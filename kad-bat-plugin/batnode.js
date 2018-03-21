const tcpUtils = require('../utils/tcp').tcp;
const fileUtils = require('../utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, host, connectionCallback, listenCallback){
    tcpUtils.createServer(port, host, connectionCallback, listenCallback)
    this.address = {port, host}
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

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
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
      let currentNodeInfo = nodes[nodeIdx]; // this.getClosestBatNode
      

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
  uploadFile(port, host, filePath) {
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

  getClosestBatNodeToShard(shardId, callback){
    this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
      let targetKadNode = res[0]
      this.kadenceNode.getOtherBatNodeContact(targetKadNode, (err, res) => {
        callback(res)
      })
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

  retrieveFile(manifestFilePath, port, host, retrievalCallback){
    let client = this.connect(port, host)
    let manifest = fileUtils.loadManifest(manifestFilePath)

    const shards = manifest.chunks
    const fileName = manifest.fileName
    let size = manifest.fileSize
    let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`)
    let currentShard = 0

    let request = {
      messageType: "RETRIEVE_FILE",
      fileName: shards[currentShard],
    }

    client.on('data', (data) => {
      size -= data.byteLength
      console.log(data.byteLength)
      retrievedFileStream.write(data)
      if (size <= 0){
        client.end()
      } else {
        currentShard += 1
        let request = {
          messageType: "RETRIEVE_FILE",
          fileName: shards[currentShard]
        }
        client.write(JSON.stringify(request))
      }
    });

    client.write(JSON.stringify(request))

    client.on('end', () => {
      console.log('end')
      fileUtils.decrypt(`./personal/${fileName}`)
    })
  }
}

exports.BatNode = BatNode;


// algorithm for distributing shards
// For each shard
// find a node in k closest nodes to shardId
// get those nodes batnode contacts
// initiate batnode connection
// transfer shard data to target node
// target node sends an iterative store rpc for its kad node

// given shards
// for each shard:
// findCloseBatNodeToShard
// InitiateBatnodeConnection
// TransferShard
// IterativeStore(shardId, kadnodeContact)


// getClosestBatNode
// targetKadNode = batnode.kadNode.findNodeClosestToKey(shardId)[0]
// targetBatNode = batnode.kadNode.getOtherBatNodeContact(this.address)
// batnode.kadNode.initiateBatPunch(targetKadNode, (res) => {
    // batnode.connect(res)
// })