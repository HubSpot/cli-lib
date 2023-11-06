const { fetchDomains } = require('../../api/domains');
const { getAccountId, isTrackingAllowed, getAccountConfig } = require('../config');
const { platform, release } = require('os');
const { trackUsage } = require('../../api/fileMapper');

const VALID_PROXY_DOMAIN_SUFFIXES = ['localhost', 'hslocal.net'];

const getPortalDomains = async (portalId) => {
  try {
    const result = await fetchDomains(portalId);
    return result;
  } catch (error) {
    console.log("There was a problem fetching domains for your portal. You may be missing a scope necessary for this feature.")
    return [];
  }
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

const insertAtEndOfBody = (html, script) => {
  const insertAt = (baseStr, index, insertStr) => {
    return `${baseStr.slice(0, index)}${insertStr}${baseStr.slice(index)}`;
  }
  const endOfBodyIndex = html.lastIndexOf("</body>");
  return insertAt(html, endOfBodyIndex, script);
}

const addRefreshScript = (html) => {
  const refreshScript = `
  <script>
  (() => {
    const NORMAL_WAIT_MS = 1000;
    const BACKOFF_RATIO = 2;
    let nextWait = NORMAL_WAIT_MS;
    let timeWaited = 0;

    setInterval(() => {
      timeWaited += NORMAL_WAIT_MS;
      if (timeWaited !== nextWait) return;
      timeWaited = 0;
      const res = fetch(window.location.origin + '/meta')
        .then(async (res) => {
          const hsServerState = await res.json();
          if (hsServerState["REMOTE_FS_IS_DIRTY"]) {
            location.reload();
          }
          nextWait = NORMAL_WAIT_MS;
        })
        .catch(err => {
          nextWait *= BACKOFF_RATIO;
          console.log('Disconnected from local server... (retrying in ' + nextWait / 1000 + 's)');
        });
    }, NORMAL_WAIT_MS);
  })();
  </script>
  `;
  return insertAtEndOfBody(html, refreshScript);
}

const getSubDomainFromValidLocalDomain = hostname => {
  for (const validProxyDomainSuffix of VALID_PROXY_DOMAIN_SUFFIXES) {
    if (hostname.endsWith(`.${validProxyDomainSuffix}`)) {
      return hostname.slice(0, -1 * validProxyDomainSuffix.length - 1);
    }
  }
  return undefined;
};

// From(ish) https://git.hubteam.com/HubSpot/cloudflare-workers/blob/master/worker-lib/src/Constants.ts
const internalRoutes = {
  HCMS: '/_hcms/',
  HS_FS: '/hs-fs/',
  HUB_FS: '/hubfs/'
}

const isInternalCMSRoute = (req) =>
  Object.values(internalRoutes).some((route => req.path.startsWith(route)));

const silenceConsoleWhile = async (act, ...args) => {
  const tmpConsole = console;
  console = { log: () => {} }
  const result = await act(...args);
  console = tmpConsole;
  return result;
}

const memoize = (func, cacheBustCallback) => {
  const cache = {};
  return async (...args) => {
    const stringArgs = args.toString();
    const storedResult = cache[stringArgs];
    if (storedResult && (cacheBustCallback ? !cacheBustCallback() : true)) {
      //console.log(`Cache hit ${func}`)
      return storedResult;
    }
    //console.log(`Cache miss ${func}`)
    const res = await func(...args);
    cache[stringArgs] = res;
    return res;
  }
}

const hidePreviewInDest = (previewDest) => previewDest.split('/').slice(2).join('/');

const trackPreviewEvent = async (action) => {
  if (!isTrackingAllowed()) {
    return;
  }
  const accountId = getAccountId();

  trackUsage(
    'cms-cli-usage',
    'INTERACTION',
    {
      ...{
        applicationName: 'hubspot.preview',
        os: `${platform()} ${release()}`,
        authType: getAuthType(accountId),
      },
      action,
    },
    accountId
  ).catch(
    (err) => {
      console.error(`trackUsage failed: ${err}`);
    }
  );
}

const getAuthType = (accountId) => {
  let authType = 'unknown';

  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    authType =
      accountConfig && accountConfig.authType
        ? accountConfig.authType
        : 'apikey';
  }

  return authType;
};

module.exports = {
  isInternalCMSRoute,
  VALID_PROXY_DOMAIN_SUFFIXES,
  getSubDomainFromValidLocalDomain,
  getPortalDomains,
  getPreviewUrl,
  addRefreshScript,
  silenceConsoleWhile,
  memoize,
  hidePreviewInDest,
  trackPreviewEvent
}
