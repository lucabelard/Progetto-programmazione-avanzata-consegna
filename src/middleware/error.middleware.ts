import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../config/logger';

/**
 * Classe base per tutti gli errori dell'applicazione.
 * Permette di distinguere gli errori "operazionali" (previsti) dagli errori di programmazione.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    // Mantieni lo stack trace corretto
    // setprototypeof  serve per mantenere la corretta gerarchia di ereditarieta
    // tra le classi Figlio (NotFoundError, ValidationError, UnauthorizedError,
    //  ForbiddenError, ConflictError) e la classe Padre (AppError) 
    // in questo modo quando facciamo l' instanceof possiamo distinguere gli errori
    // operazionali da quelli di programmazione
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
// passa lo status code e il tipo di errore 
//(che verra' usato per loggare e per scegliere l'errore specifico)
export class NotFoundError extends AppError {
  constructor(resource: string = 'Risorsa') {
    super(`${resource} non trovato`, StatusCodes.NOT_FOUND);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Non autorizzato') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Accesso negato') {
    super(message, StatusCodes.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT);
  }
}

/**
 * Interfaccia per le risposte di errore standardizzate.
 */
interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown[];
  stack?: string;
}

/**
 * Global Error Handler Middleware.
 * Deve essere registrato DOPO tutte le route in Express.
 * Trasforma qualsiasi errore in una risposta JSON standardizzata.
 */

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Errore interno del server';

  // Errori applicativi (operazionali)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    logger.warn(`[AppError] ${req.method} ${req.path}  ${statusCode}: ${message}`);
  } else if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    // Errori di validazione Sequelize (es. isEmail, len, unique)  400 Bad Request
    statusCode = StatusCodes.BAD_REQUEST;
    const sequelizeErr = err as Error & { errors?: Array<{ message: string }> };
    message = sequelizeErr.errors?.map(e => e.message).join('; ') ?? err.message;
    logger.warn(`[SequelizeValidationError] ${req.method} ${req.path}  ${statusCode}: ${message}`);
  } else {
    // Errori inaspettati: logga lo stack completo
    logger.error(`[UnhandledError] ${req.method} ${req.path}`, { error: err.message, stack: err.stack });
  }

  const response: ErrorResponse = {
    success: false,
    statusCode,
    message,
    // Mostra lo stack solo in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

/**
 * Middleware per le route non trovate (404).
 * Deve essere registrato DOPO tutte le route, ma PRIMA di errorHandler.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};
