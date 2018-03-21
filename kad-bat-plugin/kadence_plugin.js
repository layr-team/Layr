

module.exports.kad_bat = function(node) {

  const { identity } = node;

  node.use('BATNODE', (req, res, next) => {
    let contact = node.batNode
    res.send([contact]);
  });


  node.getOtherBatNodeContact = function(targetNode, callback) {
    let batcontact = node.batNode
    node.send('BATNODE', batcontact, targetNode, callback);
  };

};
