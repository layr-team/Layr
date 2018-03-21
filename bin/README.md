## CLI for BatChain P2P File Storage

## Same CLI feature as node.js

### Demo for sample:
1. Type `batchain sample` to create server for node1
2. Open another terminal window, select the options to upload/download files while connecting to node1
  - `batchain sample -u <filePath>`:
    `batchain sample -u './personal/example.txt'``
  - `batchain sample -d <manifestFile>`
3. If your server window keeps running, you can view your current uploaded lists in another window
  - `batchain -l`
4. You can always run `batchain -h` to review the available command and options

## Note:
1. Before run any `batchain` option or command, make sure to run `npm install -g`
2. Need to run `npm install -g` when making bin changes
3. If "chalk" is not working for you, run `npm insatll chalk --save` to make the command line more colorful
