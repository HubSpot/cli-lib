const { fetchDomains } = require('../../api/domains');
const { getDirectoryContentsByPath } = require('../../api/fileMapper');

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
  setInterval(() => {
    const res = fetch('/meta')
      .then(async (res) => {
        const hsServerState = await res.json();
        if (hsServerState["REMOTE_FS_IS_DIRTY"]) {
          location.reload();
        }
      })
      .catch(err => console.log(err));
  }, 1000);
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
const HCMS_PATH = '/_hcms/';
const HS_FS_PATH = '/hs-fs/';
const HUB_FS_PATH = '/hubfs/';

const isInternalCMSRoute = (req) =>
  req.path.startsWith(HCMS_PATH) ||
  req.path.startsWith(HS_FS_PATH) ||
  req.path.startsWith(HUB_FS_PATH);

const silenceConsoleWhile = async (act, ...args) => {
  const tmpConsole = console;
  console = { log: () => {} }
  const result = await act(...args);
  console = tmpConsole;
  return result;
}

module.exports = {
  isInternalCMSRoute,
  VALID_PROXY_DOMAIN_SUFFIXES,
  getSubDomainFromValidLocalDomain,
  getPortalDomains,
  getModules,
  getTemplates,
  getPreviewUrl,
  addRefreshScript,
  silenceConsoleWhile
}
