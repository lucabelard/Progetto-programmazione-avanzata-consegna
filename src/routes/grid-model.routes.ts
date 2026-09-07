import { Router } from 'express';
import { gridModelController } from '../controllers/grid-model.controller';
import { authenticate, checkCredit } from '../middleware/auth.middleware';

/**
 * Router per i modelli di griglia.
 *
 * Tutte le route richiedono autenticazione JWT (middleware authenticate).
 * Le route di creazione richiedono anche il controllo del credito (checkCredit).
 *
 * POST   /api/v1/models       crea un nuovo modello (costa token)
 * GET    /api/v1/models       lista i modelli (filtri opzionali: modelType, creatorId)
 * GET    /api/v1/models/:id   dettaglio di un modello
 */
const gridModelRouter = Router();

// Creazione: autenticazione + verifica credito
gridModelRouter.post(
  '/',
  authenticate,
  checkCredit,
  (req, res, next) => gridModelController.create(req, res, next)
);

// Lista: solo autenticazione
gridModelRouter.get(
  '/',
  authenticate,
  (req, res, next) => gridModelController.list(req, res, next)
);

// Dettaglio: solo autenticazione
gridModelRouter.get(
  '/:id',
  authenticate,
  (req, res, next) => gridModelController.getById(req, res, next)
);

export default gridModelRouter;
