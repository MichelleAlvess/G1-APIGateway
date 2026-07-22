import { Router } from 'express';

export function createProtectedRouter({ authenticate, authorizeRoles }) {
  const router = Router();

  router.get('/me', authenticate, (req, res) => {
    res.status(200).json({ user: req.auth });
  });

  router.get(
    '/admin/example',
    authenticate,
    authorizeRoles('ADMIN'),
    (_req, res) => {
      res.status(200).json({ message: 'Acesso administrativo autorizado.' });
    }
  );

  return router;
}
