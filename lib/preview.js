const path = require('path');
const chokidar = require('chokidar');
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

const queue = new PQueue({
  concurrency: 10,
});

const generatePreviewUrl = (accountId, sessionToken) => {
  return `https://app.hubspot.com/${accountId}/preview/${sessionToken}`;
}

const _notifyPreviewUrl = (accountId, sessionToken) => {
  if (queue.size > 0) return;
  logger.log(`To preview, visit: ${generatePreviewUrl(accountId, sessionToken)}`);
};
const notifyPreviewUrl = debounce(_notifyPreviewUrl, 1000);

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
    mode: 'preview',
    previewSession: sessionToken
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

const initialPreviewBufferUpload = (sessionInfo, filePaths) => {
  const { accountId, sessionToken, src, dest } = sessionInfo

  const fileMapperArgs = buildFileMapperArgs(sessionToken);
  // Use uploadFolder so that failures of initial upload are retried
  uploadFolder(accountId, src, dest, fileMapperArgs, {}, filePaths)
    .then(() => {
      logger.success(
        `Completed uploading files in ${src} to ${dest} in ${accountId}`
      );
    })
    .catch(error => {
      logger.error(
        `Initial uploading of folder "${src}" to "${dest} in account ${accountId} failed`
      );
      logErrorInstance(error, {
        accountId,
      });
    });
}

const preview = (
  accountId,
  src,
  dest,
  { notify, filePaths }
) => {
  const sessionToken = Date.now();
  if (notify) {
    ignoreFile(notify);
  }
  const sessionInfo = { accountId, sessionToken, src, dest, notify };
  initialPreviewBufferUpload(sessionInfo, filePaths);

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
    notifyPreviewUrl(accountId, sessionToken);
  });
  watcher.on('add', addFileCallback);
  watcher.on('change', changeFileCallback);
  watcher.on('unlink', deleteFileCallback);
  watcher.on('unlinkDir', deleteFolderCallback);

  return watcher;
}

module.exports = {
  preview,
};
