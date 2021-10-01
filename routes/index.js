const fs = require('fs');
const express = require('express');
const router = express.Router();
const models = require('../models');

const sigUtil = require('eth-sig-util');
const ethUtil = require('ethereumjs-util');

/**
 * Ensures the message stays the same on signature verification
 */
function getSigningMessage(nonce, done) {
  fs.readFile('./message.txt', 'utf8', (err, text) => {
    if (err) return done(err);
    done(null, [
      {
        type: 'string',
        name: 'Message',
        value: text
      },
      {
        type: 'string',
        name: 'nonce',
        value: nonce,
      }
    ]);
  });
};

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: process.env.TITLE, messages: req.flash() });
});

/**
 * This is where the nonce gets created and sent
 */
router.post('/introduce', (req, res) => {
  models.Agent.findOne({ where: { publicAddress: req.body.publicAddress } }).then(agent => {

   if (agent) {
     const nonce = Math.floor(Math.random() * 1000000).toString();
     agent.nonce = nonce;
     agent.save({ validateBeforeSave: false }).then(agent => {

       getSigningMessage(nonce, (err, message) => {
         if (err) return res.status(500).json({ message: err.message });
         res.status(201).json({ message: message, publicAddress: agent.publicAddress });
       });
     }).catch(err => {
       res.status(500).json(err);
     });
   }
   else {
     models.Agent.create({ publicAddress: req.body.publicAddress }).then(agent => {
       getSigningMessage(agent.nonce, (err, message) => {
         if (err) return res.status(500).json({ message: err.message });
         res.status(201).json({ message: message, publicAddress: agent.publicAddress });
       });
     }).catch(err => {
       if (req.headers['accept'] === 'application/json') {
         if (err.errors['publicAddress']) {
           res.status(400).json({ message: err.errors['publicAddress'].message });
         }
         else {
           res.status(400).json({ message: err.message });
         }
       }
       else {
         if (err.errors['publicAddress']) {
           req.flash('error', err.errors['publicAddress'].message);
         }
         else {
           req.flash('error', err.message);
         }
         res.redirect('/');
       }
     });
   }
  }).catch(err => {
    res.status(500).json(err);
  });
});

/**
 * Takes signed message and verifies signatures
 *
 */
router.post('/prove', (req, res) => {
  models.Agent.findOne({ where: { publicAddress: req.body.publicAddress } }).then(agent => {
    getSigningMessage(agent.nonce, (err, message) => {
      if (err) return res.status(500).json({ message: err.message });

      //
      // 2021-9-28 https://www.toptal.com/ethereum/one-click-login-flows-a-metamask-tutorial
      //
      // We now are in possession of message, publicAddress and signature. We
      // can perform an elliptic curve signature verification with ecrecover
      //
      const msgBuffer = ethUtil.toBuffer(JSON.stringify(message));
      const msgHash = ethUtil.hashPersonalMessage(msgBuffer);
      //const msgBuffer = ethUtil.toBuffer(JSON.stringify(message));
      //const msgHash = ethUtil.keccak256(msgBuffer);
      const signatureBuffer = ethUtil.toBuffer(req.body.signature);
      const signatureParams = ethUtil.fromRpcSig(signatureBuffer);
      const publicKey = ethUtil.ecrecover(
        msgHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s
      );
      const addressBuffer = ethUtil.publicToAddress(publicKey);
      const address = ethUtil.bufferToHex(addressBuffer);
console.log('HEEEEEEEEEEEEEEERE');
console.log('address retrieved', address);
console.log('actual address', agent.publicAddress);



//      const msgHash = ethereumJsUtil.sha3(msg);
//      const signatureBuffer = ethereumJsUtil.toBuffer(signature);
//      const signatureParams = ethereumJsUtil.fromRpcSig(signatureBuffer);
//      const publicKey = ethereumJsUtil.ecrecover(
//        msgHash,
//        signatureParams.v,
//        signatureParams.r,
//        signatureParams.s
//      );
//      const addressBuffer = ethereumJsUtil.publicToAddress(publicKey);
//      const address = ethereumJsUtil.bufferToHex(addressBuffer);
//
//console.log('HEEEEEEEEEEEEEEERE');
//console.log(address);
//console.log(agent.publicAddress);


      if (address.toLowerCase() === agent.publicAddress.toLowerCase()) {
        req.session.agent_id = agent._id;
        req.session.save(err => {
          if (err) return res.status(500).json({ message: 'Could not establish session' });

          if (req.headers['accept'] === 'application/json') {
            return res.status(201).json({ message: 'Welcome!' });
          }

          req.flash('success', 'Welcome!');
          res.redirect('/');
        });
      }
      else {
        if (req.headers['accept'] === 'application/json') {
          return res.status(401).json({ message: 'Signature verification failed' });
        }

        req.flash('error', 'Signature verification failed');
        res.redirect('/');
      }
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

/**
 * Logout
 */
router.get('/disconnect', (req, res) => {
  for (let cookie in req.cookies) {
    res.cookie(cookie, '', {expires: new Date(0)});
  }

  // Tests suggest this doesn't do anything even with `unset: 'destroy'`.
  // I.e., the client still has a cookie (see above)
  req.session.destroy(err => {
    if (err) console.error(err);

    res.redirect('/');
  });
});

module.exports = router;
