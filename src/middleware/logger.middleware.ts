import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logger } from '../config/logger';

/**
 * Middleware di logging delle richieste HTTP usando Morgan.
 * In sviluppo usa il formato "dev" colorato;
 * in produzione usa il formato "combined" standard Apache.
 */

// Stream che reindirizza l'output di Morgan verso Winston  
// Morgan normalmente stamperebbe tutto con console.log
const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
  { stream: morganStream }
);
