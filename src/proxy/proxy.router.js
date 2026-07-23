import { Router } from 'express';
import { ProxyService } from './proxy.service.js';

export const proxyRouter = Router();

// Usamos /*path para capturar qualquer sub-rota sem erro de sintaxe
proxyRouter.all('/*path', async (req, res, next) => {
  try {
    const targetPath = req.originalUrl.replace(/^\/api\/v1\/voting/, '') || '/';
    const upstreamResponse = await ProxyService.forwardRequest(req, targetPath);

    res.status(upstreamResponse.status);

    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    const responseBuffer = await upstreamResponse.arrayBuffer();
    return res.send(Buffer.from(responseBuffer));
  } catch (error) {
    return next(error);
  }
});