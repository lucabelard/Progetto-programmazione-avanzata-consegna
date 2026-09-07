import { Sequelize } from 'sequelize-typescript';
import { env } from './env';
import { logger } from './logger';
import { ALL_MODELS } from '../models';

/**
 * Crea l'istanza Sequelize in base all'ambiente.
 *
 * - In ambiente di TEST: usa SQLite in memoria per velocità e isolamento.
 * - In tutti gli altri ambienti: PostgreSQL con le credenziali da .env
 */
function createSequelizeInstance(): Sequelize {
  if (env.NODE_ENV === 'test') {
    // SQLite in memoria: ideale per i test automatici, non richiede un DB reale
    return new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      models: ALL_MODELS,
      logging: false,
      define: { underscored: true, timestamps: true },
    });
  }

  return new Sequelize({
    dialect: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,

    // I modelli sono registrati centralmente in src/models/index.ts
    models: ALL_MODELS,

    // Pool di connessioni
    pool: {
      max: env.DB_POOL_MAX,
      min: env.DB_POOL_MIN,
      acquire: env.DB_POOL_ACQUIRE,
      idle: env.DB_POOL_IDLE,
    },

    // Logging: mostra le query solo in development
    logging: env.NODE_ENV === 'development'
      ? (msg: string) => logger.debug(msg)
      : false,

    // impone al db di comunicare con il server usando SSL
    //se env.NODE_ENV e' 'production' lo spread(...) aggiunge l'opzione ssl dentro dialectOptions
    //altrimenti non aggiunge nulla
    dialectOptions: {
      ...(env.NODE_ENV === 'production' && {
        ssl: { require: true, rejectUnauthorized: false },
      }),
    },

    define: {
      underscored: true,
      timestamps: true,
    },
  });
}

/** Istanza singleton di Sequelize usata in tutta l'app */
export const sequelize = createSequelizeInstance();

/**
 * Testa la connessione al database.
 * Da chiamare all'avvio dell'applicazione.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info(` Database connesso: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);

    // In development, sincronizza i modelli (non usare in produzione!)
    if (env.NODE_ENV === 'development') {
      //con alter:true modifichera le tabelle esistenti aggiungendo/rimuovendo colonne se necessario 
      //per aggiornare automaticamente la struttura delle tabelle
      await sequelize.sync({ alter: true });
      logger.info(' Modelli Sequelize sincronizzati (alter: true)');
    }
  } catch (error) {
    logger.error(' Impossibile connettersi al database:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await sequelize.close();
  logger.info('Database disconnesso.');
}
