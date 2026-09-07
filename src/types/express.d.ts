import { Request } from 'express';
import { JwtPayload } from './common';

/**
 * Estensione dell'interfaccia Request di Express.
 *
 * Dopo il middleware di autenticazione, req.user conterrà
 * il payload decodificato del JWT dell'utente autenticato.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
