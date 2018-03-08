const net = require('net');

exports.tcp = (function(){
  const createServer = (port, host, callback) => {
    const server =  net.createServer(callback).listen(port, host, () => { console.log(server.address())})
    server.on('error', (err) => {throw err})
    return server;
  }

  const connect = (port, host, callback) => {
    return net.createConnection(port, host, callback)
  }

  return {
    createServer,
    connect
  }
})();


