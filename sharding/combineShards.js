const fileSystem = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
const zlib = require('zlib');

// assume the manifest in user's local machine
// get the shards info from manifest file first, then assemble the shards
function composeShards(manifestFile) {
  const manifest = JSON.parse(fileSystem.readFileSync(manifestFile));
  const chunkIds = manifest.chunks;
  
  // TODO: get the shards via iterativeFindValue and store the shards in local disk
  // - iterate through the chunkIds array
  //  - find the shard file based on chunkId(might need to use JS `startsWith`)
  //   - if the file hasn't existed yet (by comparing file id)
  //      - store the file 
  //      - shardSaved += 1
  
  // after getting all the shards (shardSaved === 10), might need to set the default number as constants
  assembleShards(manifest, chunkIds);
}

function assembleShards(manifest, chunkIds) {
  // get the shards folder directions after downloading all the shards
  const chunkdir = './shards';
  const filePaths = chunkIds.map(chunkId => chunkdir + '/' + chunkId);

  const destDir = './downloads';
  if (!fileSystem.existsSync(destDir)){ fileSystem.mkdirSync(destDir); }
  
  const fileDes =  destDir + '/' + manifest.fileName;
  let writeStream = fileSystem.createWriteStream(fileDes);
  
  filePaths.forEach(path => {
    writeStream.write(fileSystem.readFileSync(path));
  });
  
  // once stream.write(chunk) returns false, emit the 'drain' event will be emitted 
  writeStream.once('drain', () => {
    console.log('The file has been saved, ready to be decrypted!');
    decrypt(fileDes);
  });
}