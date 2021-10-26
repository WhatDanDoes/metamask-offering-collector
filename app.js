require('dotenv-flow').config();
const appName = require('./package.json').name;
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const indexRouter = require('./routes/index');
const accountRouter = require('./routes/account');
const transactionRouter = require('./routes/transaction');
const authRouter = require('./routes/auth');
const transferRouter = require('./routes/transfer');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Flash messages
 */
const flash = require('connect-flash');
app.use(flash());

/**
 * Sessions
 */
const session = require('express-session');
const MongoStore = require('connect-mongo');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/models/config.json')[env];

const sessionConfig = {
  name: appName,
  secret: 'remember to set this to something configurable',
  resave: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: 'mongodb://' + config.host + ':27017/' + config.database })
};

/**
 * 2021-10-6
 *
 * This may not be relevant. The `httpOnly` in particular seems to mess up
 * the client Javascript calls.
 */
//if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
//  sessionConfig.cookie.httpOnly = false;
//  sessionConfig.cookie.sameSite = 'none';
//  sessionConfig.cookie.secure = true;
//}

app.use(session(sessionConfig));

/**
 * Check for existing session and attach `req.agent` if it exists
 */
const models = require('./models');
app.use((req, res, next) => {

  // 2021-10-16
  // Metamask is doing this twice... 302 then 304 response
  // Only the second response has a cookie set. Why?
  console.log('SESSION CHECK');
  console.log(req.session);

  if (!req.session.agent_id) {
    return next();
  }
  models.Agent.findById(req.session.agent_id).then(agent => {
    req.agent = agent;
    next();
  }).catch(err => {
    next(err);
  });
});

/**
 * For PUT/PATCH/DELETE
 */
const methodOverride = require('method-override');
app.use(methodOverride('_method'))

/**
 * Routes
 */
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/account', accountRouter);
app.use('/transaction', transactionRouter);
app.use('/transfer', transferRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

/**
 * 2021-10-6
 *
 * Note to self: this is different from how I normally do things. Synpress
 * falls apart if the server is running on anything but port 3000. Normally
 * I would set 3000 to production and use 3001 for testing. It is opposite
 * here.
 */
let port = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'tor' ? 3001 : 3000;
app.listen(port, '0.0.0.0', () => {
  console.log('metamask-offering-collector listening on ' + port + '!');
});

module.exports = app;
