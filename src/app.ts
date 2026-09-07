import 'reflect-metadata';
import express, { Application } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logger.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import rootRouter from './routes';
import { env } from './config/env';

/**
 * Configurazione e setup dell'applicazione Express.
 *
 * Questa funzione registra i middleware nell'ordine corretto:
 * 1. Middleware di sicurezza / parsing
 * 2. Logging delle richieste
 * 3. Route
 * 4. Handler 404 (route non trovate)
 * 5. Global Error Handler (deve essere l'ultimo!)
 */

//factory pattern per la creazione di un'app express pulita e isolata in memoria
export function createApp(): Application {
  const app: Application = express();

  // ─────────────────────────────────────────────
  // 1. Middleware di base
  // ─────────────────────────────────────────────

  // CORS – Configura le origini consentite
  app.use(cors({
    origin: env.NODE_ENV === 'production'
      ? ['https://tuo-dominio.com']  // TODO: aggiornare in produzione
      : '*', // in fase di test accetta tutto
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Parsing JSON e URL-encoded bodies (limite di 10mb per evitare attacchi DoS)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─────────────────────────────────────────────
  // 2. Logging HTTP
  // ─────────────────────────────────────────────
  app.use(requestLogger);

  // ─────────────────────────────────────────────
  // 3. Route 
  // ────────────────────────────────────────────
  app.use('/', rootRouter);

  // ─────────────────────────────────────────────
  // 4. Handler 404 – Route non trovata
  //    DEVE essere dopo tutte le route
  // ─────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─────────────────────────────────────────────
  // 5. Global Error Handler
  //    DEVE essere l'ultimo middleware (4 parametri!)
  // ─────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
