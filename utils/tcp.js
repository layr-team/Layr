const net = require('net');

exports.tcp = (function(){
  const createServer = (port, host, connectionCallback, listenCallback) => {
    const server =  net.createServer(connectionCallback)
    
    server.listen(port, host, () => {
      if (listenCallback) {
        listenCallback(server)
      }
    })

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


