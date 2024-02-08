const moment = require('moment');
const { HubSpotAuthError } = require('./lib/models/Errors');
const {
  getEnv,
  getAccountConfig,
  updateAccountConfig,
  updateDefaultAccount,
  writeConfig,
} = require('./lib/config');
const { getValidEnv } = require('./lib/environment');
const {
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('./lib/constants');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { fetchAccessToken } = require('./api/localDevAuth/unauthenticated');
const { fetchSandboxHubData } = require('./api/hubs');

const refreshRequests = new Map();

function getRefreshKey(personalAccessKey, expiration) {
  return `${personalAccessKey}-${expiration || 'fresh'}`;
}

async function getAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  accountId
) {
  let response;
  try {
    response = await fetchAccessToken(personalAccessKey, env, accountId);
  } catch (e) {
    if (e.response) {
      const errorOutput = `Error while retrieving new access token: ${e.response.body.message}`;
      throw new HubSpotAuthError(errorOutput, e.response);
    } else {
      throw e;
    }
  }
  return {
    portalId: response.hubId,
    accessToken: response.oauthAccessToken,
    expiresAt: moment(response.expiresAtMillis),
    scopeGroups: response.scopeGroups,
    enabledFeatures: response.enabledFeatures,
    encodedOauthRefreshToken: response.encodedOauthRefreshToken,
  };
}

async function refreshAccessToken(
  accountId,
  personalAccessKey,
  env = ENVIRONMENTS.PROD
) {
  const accessTokenResponse = await getAccessToken(
    personalAccessKey,
    env,
    accountId
  );
  const { accessToken, expiresAt } = accessTokenResponse
  const config = getAccountConfig(accountId);

  updateAccountConfig({
    ...config,
    portalId: accountId,
    tokenInfo: {
      accessToken,
      expiresAt: expiresAt.toISOString(),
    },
  });
  writeConfig();

  return accessTokenResponse;
}

async function getNewAccessToken(accountId, personalAccessKey, expiresAt, env, fullAPIResponse=false) {
  const key = getRefreshKey(personalAccessKey, expiresAt);
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessTokenResponse;
  try {
    const refreshAccessPromise = refreshAccessToken(
      accountId,
      personalAccessKey,
      env
    );
    if (key) {
      refreshRequests.set(key, refreshAccessPromise);
    }
    accessTokenResponse = await refreshAccessPromise;
  } catch (e) {
    if (key) {
      refreshRequests.delete(key);
    }
    throw e;
  }
  if (fullAPIResponse) {
    return accessTokenResponse;
  }
  return accessTokenResponse.accessToken;
}

async function accessTokenForPersonalAccessKey(accountId) {
  const { auth, personalAccessKey, env } = getAccountConfig(accountId);
  const authTokenInfo = auth && auth.tokenInfo;
  const authDataExists = authTokenInfo && auth.tokenInfo.accessToken;

  if (
    !authDataExists ||
    moment()
      .add(5, 'minutes')
      .isAfter(moment(authTokenInfo.expiresAt))
  ) {
    return getNewAccessToken(
      accountId,
      personalAccessKey,
      authTokenInfo && authTokenInfo.expiresAt,
      env
    );
  }

  return auth.tokenInfo.accessToken;
}
async function enabledFeaturesForPersonalAccessKey(accountId) {
  const { auth, personalAccessKey, env } = getAccountConfig(accountId);
  const authTokenInfo = auth && auth.tokenInfo;

  const accessTokenResponse = await getNewAccessToken(
    accountId,
    personalAccessKey,
    authTokenInfo && authTokenInfo.expiresAt,
    env,
    fullAPIResponse=true
  )
  return accessTokenResponse.enabledFeatures;
}


/**
 * Adds a account to the config using authType: personalAccessKey
 *
 * @param {object} configData Data containing personalAccessKey and name properties
 * @param {string} configData.personalAccessKey Personal access key string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the account being added to the config the default account
 */
const updateConfigWithPersonalAccessKey = async (configData, makeDefault) => {
  const { personalAccessKey, name, env } = configData;
  const accountEnv = env || getEnv(name);

  let token;
  try {
    token = await getAccessToken(personalAccessKey, accountEnv);
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const { portalId, accessToken, expiresAt } = token;

  let hubInfo;
  try {
    hubInfo = await fetchSandboxHubData(accessToken, portalId, accountEnv);
  } catch (err) {
    // Ignore error, returns 404 if account is not a sandbox
  }

  let sandboxAccountType = null;
  let parentAccountId = null;
  if (hubInfo) {
    if (hubInfo.type !== undefined) {
      sandboxAccountType = hubInfo.type === null ? 'STANDARD' : hubInfo.type;
    }
    if (hubInfo.parentHubId) {
      parentAccountId = hubInfo.parentHubId;
    }
  }

  const updatedConfig = updateAccountConfig({
    portalId,
    personalAccessKey,
    name,
    environment: getValidEnv(accountEnv, true),
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
    sandboxAccountType,
    parentAccountId,
  });
  writeConfig();

  if (makeDefault) {
    updateDefaultAccount(name);
  }

  return updatedConfig;
};

module.exports = {
  accessTokenForPersonalAccessKey,
  enabledFeaturesForPersonalAccessKey,
  updateConfigWithPersonalAccessKey,
  getAccessToken,
};
