const { Router } = require('express');

const { buildIndexRouteHandler } = require('./routes/index.js');
const { buildProxyRouteHandler } = require('./routes/proxy.js');
const { buildModuleRouteHandler } = require('./routes/module.js');
const { buildTemplateRouteHandler } = require('./routes/template.js');
const { buildMetaRouteHandler } = require('./routes/meta.js');

const { proxyResourceRedirectHandler } = require('./routes/proxyResourceRedirect.js');

const createPreviewServerRoutes = async (sessionInfo) => {
    const previewServerRouter = Router();
    previewServerRouter.get('/proxy', buildProxyRouteHandler(sessionInfo));
    previewServerRouter.get('/module/:modulePath', buildModuleRouteHandler(sessionInfo));
    previewServerRouter.get('/template/:templatePath', buildTemplateRouteHandler(sessionInfo));
    previewServerRouter.get('/meta', buildMetaRouteHandler(sessionInfo));

    previewServerRouter.get('/*', proxyResourceRedirectHandler);
    previewServerRouter.post('/*', proxyResourceRedirectHandler);
    previewServerRouter.delete('/*', proxyResourceRedirectHandler);
    previewServerRouter.head('/*', proxyResourceRedirectHandler);
    previewServerRouter.put('/*', proxyResourceRedirectHandler);
    previewServerRouter.options('/*', proxyResourceRedirectHandler);

    previewServerRouter.get('/', buildIndexRouteHandler(sessionInfo));

    return previewServerRouter;
}

module.exports = {
  createPreviewServerRoutes,
}
