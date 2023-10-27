const { fetchContentMetadata } = require('../../../api/preview');
const { proxyPage } = require('../proxyPage.js');
const {
  getSubDomainFromValidLocalDomain,
  VALID_PROXY_DOMAIN_SUFFIXES,
} = require('../previewUtils.js');

const fullOriginalUrlFromRequest = (request) => {
  return `${request.protocol}://${request.get('host')}${request.originalUrl}`;
}

const buildProxyPageRouteHandler = (sessionInfo) => {
  return async (request, response, next) => {
    if (!request.accepts().includes('text/html')) {
      return response.sendStatus(404);
    }

    const fullOriginalUrl = fullOriginalUrlFromRequest(request);
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
    const urlToProxy = `http://${domainToProxy}${request.originalUrl}`;

    try {
      const { portalId, contentId, hublet } = await fetchContentMetadata(
        urlToProxy,
        sessionInfo.portalId
      );
      console.log(urlToProxy)
      console.log(fullOriginalUrl)
      await proxyPage(
        response,
        portalId,
        hublet,
        contentId,
        urlToProxy,
        fullOriginalUrl
      );
    } catch (e) {
      next(e);
    }
  }
}

module.exports = {
  buildProxyPageRouteHandler,
}
