import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../middleware/error.middleware';

/**
 * AuthController  gestisce le route di registrazione e login.
 *
 * Responsabilit:
 *   - Estrarre e validare i dati dal body della richiesta
 *   - Delegare la logica al AuthService
 *   - Restituire risposte HTTP standardizzate
 */
export class AuthController {

  /**
   * POST /api/v1/auth/register
   *
   * Registra un nuovo utente.
   * Body: { name, email, password }
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw new ValidationError('name, email e password sono obbligatori');
      }

      const result = await authService.register({ name, email, password });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Registrazione completata con successo',
        data: {
          user:  result.user,
          token: result.token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   *
   * Autentica un utente esistente e restituisce il JWT.
   * Body: { email, password }
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('email e password sono obbligatori');
      }

      const result = await authService.login(email, password);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Login effettuato con successo',
        data: {
          user:  result.user,
          token: result.token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
