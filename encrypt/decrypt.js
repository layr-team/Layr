const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const path = require('path');

const fs = require('fs');
const zlib = require('zlib');

// file to decrpt
const file = 'orgexp.txt.crypt';

const DecryptHelper = (function(filepath) {
  // Path to temporarily store decrypted version of file to be uploaded
  const temppath = 'decrypt' + path.parse(filepath).name  // go back to original ext

  // get the file password from the previously designated secret file
  const secretpath = filepath + 'secret.env';
  const password = fs.readFileSync(secretpath);

  // input file
  const r = fs.createReadStream(filepath);

  // decrypt content
  const decrypt = crypto.createDecipher(algorithm, password);
  // unzip content
  const unzip = zlib.createGunzip();
  // write file
  const w = fs.createWriteStream(temppath);

  // start pipe
  console.log("The file is fully decrypted");
  r.pipe(decrypt).pipe(unzip).pipe(w);
});

DecryptHelper(file);
