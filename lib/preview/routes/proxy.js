const { get } = require('../../../http');

const buildProxyRouteHandler = (sessionInfo) => {
  const { portalId } = sessionInfo;

  return async (req, res) => {
    const { page } = req.query;
    const result = await fetch(page);
    const responseHTML = buildProxyHtml(sessionInfo, page)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(responseHTML);
  }
}

const buildProxyHtml = (sessionInfo, page) => {
  // If we want to embed a script or something into the proxy
  // we can wrap it here or parse the returned HTML into the render
  // but that's maybe trickier...
  return `
    <!DOCTYPE html>
    <head>
    </head>
		<body>
		  <h1>${page}</h1>
		</body>
  `;
}




module.exports = {
  buildProxyRouteHandler
}
