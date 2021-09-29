const _appName = require('../../package.json').name;
const fs = require('fs');
const ethers = require('ethers');
const request = require('supertest-session');
const app = require('../../app');
const models = require('../../models');

describe('identify', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

  // These were provided by ganache-cli
  const _publicAddress = '0x034F8c5c8381Bf45511d071875333Eba143Bd10e';
  const _privateAddress = '0xb30b64470fe770bbe8e9ff6478e550ce99e7f38d8e07ec2dbe27e8ff45742cf6';

  afterEach(done => {
    models.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch(function(err) {
      done.fail(err);
    });
  });

  describe('POST /introduce', () => {

    let signingMessage;
    beforeEach(async () => {
      signingMessage = fs.readFileSync('./message.txt', 'utf8');
    });

    it('starts a session', done => {
      const session = request(app);
      expect(session.cookies.length).toEqual(0);
      session
        .post('/introduce')
        .send({ publicAddress: _publicAddress })
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

    it('sets maximum cookie age to one hour', done => {
      const session = request(app);
      session
        .post('/introduce')
        .send({ publicAddress: _publicAddress })
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

        it('returns a public address and message with nonce for signing', done => {
          request(app)
            .post('/introduce')
            .send({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message.length).toEqual(2);
              expect(res.body.message[0].name).toEqual('Message');
              expect(res.body.message[0].value).toEqual(signingMessage);
              expect(res.body.message[1].name).toEqual('nonce');
              expect(typeof BigInt(res.body.message[1].value)).toEqual('bigint');
              expect(res.body.publicAddress).toEqual(_publicAddress);

              done();
            });
        });

        it('creates a new Agent record', done => {
          models.Agent.find({}).then(agents => {
            expect(agents.length).toEqual(0);

            request(app)
              .post('/introduce')
              .send({ publicAddress: _publicAddress })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                models.Agent.find({}).then(agents => {
                  expect(agents.length).toEqual(1);
                  expect(agents[0].publicAddress).toEqual(_publicAddress);

                  expect(typeof BigInt(agents[0].nonce)).toEqual('bigint');
                  expect(agents[0].nonce).toEqual(res.body.message[1].value);
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

      describe('subsequent onboardings', () => {

        beforeEach(done => {
          request(app)
            .post('/introduce')
            .send({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);
              done();
            });
        });

        it('returns a public address and message with nonce for signing', done => {
          request(app)
            .post('/introduce')
            .send({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);

              expect(res.body.message.length).toEqual(2);
              expect(res.body.message[0].name).toEqual('Message');
              expect(res.body.message[0].value).toEqual(signingMessage);
              expect(res.body.message[1].name).toEqual('nonce');
              expect(typeof BigInt(res.body.message[1].value)).toEqual('bigint');
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
              .post('/introduce')
              .send({ publicAddress: _publicAddress })
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
                  expect(agents[0].nonce).toEqual(res.body.message[1].value);

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

      describe('POST /prove', () => {

        let publicAddress, message, session;

        beforeEach(done => {
          session = request(app);
          session
            .post('/introduce')
            .send({ publicAddress: _publicAddress })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end((err, res) => {
              if (err) return done.fail(err);
              ({ publicAddress, message } = res.body);
              done();
            });
        });

        describe('success', () => {

          let signed;
          beforeEach(done => {
            const signer = new ethers.Wallet(_privateAddress);
            signer.signMessage(JSON.stringify(message)).then(result => {
              signed = result;
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns 201 status with message', done => {
            session
              .post('/prove')
              .send({ publicAddress: _publicAddress, signature: signed })
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
                .post('/prove')
                .send({ publicAddress: _publicAddress, signature: signed })
                .set('Accept', 'application/json')
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

        describe('failure', () => {

          describe('bad private key', () => {

            it('returns 401 status with message', done => {
              // Bad private key obtained from ganache-cli
              const signer = new ethers.Wallet('0x0fb6b6f3f49a79f5b49bd71386cc5016762a07340d903a5590a9433253779d8b');
              signer.signMessage(JSON.stringify(message)).then(signed => {

                request(app)
                  .post('/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Signature verification failed');
                    done();
                  });

              }).catch(err => {
                done.fail(err);
              });
            });
          });

          describe('incorrect nonce', () => {

            it('returns 401 status with message', done => {
              const _msgBadNonce = [...message];
              _msgBadNonce[1].nonce = Math.floor(Math.random() * 1000000).toString();

              const signer = new ethers.Wallet(_privateAddress);
              signer.signMessage(JSON.stringify(_msgBadNonce)).then(signed => {

                request(app)
                  .post('/prove')
                  .send({ publicAddress: _publicAddress, signature: signed })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Signature verification failed');
                    done();
                  });

              }).catch(err => {
                done.fail(err);
              });
            });
          });
        });
      });
    });

    describe('failure', () => {

      describe('invalid ethereum address', () => {

        it('returns an error', done => {
          request(app)
            .post('/introduce')
            .send({ publicAddress: 'invalid ethereum address' })
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
              .post('/introduce')
              .send({ publicAddress: 'invalid ethereum address' })
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
    });
  });

  describe('GET /disconnect', () => {
    let session;

    beforeEach(done => {
      session = request(app);
      session.post('/introduce')
        .send({ publicAddress: _publicAddress })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) return done.fail(err);
          done();
        });
    });

    it('redirects home and clears the session', done => {
      expect(session.cookies.length).toEqual(1);
      session
        .get('/disconnect')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(0);
          done();
        });
    });
  });
});


