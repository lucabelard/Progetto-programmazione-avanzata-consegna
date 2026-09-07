import { Sequelize } from 'sequelize-typescript';
import { User } from './user.model';
import { GridModel } from './grid-model.model';
import { ModelVersion } from './model-version.model';
import { UpdateRequest } from './update-request.model';

/**
 * Registro centralizzato di tutti i modelli Sequelize.
 *
 * Questo file viene importato da database.ts per registrare
 * i modelli nell'istanza Sequelize e definire le associazioni.
 *
 * Ordine di caricamento importante per evitare dipendenze circolari:
 *   1. User (indipendente)
 *   2. GridModel (dipende da User)
 *   3. ModelVersion (dipende da GridModel, User)
 *   4. UpdateRequest (dipende da GridModel, ModelVersion, User)
 */

export const ALL_MODELS = [
  User,
  GridModel,
  ModelVersion,
  UpdateRequest,
];

/**
 * Registra i modelli sull'istanza Sequelize fornita.
 * Da chiamare dopo la creazione dell'istanza Sequelize.
 */
export function registerModels(sequelizeInstance: Sequelize): void {
  sequelizeInstance.addModels(ALL_MODELS);
}

// Re-esporta tutti i modelli per comodità (se devo importare più modelli in un
// altro file, mi permette di fare 1 solo import unico anzichè 4 import differenti)
export { User, GridModel, ModelVersion, UpdateRequest };
