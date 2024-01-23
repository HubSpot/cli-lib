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
    const { portalId } = sessionInfo;
    // TODO change error.stack to error.message before we publish
    res
      .status(500)
      .end(
        `Failed proxy render of page ${urlToProxy} hub id = ${portalId}\n\n${error.stack}`
      );
    return;
  }
}

module.exports = {
  proxyPage
}
