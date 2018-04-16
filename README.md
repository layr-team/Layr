## Layr


### Getting Started

#### Seed node and BatNode Generation

Layr is an alpha version software that aims to implement a transaction-based p2p distributed file storage system.

Each Layr peer has two nodes: a Kademlia node that is responsible for managing contact information between nodes as well as addressing the locations of files in the network, and a BatNode which is responsible for handling file data transfer, retrieval, and auditing.

In its current state, an NAT traversal strategy in which a Layr peer's Kademlia node brokers connections between two Layr nodes' BatNodes using TCP hole-punching is something we are currently working on. Our case study (coming soon) will detail our approach to NAT traversal.

We define a Layr node as a BatNode-KademliaNode pair running on a device.

A Layr network needs at least one seednode running so that other nodes can join the network. So, before anything else, you should construct a seednode. A seednode is not a Layr node because it does not include a BatNode: it is an individual Kademlia node.

To get a Layr node up and running on a server, ssh into the server and fork this repo. You should then `cd` into the repo and run `yarn install`. After running `yarn install`, `cd` into the root directory of the project and run `yarn link`. This will allow you to use the CLI.

To set up a seed node specifically, update the constants.js file to match your server's host information. Then, `cd` into the `seednode` directory and run `node seed.js`. Further nodes that wish to join your network will need this updated version of constants.js in order to join your network.

For Layr nodes that will be participating as data hosts and/or data owners, ssh into a new server, `cd` into the root directory of the project,and run `yarn install` and then `yarn link`. After you do that, run `node start.js`. In a second terminal window, ssh into the same server and `cd` into the repo's root directory and run `batchain -h` for a list of commands you can use.

#### Data Owners
Chances are that you will upload files to the network. The question is: If you want to upload the file from one machine and retrieve it from another, what do you do?

To retrieve a file, you need the file name, the ids of the shard copies on the network, and the secret key used to encrypt (and decrypt) the file's contents.

Therefore, you can retrieve your file from any device as long as:
1. The Layr node on that device has the manifest file corresponding to the file you wish to retrieve.
2. The Layr node's `.env` file contains the private key you used to encrypt the file's data

In other words, what defines you as the owner of the data is possession of the manifest file that was generated when you uploaded the file to the network as well as the private key you used to encrypt that file's data.

If you simply run `node start.js` without manually creating a `.env` file and without including a PRIVATE_KEY in that file, then a private key will be generated for you automatically.


### Stellar

Layr uses the stellar network to allow peer nodes to pay for space on other peer nodes' devices. In its current state, Layr is a proof-of-concept project and therefore uses Stellar's test-net. The Stellar test-net provides test-currency for transactions (10,000 lumens per account).

When a node is launched with `node start.js`, a secret `.env` file is created for you. This file will contain your private key for decrypting and encrypting file data that you upload to the network, as well as your Stellar account information. If you already have a stellar account, you should create the `.env` file manually and include your stellar public id like so: `STELLAR_ACCOUNT_ID=xxx` as well as your stellar secret key: `STELLAR_SECRET=xxx`

Both are required for transactions to work properly.


### Demos

#### Note:

For `npm`:
1. Run `npm install -g` before running any `batchain` option or command, make sure to
2. Need to run `npm install -g` when making bin changes
3. If "chalk" is not working for you, run `npm install chalk --save` to make the command line more colorful

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

#### Local CLI demo 2 - upload and audit a file

First step is to make some temporary changes to allow the code to run locally

Uncomment the seed node information and comment out the remote seed node info. The file should end up looking like this:

```
// For network testing:
// exports.SEED_NODE = ['a678ed17938527be1383388004dbf84246505dbd', { hostname: '167.99.2.1', port: 80 }];
// exports.CLI_SERVER = {host: 'localhost', port: 1800};
// exports.BATNODE_SERVER_PORT = 1900;
// exports.KADNODE_PORT = 80;

// For local testing
exports.SEED_NODE = ['a678ed17938527be1383388004dbf84246505dbd', { hostname: 'localhost', port: 1338 }]
exports.BASELINE_REDUNDANCY = 3;
```

Next, change this line of code in the `while` loop

```
getClosestBatNodeToShard(shardId, callback){
  this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
    let i = 0
    let targetKadNode = res[0]; // res is an array of these tuples: [id, {hostname, port}]
    while (targetKadNode[1].hostname === this.kadenceNode.contact.hostname &&
          (targetKadNode[1].port === this.kadenceNode.contact.port) {
```

to this.

```
    // while (targetKadNode[1].hostname === this.kadenceNode.contact.hostname &&
    while (targetKadNode[1].port === this.kadenceNode.contact.port) {
```

Now we can proceed with the demo.

1. `cd` into `/audit` directory
2. If you haven't already, run `yarn link`  to create a symbolic link between project directory and executable command. This only needs to be done once.
3. Open 3 additional terminal windows or tabs that are also in the `/audit` directory
4. In the first terminal, `cd` into `server` directory. Run `rm -r db` first and then run `node node.js`
5. In the second terminal, `cd` into `server2` directory. Run `rm -r dbb` first and then run `node node.js`
6. In the third terminal, `cd` into `client` directory. Run `rm -r dbbb` first and then run `node node.js`. This boots up the CLI server which will listen for CLI commands. Wait for a message to log out saying the CLI is ready before issuing any commands.
7. In the fourth terminal, `cd` into `client` as well. Here we can issue `batchain` CLI commands.
8. There should be a example file in the `personal` directory, so run `batchain -u ./personal/example.txt`. Wait a few seconds for the 24 or so shard files to be written to `server` and `server2` `/host` directories.
9. Kill the process manually (Control-C) and run `batchain -a ./manifest/$MANIFESTNAME.batchain`. Replace `$MANIFESTNAME` with the manifest file name generated on `client/manifest` directory.
