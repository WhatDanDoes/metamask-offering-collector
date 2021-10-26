const express = require('express');
const router = express.Router();
const ensureAuthorized = require('../lib/ensureAuthorized');

/**
 * GET /transfer
 */
router.get('/', ensureAuthorized, (req, res, next) => {
  if (req.agent) {
    if (req.agent.isSuper()) {
      req.flash('info', 'I cannot allow you to send ETH to your own wallet, Dave');
      return res.redirect('/transaction');
    }
    res.render('transfer', { messages: req.flash(), agent: req.agent });
    //res.redirect('/transfer');
  }
  else {
    req.flash('error', 'You need to confirm your identity first');
    res.redirect('/');
  }
});

module.exports = router;
