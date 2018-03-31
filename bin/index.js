#!/usr/bin/env node

'use strict';

const batchain = require('commander');
const chalk = require('chalk');

const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');
const async = require('async');

batchain
  .command('sample', 'see the sample nodes running in LAN')
  .option('-l, --list', 'view your list of uploaded files in BatChain network')
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .option('-a, --audit <manifestPath>', 'audit files from manifest file path')
  .option('-p, --patch <manifestPath>', 'creates copies of vulnerable data shards to ensure data availability')
  .parse(process.argv);

const cliNode = new BatNode();
let client;

function sendUploadMessage() {
  
  const message = {
    messageType: "CLI_UPLOAD_FILE",
    filePath: batchain.upload,
  };
        
  client.write(JSON.stringify(message));
}

function sendDownloadMessage() {
  
  const message = {
    messageType: "CLI_DOWNLOAD_FILE",
    filePath: batchain.download,
  };

  client.write(JSON.stringify(message));
}

function sendAuditMessage(filePath, logOut=true) {
  return new Promise((resolve, reject) => {
    const message = {
      messageType: "CLI_AUDIT_FILE",
      filePath: filePath,
    };

    client.write(JSON.stringify(message));

    client.on('data', (data, error) => {
      if (error) { throw error; }
      const auditData = JSON.parse(data);

      // with optional logging
      const manifest = fileSystem.loadManifest(filePath);

      if (logOut) {
        // oddly fails audit if resolve is higher in method body
        resolve(auditData);
        console.log(`File name: ${manifest.fileName} | Manifest: ${filePath} | Data available: ${auditData.passed}`);
      } else {
        resolve(auditData);
      }
    })

    client.on('error', (err) => {
      reject(err);
    })
  })
}

function findRedundantSibling(auditData, failedSha) {
  const shardKeys = Object.keys(auditData[failedSha]);
  const isRetrievabalShard = (shardKey) => {
    auditData[failedSha][shardKey] === true;
  }

  return shardKeys.find(isRetrievabalShard);
}

async function sendPatchMessage(filePath) {
  try {
    const audit = await sendAuditMessage(filePath);
    if (!audit.passed) {
      audit.failed.forEach((failedSha) => {
        // patching goes here
        const siblingShard = findRedundantShard(audit.data, failedSha);
        if (siblingShard) {
          // find closest batNode (host device) to shard here?
          // const newShardId = fileSystem.createRedundantShardId(fileContent)
          // get manifest; const manifest = fileSystem.loadManifest(filePath);
          // write new shard to it; manifest.chunks[failedSha].push(newShardId)
        } else {
          console.log(`No redundant shards for ${failedSha}. You\'ll need to upload the source file`);
        }
      });
    }
  } catch(error) {
    console.log(error);
  }
}

function displayFileList() {
  const manifestFolder = './manifest/';

  if (!fs.existsSync(manifestFolder)) {
    console.log(chalk.bold.cyan("You don't have a manifest folder"));
  } else {
    console.log(chalk.bold.cyan("You current file list: "));

    fs.readdirSync(manifestFolder).forEach(file => {
      const manifestFilePath = manifestFolder + file;
      const manifest = fileSystem.loadManifest(manifestFilePath);
      console.log('name: ' + manifest.fileName + '; manifest path: ' + manifestFilePath);
    });
  }
}

if (batchain.list) {
  
  displayFileList();

} else if (batchain.upload) {
  client = cliNode.connect(1800, 'localhost');  // TODO: change the hard-coded params 

  console.log(chalk.yellow('You can only upload one file at a time'));
  
  if (!fs.existsSync(batchain.upload)) {
    console.log(chalk.red('You entered an invalid file path, please try again'));   
  } else {
    console.log(chalk.yellow('Uploading file to the network'));
    sendUploadMessage();
  }

} else if (batchain.download) {
  client = cliNode.connect(1800, 'localhost');  // TODO: change the hard-coded params 

  console.log(chalk.yellow('You can only download one file at a time'));
  
  if (!fs.existsSync(batchain.download)) {
    console.log(chalk.red('You entered an invalid manifest path, please try again'));   
  } else {
    console.log(chalk.yellow('Downloading file to your local disk'));
    sendDownloadMessage();
  }

} else if (batchain.audit) {
  client = cliNode.connect(1800, 'localhost');
  
  console.log(chalk.yellow('You can audit file to make sure file integrity'));
  
  if (!fs.existsSync(batchain.audit)) {
    console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));   
  } else {
    console.log(chalk.yellow('sample node3 audits files from sample node1/node2'));
    sendAuditMessage(batchain.audit);
  }
} else if (batchain.patch) {
   client = cliNode.connect(1800, 'localhost');

   if (!fs.existsSync(batchain.patch)) {
     console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
   } else {
     console.log(chalk.yellow('Starting patch command'));
     sendPatchMessage(batchain.patch);
   }

 } else {
  console.log(chalk.bold.magenta("Hello, welcome to Batchain!"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}