import { AppError } from '../errors/app-error.js';

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(404, 'ROUTE_NOT_FOUND', `Rota não encontrada: ${req.method} ${req.path}`)
  );
}

export function errorHandler(error, req, res, _next) {
  
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    error = new AppError(400, 'INVALID_JSON', 'O corpo da requisição contém JSON inválido.');
  }

  
  const isOperational = error instanceof AppError || Boolean(error.statusCode);
  
  const statusCode = error.statusCode || (isOperational ? 400 : 500);
  const code = error.code || error.error || (statusCode === 504 ? 'GATEWAY_TIMEOUT' : statusCode === 502 ? 'BAD_GATEWAY' : 'INTERNAL_SERVER_ERROR');
  const message = error.message || 'Ocorreu um erro interno no servidor.';
  const requestId = req.id || req.headers['x-request-id'] || 'N/A';

  
  if (statusCode >= 500) {
    req.log?.error({ err: error, requestId, statusCode, errorCode: code }, 'Falha no processamento/Upstream');
  } else {
    req.log?.warn({ err: error, requestId, statusCode, errorCode: code }, 'Requisição inválida do cliente');
  }

 
  const response = {
    error: {
      code,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  if (error.details !== undefined) {
    response.error.details = error.details;
  }

  if (process.env.NODE_ENV !== 'production' && !isOperational && error.stack) {
    response.error.stack = error.stack;
  }

  return res.status(statusCode).json(response);
}