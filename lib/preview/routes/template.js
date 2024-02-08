const http = require('../../../http');
const { fetchTemplatesByPath } = require('../../../api/designManager');
const { getPreviewUrl, addRefreshScript, memoize, buildHTMLResponse } = require('../previewUtils');
const { logger } = require('./../../../logger');

const cachedFetchTemplatesByPath = memoize(fetchTemplatesByPath);

const buildTemplateRouteHandler = (sessionInfo) => {
  const { accountId, sessionToken } = sessionInfo;

  return async (req, res) => {
    const { templatePath } = req.params;

    if (!templatePath) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildTemplateIndex());
      return;
    }

    const calculatedPath = `@preview/${sessionToken}/${templatePath}`;
    let templateInfo;
    try {
      templateInfo = await cachedFetchTemplatesByPath(accountId, calculatedPath);
    } catch (err) {
      logger.error(`Failed to fetch template info for ${calculatedPath}: ${err}`);
    }
    if (!templateInfo || !('previewKey' in templateInfo)) {
      res.status(502).set({ 'Content-Type': 'text/html' }).end(buildErrorIndex());
      return;
    }
    const params = {
      template_file_path: calculatedPath,
      hs_preview_key: templateInfo.previewKey,
      ...req.query
    }
    const previewUrl = new URL(getPreviewUrl(sessionInfo, params));
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
    <p>Failed to fetch template data.</p>
  </div>
`)

const buildTemplateIndex = () => buildHTMLResponse(`
  <div>
    <h2>Template</h2>
    <p>Please provide a template path in the request</p>
  </div>
`)

module.exports = {
  buildTemplateRouteHandler
}
