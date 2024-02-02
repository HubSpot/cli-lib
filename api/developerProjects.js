const http = require('../http');

const DEVELOPER_PROJECTS_API_PATH = 'developer/projects/v1';

/**
 * Fetch default project platform version along with list of active platform versions
 *
 * @async
 * @returns {Promise}
 */
async function fetchPlatformVersions(accountId) {
  return http.get(accountId, {
    uri: `${DEVELOPER_PROJECTS_API_PATH}/platformVersion`,
  });
}

module.exports = {
  fetchPlatformVersions,
};
