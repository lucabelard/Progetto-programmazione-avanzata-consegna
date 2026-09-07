import { Router } from 'express';
import { pathfindingController } from '../controllers/pathfinding.controller';
import { authenticate, checkCredit } from '../middleware/auth.middleware';

/**
 * Router per l'esecuzione del pathfinding.
 *
 * POST /api/v1/models/:id/execute → esegui pathfinding (costa token)
 */

//mergeParams: true permette di ereditare i parametri dall'endpoint padre
const pathfindingRouter = Router({ mergeParams: true });

pathfindingRouter.post(
  '/execute',
  authenticate,
  checkCredit,
  (req, res, next) => pathfindingController.execute(req, res, next)
);

export default pathfindingRouter;
