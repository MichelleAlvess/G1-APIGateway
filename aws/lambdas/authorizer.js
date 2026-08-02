'use strict';

const { verifyAccessToken } = require('./common/jwt');

exports.handler = async (event) => {
  try {
    const token = extractBearerToken(event.authorizationToken);
    const payload = verifyAccessToken(token, {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER || 'voting-api-gateway',
      audience: process.env.JWT_AUDIENCE || 'voting-services'
    });

    return createPolicy(payload.sub, 'Allow', event.methodArn, {
      userId: String(payload.sub),
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      role: String(payload.role || ''),
      tokenId: String(payload.jti || '')
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        action: 'jwt_denied',
        code: error.code || 'JWT_INVALID',
        message: error.message
      })
    );

    // API Gateway transforma exatamente esta mensagem em HTTP 401.
    throw new Error('Unauthorized');
  }
};

function extractBearerToken(authorizationToken) {
  const match = String(authorizationToken || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Use Authorization: Bearer <token>.');
    error.code = 'AUTH_SCHEME_INVALID';
    throw error;
  }

  return match[1].trim();
}

function createPolicy(principalId, effect, methodArn, context) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: methodArn
        }
      ]
    },
    context
  };
}

exports.extractBearerToken = extractBearerToken;
exports.createPolicy = createPolicy;
