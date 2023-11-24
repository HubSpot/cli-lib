const path = require('path');
const { fork } = require('child_process');
const escapeRegExp = require('./escapeRegExp');
const { logger } = require('../logger');

/**
 * FieldsJS Class.
 * @param {string} projectDir - The root directory of the filePath
 * @param {string} pathToFieldsJs - The path to the fields.js file to be converted
 * @param {string} [fieldOptions] - (Optional) The options to be passed to the fields.js functions
 */
class FieldsJs {
  projectDir;
  pathToFieldsJs;
  rejected;
  fieldOptions;

  constructor(projectDir, pathToFieldsJs, fieldOptions = '') {
    this.projectDir = projectDir;
    this.pathToFieldsJs = pathToFieldsJs;
    this.fieldOptions = fieldOptions;
    this.rejected = false;
  }

  /**
   * Returns resulting JSON string from running a fields.js
   * @returns {Promise<string>} json - Promise that returns JSON output of the fields.js file
   */
  convert() {
    const filePath = this.pathToFieldsJs;
    const dirName = path.dirname(filePath);
    return new Promise((resolve, reject) => {
      const convertFieldsProcess = fork(
        path.join(__dirname, './processFieldsJs.js'),
        [],
        {
          cwd: dirName,
          env: {
            dirName,
            fieldOptions: this.fieldOptions,
            filePath,
          },
        }
      );
      debug(`${i18nKey}.convertFieldsJs.creating`, {
        pid: convertFieldsProcess.pid || '',
      });
      convertFieldsProcess.on('message', message => {
        if (message.action === 'ERROR') {
          reject(message.message);
        } else if (message.action === 'COMPLETE') {
          resolve(message.json);
        }
      });

      convertFieldsProcess.on('close', () => {
        debug(`${i18nKey}.convertFieldsJs.terminating`, {
          pid: convertFieldsProcess.pid || '',
        });
      });
    }).catch(e => {
      this.rejected = true;
      logger.error(
        i18n(`${i18nKey}.convertFieldsJs.errors.errorConverting`),
        filePath,
        e
      );
    });
  }

  /**
   * Resolves the relative path to the fields.js within the project directory and returns
   * directory name to write to in writeDir directory.
   *
   * Ex: If writeDir = 'path/to/temp', filePath = 'projectRoot/sample.module/fields.js'. Then getWriteDir() => path/to/temp/sample.module
   * @param {string} writeDir - Directory to resolve with respect to.
   */
  getWritePath(writeDir) {
    const projectDirRegex = new RegExp(`^${escapeRegExp(this.projectDir)}`);
    const relativePath = this.pathToFieldsJs.replace(projectDirRegex, '');
    return path.dirname(path.join(writeDir, relativePath, 'fields.json'));
  }
}

module.exports = {
  FieldsJs,
};
