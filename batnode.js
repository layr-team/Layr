const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, ip, connectionCallback, listenCallback){
    tcpUtils.createServer(port, ip, connectionCallback, listenCallback)
    this.address = {port, ip}
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
  // Send shards one at a time
  sendShards(port, host, shards){
    let shardIdx = 0
    let client = this.connect(port, host)

    client.on('data', (data) => {
      let serverResponse = JSON.parse(data).messageType
      if (serverResponse === "SUCCESS" && shardIdx < shards.length - 1) {
        shardIdx += 1
        let message = {
          messageType: "STORE_FILE",
          fileName: shards[shardIdx],
          fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
        }
        client.write(JSON.stringify(message))
      }
    })

    let message = {
      messageType: "STORE_FILE",
      fileName: shards[shardIdx],
      fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
    }
    client.write(JSON.stringify(message))
  }
  // Upload file will process the file then send it to the target node
  uploadFile(port, host, filePath){
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base

    fileUtils.processUpload(filePath, (manifestPath) => {
      const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
      this.sendShards(port, host, shardsOfManifest)
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    let fileContent = new Buffer(payload.fileContent)
    this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
      if (err) {
        throw err;
      }
    })
  }

  retrieveFile(manifestFilePath, retrievalCallback) {
    // checking that all shards were retrieved?
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const shards = manifest.chunks;
    const fileName = manifest.fileName;
    let size = manifest.fileSize;
    // hardcoded 8 fileId + node contact info retrieved via find value RPC process.
    const retrievedShardLocationInfo = [
      [ "51397aa19cccf5aa106ac3034a7056f21db18805", { host: '127.0.0.1', port: 1237 }],
      [ "2acb3ebbd2bd8c0129d4059fa4241a0870c8b1c4", { host: '127.0.0.1', port: 1237 }],
      [ "69b2d798bd49b10ca31bd0ea9761c517ae22a61f", { host: '127.0.0.1', port: 1237 }],
      [ "2dbbf286d089a009638cdbc79152ebb897bfdd15", { host: '127.0.0.1', port: 1237 }],
      [ "f28eda173ce23c1e9043cabc44c7ebccdd5aef6f", { host: '127.0.0.1', port: 1238 }],
      [ "df8e4ebe645f1a40cc7477f4744b441579a70abc", { host: '127.0.0.1', port: 1238 }],
      [ "1df5cad197fca0363ba996f42d75468af2c1252e", { host: '127.0.0.1', port: 1238 }],
      [ "7713bee6e01f71c0f786cd3ef2f3d0608e74b77f", { host: '127.0.0.1', port: 1238 }]
    ];
    let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`);

    retrievedShardLocationInfo.forEach((shardInfo) => {
      let client = this.connect(shardInfo.port, shardInfo.host);
      let request = {
        messageType: "RETRIEVE_FILE",
        fileName: shardInfo[0],
      };

      client.write(JSON.stringify(request));
      // , () => {
      //
      // });
    });

  }

  // retrieveFile(manifestFilePath, port, host, retrievalCallback){
  //   let client = this.connect(port, host)
  //   let manifest = fileUtils.loadManifest(manifestFilePath)
  //
    // const shards = manifest.chunks
    // const fileName = manifest.fileName
  //   let size = manifest.fileSize
  //   let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`)
  //   let currentShard = 0
  //
    // let request = {
    //   messageType: "RETRIEVE_FILE",
    //   fileName: shards[currentShard],
    // }
  //
  //   client.on('data', (data) => {
  //     size -= data.byteLength
  //     console.log(data.byteLength)
  //     retrievedFileStream.write(data)
  //     if (size <= 0){
  //       client.end()
  //     } else {
  //       currentShard += 1
  //       request.fileName = shards[currentShard]
  //       client.write(JSON.stringify(request))
  //     }
  //   })
  //
  //   client.write(JSON.stringify(request))
  //
  //   client.on('end', () => {
  //     console.log('end')
  //     fileUtils.decrypt(`./personal/${fileName}`)
  //   })
  // }

}

exports.BatNode = BatNode;
