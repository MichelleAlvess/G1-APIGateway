'use strict';

const { randomUUID } = require('node:crypto');
const { errorResponse, getRequestId, jsonResponse, parseJsonBody } = require('./common/http');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const candidateId = Number(body.candidato_id ?? body.candidatoId);

    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      const error = new Error('Informe candidato_id como um número inteiro positivo.');
      error.statusCode = 400;
      error.code = 'INVALID_CANDIDATE_ID';
      throw error;
    }

    const authorizer = event.requestContext?.authorizer || {};
    const voteEvent = {
      eventId: randomUUID(),
      type: 'VOTE_SUBMITTED',
      candidato_id: candidateId,
      eleitor_id: authorizer.userId,
      role: authorizer.role,
      request_id: getRequestId(event),
      created_at: new Date().toISOString()
    };

    let messageId;

    if (String(process.env.LOCAL_DEMO_MODE).toLowerCase() === 'true') {
      messageId = `local-${randomUUID()}`;
    } else {
      if (!process.env.VOTE_QUEUE_URL) {
        throw new Error('VOTE_QUEUE_URL não configurada.');
      }

      const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
      const sqs = new SQSClient({});
      const result = await sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.VOTE_QUEUE_URL,
          MessageBody: JSON.stringify(voteEvent),
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: voteEvent.type
            }
          }
        })
      );
      messageId = result.MessageId;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        action: 'vote_enqueued',
        eventId: voteEvent.eventId,
        messageId,
        userId: authorizer.userId,
        candidateId
      })
    );

    return jsonResponse(
      202,
      {
        mensagem: 'Voto recebido e enviado para processamento assíncrono.',
        eventId: voteEvent.eventId,
        messageId,
        candidato_id: candidateId,
        eleitor_id: authorizer.userId
      },
      event
    );
  } catch (error) {
    return errorResponse(error, event);
  }
};
