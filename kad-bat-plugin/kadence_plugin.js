

module.exports.kad_bat = function(node) {


  node.use('BATNODE', (req, res, next) => {
    let contact = node.batNode
    res.send([contact]);
  });


  node.getOtherBatNodeContact = function(targetNode, callback) {
    console.log('sending')
    let batcontact = node.batNode
    node.send('BATNODE', batcontact, targetNode, callback); // batcontact is an object, targetNode is a contact tuple from a bucket
  };

};
