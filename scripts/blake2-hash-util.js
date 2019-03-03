const blake = require('blakejs');

const getBlake2Hash = (value) => {
  // console.log('STARTED getBlake2Hash', password);
  const hashBytes = blake.blake2b(value, null, 32);
  const hash = Buffer.from(hashBytes).toString('hex').toUpperCase();;
  // console.log('SUCCESS getBlake2Hash', hash);
  return hash;
}

exports.getBlake2Hash = getBlake2Hash;
