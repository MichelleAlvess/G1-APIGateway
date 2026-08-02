'use strict';

const { errorResponse, jsonResponse, parseJsonBody } = require('./common/http');
const { createAccessToken } = require('./common/jwt');
const { verifyPassword } = require('./common/password');

const DEFAULT_PASSWORD_HASH =
  'scrypt$e2502977b87a0788b6edf0ff8dad584d$bcae24882310491931349a0e92353f8274c297d9637143b5b183983f96de897dd74b55a2be6d0d47d8081964cf45cff98f8ffdfe98fd7e3d964379e94ae98168';

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    validateCredentials(body.email, body.password);

    const demoUser = {
      id: process.env.DEMO_USER_ID || 'usr-eleitor-001',
      name: process.env.DEMO_USER_NAME || 'Eleitor de Demonstração',
      email: (process.env.DEMO_USER_EMAIL || 'eleitor@votacao.local').toLowerCase(),
      role: process.env.DEMO_USER_ROLE || 'VOTER',
      passwordHash: process.env.DEMO_USER_PASSWORD_HASH || DEFAULT_PASSWORD_HASH
    };

    const normalizedEmail = body.email.trim().toLowerCase();
    const passwordMatches = await verifyPassword(body.password, demoUser.passwordHash);

    if (normalizedEmail !== demoUser.email || !passwordMatches) {
      const error = new Error('E-mail ou senha inválidos.');
      error.statusCode = 401;
      error.code = 'AUTH_INVALID_CREDENTIALS';
      throw error;
    }

    const accessToken = createAccessToken(demoUser, {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER || 'voting-api-gateway',
      audience: process.env.JWT_AUDIENCE || 'voting-services',
      expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 900)
    });

    console.log(
      JSON.stringify({
        level: 'info',
        action: 'login_success',
        userId: demoUser.id,
        requestId: event.requestContext?.requestId
      })
    );

    return jsonResponse(
      200,
      {
        accessToken: accessToken.token,
        tokenType: 'Bearer',
        expiresAt: new Date(accessToken.payload.exp * 1000).toISOString(),
        user: {
          id: demoUser.id,
          name: demoUser.name,
          email: demoUser.email,
          role: demoUser.role
        }
      },
      event
    );
  } catch (error) {
    return errorResponse(error, event);
  }
};

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    const error = new Error('Informe um e-mail válido.');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    const error = new Error('A senha deve possuir entre 8 e 128 caracteres.');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
}
