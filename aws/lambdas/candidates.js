'use strict';

const { jsonResponse } = require('./common/http');

const CANDIDATES = [
  { id: 1, nome: 'Candidato A', partido: 'Partido Sol', votos: 0 },
  { id: 2, nome: 'Candidato B', partido: 'Partido Lua', votos: 0 }
];

exports.handler = async (event) => {
  const userId = event.requestContext?.authorizer?.userId;

  return jsonResponse(
    200,
    {
      requestId: event.requestContext?.requestId,
      requestedBy: userId,
      candidatos: CANDIDATES,
      observacao:
        'Lista de demonstração. O integrante responsável pelo DynamoDB pode substituir esta fonte sem alterar a rota.'
    },
    event
  );
};
