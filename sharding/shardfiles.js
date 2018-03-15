const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');

function sha1HashContent(fileData) {
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function addShardsToManifest(manifest, filePath, manifestName, dir) {
  const fileSize = manifest.fileSize;
  const setChunkNum = 10; // default Chunk number from SIA: https://blog.sia.tech/how-to-put-data-on-the-sia-network-784499a65b
  const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
  const chunkSize = Math.floor(fileSize/chunkNumber);
 
  const readable = fs.createReadStream(filePath);
  readable.on('readable', function() {
    let chunk;
    // readable.read() is called automatically until the internal buffer is fully drained
    // you don't need remainder as the last chunkSize will equal to whatever bytes left
    while (null !== (chunk = readable.read(chunkSize))) {
      const chunkId = sha1HashContent(chunk);
      manifest.chunks.push(chunkId);
      console.log(`Received ${chunk.length} bytes of data.`);
      // console.log(manifest.chunks.length);
      
      storeShards(chunk, chunkId);
    }
  });
  readable.on('end', () => {
    writeToFolder(dir, manifestName, JSON.stringify(manifest), function() {
      console.log('The manifest file has been saved!');
    });
  });
}

function storeShards(chunk, chunkId) {
  const dir = './shards';

  if (!fs.existsSync(dir)){ fs.mkdirSync(dir); }
  
  const filePath = dir + '/' + chunkId;

  writeToFolder(dir, chunkId, chunk, function(err) {
    if (err) throw err;
    console.log("filePath: " + filePath + " size: " + fs.statSync(filePath).size);
  });
    
  // TODO: store iteratively
}

function writeToFolder(dir, filename, filecontent, callback) {
  return fs.writeFile(`${dir}/${filename}`, filecontent, callback);
}

const manifest = {"fileName":"pilate.mp4.crypt","fileSize":70640160,"chunks":[]};

addShardsToManifest(manifest, '../personal/pilate.mp4.crypt', 'shardtest.bat', '../upload-file/manifest'); 