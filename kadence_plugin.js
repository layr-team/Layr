

module.exports.kad_bat = function(node) {


  node.use('BATNODE', (req, res, next) => {
    let contact = node.batNode.address
    if (node.batNode.server){
      res.send(contact);
    } else {
      res.send(['false'])
    }

  });


  node.getOtherBatNodeContact = function(targetNode, callback) {
    let batcontact = node.batNode.address
    node.send('BATNODE', batcontact, targetNode, callback); // batcontact is an object, targetNode is a contact tuple from a bucket
  };

};


module.exports.stellar_account = function(node) {
  node.use('STELLAR', (req, res, next) => {
    let stellarId = node.batNode.stellarAccountId;
    console.log('my stellar id is: ', stellarId)
    res.send([`${stellarId}`])
  })

  node.getOtherNodeStellarAccount = function(targetNode, callback) {
    console.log('my stellar id is: ', node.batNode.stellarAccountId)
    console.log("requesting this node's stellar ID: ", targetNode)
    node.send('STELLAR', null, targetNode, callback)
  }
}