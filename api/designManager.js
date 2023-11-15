const http = require('../http');

const DESIGN_MANAGER_API_PATH = 'designmanager/v1';

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchMenus(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/menus`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchThemes(accountId, query = {}) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/themes/combined`,
    query,
  });
}

/**
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchBuiltinMapping(accountId) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
  });
}

async function fetchRawAssetByPath(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/raw-assets/by-path/${path}?portalId=${accountId}`,
  });
}

async function fetchModulesByPath(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/modules/by-path/${path}?portalId=${accountId}`
  })
}

async function fetchModulesPathStartsWith(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/modules?portalId=${accountId}&path__startswith=${path}`,
  });
}

async function fetchTemplatesByPath(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/templates/by-path/${path}?portalId=${accountId}`
  })
}

async function fetchTemplatesPathStartsWith(accountId, path) {
  return http.get(accountId, {
    uri: `${DESIGN_MANAGER_API_PATH}/templates?portalId=${accountId}&path__startswith=${path}`,
  });
}

module.exports = {
  fetchBuiltinMapping,
  fetchMenus,
  fetchRawAssetByPath,
  fetchThemes,
  fetchModulesByPath,
  fetchModulesPathStartsWith,
  fetchTemplatesByPath,
  fetchTemplatesPathStartsWith,
};
