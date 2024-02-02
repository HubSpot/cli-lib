const { fetchPlatformVersions } = require('../api/developerProjects');

const fetchDefaultVersion = async accountId => {
  const platformVersions = await fetchPlatformVersions(accountId);
  return platformVersions.defaultPlatformVersion;
};

module.exports = {
  fetchDefaultVersion,
};
