## Layr


### Getting Started

To test locally:

`sudo yarn global add pm2`
`yarn install`
`cd Layr`
`yarn run start-all`

Result:
- This will start and daemonize both a locally-running seed node and a locally running layr node.
- To add more local layr nodes, just initialize multiple nodes in local-start.js, listening on different ports.


Seed node: A seednode is a node that other peers can contact in order to initially join the network.
layr node: A layr node is comprised of two parts: the kademlia node and the "bat node". The kademlia node is responsible for addressing file shards and other nodes using the kademlia-based DHT. The bat node is responsible for file transfers between peers.
