'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { handler: loginHandler } = require('../lambdas/login');
const { handler: authorizerHandler } = require('../lambdas/authorizer');
const { verifyAccessToken } = require('../lambdas/common/jwt');

const SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';

function configureEnvironment() {
  process.env.JWT_SECRET = SECRET;
  process.env.JWT_ISSUER = 'voting-api-gateway';
  process.env.JWT_AUDIENCE = 'voting-services';
  process.env.JWT_EXPIRES_IN_SECONDS = '900';
  process.env.DEMO_USER_ID = 'usr-eleitor-001';
  process.env.DEMO_USER_NAME = 'Eleitor de Demonstração';
  process.env.DEMO_USER_EMAIL = 'eleitor@votacao.local';
  process.env.DEMO_USER_ROLE = 'VOTER';
}

describe('Implementação AWS - login e Lambda Authorizer', () => {
  it('emite JWT válido no login', async () => {
    configureEnvironment();

    const response = await loginHandler({
      requestContext: { requestId: 'req-1' },
      body: JSON.stringify({
        email: 'eleitor@votacao.local',
        password: 'Voto@123'
      })
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.tokenType, 'Bearer');

    const payload = verifyAccessToken(body.accessToken, {
      secret: SECRET,
      issuer: 'voting-api-gateway',
      audience: 'voting-services'
    });

    assert.equal(payload.sub, 'usr-eleitor-001');
    assert.equal(payload.role, 'VOTER');
  });

  it('rejeita credenciais incorretas', async () => {
    configureEnvironment();

    const response = await loginHandler({
      requestContext: { requestId: 'req-2' },
      body: JSON.stringify({
        email: 'eleitor@votacao.local',
        password: 'senha-incorreta'
      })
    });

    assert.equal(response.statusCode, 401);
    assert.equal(JSON.parse(response.body).error.code, 'AUTH_INVALID_CREDENTIALS');
  });

  it('autoriza uma chamada com Bearer token válido', async () => {
    configureEnvironment();

    const loginResponse = await loginHandler({
      requestContext: { requestId: 'req-3' },
      body: JSON.stringify({
        email: 'eleitor@votacao.local',
        password: 'Voto@123'
      })
    });
    const token = JSON.parse(loginResponse.body).accessToken;

    const policy = await authorizerHandler({
      authorizationToken: `Bearer ${token}`,
      methodArn:
        'arn:aws:execute-api:us-east-1:123456789012:api-id/Prod/GET/auth/validate'
    });

    assert.equal(policy.principalId, 'usr-eleitor-001');
    assert.equal(policy.policyDocument.Statement[0].Effect, 'Allow');
    assert.equal(policy.context.role, 'VOTER');
  });

  it('rejeita token adulterado', async () => {
    configureEnvironment();

    const loginResponse = await loginHandler({
      requestContext: { requestId: 'req-4' },
      body: JSON.stringify({
        email: 'eleitor@votacao.local',
        password: 'Voto@123'
      })
    });
    const token = JSON.parse(loginResponse.body).accessToken;
    const altered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    await assert.rejects(
      () =>
        authorizerHandler({
          authorizationToken: `Bearer ${altered}`,
          methodArn:
            'arn:aws:execute-api:us-east-1:123456789012:api-id/Prod/GET/auth/validate'
        }),
      /Unauthorized/
    );
  });
});
