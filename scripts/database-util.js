// libraries
const fs = require('fs');
const loki = require('lokijs');
const lfsa = require('lokijs/src/loki-fs-structured-adapter');

// modules
const blake2HashUtil = require('./blake2-hash-util.js');

// constants
const sessionsTable = 'sessions';

const usersTable = 'users';

const tableNames = [sessionsTable, usersTable];
const tableIndexes = {};
tableIndexes[sessionsTable] = ['ip'];
tableIndexes[usersTable] = ['username', 'referralCode'];


const LOG_DB_OPEN_CLOSE = false;

const LOG_DB_SET_GET = false;

const LOG_DB_SAVE = false;

// variables
let db;

let serverReferralSalt;

// functions
const loadDb = (config) => {
  if (config === undefined) {
    throw new Error('Undefined config');
  }
  if (config.dbFileName === undefined) {
    throw new Error('Undefined config.dbFileName');
  }
  if (db !== undefined) {
    throw new Error('Defined db');
  }
  if (LOG_DB_OPEN_CLOSE) {
    console.log('loadDb');
  }

  serverReferralSalt = config.serverReferralSalt;

  const FileStore = {
    mode: 'reference',
    saveDatabase: async (name, data, callback) => {
      if (LOG_DB_SAVE) {
        console.log('STARTED dbSave');
      }
      try {
        const tempName = name + '.tmp';
        fs.writeFileSync(tempName, data, 'utf-8');
        if (fs.existsSync(tempName)) {
          if (fs.existsSync(name)) {
            fs.unlinkSync(name);
          }
          fs.renameSync(tempName, name);
        }
      } catch (error) {
        console.trace(error);
      }
      if (LOG_DB_SAVE) {
        console.log('SUCCESS dbSave');
      }
      await callback(data);
    },
    loadDatabase: async (name, callback) => {
      if (LOG_DB_SAVE) {
        console.log('STARTED dbLoad');
      }
      if (fs.existsSync(name)) {
        const data = JSON.parse(fs.readFileSync(name, 'utf8'));
        await callback(data);
      } else {
        await callback({});
      }
      if (LOG_DB_SAVE) {
        console.log('SUCCESS dbLoad');
      }
    }
  }
  db = new loki(config.dbFileName, {
    adapter: FileStore,
    autosave: true,
    autosaveInterval: 5000
  })
  db.loadDatabase();
  tableNames.forEach((tableName) => {
    if (db.getCollection(tableName) === null) {
      db.addCollection(tableName, {
        indices: tableIndexes[tableName],
        clone: false
      });
    }
  });
}

const loadDbCloseBinding = () => {
  // console.log('STARTED loadDbCloseBinding.');
  process.on('SIGINT', () => {
    console.log('STARTED SIGINT flushing database.');
    closeDB();
    console.log(`SUCCESS SIGINT flushing database.`);
    process.exit(0);
  });
  // console.log('SUCCESS loadDbCloseBinding.');
}

const closeDB = () => {
  if (LOG_DB_OPEN_CLOSE) {
    console.log('closeDB');
  }
  // if (db !== undefined) {
  db.close();
  // }
}

const deleteDB = (config) => {
  if (config === undefined) {
    throw new Error('Undefined config');
  }
  if (config.dbFileName === undefined) {
    throw new Error('Undefined config.dbFileName');
  }

  if (fs.existsSync(config.dbFileName)) {
    fs.unlinkSync(config.dbFileName);
  }
  db = undefined;
  if (LOG_DB_OPEN_CLOSE) {
    console.log('deleteDB');
  }
}

const openDB = (config) => {
  loadDb(config);
  loadDbCloseBinding();
}


const getTableEntries = (table) => {
  if (LOG_DB_SET_GET) {
    console.log('STARTED getTableEntries', table);
  }
  if (table === undefined) {
    throw new Error('table is required.');
  }
  const tableElts = db.getCollection(table);
  const retval = tableElts.chain().data();
  if (LOG_DB_SET_GET) {
    console.log('SUCCESS hasTableEntry', table, retval.length);
  }
  return retval;
}

const hasTableEntry = (table, tablePkCol, tablePK) => {
  if (LOG_DB_SET_GET) {
    console.log('STARTED hasTableEntry', table, tablePK);
  }
  if (table === undefined) {
    throw new Error('table is required.');
  }
  if (tablePkCol === undefined) {
    throw new Error('tablePkCol is required.');
  }
  if (tablePK === undefined) {
    throw new Error(`${tablePkCol} value (tablePK) is required.`);
  }
  const tableElts = db.getCollection(table);
  const tableKey = {};
  tableKey[tablePkCol] = tablePK;

  const tableElt = tableElts.find(tableKey);
  const retval = (tableElt.length > 0);
  if (LOG_DB_SET_GET) {
    console.log('SUCCESS hasTableEntry', table, tablePkCol, tablePK, retval);
  }
  return retval;
}

const getTableEntry = (table, tablePkCol, tablePK, rowInitFn) => {
  if (LOG_DB_SET_GET) {
    console.log('STARTED getTableEntry', table, tablePkCol, tablePK);
  }
  if (table === undefined) {
    throw new Error('table is required.');
  }
  if (tablePkCol === undefined) {
    throw new Error('tablePkCol is required.');
  }
  if (tablePK === undefined) {
    throw new Error(`${tablePkCol} is required.`);
  }
  if (rowInitFn === undefined) {
    throw new Error('rowInitFn is required.');
  }
  const tableElts = db.getCollection(table);
  const tableKey = {};
  tableKey[tablePkCol] = tablePK;

  const tableElt = tableElts.find(tableKey);
  let retval;
  let logVal;
  if (tableElt.length > 0) {
    retval = tableElt[0];
  } else {
    if (rowInitFn == null) {
      throw Error(`table entry in table '${table}' column '${tablePkCol}' with value '${tablePK}' is undefined`);
    } else {
      rowInitFn(tableKey);
      logVal = tableElts.insert(tableKey);
      retval = tableKey;
    }
  }
  if (LOG_DB_SET_GET) {
    console.log('SUCCESS getTableEntry', table, tablePK, logVal, retval);
  }
  return retval;
}

const setTableEntry = (table, tablePkCol, tableElt) => {
  if (LOG_DB_SET_GET) {
    console.log('STARTED setTableEntry', table, tablePkCol, tableElt[tablePkCol]);
  }
  if (table === undefined) {
    throw new Error('table is required.');
  }
  if (tablePkCol === undefined) {
    throw new Error('tablePkCol is required.');
  }
  if (tableElt === undefined) {
    throw new Error('tableElt is required.');
  }
  const tableElts = db.getCollection(table);

  const logVal = tableElts.update(tableElt);
  if (LOG_DB_SET_GET) {
    console.log('SUCCESS setTableEntry', table, tablePkCol, tableElt[tablePkCol], logVal);
  }
  return logVal;
}

const getAllSessions = () => {
  return getTableEntries(sessionsTable);
}

const getSession = (ip) => {
  const newSessionFn = (sessionsKey) => {
    sessionsKey.timeNext = Date.now();
    sessionsKey.ip = ip;
    sessionsKey.loggedIn = false;
    sessionsKey.username = undefined;
    sessionsKey.isAdmin = false;
    sessionsKey.isBanned = false;
  }
  return getTableEntry(sessionsTable, 'ip', ip, newSessionFn);
}

const setSession = (session) => {
  return setTableEntry(sessionsTable, 'ip', session);
}

const hasUser = (username) => {
  if (username == undefined) {
    return false;
  }
  return hasTableEntry(usersTable, 'username', username);
}

const getUser = (username) => {
  const newUserFn = (user) => {
    user.username = username;
    user.passwordHash = undefined;
    user.email = undefined;
    user.account = undefined;
    user.score = 0;
    user.withdrawPending = 0;
    user.withdrawConfirmed = 0;
    user.referralCode = blake2HashUtil.getBlake2Hash(serverReferralSalt + user.username);
    user.referrerReferralCode = undefined;
    user.referrer = undefined;
  }
  return getTableEntry(usersTable, 'username', username, newUserFn);
}

const setUser = (user) => {
  return setTableEntry(usersTable, 'username', user);
}

const getAllUsers = () => {
  return getTableEntries(usersTable);
}


const getUserByReferralCode = (referralCode) => {
  return getTableEntry(usersTable, 'referralCode', referralCode, null);
}

const hasUserByReferralCode = (referralCode) => {
  return hasTableEntry(usersTable, 'referralCode', referralCode);
}

exports.getUserByReferralCode = getUserByReferralCode;
exports.hasUserByReferralCode = hasUserByReferralCode;
exports.getAllUsers = getAllUsers;
exports.setUser = setUser;
exports.getUser = getUser;
exports.hasUser = hasUser;
exports.getAllSessions = getAllSessions;
exports.setSession = setSession;
exports.getSession = getSession;
exports.openDB = openDB;
exports.closeDB = closeDB;
exports.deleteDB = deleteDB;
