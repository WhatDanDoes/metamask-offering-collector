const express = require('express');
const router = express.Router();

/**
 * Landing page
 */
router.get('/', (req, res, next) => {
  res.render('index', { title: process.env.TITLE, messages: req.flash(), agent: req.agent });
});

module.exports = router;
