const { Router } = require('express');

const { buildIndexRouteHandler } = require('./routes/index.js');
const { buildProxyRouteHandler } = require('./routes/proxy.js');
const { buildModuleRouteHandler } = require('./routes/module.js');
const { buildTemplateRouteHandler } = require('./routes/template.js');
const { buildMetaRouteHandler } = require('./routes/meta.js');

const createPreviewServerRoutes = async (sessionInfo) => {
    const previewServerRouter = Router();
    previewServerRouter.get('/', buildIndexRouteHandler(sessionInfo));
    previewServerRouter.get('/proxy', buildProxyRouteHandler(sessionInfo));
    previewServerRouter.get('/module/:name', buildModuleRouteHandler(sessionInfo));
    previewServerRouter.get('/template/:name', buildTemplateRouteHandler(sessionInfo));
    previewServerRouter.get('/meta', buildMetaRouteHandler(sessionInfo));
    return previewServerRouter;
}

module.exports = {
  createPreviewServerRoutes,
}
