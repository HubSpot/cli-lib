const http = require('http');
const path = require('path');
const chokidar = require('chokidar');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../logger');
const {
  ApiErrorContext,
  logApiErrorInstance,
  logApiUploadErrorInstance,
} = require('../errorHandlers');
const { uploadFolder } = require('./uploadFolder');
const { shouldIgnoreFile, ignoreFile } = require('../ignoreRules');
const { getFileMapperQueryValues } = require('../fileMapper');
const { upload, deleteFile } = require('../api/fileMapper');
const escapeRegExp = require('./escapeRegExp');
const { convertToUnixPath, isAllowedExtension } = require('../path');
const { triggerNotify } = require('./notify');
const { getAccountConfig } = require('./config');
const { createPreviewServerRoutes } = require('./preview/createRoutes');
const { getPortalDomains } = require('./preview/previewUtils');
const { markRemoteFsDirty } = require('./preview/routes/meta');
const { startShadowDevServer } = require('./preview/shadowDevServer')
const { createHttpsRedirectingServer } = require('./preview/httpsRedirectingServer');

async function uploadFile(accountId, sessionToken, src, dest) {
  logger.debug(`Attempting to upload file "${src}" to "${dest}"`);
  const fileMapperArgs = buildFileMapperArgs(sessionToken);

  try {
    await upload(accountId, src, dest, fileMapperArgs);
    logger.log(`Uploaded file ${src} to ${dest}`);
    markRemoteFsDirty();
  } catch {
    const uploadFailureMessage = `Uploading file ${src} to ${dest} failed`;
    logger.debug(uploadFailureMessage);
    logger.debug(`Retrying to upload file "${src}" to "${dest}"`);
    try {
      await upload(accountId, src, dest, fileMapperArgs);
      markRemoteFsDirty();
    } catch (error) {
      logger.error(uploadFailureMessage);
      logApiUploadErrorInstance(
        error,
        new ApiErrorContext({
          accountId,
          request: dest,
          payload: src,
        })
      );
    }
  }
};

async function deleteRemoteFile(accountId, sessionToken, remoteFilePath) {
  logger.debug(`Attempting to delete file "${remoteFilePath}"`);
  const fileMapperArgs = buildFileMapperArgs(sessionToken);

  try {
    await deleteFile(accountId, remoteFilePath, fileMapperArgs);
    logger.log(`Deleted file ${remoteFilePath}`);
    markRemoteFsDirty();
  } catch (error) {
    logger.error(`Deleting file ${remoteFilePath} failed`);
    logger.debug(`Retrying deletion of file ${remoteFilePath}`)
    try {
      await deleteFile(acccountId, remoteFilePath, fileMapperArgs);
      markRemoteFsDirty();
    } catch (error) {
      logger.error(`Deleting file ${remoteFilePath} failed`);
      logApiErrorInstance(
        error,
        new ApiErrorContext({
          accountId,
          request: remoteFilePath,
        })
      );
    }
  }
}

const getDesignManagerPath = (src, dest, file) => {
  const regex = new RegExp(`^${escapeRegExp(src)}`);
  const relativePath = file.replace(regex, '');
  return convertToUnixPath(path.join(dest, relativePath));
};

const buildFileMapperArgs = (sessionToken) => {
  return getFileMapperQueryValues({
    mode: 'publish',
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
    const deletePromise = deleteRemoteFile(accountId, filePath, remotePath)
    triggerNotify(notify, 'Removed', filePath, deletePromise);
  }
}

const buildUploadFileToPreviewBufferCallback = (sessionInfo, notifyMessage) => {
  const { portalId, src, dest, sessionToken, notify } = sessionInfo;

  return async (filePath) => {
    if (!isAllowedExtension(filePath)) {
      logger.debug(`Skipping ${filePath} due to unsupported extension`);
      return;
    }
    if (shouldIgnoreFile(filePath)) {
      logger.debug(`Skipping ${filePath} due to an ignore rule`);
      return;
    }
    const destPath = getDesignManagerPath(src, dest, filePath);
    const fileMapperArgs = buildFileMapperArgs(sessionToken)
    const uploadPromise = uploadFile(portalId, sessionToken, filePath, destPath);
    triggerNotify(notify, notifyMessage, filePath, uploadPromise);
  }
}

const initialPreviewBufferUpload = async (sessionInfo, filePaths) => {
  const { portalId, sessionToken, src, dest } = sessionInfo
  const fileMapperArgs = buildFileMapperArgs(sessionToken);
  return uploadFolder(portalId, src, dest, fileMapperArgs, {}, filePaths);
}


const startPreviewWatcher = async (sessionInfo) => {
  const { src } = sessionInfo;
  let watcherIsReady = false;

  const watcher = chokidar.watch(src, {
    ignoreInitial: true, // makes initial addition of files not trigger the watcher
    ignored: file => shouldIgnoreFile(file),
  });

  const addFileCallback = buildUploadFileToPreviewBufferCallback(sessionInfo, 'Added');
  const changeFileCallback = buildUploadFileToPreviewBufferCallback(sessionInfo, 'Change');
  const deleteFileCallback = buildDeleteFileFromPreviewBufferCallback(sessionInfo, 'file');
  const deleteFolderCallback = buildDeleteFileFromPreviewBufferCallback(sessionInfo, 'folder');

  watcher.on('ready', () => {
    console.log('Local file watching service has started!');
    watcherIsReady = true;
  });
  watcher.on('add', addFileCallback);
  watcher.on('change', changeFileCallback);
  watcher.on('unlink', deleteFileCallback);
  watcher.on('unlinkDir', deleteFolderCallback);

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  while (!watcherIsReady) {
    await sleep(1)
    // do nothing... surely there's a better way to do this...
  }
  return watcher;
}

const createLocalHttpServer = async (sessionInfo) => {
  const expressServer = express();
  //expressServer.use(bodyParser.json());
  expressServer.use('/', await createPreviewServerRoutes(sessionInfo));

  return expressServer;
}

const preview = async (
  accountId,
  src,
  dest,
  { notify, filePaths, skipUpload, noSsl, port }
) => {`x`
  const accountConfig = getAccountConfig(accountId);
  const domains = await getPortalDomains(accountId);
  const sessionToken = 'test' // uuidv4();
  const PORT = port || 3000;
  const protocol = noSsl ? 'http' : 'https';

  const sessionInfo = {
    src,
    dest: `@preview/${sessionToken}/${dest}`,
    portalName: accountConfig.name,
    portalId: accountId,
    env: accountConfig.env,
    personalAccessKey: accountConfig.personalAccessKey,
    // we find hublet later in the content metadata fetch
    // can we get that ahead of time? hardcoding it for now
    hublet: 'na1',
    sessionToken,
    domains,
    PORT,
    protocol,
  }

  if (notify) {
    ignoreFile(notify);
  }

  if (!skipUpload) {
    await initialPreviewBufferUpload(sessionInfo, filePaths);
  }
  const expressServer = await createLocalHttpServer(sessionInfo);
  const previewWatcher = await startPreviewWatcher(sessionInfo);

  if (!noSsl) {
    const { server, innerHTTPServer, innerHTTPSServer } = await createHttpsRedirectingServer(expressServer, domains);
    server.listen(PORT);
  } else {
    const httpServer = http.createServer(expressServer);
    httpServer.listen(PORT);
  }
  startShadowDevServer(sessionInfo);
  console.log(`HubSpot preview local dev server hosting at ${protocol}://hslocal.net:${PORT}, portalId=${accountId}`)
}

module.exports = {
  preview,
};
