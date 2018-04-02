const tcpUtils = require('../utils/tcp').tcp;
const fileUtils = require('../utils/file').fileSystem;
const path = require('path');
const dotenv = require('dotenv');
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const stellar = require('../utils/stellar').stellar;
const fs = require('fs');
const constants = require('../constants');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    this._audit = { ready: false, data: null, passed: false, failed: [] };

    fs.exists('./hosted', (exists) => {
      if (!exists){
        fs.mkdir('./hosted')
      }
    })

    if (!fs.existsSync('./.env') || this.noStellarAccount()) {
      let stellarKeyPair = stellar.generateKeys()

      fileUtils.generateEnvFile({
        'STELLAR_ACCOUNT_ID': stellarKeyPair.publicKey(),
        'STELLAR_SECRET': stellarKeyPair.secret()
      })
    }
    this._stellarAccountId = fileUtils.getStellarAccountId();

    stellar.accountExists(this.stellarAccountId, (account) => {
      console.log('account does exist')
      account.balances.forEach((balance) =>{
        console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
      });
    }, (publicKey) => {
      console.log('account does not exist, creating account...')
      stellar.createNewAccount(publicKey)
    })

    this._audit = { ready: false, data: null, passed: false };

  }

  noStellarAccount() {
    return !dotenv.config().parsed.STELLAR_ACCOUNT_ID || !dotenv.config().parsed.STELLAR_SECRET
  }

  // TCP server
  createServer(port, host, connectionCallback){
    const listenCallback = (server) => {
      this._server = server
    }
    tcpUtils.createServer(port, host, connectionCallback, listenCallback)
    this.address = {port, host}
  }

  sendPaymentFor(destinationAccountId, onSuccessfulPayment, numberOfBytes) {
    console.log(destinationAccountId, ' sending payment to that account')
    let stellarSeed = fileUtils.getStellarSecretSeed();
    let amount = 1;
    if (numberOfBytes) {
      amount *= numberOfBytes
    }
    stellar.sendPayment(destinationAccountId, stellarSeed, `${amount}`, onSuccessfulPayment)
  }

  createCLIServer(port, host, connectionCallback) {
    tcpUtils.createServer(port, host, connectionCallback);
  }

  get audit() {
    return this._audit
  }

  get stellarAccountId(){
    return this._stellarAccountId
  }

  getStellarAccountInfo(){
    let accountId = this.stellarAccountId;
    stellar.getAccountInfo(accountId)
  }

  get server(){
    return this._server
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
  writeFile(filePath, data, callback) {
    fileUtils.writeFile(filePath, data, callback)
  }

  sendShardToNode(nodeInfo, shard, shards, shardIdx, storedShardName, distinctIdx, manifestPath) {
    let { port, host } = nodeInfo;
    let client = this.connect(port, host, () => {
      console.log('connected to target batnode')
    });

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${storedShardName}`)
    };

    client.on('data', (data) => {
      console.log('received data from server')
      if (shardIdx < shards.length - 1){
        this.getClosestBatNodeToShard(shards[shardIdx + 1], (batNode, kadNode) => {
          this.kadenceNode.getOtherNodeStellarAccount(kadNode, (error, accountId) => {
            console.log("The target node returned this stellard id: ", accountId)
            this.sendPaymentFor(accountId, (paymentResult) => {
              console.log(paymentResult, " result of payment")
              this.sendShardToNode(batNode, shards[shardIdx + 1], shards, shardIdx + 1, storedShardName, distinctIdx, manifestPath)
            })
          })
        })
      } else {
        this.distributeCopies(distinctIdx + 1, manifestPath)
      }
    })

    client.write(JSON.stringify(message), () => {
      console.log('sent data to server!', port, host)
    });
  }

  // Upload file will process the file then send it to the target node
  uploadFile(filePath, distinctIdx = 0) {
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    fileUtils.processUpload(filePath, (manifestPath) => {
     this.distributeCopies(distinctIdx, manifestPath)
    });
  }

  distributeCopies(distinctIdx, manifestPath, copyIdx = 0){
    const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
    if (distinctIdx < shardsOfManifest.length) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath))
      let copiesOfCurrentShard = manifest.chunks[shardsOfManifest[distinctIdx]]

      this.getClosestBatNodeToShard(copiesOfCurrentShard[copyIdx],  (batNode, kadNode) => {
        this.kadenceNode.getOtherNodeStellarAccount(kadNode, (error, accountId) => {
          console.log("The target node returned this stellard id: ", accountId)
          this.sendPaymentFor(accountId, (paymentResult) => {
            console.log(paymentResult, " result of payment")
            this.sendShardToNode(batNode, copiesOfCurrentShard[copyIdx], copiesOfCurrentShard, copyIdx, shardsOfManifest[distinctIdx], distinctIdx, manifestPath)
          })
        })
      });
    } else {
      console.log("Uploading shards and copies completed! You can safely remove the files under shards folder from your end now.")
    }
  }

  getClosestBatNodeToShard(shardId, callback){
    this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
      let i = 0
      let targetKadNode = res[0]; // res is an array of these tuples: [id, {hostname, port}]
      console.log(targetKadNode, "Target kad node")

      // remove the last "or" condition to see the local changes in node1
      while ((targetKadNode[1].hostname === this.kadenceNode.contact.hostname &&
            targetKadNode[1].port === this.kadenceNode.contact.port)) { // change to identity and re-test
        i += 1
        targetKadNode = res[i]
      }

      this.kadenceNode.ping(targetKadNode, (error) => { // Checks whether target kad node is alive
        if (error) {
          this.getClosestBatNodeToShard(shardId, callback) // if it's offline, re-calls method. This works because sendign RPCs to disconnected nodes
        } else {                                          // will automatically remove the dead node's contact info from sending node's routing table
          this.kadenceNode.getOtherBatNodeContact(targetKadNode, (error2, result) => { // res is contact info of batnode {port, host}
            callback(result, targetKadNode)
          })
        }
      })
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    this.kadenceNode.iterativeStore(fileName, this.kadenceNode.contact, () => {
      console.log('store completed')
      let fileContent = new Buffer(payload.fileContent)
      this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
        if (err) {
          throw err;
        }
      })
    })
  }

  retrieveFile(manifestFilePath, copyIdx = 0, distinctIdx = 0) {
    let manifestJson = fileUtils.loadManifest(manifestFilePath);
    const distinctShards = fileUtils.getArrayOfShards(manifestFilePath)
    const fileName = manifestJson.fileName;
    this.retrieveSingleCopy(distinctShards, manifestJson.chunks, fileName, manifestJson, distinctIdx, copyIdx)
  }

  retrieveSingleCopy(distinctShards, allShards, fileName, manifestJson, distinctIdx, copyIdx){
    if (copyIdx && copyIdx > 2) {
      console.log('Host could not be found with the correct shard')
    } else {
      let currentCopies = allShards[distinctShards[distinctIdx]] // array of copy Ids for current shard
      let currentCopy = currentCopies[copyIdx]

      const afterHostNodeIsFound = (hostBatNode, kadNode, nextCopy=false) => {
        if (hostBatNode[0] === 'false' || nextCopy === true){
          this.retrieveSingleCopy(distinctShards, allShards, fileName, manifestJson, distinctIdx, copyIdx + 1)
        } else {

          this.kadenceNode.getOtherNodeStellarAccount(kadNode, (error, accountId) => {

            let retrieveOptions = {
              saveShardAs: distinctShards[distinctIdx],
              distinctShards,
              fileName,
              distinctIdx,
            }
            this.sendPaymentFor(accountId, (paymentResult) => {
              this.issueRetrieveShardRequest(currentCopy, hostBatNode, manifestJson,retrieveOptions, () => {
                this.retrieveSingleCopy(distinctShards, allShards, fileName, manifestJson, distinctIdx + 1, copyIdx)
              })
            });
          });
        }
      }

      this.getHostNode(currentCopy, afterHostNodeIsFound)
    }
  }

  combineShardsAfterWaitTime(waitTime, fileName, distinctShards, error) {
    return new Promise((resolve, reject) => {
      if (error) reject(error);
      setTimeout(() => resolve(fileUtils.assembleShards(fileName, distinctShards)), waitTime);
    });
  }

  async asyncCallAssembleShards(waitTime, fileName, distinctShards, error) {
    try {
      console.log("waiting time in ms: ", waitTime);
      const result = await this.combineShardsAfterWaitTime(waitTime, fileName, distinctShards, error);
      return result;
    } catch (error) {
      console.error(error);
    }
  }

  issueRetrieveShardRequest(shardId, hostBatNode, manifestJson, options, finishCallback){
   let { saveShardAs, distinctIdx, distinctShards, fileName } = options

   let client = this.connect(hostBatNode.port, hostBatNode.host, () => {
    let message = {
      messageType: 'RETRIEVE_FILE',
      fileName: shardId
    }

    if (!fs.existsSync('./shards/')){ fs.mkdirSync('./shards/'); }
    const fileDestination = './shards/' + saveShardAs;
    let shardStream = fs.createWriteStream(fileDestination);

    const completeFileSize = manifestJson.fileSize;
    const waitTime = Math.floor(completeFileSize/16000);  // set the divided amount slightly below 16kb ~ 16384 (the default high watermark for read/write streams)

    client.once('data', (data) => {
      shardStream.write(data, function (err) {
        if(err){
          throw err;
        }
      });
      client.pipe(shardStream);

      if (distinctIdx < distinctShards.length - 1){
        finishCallback()
      } else {
        this.asyncCallAssembleShards(waitTime, fileName, distinctShards);
      }
    })

    client.write(JSON.stringify(message), () => {
      console.log("Accessing distinctIdx: ", distinctIdx);
    })
   })
  }

  getHostNode(shardId, callback){
    this.kadenceNode.iterativeFindValue(shardId, (err, value, responder) => {
      let kadNodeTarget = value.value;
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {

        callback(batNode, kadNodeTarget)
      })
    })
  }

  auditFile(manifestFilePath, shaIdx = 0, shardAuditData=null, shaIds=null, shards=null) {
    const manifest = fileUtils.loadManifest(manifestFilePath);

    if (shaIdx === 0){
      shards = manifest.chunks;
      shaIds = Object.keys(shards);
      shardAuditData = this.prepareAuditData(shards, shaIds);
    }


    if (shaIds.length > shaIdx) {
      this.auditShardsGroup(shards, shaIds, shaIdx, shardAuditData, 0, manifestFilePath);
    }
  }

  prepareAuditData(shards, shaIds) {
    return shaIds.reduce((acc, shaId) => {
      acc[shaId] = {};

      shards[shaId].forEach((shardId) => {
        acc[shaId][shardId] = false;
      });

      return acc;
    }, {});
  }
  /**
   * Tests the redudant copies of the original shard for data integrity.
   * @param {shards} Object - Shard content SHA keys with
   * array of redundant shard ids
   * @param {shaIdx} Number - Index of the current
   * @param {shardAuditData} Object - same as shards param except instead of an
   * array of shard ids it's an object of shard ids and their audit status
  */
  auditShardsGroup(shards, shaIds, shaIdx, shardAuditData, shardDupIdx=0, manifestFilePath) {
    const shaId = shaIds[shaIdx];

    if (shards[shaId].length > shardDupIdx) {
      this.auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData, shaIds, manifestFilePath);
    } else {
      this.auditFile(manifestFilePath, shaIdx+1, shardAuditData, shaIds, shards)
    }
  }

  auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData, shaIds, manifestFilePath) {
    const shardId = shards[shaId][shardDupIdx];

    this.kadenceNode.iterativeFindValue(shardId, (error, value, responder) => {
      if (error) { throw error; }
      if (Array.isArray(value)) { // then k closest contacts were found: the value doesn't exist on network
        return;
      } else {
        let kadNodeTarget = value.value;

        this.kadenceNode.ping(kadNodeTarget, (pingError) => {
          if (pingError) { // Node is not alive
            return;
          } else {
            this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
              if (err) { throw err; }
              this.auditShardData(batNode, shards, shaIdx, shardDupIdx, shardAuditData, shaIds, manifestFilePath)
            })
          }
        })
      }
    })
  }

  auditShardData(targetBatNode, shards, shaIdx, shardDupIdx, shardAuditData, shaIds, manifestFilePath) {
    let client = this.connect(targetBatNode.port, targetBatNode.host);

    const shaKeys = Object.keys(shards);
    const shaId = shaKeys[shaIdx];
    const shardId = shards[shaId][shardDupIdx]; // id of a redundant shard for shaId

    const finalShaGroup = shaKeys.length - 1 === shaIdx;
    const finalShard = shards[shaId].length - 1 === shardDupIdx;

    let message = {
      messageType: "AUDIT_FILE",
      fileName: shardId
    };

    client.write(JSON.stringify(message), (err) => {
      if (err) { throw err; }
    })

    client.on('data', (data) => {
      const hostShardSha1 = data.toString('utf8');
      // Check that shard content matches original content SHA
      if (hostShardSha1 === shaId) {
        shardAuditData[shaId][shardId] = true;
      }

      if (finalShaGroup && finalShard) {

        const hasBaselineRedundancy = this.auditResults(shardAuditData, shaKeys);
        this.audit.ready = true;
        this.audit.data = shardAuditData;
        this.audit.passed = hasBaselineRedundancy;

        console.log(shardAuditData);
        if (hasBaselineRedundancy) {
          console.log('Passed audit!');
        } else {
          console.log('Failed Audit');
        }


      } else {
        this.auditShardsGroup(shards, shaIds, shaIdx,shardAuditData, shardDupIdx + 1, manifestFilePath)
      }
    })
  }

  auditResults(auditData, shaKeys) {
    const isRedundant = (shaId) => {
      let validShards = 0;
      // For each key (shardId) under the shard content's shaId key
      Object.keys(auditData[shaId]).forEach((shardId) => {
        if (auditData[shaId][shardId] === true) { validShards += 1; }
      });

      if (validShards >= constants.BASELINE_REDUNDANCY) {
        return true;
      } else {
        this.audit.failed.push(shaId);
        return false;
      }
    }

    return shaKeys.every(isRedundant);
  }

  patchFile(siblingShardData, manifestPath, failedShaId, hostBatNodeContact) {
    // Store new shard
    const newShardId = fileUtils.createRandomShardId(siblingShardData);
    const { port, host } = hostBatNodeContact;
    const client = this.connect(port, host)
    const message = {
      messageType: "STORE_FILE",
      fileName: newShardId,
      fileContent: siblingShardData,
    };

    client.write(JSON.stringify(message));

    // Should wait for the server to respond with success before starting?
    client.on('data', () => {
      fs.readFile(manifestPath, (error, manifestData) => {
        if (error) { throw error; }
        let manifestJson = JSON.parse(manifestData);
        manifestJson.chunks[failedShaId].push(newShardId);

        fs.writeFile(manifestPath, JSON.stringify(manifestJson, null, '\t'), (err) => {
          if (err) { throw err; }
        });
      });
    })
  }
}

exports.BatNode = BatNode;
