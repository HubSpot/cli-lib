const { fetchDomains } = require('../../api/domains');
const { getDirectoryContentsByPath } = require('../../api/fileMapper');

const getPortalDomains = async (portalId) => {
  try {
    const result = await fetchDomains(portalId);
    return result;
  } catch (error) {
    console.log("There was a problem fetching domains for your portal. You may be missing a scope necessary for this feature.")
    return [];
  }
}

const getModules = async (sessionInfo) => {
  const modulesPath = `${sessionInfo.dest}/modules`;
  return getDirectoryContentsByPath(sessionInfo.portalId, modulesPath)
    .then(response => response.children)
    .catch(err => null);
}

const getTemplates = async (sessionInfo) => {
  const templatesPath = `${sessionInfo.dest}/templates`;
  return getDirectoryContentsByPath(sessionInfo.portalId, templatesPath)
    .then(response => response.children)
    .catch(err => null);
}

const getPreviewUrl = (sessionInfo, queryParams) => {
  const { portalId, env, hublet } = sessionInfo;

  return `http://${portalId}.hubspotpreview${
    env === 'qa' ? 'qa' : ''
  }-${hublet}.com/_hcms/preview/template/multi?${stringifyQuery(queryParams)}`;
}

const stringifyQuery = (query) => {
  return Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join('&');
}
module.exports = {
  getPortalDomains,
  getModules,
  getTemplates,
  getPreviewUrl
}
