## Batnode Prototype

## To do:

1. Update the `batnode.uploadFile` and `batnode.retrieveFile` methods to iteratively request shards in the manifest

### Demos

#### 1: Write a file across two nodes in a LAN.

`node1` will write to `node2`, which resides in another directory.

Starting condition:  
- `demo/batnode1/hosted` has an `example.txt` file.
- Delete any files in `demo/batnode2/hosted`.

1) cd into `demo/batnode1`
2) run `node batnode.js`
3) open a new terminal session and `cd` into `demo/batnode2`
4) run `node batnode.js`

Ending condition: `demo/batnode2/hosted` has a `example.txt-1` file.

## Run `npm install -g` to start CLI