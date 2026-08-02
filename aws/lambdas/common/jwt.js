'use strict';

const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw jwtError('JWT_MALFORMED', 'Token JWT malformado.');
  }
}

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function createAccessToken(user, options) {
  validateOptions(options);

  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = Number(options.expiresInSeconds || 900);

  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('JWT_EXPIRES_IN_SECONDS deve ser um inteiro positivo.');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    iss: options.issuer,
    aud: options.audience,
    iat: now,
    exp: now + expiresInSeconds,
    jti: randomUUID()
  };

  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsignedToken, options.secret);

  return {
    token: `${unsignedToken}.${signature}`,
    payload
  };
}

function verifyAccessToken(token, options) {
  validateOptions(options);

  if (typeof token !== 'string' || token.length === 0) {
    throw jwtError('JWT_MISSING', 'Token JWT não informado.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw jwtError('JWT_MALFORMED', 'Token JWT malformado.');
  }

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw jwtError('JWT_ALGORITHM_INVALID', 'Algoritmo JWT não permitido.');
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, options.secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(providedSignature, 'utf8');

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw jwtError('JWT_SIGNATURE_INVALID', 'Assinatura JWT inválida.');
  }

  const now = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(payload.exp) || payload.exp <= now) {
    throw jwtError('JWT_EXPIRED', 'Token JWT expirado.');
  }

  if (payload.nbf != null && Number(payload.nbf) > now) {
    throw jwtError('JWT_NOT_ACTIVE', 'Token JWT ainda não está ativo.');
  }

  if (payload.iss !== options.issuer) {
    throw jwtError('JWT_ISSUER_INVALID', 'Emissor JWT inválido.');
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(options.audience)) {
    throw jwtError('JWT_AUDIENCE_INVALID', 'Audiência JWT inválida.');
  }

  if (!payload.sub || !payload.role) {
    throw jwtError('JWT_CLAIMS_INVALID', 'Claims obrigatórias ausentes no JWT.');
  }

  return payload;
}

function validateOptions(options = {}) {
  if (typeof options.secret !== 'string' || options.secret.length < 32) {
    throw new Error('JWT_SECRET deve possuir pelo menos 32 caracteres.');
  }

  if (!options.issuer || !options.audience) {
    throw new Error('JWT_ISSUER e JWT_AUDIENCE são obrigatórios.');
  }
}

function jwtError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  createAccessToken,
  verifyAccessToken
};
