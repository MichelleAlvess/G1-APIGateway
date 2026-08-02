'use strict';

/**
 * Worker consumidor da fila Amazon SQS (VoteQueue).
 *
 * Responsabilidade: pegar os eventos de voto publicados pela Lambda `vote.js`,
 * validar o conteúdo, gravar o resultado de forma idempotente e reportar à
 * AWS quais mensagens falharam (para que só ELAS sejam reprocessadas).
 *
 * Conceitos de Sistemas Distribuídos aplicados aqui:
 * - Comunicação indireta (producer/consumer desacoplados pela fila).
 * - Entrega "at-least-once" do SQS: a mesma mensagem pode chegar mais de
 *   uma vez, por isso o processamento precisa ser IDEMPOTENTE.
 * - Tolerância a falhas: se o processamento falhar, a mensagem NÃO é
 *   confirmada (ack) e volta a ficar visível na fila depois do
 *   VisibilityTimeout, para ser tentada de novo. Depois de N tentativas
 *   (RedrivePolicy no template.yaml), ela vai para a Dead-Letter Queue (DLQ)
 *   em vez de travar o processamento das mensagens seguintes.
 */

// Usado só em LOCAL_DEMO_MODE, para testar a lógica sem precisar de AWS real.
// Em produção a idempotência é garantida pelo DynamoDB (PutCommand condicional
// abaixo), não por este Set em memória — um Set local não sobrevive entre
// containers diferentes do Lambda.
const processedEventsLocal = new Set();

function isLocalDemo() {
  return String(process.env.LOCAL_DEMO_MODE).toLowerCase() === 'true';
}

async function getDynamoClients() {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const {
    DynamoDBDocumentClient,
    PutCommand,
    UpdateCommand
  } = require('@aws-sdk/lib-dynamodb');

  const client = new DynamoDBClient({});
  const doc = DynamoDBDocumentClient.from(client);
  return { doc, PutCommand, UpdateCommand };
}

function parseVoteEvent(record) {
  const body = JSON.parse(record.body);

  if (!body.eventId || typeof body.eventId !== 'string') {
    throw new Error('Mensagem sem eventId válido.');
  }
  if (!Number.isInteger(body.candidato_id) || body.candidato_id <= 0) {
    throw new Error('Mensagem sem candidato_id inteiro válido.');
  }

  return body;
}

/**
 * Processa um único voto de forma idempotente.
 * Retorna { duplicate: true } se o eventId já tiver sido processado antes.
 */
async function processVoteEvent(voteEvent) {
  if (isLocalDemo()) {
    if (processedEventsLocal.has(voteEvent.eventId)) {
      return { duplicate: true };
    }
    processedEventsLocal.add(voteEvent.eventId);
    return { duplicate: false };
  }

  if (!process.env.VOTES_TABLE || !process.env.PROCESSED_EVENTS_TABLE) {
    throw new Error('VOTES_TABLE ou PROCESSED_EVENTS_TABLE não configuradas.');
  }

  const { doc, PutCommand, UpdateCommand } = await getDynamoClients();

  try {
    // Grava um "carimbo" do eventId ANTES de contabilizar o voto.
    // ConditionExpression garante, de forma atômica, que só passamos
    // daqui se este eventId nunca tiver sido gravado — é isso que
    // impede a mesma mensagem entregue duas vezes de contar dois votos.
    await doc.send(
      new PutCommand({
        TableName: process.env.PROCESSED_EVENTS_TABLE,
        Item: {
          eventId: voteEvent.eventId,
          candidato_id: voteEvent.candidato_id,
          processedAt: new Date().toISOString()
        },
        ConditionExpression: 'attribute_not_exists(eventId)'
      })
    );
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { duplicate: true };
    }
    throw error;
  }

  await doc.send(
    new UpdateCommand({
      TableName: process.env.VOTES_TABLE,
      Key: { candidato_id: voteEvent.candidato_id },
      UpdateExpression: 'ADD votos :inc',
      ExpressionAttributeValues: { ':inc': 1 }
    })
  );

  return { duplicate: false };
}

exports.handler = async (event) => {
  // "Partial batch failure": o Lambda pode receber várias mensagens de
  // uma vez (BatchSize no template.yaml). Se devolvêssemos erro para o
  // lote inteiro, mensagens BOAS seriam reprocessadas à toa. Por isso
  // reportamos individualmente só o que falhou, em `batchItemFailures`.
  const batchItemFailures = [];

  for (const record of event.Records || []) {
    try {
      const voteEvent = parseVoteEvent(record);
      const result = await processVoteEvent(voteEvent);

      console.log(
        JSON.stringify({
          level: 'info',
          action: result.duplicate ? 'vote_duplicate_ignored' : 'vote_processed',
          eventId: voteEvent.eventId,
          candidatoId: voteEvent.candidato_id,
          messageId: record.messageId
        })
      );
    } catch (error) {
      if (error.message?.startsWith('Mensagem sem')) {
        // "Poison pill": a mensagem está malformada e NUNCA vai processar
        // com sucesso, não importa quantas vezes tentarmos. Em vez de
        // reportar falha (o que faria o SQS reentregar pra sempre até a
        // DLQ), só logamos e descartamos — evita gastar tentativas de
        // retry com um problema que não é transitório.
        console.error(
          JSON.stringify({
            level: 'error',
            action: 'vote_event_discarded_invalid',
            messageId: record.messageId,
            reason: error.message
          })
        );
        continue;
      }

      // Falha real (ex: DynamoDB indisponível): reportamos a mensagem
      // como falha para que o SQS a reentregue depois do VisibilityTimeout.
      console.error(
        JSON.stringify({
          level: 'error',
          action: 'vote_processing_failed',
          messageId: record.messageId,
          message: error.message
        })
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

// Exportado apenas para os testes locais (aws/test/aws-worker.test.js).
exports.__resetLocalStateForTests = () => processedEventsLocal.clear();
