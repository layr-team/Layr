

module.exports = function(node) {

  const { identity } = node;

  /**
   * Respond to HOWDY messages
   */
  node.use('HOWDY', (req, res) => {
    res.send(['howdy, neighbor']);
  });

  /**
   * Say howdy to our nearest neighbor
   */
  node.sayHowdy = function(callback) {
    let neighbor = [
      ...node.router.getClosestContactsToKey(identity).entries()
    ].shift();

    node.send('HOWDY', ['howdy, neighbor'], neighbor, callback);
  };

};