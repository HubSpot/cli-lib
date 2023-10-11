const http = require('http')
const { fetchTemplatesByPath } = require('../../../api/designManager');
const { getPreviewUrl } = require('../previewUtils');


const buildTemplateRouteHandler = (sessionInfo) => {
  const { portalId } = sessionInfo;

  return async (req, res) => {
    const { name } = req.params;
    if (!name) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildTemplateIndex());
      return;
    }

    const calculatedPath = `${sessionInfo.dest}/templates/${name}`;
    const templateInfo = await fetchTemplatesByPath(portalId, calculatedPath);
    if (!('previewKey' in templateInfo)) {
      res.status(502).set({ 'Content-Type': 'text/html' }).end(buildErrorIndex());
      return;
    }
    const params = {
      template_file_path: calculatedPath,
      //is_buffered: true,
      //portalId: portalId,
      //language: 'en',
      hs_preview_key: templateInfo.previewKey,
      //hsPreviewerApp: 'module',
      //updated
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
        <p>Failed to fetch template data.</p>
      </div>
    </body>
  `;
}

const buildTemplateIndex = () => {
  return `
    <!DOCTYPE html>
    <head>
    </head>
    <body>
      <div>
        <h2>Template</h2>
        <p>Provide a template path in the request</p>
      </div>
    </body>
  `;
}

module.exports = {
  buildTemplateRouteHandler
}
