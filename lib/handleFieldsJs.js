const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { isModuleFolderChild } = require('../modules');
const escapeRegExp = require('./escapeRegExp');
const { logger } = require('../logger');
const { FieldsJs } = require('./FieldsJs');

async function handleMultipleFieldsJs(
  filePaths,
  projectRoot,
  saveOutput,
  fieldOptions
) {
  const tempDirPath = createTmpDirSync('hubspot-temp-fieldsjs-output-');

  const fieldsJs = filePaths.map(
    path => new FieldsJs(projectRoot, path, fieldOptions)
  );

  const destPaths = await Promise.all(
    fieldsJs.map(async fjs => {
      const jsonOutput = await fjs.convert();
      const writePath = fjs.getWritePath(tempDirPath);

      if (!jsonOutput) throw new Error();

      fs.writeFileSync(writePath, jsonOutput);

      if (saveOutput) {
        const saveWritePath = fjs.getWritePath(projectRoot);
        fs.copyFileSync(writePath, saveWritePath);
      }
      return writePath;
    })
  ).catch(err => {
    console.log('err', err);
    throw new Error(err);
  });

  if (!destPaths) {
    throw new Error();
  }

  return [destPaths, tempDirPath];
}

async function handleFieldsJs(filePath, projectRoot, saveOutput, fieldOptions) {
  const [destPaths, tempDirPath] = await handleMultipleFieldsJs(
    [filePath],
    projectRoot,
    saveOutput,
    fieldOptions
  );
  if (destPaths.length === 1) {
    return [destPaths[0], tempDirPath];
  }
  throw new Error();
}

/**
 * Determines if file is a convertable fields.js file i.e., if it is called
 * 'fields.js' and in a root or in a module folder, and if convertFields flag is true.
 * @param {string} rootDir - The root directory of the project where the file is
 * @param {string} filePath - The file to check
 * @param {Boolean} convertFields - The convertFields flag option value
 */
function isConvertibleFieldJsFile(rootDir, filePath, convertFields = false) {
  const allowedFieldsNames = ['fields.js', 'fields.mjs', 'fields.cjs'];
  const regex = new RegExp(`^${escapeRegExp(rootDir)}`);
  const relativePath = path.dirname(filePath.replace(regex, ''));
  const baseName = path.basename(filePath);
  const inModuleFolder = isModuleFolderChild({ path: filePath, isLocal: true });
  return !!(
    convertFields &&
    allowedFieldsNames.includes(baseName) &&
    (inModuleFolder || relativePath == '/')
  );
}

/**
 * Determines if a fields js is present in a directory
 * 'fields.js' and in a root or in a module folder, and if convertFields flag is true.
 * @param {string} dir - The directory to search for a fields js
 */
function isFieldsJsPresent(dir) {
  const filesInDir = fs.readdirSync(dir);
  return (
    filesInDir.filter(file => isConvertibleFieldJsFile(dir, file)).length > 0
  );
}

/**
 * Try cleaning up resources from os's tempdir
 * @param {String} prefix - Prefix for directory name.
 */
function createTmpDirSync(prefix) {
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  } catch (err) {
    logger.error('An error occured writing temporary project source.');
  }
  return tmpDir;
}

/**
 * Try cleaning up resources from os's tempdir
 * @param {String} tmpDir
 */
function cleanupTmpDirSync(tmpDir) {
  fs.rm(tmpDir, { recursive: true }, err => {
    if (err) {
      logger.error('There was an error deleting the temporary project source');
    }
  });
}

module.exports = [
  handleMultipleFieldsJs,
  handleFieldsJs,
  isConvertibleFieldJsFile,
  isFieldsJsPresent,
  createTmpDirSync,
  cleanupTmpDirSync,
];
