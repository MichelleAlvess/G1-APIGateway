'use strict';

const { promisify } = require('node:util');
const { scrypt, timingSafeEqual } = require('node:crypto');

const scryptAsync = promisify(scrypt);

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || password.length === 0) {
    return false;
  }

  const [algorithm, saltHex, expectedHex] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !expectedHex) {
    throw new Error('Formato de hash de senha inválido.');
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

module.exports = {
  verifyPassword
};
