const request = require('request');
const {
  getSubDomainFromValidLocalDomain,
  VALID_PROXY_DOMAIN_SUFFIXES,
  isInternalCMSRoute
} = require('../previewUtils');

const proxyPageResourceRedirect = (req, res, next) => {
  const isAHtmlRequest = req.accepts().includes('text/html');

  if (
    (isAHtmlRequest && !isInternalCMSRoute(req)) ||
    VALID_PROXY_DOMAIN_SUFFIXES.includes(req.hostname)
  ) {
    next();
    return;
  }

  const domainToProxy = getSubDomainFromValidLocalDomain(req.hostname);
  const pathToProxy = req.originalUrl;
  const urlToProxy = `https://${domainToProxy}${pathToProxy}`;

  if (req.method === 'GET') {
    request(urlToProxy).pipe(res);
  } else {
    const contentType = req.headers['content-type'];
    const isSendingJSON =
      contentType && /\bjson\b/.test(req.headers['content-type'].toString());

    const headerEntries = Object.entries(req.headers).filter(([header]) =>
      // Need to reset these headers for https (and recompression/encoding?) to work properly
      !['host', 'origin', 'connection', 'content-length'].includes(
        header.toLowerCase()
      ) &&
      !header.startsWith('sec-')
    );

    let body = undefined;

    if (req.body) {
      if (isSendingJSON) {
        body = JSON.stringify(req.body);
      } else {
        body = req.body.toString();
      }
    }

    request({
      url: urlToProxy,
      method: req.method,
      headers: Object.fromEntries(headerEntries),
      body,
    }).pipe(res);
  }
}

module.exports = {
  proxyPageResourceRedirect
}
