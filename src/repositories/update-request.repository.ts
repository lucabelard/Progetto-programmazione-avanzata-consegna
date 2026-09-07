import { Op, Transaction } from 'sequelize';
import { BaseRepository } from './base.repository';
import { UpdateRequest, CellChange } from '../models/update-request.model';
import { User } from '../models/user.model';
import { GridModel } from '../models/grid-model.model';
import { ModelVersion } from '../models/model-version.model';
import { UpdateRequestStatus, UpdateRequestFilters } from '../types/common';
import { NotFoundError } from '../middleware/error.middleware';

/**
 * UpdateRequestRepository  accesso alle richieste di aggiornamento.
 *
 * Gestisce tutte le query sulle UpdateRequest, compresi i filtri
 * temporali, per stato e per layer z (specifico per 3D).
 */
export class UpdateRequestRepository extends BaseRepository<UpdateRequest> {
  constructor() {
    super(UpdateRequest);
  }

  /**
   * Crea una nuova richiesta di aggiornamento.
   * L'importo in token  gi stato scalato dal service prima di chiamare questo metodo.
   */
  async createRequest(
    data: {
      modelId:       number;
      baseVersionId: number;
      proposerId:    number;
      cells:         CellChange[];
      status:        UpdateRequestStatus;
    },
    t?: Transaction
  ): Promise<UpdateRequest> {
    return UpdateRequest.create(
      {
        modelId:       data.modelId,
        baseVersionId: data.baseVersionId,
        proposerId:    data.proposerId,
        cells:         data.cells,
        status:        data.status,
        approverId:    null,
        reason:        null,
        decidedAt:     null,
      },
      { transaction: t }
    );
  }

  /**
   * Cerca una richiesta per ID, con tutte le associazioni.
   * @throws NotFoundError se non trovata
   */
  async findByIdWithDetails(id: number): Promise<UpdateRequest> {
    const req = await UpdateRequest.findByPk(id, {
      include: [
        { model: User,         as: 'proposer',    attributes: ['id', 'name', 'email'] },
        { model: User,         as: 'approver',    attributes: ['id', 'name', 'email'] },
        { model: GridModel,    as: 'model',       attributes: ['id', 'name', 'modelType', 'creatorId'] },
        { model: ModelVersion, as: 'baseVersion', attributes: ['id', 'versionNumber'] },
      ],
    });
    if (!req) throw new NotFoundError(`Richiesta di aggiornamento con ID ${id}`);
    return req;
  }

  /**
   * Restituisce le richieste di un modello con filtri opzionali.
   *
   * Filtri supportati (tutti opzionali):
   *   - status:    PENDING | ACCEPTED | REJECTED
   *   - modelType: GRID_2D | GRID_3D  filtra per tipo di modello (JOIN su GridModel)
   *   - startDate: richieste create da questa data
   *   - endDate:   richieste create fino a questa data
   *   - layerZ:    solo per 3D  filtra le celle che toccano questo layer z
   */
  async findByModelWithFilters(
    modelId: number,
    filters: UpdateRequestFilters = {}
  ): Promise<UpdateRequest[]> {
    const where: Record<string, unknown> = { modelId };

    // Filtro per stato
    if (filters.status) {
      where['status'] = filters.status;
    }

    // Filtro per intervallo temporale (colonna requestedAt)
    if (filters.startDate || filters.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.startDate) dateFilter[Op.gte as unknown as string] = filters.startDate;
      if (filters.endDate)   dateFilter[Op.lte as unknown as string] = filters.endDate;
      where['requestedAt'] = dateFilter;
    }

    // Include su GridModel: obbligatorio per il filtro modelType.
    // Se modelType  specificato aggiunge una clausola WHERE sul JOIN;
    // altrimenti include il modello senza filtrare (required: false).
    const gridModelInclude: Record<string, unknown> = {
      model: GridModel,
      as: 'model',
      attributes: ['id', 'name', 'modelType'],
      required: filters.modelType ? true : false, // INNER JOIN solo se si filtra
    };
    if (filters.modelType) {
      gridModelInclude['where'] = { modelType: filters.modelType };
    }

    const requests = await UpdateRequest.findAll({
      where,
      include: [
        gridModelInclude,
        { model: User, as: 'proposer', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email'] },
      ],
      order: [['requestedAt', 'DESC']],
    });

    // Filtro per layer z applicato in memoria (il campo cells  JSONB).
    // Per sistemi ad alto traffico si potrebbe usare una query JSONB nativa PostgreSQL.
    if (filters.layerZ !== undefined) {
      const z = filters.layerZ;
      return requests.filter(req =>
        req.cells.some(cell => cell.z !== undefined && cell.z === z)
      );
    }

    return requests;
  }

  /**
   * Aggiorna lo stato di una richiesta (approvazione/rifiuto).
   * Da eseguire sempre in transazione.
   */
  async decide(
    requestId:       number,
    approverId:      number,
    newStatus:       UpdateRequestStatus.ACCEPTED | UpdateRequestStatus.REJECTED,
    reason:          string | null,
    resultVersionId: number | null,
    t:               Transaction
  ): Promise<UpdateRequest> {
    const req = await UpdateRequest.findByPk(requestId, { transaction: t, lock: true });
    if (!req) throw new NotFoundError(`Richiesta con ID ${requestId}`);

    await req.update(
      {
        status:          newStatus,
        approverId,
        reason,
        decidedAt:       new Date(),
        resultVersionId,
      },
      { transaction: t }
    );

    return req;
  }
}

export const updateRequestRepository = new UpdateRequestRepository();
