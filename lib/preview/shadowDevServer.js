const net = require('net');
const express = require('express');
const { Router } = require('express');
const cors = require("cors");

const SHADOW_PORT = 1442;

const startShadowDevServer = async (sessionInfo) => {
  const portIsTaken = await new Promise((res, rej) => {
    console.log(`Starting proxy link server on port ${SHADOW_PORT}`);
    const testNetServer = net.createServer();

    testNetServer.once('error', err => {
      if (err['code'] === 'EADDRINUSE') {
        console.error(
          `Port ${SHADOW_PORT} is in use. HubSpot is unable to automatically create proxy links in the Sprocket Menu`
        );
        res(true);
      } else {
        rej(err);
      }
    });

    testNetServer.once('listening', () => {
      testNetServer.close();
    });

    testNetServer.once('close', () => {
      res(false);
    });

    testNetServer.listen(SHADOW_PORT);
  });

  if (portIsTaken) {
    return;
  }

  const shadowDevServer = express();

  shadowDevServer.listen(SHADOW_PORT);

  shadowDevServer.use(
    '/',
    await createShadowDevServerRoutes(sessionInfo)
  );
}

const createShadowDevServerRoutes = async (sessionInfo) => {
  const shadowDevServerRoutes = Router();

  shadowDevServerRoutes.get(
    '/check-if-local-dev-server',
    cors(),
    shadowDevServerCheckHandler(sessionInfo),
  );

  return shadowDevServerRoutes;
}

const shadowDevServerCheckHandler = (sessionInfo) =>  async (req, res) => {
  const { PORT } = sessionInfo;
  const { query } = req;

  if (query) {
    const {
      hostName,
      pathName,
    } = query;

    let hasJSBuildingBlocks;
    let localProxyUrl;

    hasJSBuildingBlocks = false;
    localProxyUrl = `http://${hostName}.hslocal.net:${PORT}${pathName}`;

    res
      .status(200)
      .set({ 'Content-Type': 'application/json' })
      .json({ hasJSBuildingBlocks, localProxyUrl });
};
}

module.exports = {
  startShadowDevServer
}
