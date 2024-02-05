const { Router } = require('express');
const { logger } = require('./../../logger');

const { buildIndexRouteHandler } = require('./routes/index.js');
const { buildModuleRouteHandler } = require('./routes/module.js');
const { buildTemplateRouteHandler } = require('./routes/template.js');
const { buildMetaRouteHandler } = require('./routes/meta.js');

const { buildProxyRouteHandler } = require('./routes/proxyPathPageRouteHandler.js');
const { buildProxyPageRouteHandler } = require('./routes/proxyPageRouteHandler.js');
const { proxyPathPageResourceRedirect } = require('./routes/proxyPathPageResourceRedirect.js');
const { proxyPageResourceRedirect } = require('./routes/proxyPageResourceRedirect.js');

const createPreviewServerRoutes = async (sessionInfo) => {
    const previewServerRouter = Router();
    previewServerRouter.get('/proxy', buildProxyRouteHandler(sessionInfo));
    previewServerRouter.get('/module/:modulePath(*)', buildModuleRouteHandler(sessionInfo));
    previewServerRouter.get('/template/:templatePath(*)', buildTemplateRouteHandler(sessionInfo));
    // fetches server metadata from the client (used by refresh script to check if fs has been changed)
    previewServerRouter.get('/meta', buildMetaRouteHandler(sessionInfo));
    // handles resources on the proxied page, so a fetch from relative path gets proxied too
    previewServerRouter.get('/*', proxyPathPageResourceRedirect)
    previewServerRouter.get('/*', proxyPageResourceRedirect);
    previewServerRouter.post('/*', proxyPageResourceRedirect);
    previewServerRouter.delete('/*', proxyPageResourceRedirect);
    previewServerRouter.head('/*', proxyPageResourceRedirect);
    previewServerRouter.put('/*', proxyPageResourceRedirect);
    previewServerRouter.options('/*', proxyPageResourceRedirect);
    previewServerRouter.get('/*', buildProxyPageRouteHandler(sessionInfo));
    // index route
    previewServerRouter.get('/', buildIndexRouteHandler(sessionInfo));

    return previewServerRouter;
}

module.exports = {
  createPreviewServerRoutes,
}
