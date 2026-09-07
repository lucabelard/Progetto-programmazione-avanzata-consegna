import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { gridModelRepository } from '../repositories/grid-model.repository';
import { modelVersionRepository } from '../repositories/model-version.repository';
import { updateRequestRepository } from '../repositories/update-request.repository';
import { userRepository } from '../repositories/user.repository';
import { UpdateRequest, CellChange } from '../models/update-request.model';
import { GridModel } from '../models/grid-model.model';
import { ModelType, UpdateRequestStatus, UpdateRequestFilters } from '../types/common';
import { ValidationError, ForbiddenError, NotFoundError } from '../middleware/error.middleware';
import { AppError } from '../middleware/error.middleware';
import { UpdateRequestStateContext } from '../states/update-request.state';
import { StatusCodes } from 'http-status-codes';

/**
 * UpdateRequestService  gestisce le proposte di modifica della griglia.
 *
 * Implementa il workflow crowd-sourcing richiesto dalle specifiche:
 *
 *   1. Un utente propone la modifica di una o pi celle
 *   2. Viene addebitato 0.25 token per cella modificata
 *   3a. Se l'utente  il creatore del modello  ACCEPTED direttamente + nuova versione
 *   3b. Se  un altro utente  PENDING, in attesa della decisione del creatore
 *   4. Il creatore approva (ACCEPTED + nuova versione) o rifiuta (REJECTED, griglia invariata)
 *
 * Tutte le operazioni che modificano dati sono eseguite in transazione
 * per garantire la consistenza anche in caso di errori.
 */
export class UpdateRequestService {

  /**
   * Propone una modifica a una o pi celle della griglia.
   *
   * @param modelId   ID del modello da modificare
   * @param cells     Lista di celle da modificare con il nuovo valore
   * @param proposerId ID dell'utente che propone la modifica
   */
  async proposeUpdate(
    modelId:    number,
    cells:      CellChange[],
    proposerId: number
  ): Promise<UpdateRequest> {

    //  1. Carica il modello e verifica che esista 
    const model = await gridModelRepository.findByIdWithDetails(modelId);
    const latestVersion = await modelVersionRepository.findLatestByModel(modelId);

    //  2. Valida le celle proposte 
    this.validateCells(cells, model);

    //  3. Calcola il costo: 0.25 token per ogni cella coinvolta 
    const tokenCost = parseFloat((0.25 * cells.length).toFixed(4));

    const proposer = await userRepository.findByIdOrFail(proposerId);
    if (proposer.tokens < tokenCost) {
      throw new AppError(
        `Credito insufficiente. Costo richiesta: ${tokenCost} token. Disponibili: ${proposer.tokens} token.`,
        StatusCodes.UNAUTHORIZED
      );
    }

    const isCreator = model.creatorId === proposerId;

    //  4. Esegui in transazione 
    return sequelize.transaction(async (t) => {
      // Scala sempre i token del proponente
      await userRepository.decrementTokens(proposerId, tokenCost, t);

      if (isCreator) {
        // Il creatore: applica direttamente la modifica e registra come ACCEPTED
        const newGridData = this.applyChanges(model.gridData, cells);

        // Aggiorna la gridData corrente del modello
        await gridModelRepository.updateGridData(modelId, newGridData, t);

        // Crea una nuova versione con lo snapshot aggiornato
        const newVersion = await modelVersionRepository.createNewVersion(
          {
            modelId,
            gridData:   newGridData,
            proposedBy: proposerId,
            approvedBy: proposerId,
          },
          t
        );

        // Crea la richiesta gi come ACCEPTED
        const request = await updateRequestRepository.createRequest(
          {
            modelId,
            baseVersionId: latestVersion.id,
            proposerId,
            cells,
            status: UpdateRequestStatus.ACCEPTED,
          },
          t
        );

        // Aggiorna la richiesta con il riferimento alla versione creata
        await request.update({ approverId: proposerId, decidedAt: new Date(), resultVersionId: newVersion.id }, { transaction: t });

        return request;
      } else {
        // Altro utente: registra come PENDING, non modifica la griglia
        return updateRequestRepository.createRequest(
          {
            modelId,
            baseVersionId: latestVersion.id,
            proposerId,
            cells,
            status: UpdateRequestStatus.PENDING,
          },
          t
        );
      }
    });
  }

  /**
   * Il creatore del modello approva o rifiuta una singola richiesta PENDING.
   *
   * @param requestId  ID della richiesta da decidere
   * @param approverId ID del creatore che prende la decisione
   * @param action     'approve' o 'reject'
   * @param reason     Motivazione del rifiuto (opzionale, solo per REJECTED)
   */
  async decideRequest(
    requestId:   number,
    approverId:  number,
    action:      'approve' | 'reject',
    reason?:     string,
    externalTransaction?: Transaction
  ): Promise<UpdateRequest> {

    const request = await updateRequestRepository.findByIdWithDetails(requestId);
    const model   = await gridModelRepository.findByIdWithDetails(request.modelId);

    // Solo il creatore del modello pu decidere sulle richieste
    if (model.creatorId !== approverId) {
      throw new ForbiddenError(
        'Solo il creatore del modello pu approvare o rifiutare le richieste di aggiornamento'
      );
    }

    // Usa il State Pattern per verificare che la transizione sia valida
    const stateCtx = new UpdateRequestStateContext(request.status);

    const execute = async (t: Transaction) => {
      if (action === 'approve') {
        stateCtx.approve(); // Lancia errore se non  PENDING

        // Applica le modifiche alla griglia
        const newGridData = this.applyChanges(model.gridData, request.cells);
        await gridModelRepository.updateGridData(model.id, newGridData, t);

        // Crea la nuova versione come storico della modifica approvata
        const newVersion = await modelVersionRepository.createNewVersion(
          {
            modelId:    model.id,
            gridData:   newGridData,
            proposedBy: request.proposerId,
            approvedBy: approverId,
          },
          t
        );

        return updateRequestRepository.decide(
          requestId,
          approverId,
          UpdateRequestStatus.ACCEPTED,
          null,
          newVersion.id,
          t
        );

      } else {
        stateCtx.reject(); // Lancia errore se non  PENDING

        // REJECTED: la griglia rimane invariata, nessuna nuova versione
        return updateRequestRepository.decide(
          requestId,
          approverId,
          UpdateRequestStatus.REJECTED,
          reason ?? null,
          null,
          t
        );
      }
    };

    if (externalTransaction) {
      return execute(externalTransaction);
    } else {
      return sequelize.transaction(execute);
    }
  }

  /**
   * Approvazione/rifiuto in modalit bulk.
   *
   * Permette di decidere su pi richieste in un'unica chiamata.
   * Tutte le decisioni vengono applicate nell'ambito di un'unica transazione:
   * se una fallisce, nessuna delle precedenti viene committata (atomicit).
   *
   * @param items      Lista di { requestId, action, reason? }
   * @param approverId ID del creatore
   */
  async bulkDecide(
    items: Array<{
      requestId: number;
      action:    'approve' | 'reject';
      reason?:   string;
    }>,
    approverId: number
  ): Promise<UpdateRequest[]> {

    // Tutte le decisioni vengono eseguite in un'unica transazione globale.
    // Se una delle approvazioni solleva un errore, Sequelize fa il rollback
    // di tutte le operazioni precedenti nella stessa transazione.
    return sequelize.transaction(async (t) => {
      const results: UpdateRequest[] = [];

      for (const item of items) {
        const result = await this.decideRequest(
          item.requestId,
          approverId,
          item.action,
          item.reason,
          t
        );
        results.push(result);
      }

      return results;
    });
  }

  /**
   * Restituisce le richieste di aggiornamento di un modello con filtri.
   */
  async getRequestsByModel(modelId: number, filters: UpdateRequestFilters = {}): Promise<UpdateRequest[]> {
    // Verifica che il modello esista
    await gridModelRepository.findByIdWithDetails(modelId);
    return updateRequestRepository.findByModelWithFilters(modelId, filters);
  }

  // 
  // Metodi privati di validazione e applicazione modifiche
  // 

  /**
   * Valida la lista di celle proposte.
   *
   * Controlli:
   *   - Le coordinate devono essere dentro i limiti della griglia
   *   - Per GRID_3D: z deve essere specificato e dentro depth
   *   - Non ci devono essere celle duplicate
   *   - Il valore newValue deve essere 0 o 1
   *   - Non ci devono essere modifiche nulle (cella gi nello stato proposto)
   */
  private validateCells(cells: CellChange[], model: GridModel): void {
    if (!cells || cells.length === 0) {
      throw new ValidationError('Devi specificare almeno una cella da modificare');
    }

    const seen = new Set<string>();

    for (const cell of cells) {
      // Valida valori ammessi
      if (cell.newValue !== 0 && cell.newValue !== 1) {
        throw new ValidationError(
          `newValue deve essere 0 (libero) o 1 (occupato), ricevuto: ${cell.newValue}`
        );
      }

      // Valida coordinate x
      if (cell.x < 0 || cell.x >= model.width) {
        throw new ValidationError(
          `Coordinata x=${cell.x} fuori dal range [0, ${model.width - 1}]`
        );
      }

      // Valida coordinate y
      if (cell.y < 0 || cell.y >= model.height) {
        throw new ValidationError(
          `Coordinata y=${cell.y} fuori dal range [0, ${model.height - 1}]`
        );
      }

      // Valida coordinata z per 3D
      if (model.modelType === ModelType.GRID_3D) {
        if (cell.z === undefined || cell.z === null) {
          throw new ValidationError(
            `La coordinata z  obbligatoria per i modelli GRID_3D`
          );
        }
        const depth = model.depth ?? 1;
        if (cell.z < 0 || cell.z >= depth) {
          throw new ValidationError(
            `Coordinata z=${cell.z} fuori dal range [0, ${depth - 1}]`
          );
        }
      }

      // Verifica duplicati
      const key = `${cell.x},${cell.y},${cell.z ?? 0}`;
      if (seen.has(key)) {
        throw new ValidationError(`Cella duplicata nella richiesta: {x:${cell.x}, y:${cell.y}${cell.z !== undefined ? `, z:${cell.z}` : ''}}`);
      }
      seen.add(key);

      // Verifica che la modifica non sia nulla (la cella  gi in quello stato)
      const currentValue = model.modelType === ModelType.GRID_3D
        ? (model.gridData as number[][][])[cell.z!]?.[cell.y]?.[cell.x]
        : (model.gridData as number[][])[cell.y]?.[cell.x];

      if (currentValue === cell.newValue) {
        throw new ValidationError(
          `Modifica nulla: la cella {x:${cell.x}, y:${cell.y}${cell.z !== undefined ? `, z:${cell.z}` : ''}}  gi ${cell.newValue === 0 ? 'libera' : 'occupata'}`
        );
      }
    }
  }

  /**
   * Applica le modifiche delle celle alla gridData corrente.
   *
   * Crea una copia profonda della griglia (deep clone) prima di modificarla,
   * per non alterare l'oggetto originale durante la transazione.
   */
  private applyChanges(
    currentData: number[][] | number[][][],
    cells: CellChange[]
  ): number[][] | number[][][] {
    // Deep clone per immutabilit
    const newData = JSON.parse(JSON.stringify(currentData));

    for (const cell of cells) {
      if (cell.z !== undefined) {
        // Griglia 3D: [z][y][x]
        (newData as number[][][])[cell.z][cell.y][cell.x] = cell.newValue;
      } else {
        // Griglia 2D: [y][x]
        (newData as number[][])[cell.y][cell.x] = cell.newValue;
      }
    }

    return newData;
  }
}

export const updateRequestService = new UpdateRequestService();
