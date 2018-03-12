const fs = require('fs');
const crypto = require('crypto');

function sha1Hash(file) {
  // doesn't work with `readFile`, get `undefined` for fileData
  // const fileData = fs.readFile(file, (err, data) => {
  //   if (err) throw err;
  //   console.log(data);
  // });
  const fileData = fs.readFileSync(file); 
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

const hash = sha1Hash('../stored/example.txt');

console.log(hash);

