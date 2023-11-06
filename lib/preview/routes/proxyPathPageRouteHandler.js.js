const { fetchContentMetadata } = require('../../../api/preview');
const { proxyPage } = require('../proxyPage');
const { trackPreviewEvent } = require('../previewUtils');

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
      console.warn(message);
      return res.status(400).send(message);
    }
    // validate proxy page URL query params
    if (proxyPageUrl.searchParams.has('hs_preview')) {
      const message = `Can't make a proxy request, you cannot proxy URLs that include internal query params like hs_preview`;
      console.warn(message);
      return res.status(400).send(message);
    }
    trackPreviewEvent('proxy-path-route');
    try {
      const { portalId, contentId, hublet } = await fetchContentMetadata(
        proxyPageUrl.href,
        sessionInfo.portalId
      )

      await proxyPage(
        res,
        portalId,
        hublet,
        contentId,
        proxyPageUrl.href
      );
    } catch (e) {
      const message = `Failed to fetch proxy page for ${proxyPageUrl.href}`;
      return res.status(400).send(message);
    }
  }
}

const buildProxyIndex = () => {
  // If we want to embed a script or something into the proxy
  // we can wrap it here or parse the returned HTML into the render
  // but that's maybe trickier...
  return `
    <!DOCTYPE html>
    <head>
    </head>
		<body>
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
		</body>
  `;
}




module.exports = {
  buildProxyRouteHandler
}
