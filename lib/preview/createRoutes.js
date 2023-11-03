const { Router } = require('express');
const cors = require('cors');
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
    previewServerRouter.get('/meta', buildMetaRouteHandler(sessionInfo));

    previewServerRouter.get('/*', proxyPathPageResourceRedirect)
    previewServerRouter.get('/*', proxyPageResourceRedirect);
    previewServerRouter.post('/*', proxyPageResourceRedirect);
    previewServerRouter.delete('/*', proxyPageResourceRedirect);
    previewServerRouter.head('/*', proxyPageResourceRedirect);
    previewServerRouter.put('/*', proxyPageResourceRedirect);
    previewServerRouter.options('/*', proxyPageResourceRedirect);
    previewServerRouter.get('/*', buildProxyPageRouteHandler(sessionInfo));

    previewServerRouter.get('/', buildIndexRouteHandler(sessionInfo));

    return previewServerRouter;
}

module.exports = {
  createPreviewServerRoutes,
}
