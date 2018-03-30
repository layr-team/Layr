const StellarSdk = require('stellar-sdk');
const request = require('request');
const stellarServer = new StellarSdk.Server('https://horizon-testnet.stellar.org');



exports.stellar = (function() {
  const generateKeys = () => {
    return StellarSdk.Keypair.random();
  }

  const createNewAccount = (publicKey) => {
    request.get({
      url: 'https://friendbot.stellar.org',
      qs: { addr: publicKey },
      json: true
    }, (error, response, body) => {
      if (error || response.statusCode !== 200) {
        console.error('ERROR!', error || body);
      }
      else {
        console.log('SUCCESS! You have a new account :)\n', body);
      }
    });
  }

  const getAccountInfo = (publicKey) => {
    console.log(publicKey)
    stellarServer.loadAccount(publicKey).then( (account) => {
      console.log('Balances for account: ' + publicKey);
      account.balances.forEach((balance) =>{
        console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
      });
    });
  }

  const accountExists = (publicKey, doesExist, doesNotExist) => {
    stellarServer.loadAccount(publicKey).then((account) => {doesExist(account)}, () => {doesNotExist(publicKey)})
  }



  return {
    generateKeys,
    createNewAccount,
    getAccountInfo,
    accountExists
  }

})()