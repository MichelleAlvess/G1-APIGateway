import { loadConfig } from '../config/env.js';
import { GatewayTimeoutError, BadGatewayError } from '../errors/gateway-error.js';


const config = loadConfig();

export class ProxyService {
  static async forwardRequest(req, targetPath) {
    const upstreamUrl = `${config.backendServiceUrl}${targetPath}`;
    const requestId = req.id || req.headers['x-request-id'] || 'N/A';

    
    const outgoingHeaders = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      // 'content-length' é recalculado pelo fetch a partir do corpo reserializado abaixo;
      // repassar o valor original do cliente causa RequestContentLengthMismatchError
      // sempre que o JSON.stringify do corpo tiver um tamanho em bytes diferente do original.
      if (
        lowerKey !== 'host' &&
        lowerKey !== 'content-length' &&
        !lowerKey.startsWith('x-user-')
      ) {
        outgoingHeaders.set(key, value);
      }
    }

    
    outgoingHeaders.set('x-request-id', requestId);

    if (req.auth) {
      if (req.auth.userId) outgoingHeaders.set('x-user-id', String(req.auth.userId));
      if (req.auth.role) outgoingHeaders.set('x-user-role', String(req.auth.role));
    }

    
    const fetchOptions = {
      method: req.method,
      headers: outgoingHeaders,
      signal: AbortSignal.timeout(config.httpProxyTimeoutMs),
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        if (!outgoingHeaders.has('content-type')) {
          outgoingHeaders.set('content-type', 'application/json');
        }
      }
    }

   
    try {
      const upstreamResponse = await fetch(upstreamUrl, fetchOptions);
      return upstreamResponse;
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new GatewayTimeoutError();
      }
      throw new BadGatewayError(`Serviço de backend indisponível em: ${upstreamUrl}`);
    }
  }
}