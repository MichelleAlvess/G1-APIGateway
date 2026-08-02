'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { handler: candidatesHandler } = require('../lambdas/candidates');
const { handler: voteHandler } = require('../lambdas/vote');

describe('Implementação AWS - funções da API', () => {
  it('lista os candidatos e recebe o contexto do authorizer', async () => {
    const response = await candidatesHandler({
      requestContext: {
        requestId: 'req-candidates',
        authorizer: { userId: 'usr-eleitor-001', role: 'VOTER' }
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.requestedBy, 'usr-eleitor-001');
    assert.equal(body.candidatos.length, 2);
  });

  it('aceita voto no modo local sem precisar de uma fila real', async () => {
    process.env.LOCAL_DEMO_MODE = 'true';

    const response = await voteHandler({
      requestContext: {
        requestId: 'req-vote',
        authorizer: { userId: 'usr-eleitor-001', role: 'VOTER' }
      },
      body: JSON.stringify({ candidato_id: 1 })
    });

    assert.equal(response.statusCode, 202);
    const body = JSON.parse(response.body);
    assert.equal(body.candidato_id, 1);
    assert.equal(body.eleitor_id, 'usr-eleitor-001');
    assert.match(body.messageId, /^local-/);
  });

  it('rejeita candidato_id inválido', async () => {
    process.env.LOCAL_DEMO_MODE = 'true';

    const response = await voteHandler({
      requestContext: {
        requestId: 'req-invalid-vote',
        authorizer: { userId: 'usr-eleitor-001', role: 'VOTER' }
      },
      body: JSON.stringify({ candidato_id: 0 })
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).error.code, 'INVALID_CANDIDATE_ID');
  });
});
