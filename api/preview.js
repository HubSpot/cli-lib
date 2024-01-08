const { get } = require('../http');

const COS_RENDER_PATH = `/cos-rendering/v1/public`;

async function fetchPreviewRender(url, sessionInfo) {
  const { portalId, env, sessionToken } = sessionInfo;

  const urlObject = new URL(url);

  const proxiedQueryParams = {};

  // Convert searchParams to object param format hsGet/request expects
  for (const queryKey of urlObject.searchParams.keys()) {
    const values = urlObject.searchParams.getAll(queryKey);

    if (values.length > 1) {
      proxiedQueryParams[queryKey] = values;
    } else {
      proxiedQueryParams[queryKey] = values[0];
    }
  }

  return get(portalId, {
    baseUrl: `http://api.hubspot${env === 'qa' ? 'qa' : ''}.com`,
    uri: `${COS_RENDER_PATH}${urlObject.pathname}`,
    query: {
      ...proxiedQueryParams,
      portalId,
      localSessionToken: sessionToken,
      hsCacheBuster: Date.now(),
      hsDebugOverridePublicHost: urlObject.hostname,
    },
    headers: {
      Accept: "text/html"
    },
  });
}

module.exports = {
  fetchPreviewRender,
};
