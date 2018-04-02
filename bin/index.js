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
const CLI_SERVER = require('../constants').CLI_SERVER;

batchain
  .command('sample', 'see the sample nodes running in LAN')
  .option('-l, --list', 'view your list of uploaded files in BatChain network')
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .option('-a, --audit <manifestPath>', 'audit files from manifest file path')
  .option('-p, --patch <manifestPath>', 'creates copies of vulnerable data shards to ensure data availability')
  .option('-s, --sha <filePath>', 'Returns the SHA1 of the files content. Useful for debugging purposes')
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
      const manifest = fileSystem.loadManifest(filePath);

      resolve(auditData);
      console.log(`File name: ${manifest.fileName} | Baseline data redundancy: ${auditData.passed}`);
    })

    client.on('error', (err) => {
      reject(err);
    })
  })
}

function findRedundantShard(auditData, failedSha) {
  const shardKeys = Object.keys(auditData[failedSha]);
  const isRetrievabalShard = (shardKey) => {
    return auditData[failedSha][shardKey] === true;
  }
  console.log('findRedundantShard - auditData[failedSha]', auditData[failedSha]);
  return shardKeys.find(isRetrievabalShard);
}

async function sendPatchMessage(manifestPath) {
  try {
    const audit = await sendAuditMessage(manifestPath);
    if (!audit.passed) {
      // patching goes here
      audit.failed.forEach((failedShaId) => {
        const siblingShardId = findRedundantShard(audit.data, failedShaId);
        if (siblingShardId) {
          const message = {
            messageType: "CLI_PATCH_FILE",
            manifestPath: manifestPath,
            failedShaId: failedShaId,
            siblingShardId: siblingShardId,
          };

          console.log('sendPatchMessage - message: ', message);
          client.write(JSON.stringify(message));

        } else {
          console.log(chalk.cyan(`No redundant shards for ${failedShaId}. You\'ll need to upload the source file to perform a patch`));
        }
      });
    } else {
      console.log(chalk.green('Your file has sufficient data redundancy across the network. No need to patch!'));
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

  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host);  
  
  console.log(chalk.yellow('You can only upload one file at a time'));

  if (!fs.existsSync(batchain.upload)) {
    console.log(chalk.red('You entered an invalid file path, please try again'));
  } else {
    console.log(chalk.yellow('Uploading file to the network'));
    sendUploadMessage();
  }

} else if (batchain.download) {

  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host); 

  console.log(chalk.yellow('You can only download one file at a time'));

  if (!fs.existsSync(batchain.download)) {
    console.log(chalk.red('You entered an invalid manifest path, please try again'));
  } else {
    console.log(chalk.yellow('Downloading file to your local disk'));
    sendDownloadMessage();
  }

} else if (batchain.audit) {
  
  client = cliNode.connect(CLI_SERVER.port, CLI_SERVER.host); 
  
  console.log(chalk.yellow('Auditing checks if your file is availabile on the network'));

  if (!fs.existsSync(batchain.audit)) {
    console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
  } else {
    console.log(chalk.yellow('Starting file audit'));
    sendAuditMessage(batchain.audit);
  }
} else if (batchain.patch) {
  client = cliNode.connect(1800, 'localhost');

  if (!fs.existsSync(batchain.patch)) {
   console.log(chalk.red('You entered an invalid manifest path, please enter a valid file and try again'));
  } else {
    console.log(chalk.yellow('Checking data redundancy levels for file'));
    sendPatchMessage(batchain.patch);
  }
} else if (batchain.sha) {
  console.log(chalk.yellow('Calculating SHA of file contents'));
  const fileSha = fileSystem.sha1Hash(batchain.sha);
  console.log(fileSha);
} else {
  console.log(chalk.bold.magenta("Hello, welcome to Batchain!"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}
