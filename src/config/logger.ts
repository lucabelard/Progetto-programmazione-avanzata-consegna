import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Formato per l'ambiente di sviluppo: leggibile dagli esseri umani.
 */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\n  ${JSON.stringify(meta, null, 2)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

/**
 * Formato per la produzione: JSON strutturato (facile da parsare da tool di monitoring).
 */
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // In produzione, scrivi anche su file
    ...(env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
  // Non crashare su eccezioni non gestite
  exitOnError: false,
});
