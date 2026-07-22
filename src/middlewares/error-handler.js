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

  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;
  const code = isOperational ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isOperational
    ? error.message
    : 'Ocorreu um erro interno no servidor.';

  req.log?.error(
    {
      err: error,
      requestId: req.id,
      statusCode,
      errorCode: code
    },
    'request failed'
  );

  const response = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.id
    }
  };

  if (isOperational && error.details !== undefined) {
    response.error.details = error.details;
  }

  if (process.env.NODE_ENV !== 'production' && !isOperational) {
    response.error.debug = error.message;
  }

  res.status(statusCode).json(response);
}
