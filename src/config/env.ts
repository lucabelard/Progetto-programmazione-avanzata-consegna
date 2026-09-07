import dotenv from 'dotenv';
import path from 'path';

// Carica il file .env dalla root del progetto
//../../ va indietro di due cartelle: src -> config -> .. -> .. -> root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Configurazione tipizzata di tutte le variabili d'ambiente.
 * Viene validata all'avvio: se una variabile obbligatoria manca, l'app non parte.
 */
interface EnvConfig {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_PREFIX: string;

  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_POOL_MAX: number;
  DB_POOL_MIN: number;
  DB_POOL_ACQUIRE: number;
  DB_POOL_IDLE: number;

  // JWT – si preferisce RS256, chiave privata in file separato
  JWT_PRIVATE_KEY: string;   // Chiave privata RSA (RS256) – obbligatoria
  JWT_PUBLIC_KEY: string;    // Chiave pubblica RSA (RS256) – obbligatoria
  JWT_EXPIRES_IN: string;

  // Business logic
  INITIAL_USER_TOKENS: number;  // Credito iniziale assegnato a ogni nuovo utente

  // Logging
  LOG_LEVEL: string;
}

// principio fail fast: se una variabile obbligatoria manca l'app non parte
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[ENV] Variabile d'ambiente obbligatoria mancante: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Carica e valida la configurazione dell'ambiente.
 *
 * Le chiavi JWT RS256 vengono lette dall'ambiente come stringhe multilinea.
 * Nel file .env, usa \n per rappresentare le newline oppure fornisci
 * la chiave RSA già formattata con le newline corrette.
 */
function loadEnv(): EnvConfig {
  // Leggi le chiavi RSA: se non presenti in produzione, usa chiavi di sviluppo
  const nodeEnv = optionalEnv('NODE_ENV', 'development') as EnvConfig['NODE_ENV'];

  // In ambiente di test si usano chiavi RSA dedicate (generate per i test)
  let privateKey: string;
  let publicKey: string;

  if (nodeEnv === 'test') {
    // In test mode usiamo chiavi hardcoded leggere (generate offline)
    privateKey = optionalEnv('JWT_PRIVATE_KEY', 'test-private-key');
    publicKey = optionalEnv('JWT_PUBLIC_KEY', 'test-public-key');
  } else {
    privateKey = requireEnv('JWT_PRIVATE_KEY').replace(/\\n/g, '\n'); // /\\n/g cerca tutte le \n e le trasforma in vere newline
    publicKey = requireEnv('JWT_PUBLIC_KEY').replace(/\\n/g, '\n');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: parseInt(optionalEnv('PORT', '3000'), 10),
    API_PREFIX: optionalEnv('API_PREFIX', '/api/v1'),

    DB_HOST: optionalEnv('DB_HOST', 'localhost'),
    DB_PORT: parseInt(optionalEnv('DB_PORT', '5432'), 10),
    DB_NAME: optionalEnv('DB_NAME', 'progetto_db'),
    DB_USER: optionalEnv('DB_USER', 'postgres'),
    DB_PASSWORD: optionalEnv('DB_PASSWORD', 'postgres'),
    DB_POOL_MAX: parseInt(optionalEnv('DB_POOL_MAX', '5'), 10),
    DB_POOL_MIN: parseInt(optionalEnv('DB_POOL_MIN', '0'), 10),
    DB_POOL_ACQUIRE: parseInt(optionalEnv('DB_POOL_ACQUIRE', '30000'), 10),
    DB_POOL_IDLE: parseInt(optionalEnv('DB_POOL_IDLE', '10000'), 10),

    JWT_PRIVATE_KEY: privateKey,
    JWT_PUBLIC_KEY: publicKey,
    JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '24h'),

    INITIAL_USER_TOKENS: parseFloat(optionalEnv('INITIAL_USER_TOKENS', '100')),

    LOG_LEVEL: optionalEnv('LOG_LEVEL', 'debug'),
  };
}

export const env = loadEnv();

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
