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
        console.log('Your Stellar account has been created... Type: batchain --stellar to see your balance\n');
      }
    });
  }

  const getAccountInfo = (publicKey) => {
    console.log("Public account ID: ",publicKey)
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

  const sendPayment = (destinationAccountId, secretKey, amount, onSuccess) => {
    StellarSdk.Network.useTestNetwork();
    let sourceKeys = StellarSdk.Keypair.fromSecret(secretKey);
    stellarServer.loadAccount(destinationAccountId).then(() => {
      return stellarServer.loadAccount(sourceKeys.publicKey())
    }).then((sourceAccount) => {
      console.log("building transaction....")
      let transaction = new StellarSdk.TransactionBuilder(sourceAccount)
      .addOperation(StellarSdk.Operation.payment({
        destination: destinationAccountId,
        asset: StellarSdk.Asset.native(),
        amount: amount
      })).build();
      transaction.sign(sourceKeys);
      return stellarServer.submitTransaction(transaction);
    }).then((result) => {
      onSuccess(result)
    }).catch((error) => {
      console.log('there was an error! ', error)
    })
  }

  createEscrowAccount = (secretKey, shaSignerKey, callback) => {
    StellarSdk.Network.useTestNetwork();
    let sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    let escrowKeypair = StellarSdk.Keypair.random();
    (async () => {
      try{
        const account = await stellarServer.loadAccount(sourceKeypair.publicKey())
        let transaction = new StellarSdk.TransactionBuilder(account)
        .addOperation(StellarSdk.Operation.createAccount({
          destination: escrowKeypair.publicKey(),
          startingBalance: '100'
        })).build();
        transaction.sign(sourceKeypair);
        stellarServer.submitTransaction(transaction).then(() => {
          return stellarServer.loadAccount(escrowKeypair.publicKey())
        }).then((escrowAccount) => {
          console.log(shaSignerKey)
          let transaction = new StellarSdk.TransactionBuilder(escrowAccount)
          .addOperation(StellarSdk.Operation.setOptions({
            signer: {sha256Hash: shaSignerKey, weight: 1},
            masterWeight: 4,
            lowThreshold: 3,
            medThreshold: 1,
            highThreshold: 3
          })).build();
          transaction.sign(escrowKeypair)
          return stellarServer.submitTransaction(transaction)
        }).then(() => {
          callback(escrowKeypair)
        }).catch((error) => {
          console.log(error)
        })
      }catch(e){
        console.log('error: ', e)
      }
    })();
    
  }

  acceptPayment = (shaSignerKey, escrowAccountKey, myAccountId) => {
    let shaSignerKey = StellarSdk.Keypair.fromPublicKey(shaSignerKey)
    StellarSdk.Network.useTestNetwork();
    (async () => {
      
      
      try{
        let escrowAccount = await stellarServer.loadAccount(escrowAccountKey)
        console.log(escrowAccount)
        let transaction = new StellarSdk.TransactionBuilder(escrowAccount)
        .addOperation(StellarSdk.Operation.payment({
          destination: myAccountId,
          asset: StellarSdk.Asset.native(),
          amount: '10'
        })).build();
        transaction.sign(shaSignerKey);
        stellarServer.submitTransaction(transaction)
      }catch(e){
        console.log(e)
      }
      })();
    
  }


  return {
    generateKeys,
    createNewAccount,
    getAccountInfo,
    accountExists,
    sendPayment,
    createEscrowAccount,
    acceptPayment
  }

})()