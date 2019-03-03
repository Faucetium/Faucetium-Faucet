#!/usr/bin/env node

// libraries
const http = require('http')
const path = require('path')
const chalk = require('chalk')
const express = require('express')
const fs = require('fs')
const exphbs = require('express-handlebars');

// modules
const captchaUtil = require('./scripts/captcha-util.js');
const databaseUtil = require('./scripts/database-util.js');
const blake2HashUtil = require('./scripts/blake2-hash-util.js');

//constants

if (!fs.existsSync('./config.json')) {
  throw Error('config.json does not exist, copy config-sample.json to config.json and edit it.');
}
const config = require('./config.json');

if (config.waitTimeSeconds == undefined) {
  throw Error('waitTimeSeconds in config.json does not exist.');
}

if (config.port == undefined) {
  throw Error('port in config.json does not exist.');
}

if (config.adminUsers == undefined) {
  throw Error('adminUsers in config.json does not exist.');
}

if (config.adminIps == undefined) {
  throw Error('adminIps in config.json does not exist.');
}

if (config.maskedIps == undefined) {
  throw Error('maskedIps in config.json does not exist.');
}

if (config.scoreIncrement == undefined) {
  throw Error('scoreIncrement in config.json does not exist.');
}

if (config.referralPercentBonus == undefined) {
  throw Error('referralPercentBonus in config.json does not exist.');
}

if (config.serverReferralSalt == undefined) {
  throw Error('serverReferralSalt in config.json does not exist.');
}

if (config.dbFileName == undefined) {
  throw Error('dbFileName in config.json does not exist.');
}

if (config.challengeKey == undefined) {
  throw Error('challengeKey in config.json does not exist.');
}

if (config.verificationKey == undefined) {
  throw Error('verificationKey in config.json does not exist.');
}

if (config.authenticationHashKey == undefined) {
  throw Error('authenticationHashKey in config.json does not exist.');
}

if (config.minWithdrawal == undefined) {
  throw Error('minWithdrawal in config.json does not exist.');
}

// variables

const registeredUsers = [];

const dataByIpMap = {};

const adminUserSet = new Set();
config.adminUsers.forEach((adminUser) => {
  adminUserSet.add(adminUser);
})

const adminIpSet = new Set();
config.adminIps.forEach((adminIp) => {
  adminIpSet.add(adminIp);
})

const maskedIpSet = new Set();
config.maskedIps.forEach((maskedIp) => {
  maskedIpSet.add(maskedIp);
})

databaseUtil.openDB(config);

const app = express();

app.engine('handlebars', exphbs({
  defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');

const getIp = (req) => {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

const getNextTime = () => {
  return Date.now() + (config.waitTimeSeconds * 1000);
}

app.use(express.static('static-html'));
app.use(express.urlencoded({
  extended: true
}));

const shortenReferralCode = (referralCode) => {
  // console.log('STARTED shortenReferralCode', referralCode);
  let retval;
  if (referralCode !== undefined) {
    const prefix = referralCode.substring(0, 4);
    const suffix = referralCode.substring(referralCode.length - 4);
    retval = prefix + '...' + suffix;
  }
  // console.log('SUCCESS shortenReferralCode', retval);
  return retval;
}

const getDate = () => {
  return new Date().toISOString();
}

const getTimer = (dataByIp) => {
  return (dataByIp.timeNext - Date.now()) / 1000;
}

const getData = (ip, answer) => {
  const data = {};
  const session = databaseUtil.getSession(ip);
  const seconds = getTimer(session);
  if (seconds < 0) {
    data.timer = 'Timer Ready!';
  } else {
    data.timer = `Wait for ${seconds} more seconds!`;
  }
  data.seconds = seconds;
  data.timerMet = seconds <= 0;
  data.answer = answer;
  data.loggedIn = session.loggedIn;
  data.isAdmin = session.isAdmin;
  return data;
}

app.get('/login', async (req, res) => {
  res.render('login', getData(getIp(req), ''));
});

app.post('/login', async (req, res) => {
  const ip = getIp(req);
  const response = await captchaUtil.getCaptchaResponse(config, req, ip);
  if (response.startsWith('true')) {
    const username = req.body.username;
    const passwordHash = blake2HashUtil.getBlake2Hash(req.body.password);
    const session = databaseUtil.getSession(ip);
    console.log('login', username, passwordHash);

    if (databaseUtil.hasUser(username)) {
      const user = databaseUtil.getUser(username);
      if (user.passwordHash == passwordHash) {
        session.loggedIn = true;
        if (adminIpSet.has(ip)) {
          session.isAdmin = true;
        } else if (adminUserSet.has(username)) {
          session.isAdmin = true;
        } else {
          session.isAdmin = false;
        }
        session.username = user.username;
        databaseUtil.setSession(session);
        console.log(getDate(), 'login logged in', username, passwordHash, ip, config.adminIp);
      }
    }
  }
  res.render('login', getData(ip, ''));
});

app.get('/register', async (req, res) => {
  res.render('register', getData(getIp(req), ''));
});

app.post('/register', async (req, res) => {
  const ip = getIp(req);
  const response = await captchaUtil.getCaptchaResponse(config, req, ip);
  if (response.startsWith('true')) {
    const username = req.body.username;
    let usernameTaken = databaseUtil.hasUser(username);
    if (!usernameTaken) {
      const user = databaseUtil.getUser(username);
      user.passwordHash = blake2HashUtil.getBlake2Hash(req.body.password);
      user.email = req.body.email;
      user.account = req.body.account;
      if (req.body.referral_code.length > 0) {
        user.referrerReferralCode = req.body.referral_code;
        if (databaseUtil.hasUserByReferralCode(user.referrerReferralCode)) {
          const referrerUser = databaseUtil.getUserByReferralCode(user.referrerReferralCode);
          user.referrer = referrerUser.username;
        }
      }
      console.log('user', user);
      databaseUtil.setUser(user);

      const session = databaseUtil.getSession(ip);
      session.loggedIn = true;
      session.username = user.username;
      databaseUtil.setSession(session);
    }
    const data = getData(getIp(req), '');
    data.usernameTaken = usernameTaken;
    res.render('register', data);
  } else {
    const data = getData(getIp(req), '');
    res.render('register', data);
  }
});

const getWithdrawData = (ip) => {
  const data = getData(ip, '');
  data.minWithdrawal = config.minWithdrawal;
  data.minWithdrawalMet = false;
  data.isBanned = true;
  const session = databaseUtil.getSession(ip);
  if (session.username != undefined) {
    const user = databaseUtil.getUser(session.username);
    data.withdrawConfirmed = user.withdrawConfirmed;
    data.withdrawPending = user.withdrawPending;
    data.score = user.score;
    if (data.score > data.minWithdrawal) {
      data.minWithdrawalMet = true;
    }
    data.isBanned = user.isBanned;
  }
  return data;
}

app.get('/withdraw', async (req, res) => {
  const ip = getIp(req);
  res.render('withdraw', getWithdrawData(ip));
});

app.post('/withdraw', async (req, res) => {
  const ip = getIp(req);
  const response = await captchaUtil.getCaptchaResponse(config, req, ip);
  const responseFlag = response.startsWith('true');
  const withdrawAmount = parseInt(req.body.withdraw_amount); {
    const session = databaseUtil.getSession(ip);
    // console.log('STARTED withdraw', ip, responseFlag, req.body.withdraw_amount, withdrawAmount, session.score);
  }
  if (responseFlag) {
    const session = databaseUtil.getSession(ip);
    if (withdrawAmount > 0) {
      const user = databaseUtil.getUser(session.username);
      if (withdrawAmount <= user.score) {
        user.withdrawPending += withdrawAmount;
        user.score -= withdrawAmount;

        // console.log('INERIM withdraw', ip, responseFlag, withdrawAmount, session.score);

        databaseUtil.setSession(session);
        databaseUtil.setUser(user);
      }
    }
  } {
    const session = databaseUtil.getSession(ip);
    // console.log('SUCCESS withdraw', ip, responseFlag, req.body.withdraw_amount, withdrawAmount, session.score);
  }
  res.render('withdraw', getWithdrawData(ip, req));
});



const renderAdmin = async (req, res) => {
  const ip = getIp(req);
  const data = getData(ip, '')
  data.users = [];
  if (data.isAdmin) {
    const sessions = databaseUtil.getAllSessions();
    const sessionByUsernameMap = {};
    sessions.forEach((session) => {
      const dataByIp = dataByIpMap[ip];
      if (sessionByUsernameMap[session.username] == undefined) {
        sessionByUsernameMap[session.username] = [];
      }
      sessionByUsernameMap[session.username].push(session);
    });

    const users = databaseUtil.getAllUsers();

    // console.log('sessionByUsernameMap', sessionByUsernameMap);
    // console.log('users', users);

    users.forEach((user) => {
      const userData = {};
      userData.username = user.username;
      userData.email = user.email;
      userData.account = user.account;
      userData.score = user.score;
      userData.isBanned = user.isBanned;
      userData.withdrawPending = user.withdrawPending;
      userData.withdrawConfirmed = user.withdrawConfirmed;
      userData.referralCode = user.referralCode;
      userData.referrerReferralCode = user.referrerReferralCode;
      userData.referralCodeShort = shortenReferralCode(user.referralCode);
      userData.referrerReferralCodeShort = shortenReferralCode(user.referrerReferralCode);
      userData.referrer = user.referrer;
      data.users.push(userData);

      const sessionByUsername = sessionByUsernameMap[user.username];

      userData.sessions = [];

      if (sessionByUsername !== undefined) {
        sessionByUsername.forEach((session) => {
          const sessionData = {};
          if (maskedIpSet.has(session.ip)) {
            sessionData.ip = 'masked in config';
          } else {
            sessionData.ip = session.ip;
          }
          sessionData.timeNext = session.timeNext;
          sessionData.loggedIn = session.loggedIn;
          sessionData.isAdmin = session.isAdmin;
          userData.sessions.push(sessionData);
        });
      }
    });
  }
  res.render('admin', data);
}
app.get('/admin', renderAdmin);

app.post('/admin', async (req, res) => {
  const ip = getIp(req);
  const session = databaseUtil.getSession(ip);
  if (session.isAdmin) {
    const username = req.body.username;
    const action = req.body.action;
    if (action == 'Confirm Withdrawal') {
      if (databaseUtil.hasUser(username)) {
        const user = databaseUtil.getUser(username);
        user.withdrawConfirmed += user.withdrawPending;
        user.withdrawPending = 0;
        databaseUtil.setUser(user);
      }
    }
    // console.log('admin', action, username);
    if (action == 'Ban User') {
      if (databaseUtil.hasUser(username)) {
        const user = databaseUtil.getUser(username);
        user.isBanned = true;
        // console.log('admin', action, username, 'user.isBanned', user.isBanned);
        databaseUtil.setUser(user);
      }
    } else if (action == 'Unban User') {
      if (databaseUtil.hasUser(username)) {
        const user = databaseUtil.getUser(username);
        user.isBanned = false;
        // console.log('admin', action, username, 'user.isBanned', user.isBanned);
        databaseUtil.setUser(user);
      }
    } else if (action == 'Reset Password') {
      const user = databaseUtil.getUser(username);
      const passwordHash = blake2HashUtil.getBlake2Hash(req.body.password);
      user.passwordHash = passwordHash;
      // console.log('admin', action, username, 'user.isBanned', user.isBanned);
      databaseUtil.setUser(user);
    }
  }
  await renderAdmin(req, res);
});

app.get('/logout', async (req, res) => {
  const ip = getIp(req);
  const session = databaseUtil.getSession(ip);
  session.loggedIn = false;
  session.username = undefined;
  databaseUtil.setSession(session);
  res.render('logout', getData(ip, ''));
});

app.post('/logout', async (req, res) => {
  res.render('logout', getData(getIp(req), ''));
});

app.get('/', async (req, res) => {
  res.render('home', getData(getIp(req), ''));
});

const getFaucetData = (ip, answer) => {
  const data = getData(ip, answer);
  data.isBanned = true;
  const session = databaseUtil.getSession(ip);
  if (session.loggedIn) {
    const seconds = getTimer(session);
    if (seconds > 0) {
      data.refresh = true;
    }
    if (session.username != undefined) {
      if (databaseUtil.hasUser(session.username)) {
        const user = databaseUtil.getUser(session.username);
        data.username = user.username;
        data.score = user.score;
        data.referralCode = user.referralCode;
        data.referralBonus = config.referralPercentBonus;
        data.isBanned = user.isBanned;
      }
    }
  } else {
    data.refresh = false;
  }
  return data;
}
app.get('/faucet', async (req, res) => {
  res.render('faucet', getFaucetData(getIp(req), ''));
});

app.post('/faucet', async (req, res) => {
  const ip = getIp(req);
  const session = databaseUtil.getSession(ip);
  const seconds = getTimer(session);

  console.log('ip', ip, 'seconds', seconds);

  if (seconds > 0) {
    res.render('faucet', getFaucetData(ip, `Wait for ${seconds} more seconds!`));
  } else {
    session.timeNext = getNextTime();
    databaseUtil.setSession(session);
    const response = await captchaUtil.getCaptchaResponse(config, req, ip);
    if (response.startsWith('true')) {
      const user = databaseUtil.getUser(session.username);
      user.score += parseInt(config.scoreIncrement);
      databaseUtil.setUser(user);

      if (databaseUtil.hasUser(user.referrer)) {
        const referrerUser = databaseUtil.getUser(user.referrer);
        const referrerBonusPercent = parseInt(config.scoreIncrement) *
          parseInt(config.referralPercentBonus);
        referrerUser.score += Math.floor(parseInt(referrerBonusPercent / 100));
        databaseUtil.setUser(referrerUser);
      }

      res.render('faucet', getFaucetData(ip, 'Correct Answer!'));
    } else {
      res.render('faucet', getFaucetData(ip, 'Incorrect Answer!<br>' + response));
    }
  }
})

const server = http.createServer(app);

server.listen(config.port, (err) => {
  if (err) {
    console.error(err);
  }
  console.log(`captcha-faucet listening on port ${chalk.blue.bold(config.port)}`);
})

const io = require('socket.io')(server);
io.on('connection', (socketServer) => {
  socketServer.on('npmStop', () => {
    process.exit(0);
  });
});
