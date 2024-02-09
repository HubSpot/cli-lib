const { proxyPage } = require('../proxyPage');
const { trackPreviewEvent, buildHTMLResponse } = require('../previewUtils');
const { logger } = require('./../../../logger');

const buildProxyRouteHandler = (sessionInfo) => {

  return async (req, res) => {
    if (!req.query.page) {
      res.status(200).set({ 'Content-Type': 'text/html' }).end(buildProxyIndex());
      return;
    }

    // parse proxy page URL from query param
    let proxyPageUrl;
    try {
      proxyPageUrl = new URL(req.query.page);
    } catch (e) {
      const message =
        'Please provide a valid page query parameter, e.g., http://localhost:3000/proxy?page=https://yourdomain.com/path';
      logger.warn(message);
      return res.status(400).send(message);
    }
    // validate proxy page URL query params
    if (proxyPageUrl.searchParams.has('hs_preview')) {
      const message = `Can't make a proxy request, you cannot proxy URLs that include internal query params like hs_preview`;
      logger.warn(message);
      return res.status(400).send(message);
    }
    trackPreviewEvent('proxy-path-route');
    try {
      await proxyPage(
        res,
        proxyPageUrl.href,
        sessionInfo
      );
    } catch (e) {
      const message = `Failed to fetch proxy page for ${proxyPageUrl.href}`;
      return res.status(400).send(message);
    }
  }
}

const buildProxyIndex = () => buildHTMLResponse(`
  <div>
    <h2>Local Proxy</h2>
    <form action="/proxy">
      <label htmlFor="page" style={{ display: 'block' }}>
        Page URL
      </label>
      <input
        style={{ width: '300px' }}
        name="page"
        type="text"
        placeholder="https://somecmspage.com/path"
      />
      <button style={{ display: 'block' }}>Proxy</button>
    </form>
  </div>
`);

module.exports = {
  buildProxyRouteHandler
}
