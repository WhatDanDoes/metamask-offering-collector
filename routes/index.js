const express = require('express');
const router = express.Router();

/**
 * Landing page
 */
router.get('/', (req, res, next) => {
  if (req.agent) {
    if (req.agent.isSuper()) {
      req.flash('info', 'I cannot allow you to send ETH to your own wallet, Dave');
      return res.redirect('/transaction');
    }
    //res.render('transfer', { messages: req.flash(), agent: req.agent });
    res.redirect('/transfer');
  }
  else {
    res.render('landing', { messages: req.flash() });
  }
});

module.exports = router;
