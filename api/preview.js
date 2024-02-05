const { request } = require('../http');

async function fetchPreviewRender(url, sessionInfo) {
  const { sessionToken } = sessionInfo;

  const urlObject = new URL(url);

  urlObject.searchParams.append('localPreviewToken', sessionToken);
  urlObject.searchParams.append('hsCacheBuster', Date.now());

  return request(urlObject.href).then(res => res.text());
}

module.exports = {
  fetchPreviewRender,
};
