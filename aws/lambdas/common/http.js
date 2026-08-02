'use strict';

function getRequestId(event = {}) {
  return (
    event.requestContext?.requestId ||
    event.headers?.['x-request-id'] ||
    event.headers?.['X-Request-Id'] ||
    'sem-request-id'
  );
}

function parseJsonBody(event = {}) {
  if (event.body == null || event.body === '') {
    return {};
  }

  if (typeof event.body === 'object') {
    return event.body;
  }

  const bodyText = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(bodyText);
  } catch {
    const error = new Error('O corpo da requisição contém JSON inválido.');
    error.statusCode = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function jsonResponse(statusCode, body, event = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type,Authorization,X-Request-Id',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'x-request-id': getRequestId(event)
    },
    body: JSON.stringify(body)
  };
}

function errorResponse(error, event = {}) {
  const statusCode = Number(error.statusCode) || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const message =
    statusCode >= 500
      ? 'Ocorreu um erro interno no serviço.'
      : error.message || 'Requisição inválida.';

  if (statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        requestId: getRequestId(event),
        code,
        message: error.message,
        stack: error.stack
      })
    );
  }

  return jsonResponse(
    statusCode,
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        requestId: getRequestId(event)
      }
    },
    event
  );
}

module.exports = {
  errorResponse,
  getRequestId,
  jsonResponse,
  parseJsonBody
};
