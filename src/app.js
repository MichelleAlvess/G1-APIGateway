import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { loadConfig } from './config/env.js';
import { AuthController } from './controllers/auth.controller.js';
import { createOpenApiDocument } from './docs/openapi.js';
import { authenticate, authorizeRoles } from './middlewares/authenticate.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requestContext } from './middlewares/request-context.js';
import { InMemoryUserRepository } from './repositories/user.repository.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createProtectedRouter } from './routes/protected.routes.js';
import { TokenService } from './security/token.js';
import { AuthService } from './services/auth.service.js';

export function createApp(config = loadConfig()) {
  const app = express();

  const tokenService = new TokenService(config.jwt);
  const userRepository = new InMemoryUserRepository(config.demoUser);
  const authService = new AuthService({
    userRepository,
    tokenService,
    dummyPasswordHash: config.demoUser.passwordHash
  });
  const authController = new AuthController(authService);
  const jwtMiddleware = authenticate(tokenService);

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(
    pinoHttp({
      customProps: (req) => ({ requestId: req.id }),
      redact: {
        paths: ['req.headers.authorization', 'req.body.password'],
        censor: '[REDACTED]'
      }
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'UP',
      service: 'g1-api-gateway-auth',
      timestamp: new Date().toISOString()
    });
  });

  const openApiDocument = createOpenApiDocument(config);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));

  app.use(
    '/auth',
    createAuthRouter({
      authController,
      authenticate: jwtMiddleware
    })
  );

  app.use(
    '/api',
    createProtectedRouter({
      authenticate: jwtMiddleware,
      authorizeRoles
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
