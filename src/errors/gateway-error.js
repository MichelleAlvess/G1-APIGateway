export class GatewayTimeoutError extends Error {
  constructor(message = 'O serviço de backend não respondeu dentro do tempo limite tolerado.') {
    super(message);
    this.name = 'GatewayTimeoutError';
    this.statusCode = 504;
    this.error = 'Gateway Timeout';
  }
}

export class BadGatewayError extends Error {
  constructor(message = 'Não foi possível estabelecer comunicação com o serviço de destino.') {
    super(message);
    this.name = 'BadGatewayError';
    this.statusCode = 502;
    this.error = 'Bad Gateway';
  }
}