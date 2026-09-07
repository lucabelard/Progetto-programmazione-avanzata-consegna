import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from './error.middleware';
import { AppError } from './error.middleware';
import { StatusCodes } from 'http-status-codes';

/**
 * Middleware di autenticazione JWT (RS256).
 *
 * Verifica che la richiesta contenga un token Bearer valido.
 * Se il token è valido, popola req.user con il payload decodificato
 * (userId, email, role) e passa al middleware successivo.
 *
 * In caso di token mancante, scaduto o invalido, lancia UnauthorizedError.
 *
 * Uso:
 *   router.get('/modelli', authenticate, modelController.list);
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token di autenticazione mancante. Usa Authorization: Bearer <token>');
    }
    //serve per separare il token dall'header (perchè c'è scritto "Bearer " prima del token)
    //quindi prendiamo solo il token (la seconda parte)
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token non valido');
    }

    // Verifica e decodifica il JWT tramite AuthService
    const payload = authService.verifyToken(token);
    req.user = payload;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware di autorizzazione per ruolo admin.
 *
 * Da usare DOPO authenticate. Verifica che req.user.role sia 'admin'.
 * Usato per endpoint riservati all'amministratore (es. ricarica token, lista utenti).
 *
 * Uso:
 *   router.get('/admin/utenti', authenticate, requireAdmin, adminController.listUsers);
 */

//niente async perchè il controllo è puramente in memoria (non interagiamo col DB)
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Autenticazione richiesta'));
  }
  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Accesso riservato agli amministratori'));
  }
  next();
};

/**
 * Middleware di controllo credito token.
 *
 * Da usare DOPO authenticate. Verifica che l'utente autenticato
 * abbia almeno 1 token di credito residuo.
 *
 * Per un controllo più preciso (es. verificare l'importo esatto),
 * il controllo viene rifatto nel service con il costo effettivo.
 * Questo middleware è un "early exit" rapido per richieste senza credito.
 *
 * Come da specifiche: se il credito è esaurito, restituisce 401 Unauthorized.
 *
 * Uso:
 *   router.post('/modelli', authenticate, checkCredit, modelController.create);
 */
export const checkCredit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Autenticazione richiesta'));
    }

    // Carica l'utente aggiornato dal DB (i token in req.user potrebbero essere obsoleti)
    const user = await userRepository.findByIdOrFail(req.user.userId);

    if (user.tokens <= 0) {
      return next(new AppError(
        `Credito esaurito. Il tuo saldo è ${user.tokens} token. Contatta l'amministratore per una ricarica.`,
        StatusCodes.UNAUTHORIZED
      ));
    }

    next();
  } catch (error) {
    next(error);
  }
};
