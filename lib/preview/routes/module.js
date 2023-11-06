const http = require('../../../http')
const { fetchModulesByPath } = require('../../../api/designManager');
const { addRefreshScript, getPreviewUrl, memoize } = require('../previewUtils');

const cachedFetchModulesByPath = memoize(fetchModulesByPath);

const buildModuleRouteHandler = (sessionInfo) => {
  const { portalId, sessionToken } = sessionInfo;

  return async (req, res) => {
    console.log('Fetching module preview...')
    trackPreviewEvent('view-module-route');

    const { modulePath } = req.params;

    if (!modulePath) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildModuleIndex());
      return;
    }

    const calculatedPath = `@preview/${sessionToken}/${modulePath}.module`;
    let customWidgetInfo;
    try {
      customWidgetInfo = await cachedFetchModulesByPath(portalId, calculatedPath);
    } catch (err) {
      console.log(`Failed to fetch module preview for ${calculatedPath}`)
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
    const result = await http.get(portalId, {
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

const buildErrorIndex = () => {
  return `
    <!DOCTYPE html>
    <head>
    </head>
    <body>
      <div>
        <h2>Error</h2>
        <p>Failed to fetch module data.</p>
      </div>
    </body>
  `;
}

const buildModuleIndex = () => {
  return `
    <!DOCTYPE html>
    <head>
    </head>
    <body>
      <div>
        <h2>Module Index</h2>
        <p>Incomplete!</p>
      </div>
    </body>
  `;
}

module.exports = {
  buildModuleRouteHandler
}
