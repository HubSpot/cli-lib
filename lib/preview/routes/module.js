const http = require('../../../http')
const { fetchModulesByPath } = require('../../../api/designManager');
const {
  addRefreshScript,
  getPreviewUrl,
  memoize,
  trackPreviewEvent,
  buildHTMLResponse
} = require('../previewUtils');
const { logger } = require('./../../../logger');

const cachedFetchModulesByPath = memoize(fetchModulesByPath);

const buildModuleRouteHandler = (sessionInfo) => {
  const { accountId, sessionToken } = sessionInfo;

  return async (req, res) => {
    trackPreviewEvent('view-module-route');

    const { modulePath } = req.params;

    if (!modulePath) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildModuleIndex());
      return;
    }

    const calculatedPath = `@preview/${sessionToken}/${modulePath}.module`;
    let customWidgetInfo;
    try {
      customWidgetInfo = await cachedFetchModulesByPath(accountId, calculatedPath);
    } catch (err) {
      logger.error(`Failed to fetch module preview for ${calculatedPath}`)
    }
    if (!customWidgetInfo || !('moduleId' in customWidgetInfo && 'previewKey' in customWidgetInfo)) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildErrorIndex());
      return;
    }
    const params = {
      module_id: customWidgetInfo.moduleId,
      hs_preview_key: customWidgetInfo.previewKey,
      updated: Date.now(),
      ...req.query
    }
    const previewUrl = new URL(getPreviewUrl(sessionInfo, params))  ;
    const result = await http.get(accountId, {
      baseUrl: previewUrl.origin,
      uri: previewUrl.pathname,
      query: params,
      json: false,
      useQuerystring: true,
    });
    const html = addRefreshScript(result)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
  }
}

const buildErrorIndex = () => buildHTMLResponse(`
  <div>
    <h2>Error</h2>
    <p>Failed to fetch module data.</p>
  </div>
`);

const buildModuleIndex = () => buildHTMLResponse(`
  <div>
    <h2>Module Index</h2>
    <p>Incomplete!</p>
  </div>
`);

module.exports = {
  buildModuleRouteHandler
}
