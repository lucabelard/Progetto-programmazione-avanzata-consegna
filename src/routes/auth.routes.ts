import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

/**
 * Router per l'autenticazione.
 *
 * Route pubbliche (non richiedono JWT):
 *   POST /api/v1/auth/register  registra un nuovo utente
 *   POST /api/v1/auth/login     autentica e ritorna il JWT
 */
const authRouter = Router();

authRouter.post('/register', (req, res, next) => authController.register(req, res, next));
authRouter.post('/login',    (req, res, next) => authController.login(req, res, next));

export default authRouter;
