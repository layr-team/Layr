const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const encryptor = require('../encrypt/encrypt.js');

function sha1Hash(file) {
  const fileData = fs.readFileSync(file);
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function generateManifest(filename, filesize) {
  return { fileName: filename, fileSize: filesize, chunks: [] };
}

function addManifestToFile(file, hashId) {
  const sizeInByte = fs.statSync(file).size;
  const filename = path.basename(file);
  const manifest = generateManifest(filename, sizeInByte);

  const manifestName = hashId + '.bat';
  const dir = './manifest';

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  return fs.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), (err) => {
    if (err) throw err;
    console.log('The manifest file has been saved!');
  });
}

encryptor('../stored/example.txt');

function uploadProccesor() {
  const encryptedFile = '../stored/example.txt' + '.crypt';
  
  const hash = sha1Hash(encryptedFile);
  
  addManifestToFile(encryptedFile, hash);
}

setTimeout(uploadProccesor, 500);

