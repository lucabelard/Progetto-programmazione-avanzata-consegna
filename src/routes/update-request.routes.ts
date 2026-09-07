import { Router } from 'express';
import { updateRequestController } from '../controllers/update-request.controller';
import { authenticate, checkCredit } from '../middleware/auth.middleware';

/**
 * Router per le richieste di aggiornamento della griglia.
 *
 * Tutte le route richiedono autenticazione JWT.
 *
 * POST /api/v1/models/:id/updates                 proponi aggiornamento (costa token)
 * GET  /api/v1/models/:id/updates                 lista aggiornamenti (formato JSON o PDF)
 * POST /api/v1/models/:id/updates/:reqId/decide   approva/rifiuta una richiesta
 * POST /api/v1/models/:id/updates/bulk-decide     approva/rifiuta pi richieste
 *
 * IMPORTANTE: 'bulk-decide' deve essere registrata PRIMA di ':reqId/decide'
 * altrimenti Express interpreta 'bulk-decide' come un reqId letterale.
 */
const updateRequestRouter = Router({ mergeParams: true }); // mergeParams permette di accedere a :id del parent

// Proposta aggiornamento (costa token)
updateRequestRouter.post(
  '/',
  authenticate,
  checkCredit,
  (req, res, next) => updateRequestController.propose(req, res, next)
);

// Lista aggiornamenti (JSON o PDF via query ?format=pdf)
updateRequestRouter.get(
  '/',
  authenticate,
  (req, res, next) => updateRequestController.list(req, res, next)
);

// Bulk decide  DEVE essere prima di :reqId/decide
updateRequestRouter.post(
  '/bulk-decide',
  authenticate,
  (req, res, next) => updateRequestController.bulkDecide(req, res, next)
);

// Approva/rifiuta una singola richiesta
updateRequestRouter.post(
  '/:reqId/decide',
  authenticate,
  (req, res, next) => updateRequestController.decide(req, res, next)
);

export default updateRequestRouter;
