const { Router } = require('express');

const { buildIndexRouteHandler } = require('./routes/index.js');
const { buildProxyRouteHandler } = require('./routes/proxy.js');

const createPreviewServerRoutes = async (sessionInfo) => {
    const previewServerRouter = Router();
    previewServerRouter.get('/', buildIndexRouteHandler(sessionInfo))
    previewServerRouter.get('/proxy', buildProxyRouteHandler(sessionInfo))
    return previewServerRouter;
}

module.exports = {
  createPreviewServerRoutes,
}
