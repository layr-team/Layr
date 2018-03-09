## Batnode Prototype

### Demos

#### 1: Write a file across two nodes in a LAN.

Starting condition: demo/batnode1/stored has an `example.txt` file while demo/batnode2/stored is empty.

1) cd into demo/batnode1
2) run node batnode.js
3) open a new terminal session and cd into demo/batnode2
4) run node batnode.js

Ending condition: demo/batnode2/stored has a `example.txt-1` file.
