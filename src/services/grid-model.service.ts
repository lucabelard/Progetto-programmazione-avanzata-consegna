import { sequelize } from '../config/database';
import { gridModelRepository } from '../repositories/grid-model.repository';
import { userRepository } from '../repositories/user.repository';
import { GridModel } from '../models/grid-model.model';
import { ModelVersion } from '../models/model-version.model';
import { ModelType } from '../types/common';
import { ValidationError, UnauthorizedError, NotFoundError } from '../middleware/error.middleware';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../middleware/error.middleware';

/**
 * GridModelService  logica di business per la creazione e gestione dei modelli.
 *
 * Responsabilit:
 *   - Validazione della struttura della griglia (dimensioni, valori ammessi)
 *   - Calcolo e addebito del costo in token
 *   - Orchestrazione della creazione (modello + versione iniziale) in transazione
 *   - Recupero con filtri
 */
export class GridModelService {

  /**
   * Crea un nuovo modello di griglia.
   *
   * Processo:
   *   1. Valida il tipo di modello e le dimensioni
   *   2. Valida la struttura della griglia (coerenza, valori 0/1)
   *   3. Verifica che l'utente abbia credito sufficiente
   *   4. In transazione: scala i token, crea il modello e la versione iniziale
   *
   * @param userId  ID dell'utente che crea il modello
   * @param data    Dati del modello (nome, tipo, dimensioni, griglia)
   */
  async createModel(
    userId: number,
    data: {
      name:      string;
      modelType: ModelType;
      width:     number;
      height:    number;
      depth?:    number;
      gridData:  unknown; // Validato internamente
    }
  ): Promise<{ model: GridModel; version: ModelVersion }> {

    //  1. Valida le dimensioni 
    if (data.width < 1 || data.height < 1) {
      throw new ValidationError('width e height devono essere almeno 1');
    }
    if (data.modelType === ModelType.GRID_3D) {
      if (!data.depth || data.depth < 1) {
        throw new ValidationError('depth  obbligatoria e deve essere  1 per i modelli GRID_3D');
      }
    }

    //  2. Valida la struttura della griglia 
    const gridData = this.validateGridData(
      data.gridData,
      data.modelType,
      data.width,
      data.height,
      data.depth
    );

    //  3. Calcola il costo in token 
    const cellCount = data.modelType === ModelType.GRID_3D
      ? data.width * data.height * data.depth!
      : data.width * data.height;

    const tokenCost = parseFloat((0.025 * cellCount).toFixed(4));

    //  4. Verifica credito utente 
    const user = await userRepository.findByIdOrFail(userId);
    if (user.tokens < tokenCost) {
      throw new AppError(
        `Credito insufficiente. Costo: ${tokenCost} token. Disponibili: ${user.tokens} token.`,
        StatusCodes.UNAUTHORIZED
      );
    }

    //  5. Operazioni in transazione 
    return sequelize.transaction(async (t) => {
      // Scala i token dell'utente
      await userRepository.decrementTokens(userId, tokenCost, t);

      // Crea il modello e la versione iniziale atomicamente
      const result = await gridModelRepository.createWithFirstVersion(
        {
          name:      data.name,
          modelType: data.modelType,
          width:     data.width,
          height:    data.height,
          depth:     data.depth,
          gridData,
          creatorId: userId,
        },
        t
      );

      return result;
    });
  }

  /**
   * Restituisce un modello con i suoi dettagli.
   */
  async getModel(modelId: number): Promise<GridModel> {
    return gridModelRepository.findByIdWithDetails(modelId);
  }

  /**
   * Restituisce tutti i modelli con filtri opzionali.
   */
  async getAllModels(filters: { modelType?: ModelType; creatorId?: number } = {}): Promise<GridModel[]> {
    return gridModelRepository.findAllWithFilters(filters);
  }

  // 
  // Validazione della griglia  parte pi critica per i modelli 3D
  // 

  /**
   * Valida la struttura dati della griglia e verifica la coerenza con le dimensioni.
   *
   * Per GRID_2D:
   *   - gridData deve essere un array di `height` righe
   *   - Ogni riga deve avere esattamente `width` elementi
   *   - Ogni elemento deve essere 0 (libero) o 1 (occupato)
   *
   * Per GRID_3D:
   *   - gridData deve essere un array di `depth` layer (z)
   *   - Ogni layer deve essere un array di `height` righe (y)
   *   - Ogni riga deve avere esattamente `width` elementi (x)
   *   - Ogni elemento deve essere 0 o 1
   *
   * Le specifiche richiedono esplicitamente di validare profondit,
   * indicizzazione delle celle e coerenza tra dimensioni dichiarate e struttura.
   */
  private validateGridData(
    rawData: unknown,
    modelType: ModelType,
    width: number,
    height: number,
    depth?: number
  ): number[][] | number[][][] {

    if (!Array.isArray(rawData)) {
      throw new ValidationError('gridData deve essere un array');
    }

    if (modelType === ModelType.GRID_2D) {
      return this.validate2DGrid(rawData, width, height);
    } else {
      return this.validate3DGrid(rawData, width, height, depth!);
    }
  }

  /** Valida una griglia 2D: array[height][width] di valori 0|1 */
  private validate2DGrid(data: unknown[], width: number, height: number): number[][] {
    if (data.length !== height) {
      throw new ValidationError(
        `gridData deve avere ${height} righe (height), ma ne ha ${data.length}`
      );
    }

    return data.map((row, y) => {
      if (!Array.isArray(row)) {
        throw new ValidationError(`gridData[${y}] deve essere un array (riga ${y})`);
      }
      if (row.length !== width) {
        throw new ValidationError(
          `gridData[${y}] deve avere ${width} elementi (width), ma ne ha ${row.length}`
        );
      }
      return row.map((cell, x) => {
        if (cell !== 0 && cell !== 1) {
          throw new ValidationError(
            `Valore non ammesso in gridData[${y}][${x}]: ${cell}. Ammessi: 0 (libero) o 1 (occupato)`
          );
        }
        return cell as 0 | 1;
      });
    });
  }

  /**
   * Valida una griglia 3D: array[depth][height][width] di valori 0|1.
   *
   * Questa validazione  pi complessa: controlla tutti e tre gli assi
   * e garantisce che l'indicizzazione [z][y][x] sia corretta.
   */
  private validate3DGrid(
    data: unknown[],
    width: number,
    height: number,
    depth: number
  ): number[][][] {
    if (data.length !== depth) {
      throw new ValidationError(
        `gridData deve avere ${depth} layer (depth), ma ne ha ${data.length}. ` +
        `Ricorda: gridData[z][y][x], quindi il primo indice  z (profondit).`
      );
    }

    return data.map((layer, z) => {
      if (!Array.isArray(layer)) {
        throw new ValidationError(
          `gridData[${z}] (layer z=${z}) deve essere un array di righe`
        );
      }
      if (layer.length !== height) {
        throw new ValidationError(
          `gridData[${z}] deve avere ${height} righe (height), ma ne ha ${layer.length}`
        );
      }

      return (layer as unknown[]).map((row, y) => {
        if (!Array.isArray(row)) {
          throw new ValidationError(
            `gridData[${z}][${y}] deve essere un array di celle`
          );
        }
        if (row.length !== width) {
          throw new ValidationError(
            `gridData[${z}][${y}] deve avere ${width} celle (width), ma ne ha ${row.length}`
          );
        }

        return (row as unknown[]).map((cell, x) => {
          if (cell !== 0 && cell !== 1) {
            throw new ValidationError(
              `Valore non ammesso in gridData[${z}][${y}][${x}]: ${cell}. Ammessi: 0 o 1`
            );
          }
          return cell as 0 | 1;
        });
      });
    });
  }
}

export const gridModelService = new GridModelService();
