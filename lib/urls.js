const { ENVIRONMENTS } = require('./constants');

const getEnvUrlString = env => {
  if (typeof env !== 'string') {
    return '';
  }

  return env.toLowerCase() === ENVIRONMENTS.QA ? ENVIRONMENTS.QA : '';
};

/**
 * @deprecated
 * Use the corresponding export from local-dev-lib
 * https://github.com/HubSpot/hubspot-local-dev-lib
 */
const getHubSpotWebsiteOrigin = env => {
  return `https://app.hubspot${getEnvUrlString(env)}.com`;
};

/**
 * @deprecated
 * Use the corresponding export from local-dev-lib
 * https://github.com/HubSpot/hubspot-local-dev-lib
 */
const getHubSpotApiOrigin = (env, useLocalHost) => {
  let domain;
  const domainOverride = process.env.HUBAPI_DOMAIN_OVERRIDE;
  if (domainOverride && typeof domainOverride === 'string') {
    domain = `${domainOverride}${getEnvUrlString(env)}`;
  }
  if (!domain || typeof domain !== 'string') {
    domain = `${useLocalHost ? 'local' : 'api'}.hubapi${getEnvUrlString(env)}`;
  }
  return `https://${domain}.com`;
};

module.exports = {
  getHubSpotWebsiteOrigin,
  getHubSpotApiOrigin,
};
