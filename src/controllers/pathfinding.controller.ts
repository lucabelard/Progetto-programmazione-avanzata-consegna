import { Request, Response, NextFunction } from 'express';
import { pathfindingService } from '../services/pathfinding.service';
import { ModelType, GridCoordinate, Coordinate2D, Coordinate3D } from '../types/common';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../middleware/error.middleware';
import { gridModelService } from '../services/grid-model.service';

/**
 * PathfindingController – gestisce l'esecuzione del pathfinding.
 *
 * Endpoint:
 *   POST /api/v1/models/:id/execute → esegui pathfinding con start e goal
 */
export class PathfindingController {

  /**
   * POST /api/v1/models/:id/execute
   *
   * Esegue il pathfinding sul modello specificato.
   *
   * Body per GRID_2D:
   *   { start: { x, y }, goal: { x, y } }
   *
   * Body per GRID_3D:
   *   { start: { x, y, z }, goal: { x, y, z } }
   *
   * Risposta JSON:
   *   path, found, pathCost, nodesExplored, executionTimeMs, modelVersionId
   *
   * Costo: uguale al costo di creazione del modello (0.025 × celle)
   */
  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modelId = Number(req.params.id);
      const userId = req.user!.userId;
      const { start, goal } = req.body;

      if (!start || !goal) {
        throw new ValidationError('start e goal sono obbligatori nel body della richiesta');
      }

      // Recupera il tipo di modello per validare le coordinate
      const model = await gridModelService.getModel(modelId);

      // Valida il formato delle coordinate in base al tipo di modello
      const parsedStart = this.parseCoordinate(start, model.modelType, 'start');
      const parsedGoal = this.parseCoordinate(goal, model.modelType, 'goal');

      const result = await pathfindingService.execute(
        modelId,
        userId,
        parsedStart,
        parsedGoal
      );

      res.status(StatusCodes.OK).json({
        success: true,
        message: result.found
          ? `Percorso trovato in ${result.executionTimeMs}ms`
          : 'Nessun percorso disponibile tra start e goal',
        data: {
          found: result.found,
          path: result.path,
          pathCost: result.pathCost,
          nodesExplored: result.nodesExplored,
          executionTimeMs: result.executionTimeMs,
          modelVersionId: result.modelVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Valida e parsa una coordinata dal body JSON.
   *
   * Per GRID_2D: richiede { x, y }
   * Per GRID_3D: richiede { x, y, z }
   */
  private parseCoordinate(
    raw: Record<string, unknown>,
    modelType: ModelType,
    name: string
  ): GridCoordinate {
    if (typeof raw.x !== 'number' || typeof raw.y !== 'number') {
      throw new ValidationError(`${name} deve avere coordinate numeriche x e y`);
    }

    if (modelType === ModelType.GRID_3D) {
      if (typeof raw.z !== 'number') {
        throw new ValidationError(`${name}.z è obbligatoria per i modelli GRID_3D`);
      }
      return { x: raw.x, y: raw.y, z: raw.z } as Coordinate3D;
    }

    return { x: raw.x, y: raw.y } as Coordinate2D;
  }
}

export const pathfindingController = new PathfindingController();
