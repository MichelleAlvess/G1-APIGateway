import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  validatePasswordValue(password);
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  validatePasswordValue(password);

  const [algorithm, saltHex, expectedHex] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !saltHex || !expectedHex) {
    throw new Error('Formato de hash de senha inválido.');
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scryptAsync(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validatePasswordValue(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('A senha deve ser uma string não vazia.');
  }
}
