'use strict';

const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');

const { handler, __resetLocalStateForTests } = require('../lambdas/vote-worker');

function sqsRecord({ messageId, body }) {
  return { messageId, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

describe('Worker de votos (consumidor SQS)', () => {
  beforeEach(() => {
    process.env.LOCAL_DEMO_MODE = 'true';
    __resetLocalStateForTests();
  });

  it('processa um lote de votos válidos sem reportar falhas', async () => {
    const event = {
      Records: [
        sqsRecord({
          messageId: 'msg-1',
          body: { eventId: 'evt-1', candidato_id: 1, eleitor_id: 'usr-001' }
        }),
        sqsRecord({
          messageId: 'msg-2',
          body: { eventId: 'evt-2', candidato_id: 2, eleitor_id: 'usr-002' }
        })
      ]
    };

    const result = await handler(event);

    assert.deepEqual(result.batchItemFailures, []);
  });

  it('ignora um evento duplicado (mesmo eventId) sem contar duas vezes', async () => {
    const record = sqsRecord({
      messageId: 'msg-3',
      body: { eventId: 'evt-dup', candidato_id: 1, eleitor_id: 'usr-003' }
    });

    const first = await handler({ Records: [record] });
    const second = await handler({ Records: [{ ...record, messageId: 'msg-3-retry' }] });

    // Nenhuma das duas entregas deve ser reportada como falha: a segunda é
    // simplesmente ignorada (idempotência), não é um erro.
    assert.deepEqual(first.batchItemFailures, []);
    assert.deepEqual(second.batchItemFailures, []);
  });

  it('descarta mensagem malformada sem reportar como falha (evita retry infinito)', async () => {
    const event = {
      Records: [
        sqsRecord({ messageId: 'msg-bad', body: { candidato_id: 'não-é-numero' } })
      ]
    };

    const result = await handler(event);

    // Mensagem inválida é descartada (logada), não entra em batchItemFailures,
    // porque reprocessá-la nunca vai fazer diferença (não é uma falha transitória).
    assert.deepEqual(result.batchItemFailures, []);
  });

  it('reporta em batchItemFailures apenas a mensagem que efetivamente falhou', async () => {
    process.env.LOCAL_DEMO_MODE = 'false';
    delete process.env.VOTES_TABLE;
    delete process.env.PROCESSED_EVENTS_TABLE;

    const event = {
      Records: [
        sqsRecord({
          messageId: 'msg-falha',
          body: { eventId: 'evt-falha', candidato_id: 1, eleitor_id: 'usr-004' }
        })
      ]
    };

    const result = await handler(event);

    // Sem VOTES_TABLE/PROCESSED_EVENTS_TABLE configuradas, o processamento
    // real falha (propositalmente, para simular indisponibilidade do DynamoDB).
    assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: 'msg-falha' }]);

    process.env.LOCAL_DEMO_MODE = 'true';
  });
});
