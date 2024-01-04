const { fetchContentMetadata } = require('../../../api/preview');
const { proxyPage } = require('../proxyPage.js');
const {
  getSubDomainFromValidLocalDomain,
  VALID_PROXY_DOMAIN_SUFFIXES,
  memoize,
  trackPreviewEvent
} = require('../previewUtils.js');

const cachedFetchContentMetadata = memoize(fetchContentMetadata);

const buildProxyPageRouteHandler = (sessionInfo) => {
  return async (request, response, next) => {
    if (!request.accepts().includes('text/html')) {
      return response.sendStatus(404);
    }

    const domainToProxy = getSubDomainFromValidLocalDomain(request.hostname);

    if (!domainToProxy) {
      if (VALID_PROXY_DOMAIN_SUFFIXES.includes(request.hostname)) {
        next();
        return;
      } else {
        const message = `Can't make a proxy request, the domain '${request.hostname}' is not a valid proxy-able domain`;
        console.warn(message);
        return response.status(400).send(message);
      }
    }
    trackPreviewEvent('proxy-page-route')
    const urlToProxy = `http://${domainToProxy}${request.originalUrl}`;

    try {
      const { portalId, contentId, hublet } = await cachedFetchContentMetadata(
        urlToProxy,
        sessionInfo.portalId
      );

      await proxyPage(
        response,
        portalId,
        hublet,
        contentId,
        `${urlToProxy}?localPreviewToken=${sessionInfo.sessionToken}&hsCacheBuster=${Date.now()}`,
      );
    } catch (e) {
      next(e);
    }
  }
}

module.exports = {
  buildProxyPageRouteHandler,
}
