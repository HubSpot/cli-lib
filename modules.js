const path = require('path');
const fs = require('fs-extra');
const { getCwd, getExt, splitHubSpotPath, splitLocalPath } = require('./path');
const { walk } = require('./lib/walk');
const { logger } = require('./logger');
const { i18n } = require('./lib/lang');
const { MODULE_EXTENSION } = require('./lib/constants');
const {
  downloadGitHubRepoContents,
  listGitHubRepoContentsAtPath,
} = require('./github');

// Matches files named module.html
const MODULE_HTML_EXTENSION_REGEX = new RegExp(
  /\.module(?:\/|\\)module\.html$/
);
// Matches files named module.css
const MODULE_CSS_EXTENSION_REGEX = new RegExp(/\.module(?:\/|\\)module\.css$/);

const isBool = x => !!x === x;

/**
 * @typedef {object} PathInput
 * @property {string} path
 * @property {boolean} isLocal
 * @property {boolean} isHubSpot
 */

/**
 * @param {PathInput} pathInput
 * @returns {boolean}
 */
const isPathInput = pathInput => {
  return !!(
    pathInput &&
    typeof pathInput.path === 'string' &&
    (isBool(pathInput.isLocal) || isBool(pathInput.isHubSpot))
  );
};

const throwInvalidPathInput = pathInput => {
  if (isPathInput(pathInput)) return;
  throw new TypeError('Expected PathInput');
};

/**
 * @param {PathInput} pathInput
 * @returns {boolean}
 */
const isModuleFolder = pathInput => {
  throwInvalidPathInput(pathInput);
  const _path = pathInput.isHubSpot
    ? path.posix.normalize(pathInput.path)
    : path.normalize(pathInput.path);
  return getExt(_path) === MODULE_EXTENSION;
};

/**
 * @param {PathInput} pathInput
 * @returns {boolean}
 * @throws {TypeError}
 */
const isModuleFolderChild = (pathInput, ignoreLocales = false) => {
  throwInvalidPathInput(pathInput);
  let pathParts = [];
  if (pathInput.isLocal) {
    pathParts = splitLocalPath(pathInput.path);
  } else if (pathInput.isHubSpot) {
    pathParts = splitHubSpotPath(pathInput.path);
  }
  const { length } = pathParts;
  // Not a child path?
  if (length <= 1) return false;
  // Check if we should ignore this file
  if (ignoreLocales && pathParts.find(part => part === '_locales')) {
    return false;
  }
  // Check if any parent folders are module folders.
  return pathParts
    .slice(0, length - 1)
    .some(part => isModuleFolder({ ...pathInput, path: part }));
};

// Ids for testing
const ValidationIds = {
  SRC_REQUIRED: 'SRC_REQUIRED',
  DEST_REQUIRED: 'DEST_REQUIRED',
  MODULE_FOLDER_REQUIRED: 'MODULE_FOLDER_REQUIRED',
  MODULE_TO_MODULE_NESTING: 'MODULE_TO_MODULE_NESTING',
  MODULE_NESTING: 'MODULE_NESTING',
};

const getValidationResult = (id, message) => ({ id, message });

/**
 * @param {PathInput} src
 * @param {PathInput} dest
 * @returns {object[]}
 */
async function validateSrcAndDestPaths(src, dest) {
  const results = [];
  if (!isPathInput(src)) {
    results.push(
      getValidationResult(ValidationIds.SRC_REQUIRED, '`src` is required.')
    );
  }
  if (!isPathInput(dest)) {
    results.push(
      getValidationResult(ValidationIds.DEST_REQUIRED, '`dest` is required.')
    );
  }
  if (results.length) {
    return results;
  }
  const [_src, _dest] = [src, dest].map(inputPath => {
    const result = { ...inputPath };
    if (result.isLocal) {
      result.path = path.resolve(getCwd(), result.path);
    } else if (result.isHubSpot) {
      result.path = path.posix.normalize(result.path);
    }
    return result;
  });
  // src is a .module folder and dest is within a module. (Nesting)
  // e.g. `upload foo.module bar.module/zzz`
  if (isModuleFolder(_src) && isModuleFolderChild(_dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_TO_MODULE_NESTING,
        '`src` is a module path and `dest` is within a module.'
      )
    );
  }
  // src is a .module folder but dest is not
  // e.g. `upload foo.module bar`
  if (isModuleFolder(_src) && !isModuleFolder(_dest)) {
    return results.concat(
      getValidationResult(
        ValidationIds.MODULE_FOLDER_REQUIRED,
        '`src` is a module path but `dest` is not.'
      )
    );
  }
  // src is a folder that includes modules and dest is within a module. (Nesting)
  if (_src.isLocal && isModuleFolderChild(_dest)) {
    const stat = await fs.stat(_src.path);
    if (stat.isDirectory()) {
      const files = await walk(_src.path);
      const srcHasModulesChildren = files.some(file =>
        isModuleFolderChild({ ..._src, path: file })
      );
      if (srcHasModulesChildren) {
        return results.concat(
          getValidationResult(
            ValidationIds.MODULE_NESTING,
            '`src` contains modules and `dest` is within a module.'
          )
        );
      }
    }
  }
  // TODO: Add local FS check for dest.isLocal to support `fetch`
  return results;
}

/**
 * Checks if the given path points to an .html file within a .module folder
 * @param {string} filePath
 * @returns {boolean}
 */
const isModuleHTMLFile = filePath => MODULE_HTML_EXTENSION_REGEX.test(filePath);

/**
 * Checks if the given path points to an .css file within a .module folder
 * @param {string} filePath
 * @returns {boolean}
 */
const isModuleCSSFile = filePath => MODULE_CSS_EXTENSION_REGEX.test(filePath);

// Strings to replace in React module files
const MODULE_STRING_TRANSFORMATIONS = [
  {
    regex: /\/\* import global styles \*\//g,
    string: 'import "./global-samplejsr.css";',
    fallback: '',
  },
  {
    regex: /\/\* Default config \*\//g,
    string:
      'export const defaultModuleConfig = { \n  moduleName: "sample_jsr", \n  version: 0, \n};',
    fallback: '',
  },
];
/**
 * createModule() helper - Takes a file and uses the constants above to transform the contents
 *  @param {string} file - the file being manipulated
 * @param {object} metaData - an object containing the module's metadata
 */

const transformFileContents = (file, metaData, getInternalVersion) => {
  const i18nKey = 'cli.commands.create.subcommands.module.errors';
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      logger.error(
        i18n(`${i18nKey}.fileReadFailure`, {
          path: file,
        })
      );
      return;
    }

    let results = data;

    MODULE_STRING_TRANSFORMATIONS.forEach(entry => {
      const replacementString = getInternalVersion
        ? entry.string
        : entry.fallback;

      results = results.replace(entry.regex, replacementString);
    });

    fs.writeFile(file, results, 'utf8', err => {
      if (err) {
        logger.error(
          i18n(`${i18nKey}.failedToWrite`, {
            path: file,
          })
        );
        return;
      }
    });

    fs.appendFile(
      file,
      'export const meta = ' + JSON.stringify(metaData, null, ' '),
      err => {
        if (err) {
          logger.error(
            i18n(`${i18nKey}.failedToWrite`, {
              path: `${dest}/index.tsx`,
            })
          );
          return;
        }
      }
    );
  });
};

/**
 * Creates a sample module in the specified destination locally
 * @param {object} moduleDefinition
 * @param {string} moduleDefinition.moduleLabel - Label for the module
 * @param {boolean} moduleDefinition.reactType - Identifies if the module is a JSR type
 * @param {Array<String>} moduleDefinition.contentTypes - List of content types that the module can be used with
 * @param {boolean} moduleDefinition.global - Identifies if the module is global
 * @param {string} name
 * @param {string} dest
 * @param {boolean} getInternalVersion - flag to get internal spec of module
 * @param {object} options
 */

const createModule = async (
  moduleDefinition,
  name,
  dest,
  getInternalVersion,
  options = {
    allowExistingDir: false,
  }
) => {
  const i18nKey = 'cli.commands.create.subcommands.module';
  const { reactType: isReactModule } = moduleDefinition;
  const folderName = name.endsWith('.module') ? name : `${name}.module`;
  const destPath = !isReactModule
    ? path.join(dest, folderName)
    : path.join(dest, `${name}`);

  if (!options.allowExistingDir && fs.existsSync(destPath)) {
    logger.error(
      i18n(`${i18nKey}.errors.pathExists`, {
        path: destPath,
      })
    );
    return;
  } else {
    logger.log(
      i18n(`${i18nKey}.creatingPath`, {
        path: destPath,
      })
    );
    fs.ensureDirSync(destPath);
  }

  logger.log(
    i18n(`${i18nKey}.creatingModule`, {
      path: destPath,
    })
  );

  // Write module meta
  const writeModuleMeta = (
    { moduleLabel, contentTypes, global, reactType },
    dest
  ) => {
    const metaData = {
      label: moduleLabel,
      css_assets: [],
      external_js: [],
      global: global,
      help_text: '',
      host_template_types: contentTypes,
      js_assets: [],
      other_assets: [],
      smart_type: 'NOT_SMART',
      tags: [],
      is_available_for_new_content: false,
    };

    if (!reactType) {
      fs.writeJSONSync(dest, metaData, { spaces: 2 });
    } else {
      transformFileContents(`${dest}/index.tsx`, metaData, getInternalVersion);
    }
  };

  // Filter out certain fetched files from the response
  const moduleFileFilter = (src, dest) => {
    const emailEnabled = moduleDefinition.contentTypes.includes('EMAIL');

    switch (path.basename(src)) {
      case 'meta.json':
        writeModuleMeta(moduleDefinition, dest);
        return false;
      case 'module.js':
      case 'module.css':
        if (emailEnabled) {
          return false;
        }
        return true;
      case 'global-samplejsr.css':
      case 'stories':
      case 'tests':
        if (getInternalVersion) {
          return true;
        }
        return false;
      default:
        return true;
    }
  };

  // Download gitHub contents to the dest directory
  const sampleAssetPath = !isReactModule
    ? 'Sample.module'
    : 'SampleReactModule';

  await downloadGitHubRepoContents(
    'HubSpot/cms-sample-assets',
    `modules/${sampleAssetPath}`,
    destPath,
    { filter: moduleFileFilter }
  );

  // Mutating React module files after fetch
  if (isReactModule) {
    writeModuleMeta(moduleDefinition, destPath);
  }
};

const listReactModules = async () => {
  const contentsResp = await listGitHubRepoContentsAtPath(
    'HubSpot/cms-sample-assets',
    'modules/'
  );
  return contentsResp;
};

module.exports = {
  isModuleFolder,
  isModuleFolderChild,
  validateSrcAndDestPaths,
  ValidationIds,
  isModuleHTMLFile,
  isModuleCSSFile,
  createModule,
  listReactModules,
};
