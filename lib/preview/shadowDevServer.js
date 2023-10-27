const net = require('net');
const express = require('express');
const { Router } = require('express');
const cors = require("cors");

const SHADOW_PORT = 1442;

const startShadowDevService = async (sessionInfo) => {
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
    await createShadowDevServerRoutes()
  );
}

const createShadowDevServerRoutes = async () => {
  const shadowDevServerRoutes = Router();

  shadowDevServerRoutes.get(
    '/check-if-local-dev-server',
    cors(),
    shadowDevServerCheckHandler(),
  );

  return shadowDevServerRoutes;
}

const shadowDevServerCheckHandler = () => async (req, res) => {
  const { query } = req;

  if (query) {
    const {
      hostName,
      pathName,
    } = query;

    let hasJSBuildingBlocks = false;
    let localProxyUrl;

    hasJSBuildingBlocks = true;
    localProxyUrl = `http://${hostName}.hslocal.net:3000${pathName}`;

    res
      .status(200)
      .set({ 'Content-Type': 'application/json' })
      .json({ hasJSBuildingBlocks, localProxyUrl });
};
}

module.exports = {
  startShadowDevService
}
