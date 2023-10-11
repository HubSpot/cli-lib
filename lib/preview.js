const http = require('http');
const path = require('path');
const chokidar = require('chokidar');
const express = require('express');
const { default: PQueue } = require('p-queue');

const { logger } = require('../logger');
const debounce = require('debounce');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
  logErrorInstance,
} = require('../errorHandlers');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile, ignoreFile } = require('../ignoreRules');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload, deleteFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension, getCwd } = require('../path');
const { triggerNotify } = require('./notify');
const { getAccountConfig } = require('./config');
const { createPreviewServerRoutes } = require('./preview/createRoutes');
const { getPortalDomains } = require('./preview/previewUtils');

async function uploadFile(accountId, sessionToken, file, dest) {
  logger.debug(`Attempting to upload file "${src}" to "${dest}"`);
  const fileMapperArgs = buildFileMapperArgs(sessionToken);

  return queue.add(() => {
    return upload(accountId, src, dest, fileMapperArgs)
      .then(() => {
        logger.log(`Uploaded file ${src} to ${dest}`);
        notifyPreviewUrl(accountId, sessionToken);
      })
      .catch(() => {
        const uploadFailureMessage = `Uploading file ${src} to ${dest} failed`;
        logger.debug(uploadFailureMessage);
        logger.debug(`Retrying to upload file "${src}" to "${dest}"`);
        return upload(accountId, file, dest, fileMapperArgs).catch(error => {
          logger.error(uploadFailureMessage);
          logApiUploadErrorInstance(
            error,
            new ApiErrorContext({
              accountId,
              request: dest,
              payload: src,
            })
          );
        });
      });
  });
}

async function deleteRemoteFile(accountId, sessionToken, remoteFilePath) {
  logger.debug(`Attempting to delete file "${remoteFilePath}"`);
  const fileMapperArgs = buildFileMapperArgs(sessionToken);

  return queue.add(() => {
    return deleteFile(accountId, remoteFilePath, fileMapperArgs)
      .then(() => {
        logger.log(`Deleted file ${remoteFilePath}`);
        notifyPreviewUrl(accountId, sessionToken);
      })
      .catch(error => {
        logger.error(`Deleting file ${remoteFilePath} failed`);
        logApiErrorInstance(
          error,
          new ApiErrorContext({
            accountId,
            request: remoteFilePath,
          })
        );
      });
  });
}

const getDesignManagerPath = (src, dest, file) => {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const relativePath = file.replace(regex, '');
  return convertToUnixPath(path.join(dest, relativePath));
};

const buildFileMapperArgs = (sessionToken) => {
  return getFileMapperQueryValues({
    mode: 'publish',
    //previewSession: sessionToken
  });
}

const buildDeleteFileFromPreviewBufferCallback = (sessionInfo, type) => {
  const { accountId, src, dest, notify } = sessionInfo;

  return (filePath) => {
    if (shouldIgnoreFile(filePath)) {
      logger.debug(`Skipping ${filePath} due to an ignore rule`);
      return;
    }

    const remotePath = getDesignManagerPath(src, dest, filePath);
    logger.debug(`Attempting to delete ${type} "${remotePath}"`, type, remotePath);
    queue.add(() => {
      const deletePromise = deleteRemoteFile(accountId, filePath, remotePath)
        .then(() => {
          logger.log(`Deleted ${type} "${remotePath}"`);
        })
        .catch(error => {
          logger.error(`Deleting ${type} "${remotePath}" failed`);
          logApiErrorInstance(
            error,
            new ApiErrorContext({
              accountId,
              request: remotePath,
            })
          );
        });
      triggerNotify(notify, 'Removed', filePath, deletePromise);
      return deletePromise;
    });
  }
}

const buildUploadFileToPreviewBufferCallback = (sessionInfo, notifyMessage) => {
  const { accountId, src, sessionToken, notify } = sessionInfo;

  return async (filePath) => {
    if (!isAllowedExtension(filePath)) {
      logger.debug(`Skipping ${filePath} due to unsupported extension`);
      return;
    }
    if (shouldIgnoreFile(filePath)) {
      logger.debug(`Skipping ${filePath} due to an ignore rule`);
      return;
    }
    const destPath = getDesignManagerPath(sessionInfo, filePath);
    const fileMapperArgs = buildFileMapperArgs(sessionToken)
    const uploadPromise = uploadFile(accountId, filePath, destPath, {
      src,
      fileMapperArgs,
      commandOptions,
    });
    triggerNotify(notify, notifyMessage, filePath, uploadPromise);
  }
}

const initialPreviewBufferUpload = async (sessionInfo, filePaths) => {
  const { portalId, sessionToken, src, dest } = sessionInfo
  const fileMapperArgs = buildFileMapperArgs(sessionToken);
  // Use uploadFolder so that failures of initial upload are retried
  console.log(`Uploading ${portalId} ${src} ${dest} ${fileMapperArgs} ${filePaths}`)
  const result = await uploadFolder(portalId, src, dest, fileMapperArgs, {}, filePaths);
  console.log(result);
}

const startPreviewWatchingService = (sessionInfo) => {
  const { src } = sessionInfo;

  const watcher = chokidar.watch(src, {
    ignoreInitial: true, // makes initial addition of files not trigger the watcher
    ignored: file => shouldIgnoreFile(file),
  });


  const addFileCallback = buildUploadFileToPreviewBufferCallback(sessionInfo, 'Added');
  const changeFileCallback = buildUploadFileToPreviewBufferCallback(sessionInfo, 'Change');
  const deleteFileCallback = buildDeleteFileFromPreviewBufferCallback(sessionInfo, 'file');
  const deleteFolderCallback = buildDeleteFileFromPreviewBufferCallback(sessionInfo, 'folder');

  watcher.on('ready', () => {
    logger.log(
      `This is the message that displays when previewing begins.`
    );
  });
  watcher.on('add', addFileCallback);
  watcher.on('change', changeFileCallback);
  watcher.on('unlink', deleteFileCallback);
  watcher.on('unlinkDir', deleteFolderCallback);

  return watcher;
}

const startLocalHttpService = async (sessionInfo) => {
  const expressServer = express();
  //expressServer.use(bodyParser.json());
  expressServer.use('/', await createPreviewServerRoutes(sessionInfo));

  const httpServer = http.createServer(expressServer);
  httpServer.listen(3000);
  console.log('Now listening on port 3000');
  return httpServer;
}

const preview = async (
  accountId,
  src,
  dest,
  { notify, filePaths, skipInitial }
) => {
  const accountConfig = getAccountConfig(accountId);
  const domains = await getPortalDomains(accountId);
  const sessionInfo = {
    src,
    dest,
    portalName: accountConfig.name,
    portalId: accountId,
    env: accountConfig.env,
    personalAccessKey: accountConfig.personalAccessKey,
    hublet: 'na1', // we find this when getting content metadata during page preview, can we get that ahead of time?
    sessionToken: Date.now(),
    domains,
  }

  if (notify) {
    ignoreFile(notify);
  }

  if (!skipInitial) {
    await initialPreviewBufferUpload(sessionInfo, filePaths);
  }
  startPreviewWatchingService(sessionInfo);
  startLocalHttpService(sessionInfo);

}

module.exports = {
  preview,
};
