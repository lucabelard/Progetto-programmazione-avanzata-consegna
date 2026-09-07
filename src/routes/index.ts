import { Router, Request, Response } from 'express';
import authRouter from './auth.routes';
import gridModelRouter from './grid-model.routes';
import updateRequestRouter from './update-request.routes';
import pathfindingRouter from './pathfinding.routes';
import userRouter from './user.routes';
import { env } from '../config/env';

/**
 * Router principale dell'applicazione.
 *
 * Registra tutti i sub-router sotto il prefisso /api/v1.
 * Include anche l'endpoint /health per i controlli di liveness (Docker, k8s).
 */
const rootRouter = Router();

// ── Health Check ──────────────────────────────────────────────────────────────
//_req ha il trattino basso per indicare al compilatore TypeScript che non verra' usato
rootRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    version: '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
const apiPrefix = env.API_PREFIX || '/api/v1';

// Autenticazione (route pubbliche)
rootRouter.use(`${apiPrefix}/auth`, authRouter);

// Modelli di griglia
rootRouter.use(`${apiPrefix}/models`, gridModelRouter);

// Aggiornamenti (montati sotto /models/:id/updates)
rootRouter.use(`${apiPrefix}/models/:id/updates`, updateRequestRouter);

// Pathfinding (montato sotto /models/:id)
rootRouter.use(`${apiPrefix}/models/:id`, pathfindingRouter);

// Utenti
rootRouter.use(`${apiPrefix}/users`, userRouter);

export default rootRouter;
