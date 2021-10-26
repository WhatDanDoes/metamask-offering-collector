const fs = require('fs');
const cheerio = require('cheerio');
const sigUtil = require('eth-sig-util');
const ethUtil = require('ethereumjs-util');
const request = require('supertest-session');
const app = require('../../../app');
const models = require('../../../models');

describe('root auth', () => {

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

  // These were provided by ganache-cli
  const _publicAddress = '0x034F8c5c8381Bf45511d071875333Eba143Bd10e';
  const _privateAddress = '0xb30b64470fe770bbe8e9ff6478e550ce99e7f38d8e07ec2dbe27e8ff45742cf6';

  /**
   * Swap out existing public address in `.env`.
   *
   * `root` is whoever is configured there.
   */
  let _PUBLIC_ADDRESS;
  beforeAll(() => {
    _PUBLIC_ADDRESS = process.env.PUBLIC_ADDRESS;
    process.env.PUBLIC_ADDRESS = _publicAddress;
  });

  afterAll(() => {
    process.env.PUBLIC_ADDRESS = _PUBLIC_ADDRESS;
  });


  afterEach(done => {
    models.mongoose.connection.db.dropDatabase().then((err, result) => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authorized', () => {
    let session, root, response, $;

    describe('browser', () => {

      beforeEach(done => {
        session = request(app);
        session
          .get('/auth/introduce')
          .query({ publicAddress: _publicAddress })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) return done.fail(err);
            ({ publicAddress, typedData } = res.body);

            const signed = sigUtil.signTypedData(ethUtil.toBuffer(_privateAddress), { privateKey: _privateAddress, data: typedData, version: 'V3' });

            session
              .post('/auth/prove')
              .send({ publicAddress: _publicAddress, signature: signed })
              .expect('Content-Type', /text/)
              .expect(302)
              .end((err, res) => {
                if (err) return done.fail(err);

                response = res;

                models.Agent.findOne({ where: { publicAddress: _publicAddress } }).then(result => {
                  root = result;

                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
      });

      it('lands in the right place', () => {
        expect(response.headers['location']).toEqual('/transaction');
      });

      it('displays a friendly message', done => {
        session
          .get(response.headers['location'])
          .expect('Content-Type', /text/)
          .expect(200)
          .end((err, res) => {
            if (err) return done.fail(err);

            $ = cheerio.load(res.text);

            expect($('.alert.alert-success').text().trim()).toEqual('Welcome, root!');

            done();
          });
      });

      it('does not allow visiting the transfer app page', done => {
        session
          .get('/')
          .expect('Content-Type', /text/)
          .expect(302)
          .end((err, res) => {
            if (err) return done.fail(err);

            expect(res.headers['location']).toEqual('/transaction');

            session
              .get(res.headers['location'])
              .expect('Content-Type', /text/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);

                $ = cheerio.load(res.text);

                expect($('.alert.alert-info').text().trim()).toEqual('I cannot allow you to send ETH to your own wallet, Dave');

                done();
              });
          });
      });

      it('allows visiting the account listing page', done => {
        session
          .get('/account')
          .expect('Content-Type', /text/)
          .expect(200)
          .end((err, res) => {
            if (err) return done.fail(err);
            done();
          });
      });

      it('allows visiting the transaction listing page', done => {
        session
          .get('/transaction')
          .expect('Content-Type', /text/)
          .expect(200)
          .end((err, res) => {
            if (err) return done.fail(err);
            done();
          });
      });
    });
  });
});
