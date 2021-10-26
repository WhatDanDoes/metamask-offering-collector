const _appName = require('../../package.json').name;
const fs = require('fs');
const cheerio = require('cheerio');
const sigUtil = require('eth-sig-util');
const ethUtil = require('ethereumjs-util');
const request = require('supertest-session');
const app = require('../../app');
const models = require('../../models');

describe('auth', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

  // These were provided by ganache-cli
  const _publicAddress = '0x034F8c5c8381Bf45511d071875333Eba143Bd10e';
  const _privateAddress = '0xb30b64470fe770bbe8e9ff6478e550ce99e7f38d8e07ec2dbe27e8ff45742cf6';

  afterEach(done => {
    models.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('GET /introduce', () => {

    let signingMessage;
    beforeEach(async () => {
      signingMessage = fs.readFileSync('./message.txt', 'utf8');
    });

    it('starts a session on API access', done => {
      const session = request(app);
      expect(session.cookies.length).toEqual(0);
      session
        .get('/auth/introduce')
        .query({ publicAddress: _publicAddress })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(1);
          expect(session.cookies[0].name).toEqual(_appName);
          expect(session.cookies[0].value).toBeDefined();
          expect(typeof session.cookies[0].expiration_date).toEqual('number');
          expect(session.cookies[0].expiration_date).not.toEqual(Infinity);
          expect(session.cookies[0].path).toEqual('/');
          expect(session.cookies[0].explicit_path).toBe(true);
          expect(session.cookies[0].domain).toBeUndefined();
          expect(session.cookies[0].explicit_domain).toBe(false);
          expect(session.cookies[0].noscript).toBe(true);

          //
          // 2020-10-19
          //
          // The bulk of the above are defaults. These require manual
          // testing, because in order for such a cookie to be put into the
          // cookie jar, it would have to be HTTPS
          //
          // expect(session.cookies[0].secure).toBe(true);
          // expect(session.cookies[0].sameSite).toEqual('none');
          //
          // These are test expectations. Production expetations are commented above
          expect(session.cookies[0].secure).toBe(false);
          expect(session.cookies[0].sameSite).toBeUndefined();

          done();
        });
    });

    it('starts a session on browser access', done => {
      const session = request(app);
      expect(session.cookies.length).toEqual(0);
      session
        .get('/auth/introduce')
        .query({ publicAddress: _publicAddress })
        .set('Accept', 'text/html')
        .expect('Content-Type', /html/)
        .expect(200)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(1);
          expect(session.cookies[0].name).toEqual(_appName);
          expect(session.cookies[0].value).toBeDefined();
          expect(typeof session.cookies[0].expiration_date).toEqual('number');
          expect(session.cookies[0].expiration_date).not.toEqual(Infinity);
          expect(session.cookies[0].path).toEqual('/');
          expect(session.cookies[0].explicit_path).toBe(true);
          expect(session.cookies[0].domain).toBeUndefined();
          expect(session.cookies[0].explicit_domain).toBe(false);
          expect(session.cookies[0].noscript).toBe(true);

          //
          // 2020-10-19
          //
          // The bulk of the above are defaults. These require manual
          // testing, because in order for such a cookie to be put into the
          // cookie jar, it would have to be HTTPS
          //
          // expect(session.cookies[0].secure).toBe(true);
          // expect(session.cookies[0].sameSite).toEqual('none');
          //
          // These are test expectations. Production expetations are commented above
          expect(session.cookies[0].secure).toBe(false);
          expect(session.cookies[0].sameSite).toBeUndefined();

          done();
        });
    });


    it('sets maximum cookie age to one hour', done => {
      const session = request(app);
      session
        .get('/auth/introduce')
        .query({ publicAddress: _publicAddress })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(1);
          expect(session.cookies[0].expiration_date <= Date.now() + 1000 * 60 * 60).toBe(true);
          done();
        });
    });

    describe('success', () => {

      describe('first onboarding', () => {

        describe('api', () => {

          it('returns a public address and message with nonce for signing', done => {
            request(app)
              .get('/auth/introduce')
              .query({ publicAddress: _publicAddress })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(Object.keys(res.body.typedData.message).length).toEqual(2);
                expect(res.body.typedData.message.message).toEqual(signingMessage);
                expect(typeof BigInt(res.body.typedData.message.nonce)).toEqual('bigint');
                expect(res.body.publicAddress).toEqual(_publicAddress);

                done();
              });
          });

          it('creates a new Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(0);

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: _publicAddress })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(1);
                    expect(agents[0].publicAddress).toEqual(_publicAddress);

                    expect(typeof BigInt(agents[0].nonce)).toEqual('bigint');
                    expect(agents[0].nonce).toEqual(res.body.typedData.message.nonce);
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });

        describe('browser', () => {

          it('renders an instruction page with form-embedded public address', done => {
            request(app)
              .get('/auth/introduce')
              .query({ publicAddress: _publicAddress })
              .expect('Content-Type', /html/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                const $ = cheerio.load(res.text);
                expect($('#signed-message-form input[name="publicAddress"]').attr('value')).toContain(_publicAddress);
                expect($('#signed-message-form input[name="signature"]').attr('value')).toBeUndefined();

                done();
              });
          });

          it('creates a new Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(0);

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: _publicAddress })
                .expect('Content-Type', /html/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(1);
                    expect(agents[0].publicAddress).toEqual(_publicAddress);

                    expect(typeof BigInt(agents[0].nonce)).toEqual('bigint');
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });
      });

      describe('subsequent onboardings', () => {

        beforeEach(done => {
          request(app)
            .get('/auth/introduce')
            .query({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);
              done();
            });
        });

        describe('api', () => {

          it('returns a public address and message with nonce for signing', done => {
            request(app)
              .get('/auth/introduce')
              .query({ publicAddress: _publicAddress })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(Object.keys(res.body.typedData.message).length).toEqual(2);
                expect(res.body.typedData.message.message).toEqual(signingMessage);
                expect(typeof BigInt(res.body.typedData.message.nonce)).toEqual('bigint');
                expect(res.body.publicAddress).toEqual(_publicAddress);

                done();
              });
          });

          it('sets a new nonce in existing Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(1);
              expect(agents[0].publicAddress).toEqual(_publicAddress);
              const nonce = agents[0].nonce;

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: _publicAddress })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(1);
                    expect(agents[0].publicAddress).toEqual(_publicAddress);
                    expect(typeof BigInt(agents[0].nonce)).toEqual('bigint');
                    expect(agents[0].nonce).not.toEqual(nonce);
                    expect(agents[0].nonce).toEqual(res.body.typedData.message.nonce);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });

        describe('browser', () => {

          it('renders an instruction page with form-embedded public address', done => {
            request(app)
              .get('/auth/introduce')
              .query({ publicAddress: _publicAddress })
              .expect('Content-Type', /html/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                const $ = cheerio.load(res.text);
                expect($('#signed-message-form input[name="publicAddress"]').attr('value')).toContain(_publicAddress);
                expect($('#signed-message-form input[name="signature"]').attr('value')).toBeUndefined();

                done();
              });
          });

          it('sets a new nonce in existing Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(1);
              expect(agents[0].publicAddress).toEqual(_publicAddress);
              const nonce = agents[0].nonce;

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: _publicAddress })
                .expect('Content-Type', /html/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(1);
                    expect(agents[0].publicAddress).toEqual(_publicAddress);
                    expect(typeof BigInt(agents[0].nonce)).toEqual('bigint');
                    expect(agents[0].nonce).not.toEqual(nonce);
                    //expect(agents[0].nonce).toEqual(res.body.typedData.message.nonce);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });
      });

      describe('POST /prove', () => {

        let publicAddress, typedData, session;

        beforeEach(done => {
          session = request(app);
          session
            .get('/auth/introduce')
            .query({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);
              ({ publicAddress, typedData } = res.body);
              done();
            });
        });

        describe('success', () => {

          let signed;
          beforeEach(() => {
            signed = sigUtil.signTypedData(ethUtil.toBuffer(_privateAddress), {privateKey: _privateAddress, data: typedData, version: 'V3' });
          });

          describe('api', () => {

            it('returns 201 status with message', done => {
              session
                .post('/auth/prove')
                .send({ publicAddress: _publicAddress, signature: signed })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Welcome!');
                  done();
                });

            });

            it('attaches agent_id to the session', done => {
              models.mongoose.connection.db.collection('sessions').find({}).toArray((err, sessions) => {
                if (err) return done.fail(err);

                expect(sessions.length).toEqual(1);
                expect(JSON.parse(sessions[0].session).agent_id).toBeUndefined();

                session
                  .post('/auth/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .set('Accept', 'application/json')
                  .set('Content-Type', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    models.mongoose.connection.db.collection('sessions').find({}).toArray((err, sessions) => {
                      if (err) return done.fail(err);

                      expect(sessions.length).toEqual(1);
                      expect(JSON.parse(sessions[0].session).agent_id).toBeDefined();

                      models.Agent.find({}).then(agents => {
                        expect(agents.length).toEqual(1);
                        expect(agents[0].publicAddress).toEqual(_publicAddress);

                        expect(JSON.parse(sessions[0].session).agent_id).toEqual(agents[0]._id.toString());

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                  });
              });
            });
          });

          describe('browser', () => {

            it('returns a redirect to the transfer app with a message', done => {
              session
                .post('/auth/prove')
                .set('Content-Type', 'application/json')
                .send({ publicAddress: _publicAddress, signature: signed })
                .expect(302)
                .expect('Location', /\/transfer$/)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Follow redirect
                  session
                    .get(res.header['location'])
                    .expect(200)
                    .end((err, res) => {

                      const $ = cheerio.load(res.text);
                      expect($('#messages .alert.alert-success').text()).toContain('Welcome!');
                      done();
                    });
                });
            });

            it('attaches agent_id to the session', done => {
              models.mongoose.connection.db.collection('sessions').find({}).toArray((err, sessions) => {
                if (err) return done.fail(err);

                expect(sessions.length).toEqual(1);
                expect(JSON.parse(sessions[0].session).agent_id).toBeUndefined();

                session
                  .post('/auth/prove')
                  .set('Accept', 'text/html')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .expect(302)
                  .expect('Location', /\/transfer$/)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    models.mongoose.connection.db.collection('sessions').find({}).toArray((err, sessions) => {
                      if (err) return done.fail(err);

                      expect(sessions.length).toEqual(1);
                      expect(JSON.parse(sessions[0].session).agent_id).toBeDefined();

                      models.Agent.find({}).then(agents => {
                        expect(agents.length).toEqual(1);
                        expect(agents[0].publicAddress).toEqual(_publicAddress);

                        expect(JSON.parse(sessions[0].session).agent_id).toEqual(agents[0]._id.toString());

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                  });
              });
            });
          });
        });

        describe('failure', () => {

          describe('bad private key', () => {

            let signed;

            beforeEach(() => {
              // Bad private key obtained from ganache-cli
              signed = sigUtil.signTypedData(ethUtil.toBuffer('0x0fb6b6f3f49a79f5b49bd71386cc5016762a07340d903a5590a9433253779d8b'),
                { privateKey: '0x0fb6b6f3f49a79f5b49bd71386cc5016762a07340d903a5590a9433253779d8b', data: typedData, version: 'V3' });
            });

            describe('api', () => {

              it('returns 401 status with message', done => {
                request(app)
                  .post('/auth/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .set('Content-Type', 'application/json')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Signature verification failed');
                    done();
                  });
              });
            });

            describe('browser', () => {

              it('returns 302 status with message', done => {
                session = request(app);
                session
                  .post('/auth/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .expect(302)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // Follow redirect
                    session
                      .get(res.header['location'])
                      .expect(200)
                      .end((err, res) => {

                        const $ = cheerio.load(res.text);
                        expect($('#messages .alert.alert-error').text()).toContain('Signature verification failed');
                        done();
                      });
                  });
              });
            });
          });

          describe('incorrect nonce', () => {

            describe('api', () => {

              it('returns 401 status with message', done => {
                typedData.message.nonce = Math.floor(Math.random() * 1000000).toString();

                signed = sigUtil.signTypedData(ethUtil.toBuffer(_privateAddress), {
                  privateKey: _privateAddress,
                  data: typedData,
                  version: 'V3'
                });

                request(app)
                  .post('/auth/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .set('Content-Type', 'application/json')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Signature verification failed');
                    done();
                  });
              });
            });

            describe('browser', () => {

              it('returns 302 status with message', done => {
                typedData.message.nonce = Math.floor(Math.random() * 1000000).toString();

                signed = sigUtil.signTypedData(ethUtil.toBuffer(_privateAddress), {
                  privateKey: _privateAddress,
                  data: typedData,
                  version: 'V3'
                });


                session = request(app)
                session
                  .post('/auth/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .expect(302)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // Follow redirect
                    session
                      .get(res.header['location'])
                      .expect(200)
                      .end((err, res) => {

                        const $ = cheerio.load(res.text);
                        expect($('#messages .alert.alert-error').text()).toContain('Signature verification failed');
                        done();
                      });
                  });
              });
            });
          });
        });
      });
    });

    describe('failure', () => {

      describe('invalid ethereum address', () => {

        describe('api', () => {

          it('returns an error', done => {
            request(app)
              .get('/auth/introduce')
              .query({ publicAddress: 'invalid ethereum address' })
              .set('Content-Type', 'application/json')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Invalid public address');
                done();
              });
          });

          it('does not create a new Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(0);

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: 'invalid ethereum address' })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(0);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });

        // 2021-10-1 This is kind of weird. My original plan was to implement
        // the auth flow with client-side fetches. If that's the only way, then
        // these tests don't make sense. If there is another way, then that
        // would be the better option for session-managed authentication, as it
        // is implemented here.
        describe('browser', () => {

          it('redirects', done => {
            session = request(app)
            session
              .get('/auth/introduce')
              .query({ publicAddress: 'invalid ethereum address' })
              .expect(302)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Follow redirect
                session
                  .get(res.header['location'])
                  .expect(200)
                  .end((err, res) => {

                    const $ = cheerio.load(res.text);
                    expect($('#messages .alert.alert-error').text()).toContain('I don\'t think you have Metamask installed');
                    done();
                  });
              });
          });

          it('does not create a new Agent record', done => {
            models.Agent.find({}).then(agents => {
              expect(agents.length).toEqual(0);

              request(app)
                .get('/auth/introduce')
                .query({ publicAddress: 'invalid ethereum address' })
                .expect(302)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Agent.find({}).then(agents => {
                    expect(agents.length).toEqual(0);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });

            }).catch(err => {
              done.fail(err);
            });
          });
        });
      });
    });
  });

  describe('GET /disconnect', () => {
    let session;

    beforeEach(done => {
      session = request(app);
      session
        .get('/auth/introduce')
        .query({ publicAddress: _publicAddress })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) return done.fail(err);
          done();
        });
    });

    it('redirects home without a message', done => {
      expect(session.cookies.length).toEqual(1);
      session
        .get('/auth/disconnect')
        .expect(302)
        .end((err, res) => {
          if (err) return done.fail(err);

          // Follow redirect
          session
            .get(res.header['location'])
            .expect(200)
            .end((err, res) => {

              // 2021-10-1 https://github.com/cheeriojs/cheerio/issues/798#issuecomment-171882953
              const $ = cheerio.load(res.text);
              expect($('#messages strong').length).toEqual(0);
              done();
            });
        });
    });

    it('clears the session', done => {
      expect(session.cookies.length).toEqual(1);
      session
        .get('/auth/disconnect')
        .expect(302)
        .end((err, res) => {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(0);
          done();
        });
    });
  });
});
