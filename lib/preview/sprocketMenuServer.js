const net = require('net');
const express = require('express');
const { Router } = require('express');
const cors = require("cors");
const { logger } = require('../../logger');

const SPROCKET_MENU_PORT = 1442;

const startSprocketMenuServer = async (sessionInfo) => {
  const portIsTaken = await new Promise((res, rej) => {
    const testNetServer = net.createServer();

    testNetServer.once('error', err => {
      if (err['code'] === 'EADDRINUSE') {
        logger.error(
          `Port ${SPROCKET_MENU_PORT} is in use. HubSpot will be unable to automatically create proxy links in the Sprocket Menu`
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

    testNetServer.listen(SPROCKET_MENU_PORT);
  });

  if (portIsTaken) {
    return;
  }

  const sprocketMenuServer = express();

  sprocketMenuServer.listen(SPROCKET_MENU_PORT);

  sprocketMenuServer.use(
    '/',
    await createSprocketMenuServerRoutes(sessionInfo)
  );
}

const createSprocketMenuServerRoutes = async (sessionInfo) => {
  const sprocketMenuServerRoutes = Router();

  sprocketMenuServerRoutes.get(
    '/check-if-local-dev-server',
    cors(),
    sprocketMenuServerCheckHandler(sessionInfo),
  );

  return sprocketMenuServerRoutes;
}

const sprocketMenuServerCheckHandler = (sessionInfo) =>  async (req, res) => {
  const { PORT } = sessionInfo;
  const { query } = req;

  if (query) {
    const {
      hostName,
      pathName,
    } = query;

    let hasJSBuildingBlocks = false;
    let localProxyUrl = `http://${hostName}.hslocal.net:${PORT}${pathName}`;

    res
      .status(200)
      .set({ 'Content-Type': 'application/json' })
      .json({ hasJSBuildingBlocks, localProxyUrl });
};
}

module.exports = {
  startSprocketMenuServer
}
