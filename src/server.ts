import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import http from 'http';

/**
 * Entry point dell'applicazione.
 *
 * Flusso di avvio:
 * 1. Connessione al database
 * 2. Creazione dell'app Express
 * 3. Avvio del server HTTP
 * 4. Gestione graceful shutdown
 */
async function bootstrap(): Promise<void> {
  try {
    // 1. Connessione al database
    logger.info('Connessione al database in corso...');
    await connectDatabase();

    // 2. Creazione dell'app Express
    const app = createApp();

    // 3. Avvio del server HTTP
    const server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info('---------------------------------------------');
      logger.info(`Server avviato sulla porta ${env.PORT}`);
      logger.info(`Ambiente: ${env.NODE_ENV}`);
      logger.info(`URL: http://localhost:${env.PORT}`);
      logger.info(`Health: http://localhost:${env.PORT}/health`);
      logger.info(`API: http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info('---------------------------------------------');
    });

    // 4. Graceful Shutdown
    // Gestisce SIGTERM (Docker stop) e SIGINT (Ctrl+C)
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Ricevuto segnale ${signal}. Avvio graceful shutdown...`);

      // Chiude il server HTTP (smette di accettare nuove connessioni)
      server.close(async () => {
        logger.info('Server HTTP chiuso');

        try {
          await disconnectDatabase();
          logger.info('Database disconnesso');
          logger.info('Applicazione terminata correttamente');
          process.exit(0);
        } catch (error) {
          logger.error('Errore durante la disconnessione dal database', error);
          process.exit(1);
        }
      });

      // Forza la chiusura dopo 30 secondi se qualcosa si blocca
      setTimeout(() => {
        logger.error('Timeout graceful shutdown. Forza chiusura.');
        process.exit(1);
      }, 30_000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Gestione errori non catturati
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Errore durante il bootstrap dell\'applicazione:', error);
    process.exit(1);
  }
}

// Avvia l'applicazione
bootstrap();
