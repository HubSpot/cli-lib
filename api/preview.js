async function fetchPreviewRender(url, sessionInfo) {
  const { sessionToken } = sessionInfo;

  const urlObject = new URL(url);

  urlObject.searchParams.append('localPreviewToken', sessionToken);
  urlObject.searchParams.append('hsCacheBuster', Date.now());

  return fetch(urlObject.href).then(res => res.text());
}

module.exports = {
  fetchPreviewRender,
};
