import { gridModelRepository } from '../repositories/grid-model.repository';
import { modelVersionRepository } from '../repositories/model-version.repository';
import { userRepository } from '../repositories/user.repository';
import { sequelize } from '../config/database';
import { PathfindingResult, GridCoordinate } from '../types/common';
import { PathfindingStrategyFactory } from '../strategies/pathfinding.strategy';
import { ForbiddenError } from '../middleware/error.middleware';
import { AppError } from '../middleware/error.middleware';
import { StatusCodes } from 'http-status-codes';

/**
 * PathfindingService  orchestra l'esecuzione del pathfinding su un modello.
 *
 * Responsabilit:
 *   - Verifica che solo il creatore possa eseguire il modello
 *   - Seleziona la strategia corretta (2D o 3D) tramite la Factory
 *   - Usa l'ultima versione approvata del modello (come da specifiche)
 *   - Addebita il costo in token (uguale al costo di creazione)
 *   - Restituisce il risultato completo (path, costo, nodi, tempo, versione)
 */
export class PathfindingService {

  /**
   * Esegue il pathfinding su un modello di griglia.
   *
   * Costo: uguale al costo di creazione del modello (0.025  numero di celle).
   * Solo il creatore del modello pu eseguire il pathfinding.
   *
   * In caso di richieste pending sul modello, l'esecuzione avviene sempre
   * sulla versione approvata pi recente (non sulle versioni candidate).
   *
   * @param modelId   ID del modello su cui eseguire il pathfinding
   * @param userId    ID dell'utente che richiede l'esecuzione
   * @param start     Coordinata di partenza
   * @param goal      Coordinata di arrivo
   */
  async execute(
    modelId: number,
    userId: number,
    start: GridCoordinate,
    goal: GridCoordinate
  ): Promise<PathfindingResult> {

    //  1. Carica il modello 
    const model = await gridModelRepository.findByIdWithDetails(modelId);

    //  2. Solo il creatore pu eseguire il pathfinding 
    if (model.creatorId !== userId) {
      throw new ForbiddenError(
        'Solo il creatore del modello puo eseguire il pathfinding'
      );
    }

    //  3. Carica l'ultima versione approvata 
    // Le specifiche richiedono di usare la versione approvata pi recente,
    // non una versione candidata (pending).
    const latestVersion = await modelVersionRepository.findLatestByModel(modelId);

    //  4. Calcola il costo in token 
    const tokenCost = model.tokenCost;

    //  5. Verifica credito utente 
    const user = await userRepository.findByIdOrFail(userId);
    if (user.tokens < tokenCost) {
      throw new AppError(
        `Credito insufficiente. Costo esecuzione: ${tokenCost} token. Disponibili: ${user.tokens} token.`,
        StatusCodes.UNAUTHORIZED
      );
    }

    //  6. Seleziona la strategia corretta tramite la Factory 
    // Grid2DStrategy per GRID_2D, Grid3DStrategy per GRID_3D
    const strategy = PathfindingStrategyFactory.create(model.modelType);

    //  7. Esegui il pathfinding (con TIMEOUT tramite Promise.race) 
    // La griglia dell'esecuzione usa latestVersion.gridData (snapshot approvato)
    const executionModel = { ...model.toJSON(), gridData: latestVersion.gridData } as typeof model;

    // Creiamo una Promise per l'esecuzione del pathfinding
    const pathfindingPromise = Promise.resolve().then(() =>
      strategy.execute(executionModel as any, latestVersion, start, goal)
    );

    // Creiamo una Promise che rifiuta (lancia errore) dopo N millisecondi
    const timeoutMs = 10000; // 10 secondi
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError(`Timeout: Il calcolo ha impiegato più di ${timeoutMs}ms e il server l'ha interrotto`, StatusCodes.REQUEST_TIMEOUT));
      }, timeoutMs);
    });

    // Mettiamo in "gara" le due Promise. Se il pathfinding ci mette più di 10 secondi, scatta l'errore
    const result = await Promise.race([pathfindingPromise, timeoutPromise]);

    //  8. Scala i token solo se l'esecuzione  andata a buon fine 
    await sequelize.transaction(async (t) => {
      await userRepository.decrementTokens(userId, tokenCost, t);
    });

    return result;
  }
}

export const pathfindingService = new PathfindingService();
