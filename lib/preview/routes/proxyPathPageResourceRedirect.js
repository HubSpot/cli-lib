const fetch = require('node-fetch-commonjs');
const { isInternalCMSRoute } = require('../previewUtils');

const proxyPathPageResourceRedirect = (req, res, next) => {
  const isAHtmlRequest = req.accepts().includes('text/html');

  // proxy when referer's path is /proxy and has page query param
  let proxyPageUrl;
  let refererUrl;
  try {
    refererUrl = new URL(req.headers.referer);
    proxyPageUrl = new URL(
      new URL(req.headers.referer).searchParams.get('page')
    );
  } catch (e) {
    next();
    return;
  }
  if (!refererUrl.pathname.startsWith('/proxy')) {
    next();
    return;
  }

  // handle anchor links unless internal CMS route
  if (isAHtmlRequest && !isInternalCMSRoute(req)) {
    const encodedPageUrl = encodeURIComponent(
      `${proxyPageUrl.origin}${req.url}`
    );
    res.redirect(`/proxy?page=${encodedPageUrl}`);
    return;
  }

  const urlToProxy = `https://${proxyPageUrl.host}${req.url}`;
  fetch(urlToProxy)
    .then(response => response.body.pipe(res)) // https://github.com/node-fetch/node-fetch#bodybody
    .catch(err => console.error(err));
}

module.exports = {
  proxyPathPageResourceRedirect,
}