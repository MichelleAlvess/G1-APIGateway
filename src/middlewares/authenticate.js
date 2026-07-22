import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error.js';

export function authenticate(tokenService) {
  return function jwtAuthenticationMiddleware(req, _res, next) {
    const authorization = req.get('authorization');

    if (!authorization) {
      return next(
        new AppError(401, 'AUTH_TOKEN_MISSING', 'Token de acesso não informado.')
      );
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return next(
        new AppError(
          401,
          'AUTH_SCHEME_INVALID',
          'Use o cabeçalho Authorization no formato Bearer <token>.'
        )
      );
    }

    try {
      const payload = tokenService.verifyAccessToken(match[1].trim());

      req.auth = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        tokenId: payload.jti,
        issuedAt: payload.iat,
        expiresAt: payload.exp
      };

      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(
          new AppError(401, 'AUTH_TOKEN_EXPIRED', 'Token de acesso expirado.')
        );
      }

      if (error instanceof jwt.NotBeforeError) {
        return next(
          new AppError(401, 'AUTH_TOKEN_NOT_ACTIVE', 'Token ainda não está ativo.')
        );
      }

      return next(
        new AppError(401, 'AUTH_TOKEN_INVALID', 'Token de acesso inválido.')
      );
    }
  };
}

export function authorizeRoles(...allowedRoles) {
  return function roleAuthorizationMiddleware(req, _res, next) {
    if (!req.auth) {
      return next(
        new AppError(500, 'AUTH_CONTEXT_MISSING', 'Contexto de autenticação ausente.')
      );
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(
        new AppError(403, 'AUTH_FORBIDDEN', 'Usuário sem permissão para esta operação.')
      );
    }

    return next();
  };
}
