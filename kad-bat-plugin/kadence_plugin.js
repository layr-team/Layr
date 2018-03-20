

module.exports.kad_bat = function(node) {

  const { identity } = node;

  node.use('BATNODE', (err, req, res) => {
    console.log('received RPC')
    if (err) throw err;
    let contact = node.getSelfBatNodeContact()
    res.send([contact]);
  });


  node.getOtherBatNodeContact = function(targetNode, callback) {
    console.log('sending rpc')
    let batcontact = node.getSelfBatNodeContact()
    node.send('BATNODE', batcontact, targetNode, callback);
  };

};