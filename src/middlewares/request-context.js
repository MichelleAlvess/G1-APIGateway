import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  const incomingId = req.get('x-request-id');
  const requestId = incomingId?.trim() || randomUUID();

  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
