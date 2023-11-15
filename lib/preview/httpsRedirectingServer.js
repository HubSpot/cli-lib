const http = require('http');
const https = require('https');
const net = require('net');
const { unlinkSync } = require('fs');
const { silenceConsoleWhile } = require('./previewUtils');

const createCert = async (domainsToProxy) => {
  const additionalMkcertHosts = domainsToProxy
    .map(proxyDomain => [
      `${proxyDomain.domain}.localhost`,
      `${proxyDomain.domain}.hslocal.net`
    ])
    .flat();
  const hosts = ['localhost', 'hslocal.net', ...additionalMkcertHosts];
  const { createCertificate } = await import('mkcert-cli');
  const { key, cert } = await silenceConsoleWhile(createCertificate, {
    keyFilePath: `${__dirname}/key.pem`,
    certFilePath: `${__dirname}/cert.pem`
  }, hosts);
  unlinkSync(`${__dirname}/key.pem`);
  unlinkSync(`${__dirname}/cert.pem`);
  return { key, cert };
}

const requireHTTPS = (message, response) => {
  const newLocation = `https://${message.headers.host}${message.url}`;

  response
    .writeHead(302, {
      Location: newLocation,
    })
    .end();
}

// Running http and https servers on the same port pulled from https://stackoverflow.com/a/42019773
const createHttpsRedirectingServer = async (handler, domainsToProxy) => {

  const { key, cert } = await createCert(domainsToProxy)

  const innerHTTPServer = http.createServer(requireHTTPS);
  const innerHTTPSServer = https.createServer({ key, cert }, handler);

  const server = net.createServer(socket => {
    socket.once('data', buffer => {
      // Pause the socket
      socket.pause();

      // Determine if this is an HTTP(s) request
      const byte = buffer[0];

      let protocol;
      if (byte === 22) {
        protocol = 'https';
      } else if (32 < byte && byte < 127) {
        protocol = 'http';
      } else {
        throw new Error(
          'Unknown issue with incoming data, unknown if http or https'
        );
      }

      const proxy = protocol === 'http' ? innerHTTPServer : innerHTTPSServer;
      if (proxy) {
        // Push the buffer back onto the front of the data stream
        socket.unshift(buffer);

        // Emit the socket to the HTTP(s) server
        proxy.emit('connection', socket);
      }

      // As of NodeJS 10.x the socket must be
      // resumed asynchronously or the socket
      // connection hangs, potentially crashing
      // the process. Prior to NodeJS 10.x
      // the socket may be resumed synchronously.
      process.nextTick(() => socket.resume());
    });
  });

  return { server, innerHTTPServer, innerHTTPSServer };
}

module.exports = {
  createHttpsRedirectingServer
}
