const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const encryptor = require('../encrypt/encrypt.js');
// const zlib = require('zlib');
// const algorithm = 'aes-256-cbc';

function sha1Hash(file) {
  // doesn't work with `readFile`, get `undefined` for fileData
  // const fileData = fs.readFile(file, (err, data) => {
  //   if (err) throw err;
  //   console.log(data);
  // });
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

const encryptedFile = encryptor('../stored/example.txt');

const hash = sha1Hash(encryptedFile);

console.log(hash);

addManifestToFile(encryptedFile, hash);
