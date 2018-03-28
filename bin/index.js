#!/usr/bin/env node

'use strict';

const batchain = require('commander');
const chalk = require('chalk');

const BatNode = require('../batnode').BatNode;
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const fileSystem = require('../utils/file').fileSystem;
const fs = require('fs');

batchain
  .command('sample', 'see the sample nodes running in LAN')
  .option('-l, --list', 'view your list of uploaded files in BatChain network')
  .option('-u, --upload <filePath>', 'upload files from specified file path')
  .option('-d, --download <manifestPath>', 'retrieve files from manifest file path')
  .option('-a, --audit <manifestPath>', 'audit files from manifest file path')
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

function sendAuditMessage() {
  
  const message = {
    messageType: "CLI_AUDIT_FILE",
    filePath: batchain.audit,
  };
  
  console.log("message: ", message);
        
  client.write(JSON.stringify(message));
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
    sendAuditMessage();
  }
} else {  
  console.log(chalk.bold.magenta("Hello, welcome to Batchain!"));
  console.log(chalk.bold.magenta("Please make sure you have started the server"));
}