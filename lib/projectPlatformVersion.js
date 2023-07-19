const { fetchPlatformVersions } = require('../api/developerProjects');

const fetchDefaultVersion = async accountId => {
  const platformVersions = await fetchPlatformVersions(accountId);
  return platformVersions.defaultPlatformVersion;
};

const fetchActiveVersions = async accountId => {
  const platformVersions = await fetchPlatformVersions(accountId);
  return platformVersions.activePlatformVersions;
};

module.exports = {
  fetchDefaultVersion,
  fetchActiveVersions,
};
