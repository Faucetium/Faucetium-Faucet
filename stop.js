const io = require('socket.io-client');
const config = require('./config.json');

if (config.port == undefined) {
  throw Error('port in config.json does not exist.');
}

const url = `http://localhost:${config.port}`;

const socketClient = io.connect(url, {
  timeout: 5000
});

const timeoutErrorFn = () => {
  console.log('timeout error, cannot connnect to url', url);
  process.exit(0);
}

let timeoutId = setTimeout(timeoutErrorFn, 5000);

var acknCallbackFn = function(err, userData) {
  clearTimeout(timeoutId);
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

socketClient.on('connect', () => {
  socketClient.emit('npmStop', acknCallbackFn);
});
