const { addRefreshScript } = require('./previewUtils');
const { fetchPreviewRender } = require('../../api/preview');

const proxyPage = async (
  res,
  urlToProxy,
  sessionInfo
) => {
  try {
    const pageHtml = await fetchPreviewRender(urlToProxy, sessionInfo);

    const embeddedHtml = addRefreshScript(pageHtml);
    res.status(200).set({ 'Content-Type': 'text/html' }).end(embeddedHtml);
  } catch (error) {
    const { accountId } = sessionInfo;
    res
      .status(500)
      .end(
        `Failed proxy render of page ${urlToProxy} hub id = ${accountId}\n\n${error.message}`
      );
    return;
  }
}

module.exports = {
  proxyPage
}
