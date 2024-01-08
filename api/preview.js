const { get } = require('../http');
const http = require('http');
const https = require('https');

const CONTENT_API_PATH = `/content/api/v4/contents`;
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
    uri: COS_RENDER_PATH,
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

async function fetchPreviewInfo(accountId, contentId) {
  try {
    const content = await get(accountId, {
      uri: `${CONTENT_API_PATH}/${contentId}`,
      query: { portalId: accountId },
      json: true,
    });

    return {
      previewDomain: content.previewDomain ?? content.resolvedDomain,
      previewKey: content.previewKey,
    };
  } catch (err) {
    throw err;
  }
}

const requestPage = (url, redirects = 0, originalUrl = undefined) => {
  if (redirects > 5) {
    throw new Error(
      `Hit too many redirects to HEAD requests for ${originalUrl}`
    );
  }

  return new Promise((resolve, reject) => {
    const protocolAPI = url.startsWith('https://') ? https : http;
    protocolAPI
      .request(
        url,
        {
          method: 'HEAD',
          headers: {
            // Keep this user agent, so we don't get 403s from the request
            ['User-Agent']: 'cms-dev-server',
          },
        },
        async res => {
          // Use a lib to better follow various redirects?
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            console.log(`Redirecting to ${res.headers.location} (from ${url})`);
            return resolve(
              requestPage(
                res.headers.location,
                redirects + 1,
                originalUrl ?? url
              )
            );
          }

          return resolve(res);
        }
      )
      .on('error', err => {
        console.error(err);
        reject(err);
      })
      .end();
  });
};

module.exports = {
  fetchPreviewRender,
  fetchPreviewInfo,
};
