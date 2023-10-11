const http = require('http')
const { fetchModulesByPath, fetchModuleBuffer } = require('../../../api/designManager');
const { getPreviewUrl } = require('../previewUtils');


const buildModuleRouteHandler = (sessionInfo) => {
  const { portalId } = sessionInfo;

  return async (req, res) => {
    const { name } = req.params;
    if (!name) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildModuleIndex());
      return;
    }
    const customWidgetInfo = await fetchModulesByPath(portalId, `${sessionInfo.dest}/modules/${name}.module`);
    if (!('moduleId' in customWidgetInfo && 'previewKey' in customWidgetInfo)) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildErrorIndex());
      return;
    }
    const params = {
      module_id: customWidgetInfo.moduleId,
      //is_buffered: true,
      //portalId: portalId,
      //language: 'en',
      hs_preview_key: customWidgetInfo.previewKey,
      //hsPreviewerApp: 'module',
      //updated:
    }
    const previewUrl = getPreviewUrl(sessionInfo, params);
    console.log(previewUrl)
    res.redirect(previewUrl);
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
