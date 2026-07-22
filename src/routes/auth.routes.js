import { Router } from 'express';

export function createAuthRouter({ authController, authenticate }) {
  const router = Router();

  router.post('/login', authController.login);
  router.get('/validate', authenticate, authController.validate);

  return router;
}
