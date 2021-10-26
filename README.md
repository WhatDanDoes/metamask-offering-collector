metamask-offering-collector
===========================

A proof-of-concept web application that allows accepting ETH for ministry and fundraising purposes via [MetaMask](https://metamask.io/).

# Setup

```
npm install
cp .env.example .env
```

# Testing

This app has a lot of moving parts, which are reflected in the tests themselves. There are two seperate test sets found in the `spec/` and `tests/` directorys. The former depend upon Jasmine and Puppeteer while the latter use [Synpress](https://github.com/Synthetixio/synpress), which is a rather brittle marriage between Cypress, Puppeteer, and Metamask. I hope to simplify and consolidate these tests as I further develop my personal blockchain development workflow.

For both test sets, start a MongoDB development server:

```
docker run --name dev-mongo -p 27017:27017 -d mongo
```

## `spec/`

These are the Jasmine/Puppeteer tests, which perform some basic behavioural tests for when Metamask is not installed or disabled. It also performs database unit tests.

```
npm test
```

These tests load the app internally, so the server must not be running when these tests are executed.

## `tests/`

These are the tests that include Metamask (I can't help but wonder if I should update [Dappeteer](https://github.com/decentraland/dappeteer) myself, because Synpress feels a bit clunky).

Start the local test chain:

```
npx ganache-cli --accounts 10 --mnemonic 'yard dune doll awake peanut hour zoo spread middle glad run rough' --debug
```

Run app with `nodemon`:

```
npm run test-server
```

Run Synpress. You can retrieve the `SECRET_WORDS` from the _HD Wallet Mnemonic_ produced by `ganache-cli`. The documentation recommends you use this:

```
NODE_ENV=test NETWORK_NAME=localhost SECRET_WORDS='twelve secret recovery words etc...' npx synpress run --configFile tests/e2e/customConfig.json
```

The following doesn't reset state properly sometimes (Synpress is _clunky_, remember. Also, the documentation doesn't always align with what actually works):

```
NODE_ENV=test NETWORK_NAME=localhost SECRET_WORDS='yard dune doll awake peanut hour zoo spread middle glad run rough' npx synpress open --configFile tests/e2e/customConfig.json
```

## 2021-10-4

_Note until fixed:_

Though [synpress](https://github.com/Synthetixio/synpress) is a wonderful tool, it is still very much a work in progress. The CSS selectors that enable signature verification have changed somewhere in the last week, and so were manually modified in `node_modules/@synthetixio/synpress/pages/metamask/notification-page.js`. Currently, change these:

```
const confirmSignatureRequestButton = `${notificationPage} .request-signature__footer__sign-button`;
const rejectSignatureRequestButton = `${notificationPage} .request-signature__footer__cancel-button`;
```

To:

```
const confirmSignatureRequestButton = `${notificationPage} .signature-request-footer button:last-child`;
const rejectSignatureRequestButton = `${notificationPage} .signature-request-footer button:first-child`;
```

## 2021-10-7

Had trouble with Synpress not reloading the wallet on each try. Had to manually recover it using the `ganache-cli`-provided phrase. Also had to manually choose which of the ten addresses I wanted to use on the first test run. Remember, the default `synpress` wallet password is _Tester@1234_.

## 2021-10-14

It would be nice if Synpress reset the wallet on open. Even pre-setting the _secret words_ on chain and on Synpress result in nonce misalignment when sending a transaction. Reset Synpress Metamask wallet manually on each new test/dev session. _Resetting_ in this case is not the same as an account recovery. Go into settings on the test wallet and reset it from there.

# 2021-10-25

Basic Android Studio stuff for mobile debugging found her: https://github.com/MetaMask/metamask-mobile

Had to make a couple config changes:

`/android/app/src/main/AndroidManifest.xml`

```
-               android:usesCleartextTraffic="${isDebug}"
+               android:usesCleartextTraffic="true
```

`/android/app/src/main/res/xml/react_native_config.xml`

```
-  <base-config cleartextTrafficPermitted="false" />
+  <base-config cleartextTrafficPermitted="true" />
```

Basic startup for debugging:

```
nvm use v14.16.1
yarn watch # start build server
yarn start:android
```

Inspect the Chrome output at: chrome://inspect/#devices


# Production

In the application directory:

```
cd metamask-offering-collector
cp .env.example .env # <- don't forget to configure
npm install --production
```

The _Dockerized_ production is meant to be deployed behind an `nginx-proxy`/`lets-encrypt` combo. Change the _Let's Encrypt_ fields as appropriate and execute:

```
docker-compose -f docker-compose.prod.yml up -d
```


