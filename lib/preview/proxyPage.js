const http = require('../../http');
const { fetchPreviewInfo } = require('../../api/preview');
const { addRefreshScript, memoize } = require('./previewUtils');

const cachedFetchPreviewInfo = memoize(fetchPreviewInfo);

const proxyPage = async (
  res,
  portalId,
  hublet,
  contentId,
  urlToProxy,
) => {
  try {
    const previewInfo = await cachedFetchPreviewInfo(portalId, contentId);

    const { previewKey } = previewInfo;

    const pageHtml = await makeProxyPreviewRequest(
      portalId,
      urlToProxy,
      previewKey,
      contentId
    )

    const embeddedHtml = addRefreshScript(pageHtml);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(embeddedHtml);
  } catch (error) {
    // TODO change error.stack to error.message before we publish
    response
      .status(500)
      .end(
        `Failed proxy render of page id = ${contentId} hub id = ${portalId}\n\n${error.stack}`
      );
    return;
  }
}

const makeProxyPreviewRequest = async (
  portalId,
  urlToProxy,
  previewKey,
  contentId
) => {
  const url = new URL(urlToProxy);

  let proxiedQueryParams = {};

  // Convert searchParams to object param format hsGet/request expects
  for (const queryKey of url.searchParams.keys()) {
    const values = url.searchParams.getAll(queryKey);

    if (values.length > 1) {
      proxiedQueryParams[queryKey] = values;
    } else {
      proxiedQueryParams[queryKey] = values[0];
    }
  }

  proxiedQueryParams = {
    ...proxiedQueryParams,
    hs_preview: `${previewKey}-${contentId}`,
  };

  const result = http.get(portalId, {
    baseUrl: url.origin,
    uri: url.pathname,
    query: proxiedQueryParams,
    json: false,
    useQuerystring: true,
  });

  return result.catch(error => {
    if (
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      !!error.response.body
    ) {
      return error.response.body;
    } else {
      throw error;
    }
  });

}

module.exports = {
  proxyPage
}
