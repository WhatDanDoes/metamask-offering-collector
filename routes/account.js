const express = require('express');
const router = express.Router();
const ethers = require('ethers');
const models = require('../models');
const ensureAuthorized = require('../lib/ensureAuthorized');

/**
 * GET /account
 */
router.get('/:publicAddress?', ensureAuthorized, (req, res, next) => {

  if (req.params.publicAddress) {

    if (!req.agent.isSuper() && req.params.publicAddress !== req.agent.publicAddress) {

      if (req.headers['accept'] === 'application/json') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      req.flash('error', 'Forbidden');
      return res.render('account', { messages: req.flash(), agent: req.agent, errors: {}, superView: req.agent.isSuper() });
    }

    models.Agent.findOne({ publicAddress: req.params.publicAddress }).then(agent => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(200).json(agent);
      }
      res.render('account', { messages: req.flash(), agent: agent, errors: {}, superView: req.agent.isSuper() });
    }).catch(err => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(400).json({ message: err.errors[Object.keys(err.errors)[0]].message });
      }
      req.flash('error', 'Submission failed. Check your form.');
      res.status(400).render('account', { messages: req.flash(), errors: err.errors, agent: { ...updates, publicAddress: req.params.publicAddress }, superView: req.agent.isSuper() });
    });
  }
  else {
    if (req.agent.isSuper()) {
      models.Agent.find().sort({ updatedAt: -1 }).then(results => {
        agents = results.filter(a => a.publicAddress !== req.agent.publicAddress);
        if (req.headers['accept'] === 'application/json') {
          return res.status(200).json(agents);
        }
        res.render('accountListing', { messages: req.flash(), agents: agents, errors: {} });
      }).catch(err => {
        if (req.headers['accept'] === 'application/json') {
          return res.status(400).json({ message: err.errors[Object.keys(err.errors)[0]].message });
        }
        req.flash('error', 'Submission failed. Check your form.');
        res.status(400).render('account', { messages: req.flash(), errors: err.errors, agent: { ...updates, publicAddress: req.agent.publicAddress }, superView: req.agent.isSuper() });
      });
    }
    else {
      if (req.headers['accept'] === 'application/json') {
        return res.status(200).json(req.agent);
      }
      res.render('account', { messages: req.flash(), agent: req.agent, errors: {}, superView: req.agent.isSuper() });
    }
  }
});

/**
 * PUT /account
 */
router.put('/:publicAddress?', ensureAuthorized, (req, res, next) =>  {
  // Make sure no one tries modifying forbidden properties
  const updates = {};
  for (let prop in req.body) {
    if (['publicAddress', 'nonce'].includes(prop)) {
      if (req.headers['accept'] === 'application/json') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(403).render('account', { messages: { error: 'Unauthorized' }, agent: req.agent, errors: {}, superView: req.agent.isSuper() });
    }
    updates[prop] = req.body[prop];
  }


  if (req.params.publicAddress) {

    if (!req.agent.isSuper() && req.params.publicAddress !== req.agent.publicAddress) {

      if (req.headers['accept'] === 'application/json') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      req.flash('error', 'Forbidden');
      return res.redirect('/account');
    }

    models.Agent.findOneAndUpdate({ publicAddress: req.params.publicAddress }, updates, { runValidators: true }).then(obj => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(201).json({ message: 'Info updated' });
      }
      req.flash('success', 'Info updated');
      res.redirect(`/account/${req.params.publicAddress}`);
    }).catch(err => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(400).json({ message: err.errors[Object.keys(err.errors)[0]].message });
      }
      req.flash('error', 'Submission failed. Check your form.');
      res.status(400).render('account', { messages: req.flash(), errors: err.errors, agent: { ...updates, publicAddress: req.params.publicAddress }, superView: req.agent.isSuper() });
    });
  }
  else {
    models.Agent.findOneAndUpdate({ publicAddress: req.agent.publicAddress }, updates, { runValidators: true }).then(obj => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(201).json({ message: 'Info updated' });
      }
      req.flash('success', 'Info updated');
      res.redirect('/account');
    }).catch(err => {
      if (req.headers['accept'] === 'application/json') {
        return res.status(400).json({ message: err.errors[Object.keys(err.errors)[0]].message });
      }
      req.flash('error', 'Submission failed. Check your form.');
      res.status(400).render('account', { messages: req.flash(), errors: err.errors, agent: { ...updates, publicAddress: req.agent.publicAddress }, superView: req.agent.isSuper() });
    });
  }
});

module.exports = router;
