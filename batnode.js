const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const publicIp = require('public-ip');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, connectionCallback, listenCallback){
    publicIp.v6().then(ip => {
      console.log(ip)
      tcpUtils.createServer(port, ip, connectionCallback, listenCallback)
    })
 
  }

  get address() {
    return this._address
  }

  set address(address) {
    this._address = address
  }

  get kadenceNode() {
    return this._kadenceNode
  }

  // TCP client
  connect(port, host, callback) {
    return tcpUtils.connect(port, host, callback) // Returns a net.Socket object that can be used to read and write
  }                                               // from the TCP stream

   // Send data as tcp client
  sendDataToNode(port, host, connectCallback, payload, respondToServer){
    let client = this.connect(port, host, connectCallback) // connect to the target server with an optional callback
                                                           // that executes when the connection is established
    client.on('data', (data) => { // event handler that is called when the server responds
      respondToServer(data)
    })

    client.write(payload) // sends data to the server through the TCP stream
  }

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
  }

  sendFile(port, host, filepath, fileName) {
    this.readFile(filepath, (error, data) => {
      let payload = {
        messageType: "STORE_FILE",
        fileName,
        fileContent: data,
      }

      payload = JSON.stringify(payload)
    
      this.sendDataToNode(port, host, null, payload, null)
    })
  }

  // Upload file will process the file then send it to the target node
  uploadFile(port, host, filePath){
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    fileUtils.processUpload(filePath, () => {
      console.log('finished processing the file!')
      this.sendFile(port, host, `./personal/${fileName}.crypt`, fileName + '.crypt')
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    let fileContent = new Buffer(payload.fileContent)
    this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent)
  }

  retrieveFile(fileName, port, host, retrievalCallback){
    let client = this.connect(port, host)
    let request = {
      messageType: "RETRIEVE_FILE",
      fileName
    }
    request = JSON.stringify(request)

    client.on('data', (data) => {
      this.writeFileSync(`./personal/${fileName}`, data)
      fileUtils.decrypt(`./personal/${fileName}`)
    })
    
    client.write(request)
  }
}

exports.BatNode = BatNode;
