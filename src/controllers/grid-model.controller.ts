import { Request, Response, NextFunction } from 'express';
import { gridModelService } from '../services/grid-model.service';
import { ModelType } from '../types/common';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../middleware/error.middleware';

/**
 * GridModelController – gestisce le route relative ai modelli di griglia.
 *
 * Endpoints:
 *   POST   /api/v1/models          → crea un nuovo modello
 *   GET    /api/v1/models          → lista tutti i modelli (con filtri opzionali)
 *   GET    /api/v1/models/:id      → dettaglio di un modello
 */
export class GridModelController {

  /**
   * POST /api/v1/models
   *
   * Crea un nuovo modello di griglia.
   *
   * Body richiesto:
   *   { name, modelType, width, height, gridData }        ← per GRID_2D
   *   { name, modelType, width, height, depth, gridData } ← per GRID_3D
   *
   * Costo: 0.025 × (width × height) oppure × (width × height × depth)
   */

  //req.user!.userId è sicuro grazie al middleware authenticate quindi non sarà mai null o undefined
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, modelType, width, height, depth, gridData } = req.body;
      const userId = req.user!.userId;

      // Validazione del tipo di modello
      if (!Object.values(ModelType).includes(modelType)) {
        throw new ValidationError(
          `modelType non valido: "${modelType}". Valori accettati: ${Object.values(ModelType).join(', ')}`
        );
      }

      const { model, version } = await gridModelService.createModel(userId, {
        name,
        modelType,
        width: Number(width),
        height: Number(height),
        depth: depth !== undefined ? Number(depth) : undefined,
        gridData,
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Modello creato con successo',
        data: {
          model: {
            id: model.id,
            name: model.name,
            modelType: model.modelType,
            width: model.width,
            height: model.height,
            depth: model.depth,
            creatorId: model.creatorId,
            tokenCost: model.tokenCost,
            createdAt: model.createdAt,
          },
          version: {
            id: version.id,
            versionNumber: version.versionNumber,
            createdAt: version.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/models
   *
   * Restituisce la lista di tutti i modelli.
   *
   * Query params opzionali:
   *   modelType  → filtra per GRID_2D o GRID_3D
   *   creatorId  → filtra per creatore
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { modelType, creatorId } = req.query;

      const filters: { modelType?: ModelType; creatorId?: number } = {};
      if (modelType) {
        if (!Object.values(ModelType).includes(modelType as ModelType)) {
          throw new ValidationError(`modelType non valido: ${modelType}`);
        }
        //convertiamo modelType in ModelType cosi che TypeScript possa riconoscerlo
        //come enum e non come stringa generica
        filters.modelType = modelType as ModelType;
      }
      if (creatorId) filters.creatorId = Number(creatorId);

      const models = await gridModelService.getAllModels(filters);

      res.status(StatusCodes.OK).json({
        success: true,
        count: models.length,
        data: models.map(m => ({
          id: m.id,
          name: m.name,
          modelType: m.modelType,
          width: m.width,
          height: m.height,
          depth: m.depth,
          creator: m.creator,
          tokenCost: m.tokenCost,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/models/:id
   *
   * Restituisce il dettaglio di un modello, inclusa la versione corrente.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modelId = Number(req.params.id);
      if (isNaN(modelId)) throw new ValidationError('ID modello non valido');

      const model = await gridModelService.getModel(modelId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const gridModelController = new GridModelController();
