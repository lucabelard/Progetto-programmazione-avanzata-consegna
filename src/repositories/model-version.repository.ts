import { Transaction } from 'sequelize';
import { BaseRepository } from './base.repository';
import { ModelVersion } from '../models/model-version.model';
import { NotFoundError } from '../middleware/error.middleware';

/**
 * ModelVersionRepository – accesso allo storico delle versioni.
 *
 * Gestisce tutte le query sulle versioni dei modelli.
 * Le versioni sono immutabili (non si aggiornano mai).
 */
export class ModelVersionRepository extends BaseRepository<ModelVersion> {
  constructor() {
    super(ModelVersion);
  }

  /**
   * Restituisce l'ultima versione approvata di un modello.
   *
   * "Ultima versione approvata" = versione con versionNumber più alto per quel modello.
   * Le specifiche richiedono che il pathfinding venga eseguito sempre su questa versione
   * (non su versioni candidate o pending).
   *
   * @throws NotFoundError se il modello non ha versioni (non dovrebbe mai accadere)
   */
  async findLatestByModel(modelId: number): Promise<ModelVersion> {
    const version = await ModelVersion.findOne({
      where: { modelId },
      order: [['version_number', 'DESC']], // Prende la più recente
    });
    if (!version) {
      throw new NotFoundError(`Nessuna versione trovata per il modello ${modelId}`);
    }
    return version;
  }

  /**
   * Restituisce tutte le versioni di un modello, ordinate dalla più recente.
   */
  async findAllByModel(modelId: number): Promise<ModelVersion[]> {
    return ModelVersion.findAll({
      where: { modelId },
      order: [['version_number', 'DESC']],
    });
  }

  /**
   * Crea una nuova versione del modello.
   *
   * Il versionNumber viene calcolato automaticamente come:
   *   (ultimo versionNumber del modello) + 1
   *
   * Da eseguire sempre in transazione insieme all'aggiornamento della gridData.
   */
  async createNewVersion(
    data: {
      modelId: number;
      gridData: number[][] | number[][][];
      proposedBy: number;
      approvedBy: number;
    },
    t: Transaction
  ): Promise<ModelVersion> {
    // Calcola il prossimo numero di versione
    const latestVersion = await ModelVersion.findOne({
      where: { modelId: data.modelId },
      order: [['version_number', 'DESC']],
      transaction: t,
      lock: true, // Lock per prevenire conflitti concorrenti
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1; //se non ci sono versioni (strano) riparte da 1

    return ModelVersion.create(
      {
        modelId: data.modelId,
        versionNumber: nextVersionNumber,
        gridData: data.gridData,
        proposedBy: data.proposedBy,
        approvedBy: data.approvedBy,
      },
      { transaction: t }
    );
  }

  /**
   * Trova una versione specifica per ID, lanciando errore se non trovata.
   */
  async findByIdOrFail(versionId: number): Promise<ModelVersion> {
    const version = await ModelVersion.findByPk(versionId);
    if (!version) throw new NotFoundError(`Versione con ID ${versionId}`);
    return version;
  }
}

export const modelVersionRepository = new ModelVersionRepository();
