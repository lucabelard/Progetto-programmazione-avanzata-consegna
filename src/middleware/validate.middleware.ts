import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from './error.middleware';

/**
 * Middleware di validazione che usa express-validator.
 *
 * Uso tipico:
 *   import { validate } from '../middleware/validate.middleware';
 *   import { body } from 'express-validator';
 *
 *   router.post(
 *     '/users',
 *     validate([
 *       body('email').isEmail().withMessage('Email non valida'),
 *       body('name').notEmpty().withMessage('Nome obbligatorio'),
 *     ]),
 *     userController.create
 *   );
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Esegui tutte le validazioni in parallelo
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    // se ci sono errori unisci tutti i messaggi di errore e li passa all'error handler globale
    if (!errors.isEmpty()) {
      // Raccoglie tutti i messaggi di errore
      const errorMessages = errors
        .array()
        .map((err) => err.msg)
        .join(', ');

      next(new ValidationError(errorMessages));
      return;
    }
    //se non ci sono errori passa la richiesta al controller 
    next();
  };
};
