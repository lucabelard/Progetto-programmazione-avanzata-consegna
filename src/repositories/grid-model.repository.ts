import { Op, Transaction } from 'sequelize';
import { BaseRepository } from './base.repository';
import { GridModel } from '../models/grid-model.model';
import { ModelVersion } from '../models/model-version.model';
import { User } from '../models/user.model';
import { ModelType } from '../types/common';
import { NotFoundError } from '../middleware/error.middleware';

/**
 * GridModelRepository  accesso ai dati dei modelli di griglia.
 *
 * Gestisce tutte le query relative a GridModel, inclusi i filtri
 * e il caricamento delle associazioni (creator, versions).
 */
export class GridModelRepository extends BaseRepository<GridModel> {
  constructor() {
    super(GridModel);
  }

  /**
   * Cerca un modello per ID con le sue associazioni principali.
   * Include il creatore e l'ultima versione del modello.
   *
   * @throws NotFoundError se il modello non esiste
   */
  async findByIdWithDetails(id: number, t?: Transaction): Promise<GridModel> {
    const model = await GridModel.findByPk(id, {
      transaction: t,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        {
          model: ModelVersion,
          as: 'versions',
          order: [['version_number', 'DESC']],
          limit: 1, // Carica solo la versione pi recente
        },
      ],
    });
    if (!model) throw new NotFoundError(`Modello con ID ${id}`);
    return model;
  }

  /**
   * Restituisce tutti i modelli con filtri opzionali.
   * Usato dall'endpoint GET /api/v1/models.
   */
  async findAllWithFilters(filters: {
    modelType?: ModelType;
    creatorId?: number;
  }): Promise<GridModel[]> {
    const where: Record<string, unknown> = {};

    if (filters.modelType) where['modelType'] = filters.modelType;
    if (filters.creatorId) where['creatorId'] = filters.creatorId;

    return GridModel.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Crea un nuovo modello di griglia e la sua prima versione in transazione.
   *
   * La versione 1 rappresenta lo stato iniziale della griglia al momento della creazione.
   * Usare una transazione garantisce che il modello e la sua versione siano
   * sempre creati insieme (o non creati affatto).
   *
   * @param data  Dati del modello
   * @param t     Transazione Sequelize (obbligatoria)
   */
  async createWithFirstVersion(
    data: {
      name: string;
      modelType: ModelType;
      width: number;
      height: number;
      depth?: number;
      gridData: number[][] | number[][][];
      creatorId: number;
    },
    t: Transaction
  ): Promise<{ model: GridModel; version: ModelVersion }> {
    const model = await GridModel.create(
      {
        name:      data.name,
        modelType: data.modelType,
        width:     data.width,
        height:    data.height,
        depth:     data.depth ?? null,
        gridData:  data.gridData,
        creatorId: data.creatorId,
      },
      { transaction: t }
    );

    // Crea la versione iniziale (versione 1) come snapshot della griglia al momento della creazione
    const version = await ModelVersion.create(
      {
        modelId:       model.id,
        versionNumber: 1,
        gridData:      data.gridData,
        proposedBy:    data.creatorId,
        approvedBy:    data.creatorId, // Il creatore approva implicitamente la sua stessa creazione
      },
      { transaction: t }
    );

    return { model, version };
  }

  /**
   * Aggiorna la gridData del modello (dopo approvazione di un aggiornamento).
   * Da eseguire in transazione insieme alla creazione della nuova versione.
   */
  async updateGridData(
    modelId: number,
    newGridData: number[][] | number[][][],
    t: Transaction
  ): Promise<void> {
    await GridModel.update(
      { gridData: newGridData },
      { where: { id: modelId }, transaction: t }
    );
  }
}

export const gridModelRepository = new GridModelRepository();
