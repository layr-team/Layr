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

For `npm`: 
1. Run `npm install -g` before running any `batchain` option or command, make sure to 
2. Need to run `npm install -g` when making bin changes
3. If "chalk" is not working for you, run `npm insatll chalk --save` to make the command line more colorful

For `yarn`:
1. Run `yarn link` to create a symbolic link between project directory and executable command
2. Open another terminal window, run `batchain` and you should see:
```
 Usage: batchain [options] [command]


  Commands:

    sample      see the sample nodes running
    help [cmd]  display help for [cmd]

  Options:

    -h, --help  output usage information
    -l, --list  view your list of uploaded files in BatChain network
  ```