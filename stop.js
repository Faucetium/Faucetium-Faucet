const io = require('socket.io-client');
const config = require('./config.json');

if (config.port == undefined) {
  throw Error('port in config.json does not exist.');
}

// Specify port if your express server is not using default port 80
const socketClient = io.connect(`http://localhost:${config.port}`);

socketClient.on('connect', () => {
  socketClient.emit('npmStop');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
