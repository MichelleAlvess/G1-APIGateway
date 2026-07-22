import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';

const config = {
  nodeEnv: 'test',
  port: 3001,
  jwt: {
    secret: 'test-secret-with-at-least-thirty-two-characters-long',
    issuer: 'voting-api-gateway-test',
    audience: 'voting-services-test',
    expiresIn: '15m'
  },
  demoUser: {
    id: 'usr-test-001',
    name: 'Eleitor Teste',
    email: 'eleitor@votacao.local',
    role: 'VOTER',
    passwordHash:
      'scrypt$e2502977b87a0788b6edf0ff8dad584d$bcae24882310491931349a0e92353f8274c297d9637143b5b183983f96de897dd74b55a2be6d0d47d8081964cf45cff98f8ffdfe98fd7e3d964379e94ae98168'
  }
};

const app = createApp(config);

describe('Autenticação JWT', () => {
  it('realiza login e devolve um token Bearer', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'eleitor@votacao.local',
      password: 'Voto@123'
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.tokenType, 'Bearer');
    assert.equal(response.body.user.role, 'VOTER');
    assert.ok(response.body.accessToken);
    assert.ok(response.body.expiresAt);
  });

  it('não informa se foi o e-mail ou a senha que falhou', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'eleitor@votacao.local',
      password: 'senha-errada'
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTH_INVALID_CREDENTIALS');
    assert.equal(response.body.error.message, 'E-mail ou senha inválidos.');
  });

  it('rejeita uma rota protegida sem token', async () => {
    const response = await request(app).get('/api/me');

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTH_TOKEN_MISSING');
  });

  it('valida o token emitido no login', async () => {
    const login = await request(app).post('/auth/login').send({
      email: 'eleitor@votacao.local',
      password: 'Voto@123'
    });

    const response = await request(app)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.valid, true);
    assert.equal(response.body.user.userId, 'usr-test-001');
  });

  it('rejeita token adulterado', async () => {
    const login = await request(app).post('/auth/login').send({
      email: 'eleitor@votacao.local',
      password: 'Voto@123'
    });

    const lastCharacter = login.body.accessToken.at(-1);
    const alteredToken = `${login.body.accessToken.slice(0, -1)}${lastCharacter === 'x' ? 'y' : 'x'}`;
    const response = await request(app)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${alteredToken}`);

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTH_TOKEN_INVALID');
  });

  it('nega uma rota ADMIN a um eleitor', async () => {
    const login = await request(app).post('/auth/login').send({
      email: 'eleitor@votacao.local',
      password: 'Voto@123'
    });

    const response = await request(app)
      .get('/api/admin/example')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'AUTH_FORBIDDEN');
  });
});
