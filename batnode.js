const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');
const async = require('async');

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
    });
  }

  sendShardToNode(nodeInfo, shard, shardIdx) {
    let { port, host } = nodeInfo;
    let client = this.connect(port, host);

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${shard}`)
    };

    client.write(JSON.stringify(message));
  }
  sendShards(nodes, shards) {
    let shardIdx = 0;
    let nodeIdx = 0;
    while (shards.length > shardIdx) {
      let currentNodeInfo = nodes[nodeIdx];

      this.sendShardToNode(currentNodeInfo, shards[shardIdx], shardIdx);

      shardIdx += 1;
      nodeIdx = this.nextNodeIdx(nodeIdx, shardIdx, nodes.length, shards.length);
    }
  }
  nextNodeIdx(nodeIdx, shardIdx, nodesCount, shardsCount) {
    let atTailNode = (nodeIdx + 1 === nodesCount);
    let remainingShards = (shardIdx + 1 < shardsCount);

    nodeIdx = (atTailNode && remainingShards) ? 0 : nodeIdx + 1;

    return nodeIdx;
  }
  // Upload file will process the file then send it to the target node
  uploadFile(filePath) {
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base

    // change from hardcoded values to a method uploadDestinationNodes later
    const destinationNodes = [
      { host: '127.0.0.1' , port: 1237 },
      { host: '127.0.0.1' , port: 1238 }
    ];

    fileUtils.processUpload(filePath, (manifestPath) => {
      const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
      this.sendShards(destinationNodes, shardsOfManifest);
    });
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
    let shardTracker = { index: 0 };
    let shardsWritten = { total: 0, shardIds: [] };
    // hardcoded 8 fileId + node contact info retrieved via find value RPC process.
    const retrievedShardLocationInfo = [
      [ "fda9b8c066e0674e661edcda1f335e83b1d483fb", { host: '127.0.0.1', port: 1237 }],
      [ "679d37bbbead48bc69dd306ac0f0e50b31fd2050", { host: '127.0.0.1', port: 1238 }],
      [ "079e32312022a271d40781e863c36a85382c8035", { host: '127.0.0.1', port: 1237 }],
      [ "ffd80287cf3f17acc50c477750d87110b265c17e", { host: '127.0.0.1', port: 1238 }],
      [ "04848e38e520e0f15ab0fc95fd24d452dbb93950", { host: '127.0.0.1', port: 1237 }],
      [ "26d201ffda35105722b2d43fa84194c5d0df778e", { host: '127.0.0.1', port: 1238 }],
      [ "a0f01aae950a9be522c8091a9c99593a852a3ff1", { host: '127.0.0.1', port: 1237 }],
      [ "1ebaeb6ab20ee7710a5b16c6716e358699f987c5", { host: '127.0.0.1', port: 1238 }]
    ];
    let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`);

    while (shardTracker.index + 1 < retrievedShardLocationInfo.length) {
      if (shardTracker.index === 0) {
        shardTracker.index += 1;
      }
      this.retrieveShard(retrievedShardLocationInfo, shardTracker, retrievedFileStream, shardsWritten, fileName);
      shardTracker.index += 1;
    }

    console.log('End of retrieveFile');
  }

  retrieveShard(shardLocationInfo, shardTracker, retrievedFileStream, shardsWritten, fileName, shards, manifest) {
    let currentShardInfo = shardLocationInfo[shardTracker.index][1];
    console.log('currentNodeInfo', currentShardInfo);
    let client = this.connect(currentShardInfo.port, currentShardInfo.host);
    console.log('current idx', shardTracker.index);
    let shardId = shardLocationInfo[shardTracker.index][0]
    let request = {
      messageType: "RETRIEVE_FILE",
      fileName: shardId,
    };

    client.on('data', (data) => {
      console.log('Data callback!');
      if (data.byteLength !== 0) {
        // retrievedFileStream.write(data);
        fs.writeFile(`./shards/${shardId}.batchain`, data, 'utf8', () => {
          client.end();
        });
      } else {
        console.log('Empty shard');
      }
    });

    client.on('end', () => {
      shardsWritten.total += 1;
      // add shardIds once they are written
      shardsTracker.shardIds.push(shardLocationInfo[shardTracker.index][0])
      console.log(shardsWritten);
      console.log(shardTracker.index);
      // if (shardsWritten.total === shardLocationInfo.length) {
      //   fileUtils.decrypt(`./personal/${fileName}`);
        // fs.readFile(`./personal/${fileName}`, (err, fileData) => {
        //   if (err) { console.log('Read error!'); }
        //   debugger;
        //   fs.writeFile(`./personal/${fileName}`, fileData, (err) => {
        //     if (err) { console.log('Write error!'); }
        //     fileUtils.decrypt(`./personal/${fileName}`);
        //   });
        // });
      // }
      if (shardsWritten.total === 6) {
        fileUtils.assembleShards(manifest, shardsTracker.shardIds);
      }
    });

    client.write(JSON.stringify(request), (err) => {
      if (err) { console.log('Write err! ', err); }
    });
  };
}

exports.BatNode = BatNode;
