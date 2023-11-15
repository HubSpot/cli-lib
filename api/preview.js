const { get } = require('../http');
const http = require('http');
const https = require('https');
const { getAccountId } = require('../lib/config');

const CONTENT_API_PATH = `/content/api/v4/contents`;

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

const requestContentPreview = async (url, portalId) => {
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

  const accountId = getAccountId(portalId);

  const response = await get(accountId, {
    baseUrl: urlObject.origin,
    uri: urlObject.pathname,
    query: proxiedQueryParams,
    json: false,
    resolveWithFullResponse: true,
  });

  return response;
};

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

const fetchContentMetadata = async (url, portalId) => {
  let res;
  if (url.includes('hs_preview')) {
    res = await requestContentPreview(url, portalId);
  } else {
    res = await requestPage(url);
  }

  const portalIdHeader = res.headers['x-hs-hub-id'];
  const contentId = res.headers['x-hs-content-id'];

  if (Array.isArray(portalIdHeader) || Array.isArray(contentId)) {
    throw new Error(
      `There were multiple hub ID or content ID headers in the HEAD request to ${url}`
    );
  } else {
    const portalIdFromResponse = parseInt(portalIdHeader, 10);
    const pageAccount = await getAccountId(portalIdFromResponse);

    if (!pageAccount) {
      throw new Error(
        `No CLI auth for portal ${portalIdFromResponse} found, please run \`hs auth\``
      );
    }

    if (res.statusCode !== 200) {
      throw new Error(
        `${res.statusCode} ${
          res.statusMessage
        } - Unable to obtain HEAD information from ${url}. ${
          res.statusCode === 429 && res.headers['retry-after']
            ? `Retry after ${res.headers['retry-after']} seconds.`
            : ''
        }`
      );
    } else if (!portalId || !contentId) {
      throw new Error(
        `Missing hub ID or content ID headers on HEAD request to ${url}`
      );
    } else if (isNaN(portalId)) {
      throw new Error(
        `Hub ID from the HEAD request is not a number: '${portalId}' (${url})`
      );
    }

    // TODO, the hubs-hublets/hublets/find/<portalId> API is internal auth only.🤔...
    // Prior implementation of fetchHubletForPortalId that would work execept for an internal auth issue:
    // https://git.hubteam.com/HubSpot/cms-js-platform/blob/ef6e8029df6c09fe30d65a80073606f41ca324a6/cms-dev-server/src/proxyPage/fetchHubletForPortalId.ts
    //
    // const hublet = await fetchHubletForPortalId(portalId);

    const hublet = 'na1';

    return { portalId, contentId, hublet };
  }
};

module.exports = {
  fetchPreviewInfo,
  fetchContentMetadata,
};
