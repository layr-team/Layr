

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


module.exports.howdy = function(node) {

  const { identity } = node;

  /**
   * Respond to HOWDY messages
   */
  node.use('HOWDY', (err, req, res) => {
    if (err) throw err;
    res.send(['howdy, neighbor']);
  });

  /**
   * Say howdy to our nearest neighbor
   */
  node.sayHowdy = function(callback, target) {
    console.log('sending howdy')

    node.send('HOWDY', ['howdy, neighbor'], target, callback);
  };

};