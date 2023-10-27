const http = require('../../../http')
const { fetchModulesByPath, fetchModuleBuffer } = require('../../../api/designManager');
const { addRefreshScript, getPreviewUrl } = require('../previewUtils');

const buildModuleRouteHandler = (sessionInfo) => {
  const { portalId } = sessionInfo;

  return async (req, res) => {
    const { modulePath } = req.params;
    if (!modulePath) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildModuleIndex());
      return;
    }
    const customWidgetInfo = await fetchModulesByPath(portalId, `${sessionInfo.dest}/modules/${modulePath}.module`);
    if (!('moduleId' in customWidgetInfo && 'previewKey' in customWidgetInfo)) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildErrorIndex());
      return;
    }
    const params = {
      module_id: customWidgetInfo.moduleId,
      hs_preview_key: customWidgetInfo.previewKey,
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
