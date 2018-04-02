const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const batNode = require('./batNode.js').batNode;
const kad_bat = require('./kadence_plugin').kad_bat;
const stellar_account = require('./kadence_plugin').stellar_account;
const seed = require('./constants').SEED_NODE;
const cliServer = require('./constants').CLI_SERVER;
const batNodePort = require('./constants').batNode_SERVER_PORT
const kadNodePort = require('./constants').KADNODE_PORT
const publicIp = require('public-ip');
const fs = require('fs');
const fileUtils = require('./utils/file').fileSystem;
const backoff = require('backoff');

publicIp.v4().then(ip => {
 const kademliaNode = new kad.KademliaNode({
    transport: new kad.HTTPTransport(),
    storage: levelup(encoding(leveldown('./dbbb'))),
    contact: {hostname: ip, port: kadNodePort}
  })

  kademliaNode.plugin(kad_bat)
  kademliaNode.plugin(stellar_account)
  kademliaNode.listen(kadNodePort)
  const batNode = new batNode(kademliaNode)
  kademliaNode.batNode = batNode

  const nodeConnectionCallback = (serverConnection) => {
    serverConnection.on('end', () => {
      console.log('end')
    })
    serverConnection.on('data', (receivedData, error) => {
      if (error) { throw error; }
     receivedData = JSON.parse(receivedData)
     console.log("received data: ", receivedData)

      if (receivedData.messageType === "RETRIEVE_FILE") {
        batNode.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
         serverConnection.write(data)
        })
      } else if (receivedData.messageType === "STORE_FILE"){
        let fileName = receivedData.fileName
        batNode.kadenceNode.iterativeStore(fileName, [batNode.kadenceNode.identity.toString(), batNode.kadenceNode.contact], (err, stored) => {
          console.log('nodes who stored this value: ', stored)
          let fileContent = new Buffer(receivedData.fileContent)
          batNode.writeFile(`./hosted/${fileName}`, fileContent, (writeErr) => {
            if (writeErr) {
              throw writeErr;
            }
            serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
          })
        })
      } else if (receivedData.messageType === "AUDIT_FILE") {
        fs.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
          const shardSha1 = fileUtils.sha1HashData(data);
          serverConnection.write(shardSha1);
        });
      }
    })
  }

  const nodeCLIConnectionCallback = (serverConnection) => {

    const sendAuditDataWhenFinished = (exponentialBackoff) => {
      exponentialBackoff.failAfter(10);
      exponentialBackoff.on('backoff', function(number, delay) {
        console.log(number + ' ' + delay + 'ms');
      });
      exponentialBackoff.on('ready', function() {
        if (!batNode.audit.ready) {
          exponentialBackoff.backoff();
        } else {
          serverConnection.write(JSON.stringify(batNode.audit));
          return;
        }
      });
      exponentialBackoff.on('fail', function() {
        console.log('Timeout: failed to complete audit');
      });
      exponentialBackoff.backoff();
    }

    serverConnection.on('data', (data) => {
      let receivedData = JSON.parse(data);

      if (receivedData.messageType === "CLI_UPLOAD_FILE") {
        let filePath = receivedData.filePath;

        batNode.uploadFile(filePath);
      } else if (receivedData.messageType === "CLI_DOWNLOAD_FILE") {
        let filePath = receivedData.filePath;

        batNode.retrieveFile(filePath);
      } else if (receivedData.messageType === "CLI_AUDIT_FILE") {
        let filePath = receivedData.filePath;
        let exponentialBackoff = backoff.exponential({
            randomisationFactor: 0,
            initialDelay: 20,
            maxDelay: 2000
        });

        batNode.auditFile(filePath);
        // post audit cleanup
        serverConnection.on('close', () => {
          batNode.audit.ready = false;
          batNode.audit.data = null;
          batNode.audit.passed = false;
          batNode.audit.failed = [];
        });

        // Exponential backoff until file audit finishes
        sendAuditDataWhenFinished(exponentialBackoff);

      } else if (receivedData.messageType === "CLI_PATCH_FILE") {
        const { manifestPath, siblingShardId, failedShaId } = receivedData;

        batNode.getClosestbatNodeToShard(siblingShardId, (hostbatNodeContact) => {
          const { port, host } = hostbatNodeContact;
          const client = batNode.connect(port, host, () => {});
          const message = {
            messageType: "RETRIEVE_FILE",
            fileName: siblingShardId,
          };

          client.write(JSON.stringify(message));

          client.on('data', (shardData) => {
            batNode.patchFile(shardData, manifestPath, failedShaId, hostbatNodeContact)
          })
        })
      }
    })
  }

  batNode.createCLIServer(cliServer.port, cliServer.host, nodeCLIConnectionCallback);
  batNode.createServer(batNodePort, ip, nodeConnectionCallback)


  kademliaNode.join(seed, () => {
    console.log('you have joined the network! Ready to accept commands from the CLI!')
  })


})


// Paradigm for publicly accessible nodes

// capture public ip (which is the same as private ip if not behind NAT)
// start kad node and pass it public-ip, port 80
// start batNode server on public-ip, port 1900
// start cli server on localhost, port 1800
// kad node updates its contact info by connecting to tunneling server
// kad node joins a well known seed node

// Program is now ready to accept commands from CLI
