/**
 * Strategy Pattern per il pathfinding
 *
 * Il pattern Strategy permette di selezionare l'algoritmo di pathfinding
 * a runtime in base al tipo di modello (GRID_2D o GRID_3D),
 * senza che il chiamante debba conoscere i dettagli implementativi.
 *
 * Struttura:
 *   PathfindingStrategy   → interfaccia comune (contratto)
 *   Grid2DStrategy        → implementazione per griglie 2D
 *   Grid3DStrategy        → implementazione per voxel-grid 3D
 *   PathfindingContext    → esegue la strategia selezionata
 *   PathfindingStrategyFactory → crea la strategia corretta da ModelType
 */

import { ModelType, GridCoordinate, Coordinate2D, Coordinate3D, PathfindingResult } from '../types/common';
import { GridModel } from '../models/grid-model.model';
import { ModelVersion } from '../models/model-version.model';
import { ValidationError } from '../middleware/error.middleware';
import {
  IPathfindingAdapter,
  AdapterGrid,
  createPathfindingAdapter,
} from '../adapters/pathfinding.adapter';

// ─────────────────────────────────────────────
// Interfaccia della strategia (contratto comune)
// ─────────────────────────────────────────────

/**
 * Ogni strategia sa come:
 *   1. Validare le coordinate (start/goal) per il proprio tipo di griglia
 *   2. Preparare la griglia nel formato atteso dall'adapter
 *   3. Convertire il risultato nel formato dell'applicazione
 */
export interface PathfindingStrategy {
  /**
   * Esegue il pathfinding sul modello dato.
   * @param model   Il modello di griglia (con gridData corrente)
   * @param version La versione usata per l'esecuzione
   * @param start   Coordinata di partenza
   * @param goal    Coordinata di arrivo
   */
  execute(
    model: GridModel,
    version: ModelVersion,
    start: GridCoordinate,
    goal: GridCoordinate
  ): PathfindingResult;
}

// ─────────────────────────────────────────────
// Strategia per GRID_2D
// ─────────────────────────────────────────────

/**
 * Strategia per griglie bidimensionali.
 *
 * Tratta la griglia come un piano 2D con coordinate {x, y}.
 * Internamente la rappresenta come una voxel-grid con depth=1 (z=0),
 * così da poter usare lo stesso adapter del caso 3D.
 */
export class Grid2DStrategy implements PathfindingStrategy {
  constructor(private readonly adapter: IPathfindingAdapter) { }

  execute(
    model: GridModel,
    version: ModelVersion,
    start: GridCoordinate,
    goal: GridCoordinate
  ): PathfindingResult {
    const startTime = Date.now();

    // Cast delle coordinate – per 2D ci aspettiamo solo {x, y}
    const start2D = start as Coordinate2D;
    const goal2D = goal as Coordinate2D;

    // Validazione: le coordinate devono essere dentro la griglia
    this.validateCoordinate(start2D, model, 'start');
    this.validateCoordinate(goal2D, model, 'goal');

    const gridData2D = version.gridData as number[][];

    // L'adapter lavora sempre in 3D: aggiungiamo un layer z=0
    const adapterGrid: AdapterGrid = {
      width: model.width,
      height: model.height,
      depth: 1,
      data: [gridData2D], // [z=0][y][x]
    };

    // Traduciamo le coordinate 2D in 3D (z=0) perchè l'algoritmo lavora in 3D
    const start3D: Coordinate3D = { x: start2D.x, y: start2D.y, z: 0 };
    const goal3D: Coordinate3D = { x: goal2D.x, y: goal2D.y, z: 0 };

    const result = this.adapter.findPath(adapterGrid, start3D, goal3D);
    const executionTimeMs = Date.now() - startTime;

    // Converte il path 3D in 2D (rimuove la z superflua)
    const path2D: Coordinate2D[] = result.path.map(({ x, y }) => ({ x, y }));

    // Il costo del percorso ottimo viene dall'algoritmo A* dell'adapter.
    // Per griglie a costo uniforme (0/1) equivale al numero di passi;
    // per griglie pesate corrisponderebbe alla somma dei pesi attraversati.
    const pathCost = result.cost;

    return {
      path: path2D,
      found: result.found,
      pathCost,
      nodesExplored: result.nodesExplored,
      executionTimeMs,
      modelVersionId: version.id,
    };
  }

  /**
   * Verifica che una coordinata 2D sia dentro i limiti della griglia
   * e che la cella corrispondente sia attraversabile (valore 0).
   */
  private validateCoordinate(coord: Coordinate2D, model: GridModel, name: string): void {
    if (coord.x < 0 || coord.x >= model.width || coord.y < 0 || coord.y >= model.height) {
      throw new ValidationError(
        `Coordinata ${name} {x:${coord.x}, y:${coord.y}} fuori dai limiti della griglia ` +
        `(width:${model.width}, height:${model.height})`
      );
    }
    const gridData = model.gridData as number[][];
    if (gridData[coord.y]?.[coord.x] === 1) {
      throw new ValidationError(
        `La cella ${name} {x:${coord.x}, y:${coord.y}} non è attraversabile (occupata)`
      );
    }
  }
}

// ─────────────────────────────────────────────
// Strategia per GRID_3D
// ─────────────────────────────────────────────

/**
 * Strategia per voxel-grid tridimensionali.
 *
 * Lavora con coordinate {x, y, z} e una griglia 3D [z][y][x].
 * Valida la profondità (z) in aggiunta a larghezza e altezza.
 */
export class Grid3DStrategy implements PathfindingStrategy {
  constructor(private readonly adapter: IPathfindingAdapter) { }

  execute(
    model: GridModel,
    version: ModelVersion,
    start: GridCoordinate,
    goal: GridCoordinate
  ): PathfindingResult {
    const startTime = Date.now();

    const start3D = start as Coordinate3D;
    const goal3D = goal as Coordinate3D;

    // Validazione coordinate 3D (include controllo su z e depth)
    this.validateCoordinate(start3D, model, 'start');
    this.validateCoordinate(goal3D, model, 'goal');

    const gridData3D = version.gridData as number[][][];
    const depth = model.depth ?? 1;

    const adapterGrid: AdapterGrid = {
      width: model.width,
      height: model.height,
      depth,
      data: gridData3D,
    };

    const result = this.adapter.findPath(adapterGrid, start3D, goal3D);
    const executionTimeMs = Date.now() - startTime;

    // Il costo ottimo viene direttamente dall'algoritmo A* dell'adapter.
    const pathCost = result.cost;

    return {
      path: result.path, // Lista di Coordinate3D
      found: result.found,
      pathCost,
      nodesExplored: result.nodesExplored,
      executionTimeMs,
      modelVersionId: version.id,
    };
  }

  /**
   * Valida una coordinata 3D: deve essere dentro i limiti su tutti e tre gli assi,
   * e la cella corrispondente deve essere attraversabile.
   *
   * La validazione dell'asse Z è particolarmente importante per i modelli 3D:
   * le specifiche richiedono esplicitamente di controllare depth e profondità.
   */
  private validateCoordinate(coord: Coordinate3D, model: GridModel, name: string): void {
    const depth = model.depth ?? 1;

    if (coord.x < 0 || coord.x >= model.width) {
      throw new ValidationError(`${name}.x=${coord.x} fuori dal range [0, ${model.width - 1}]`);
    }
    if (coord.y < 0 || coord.y >= model.height) {
      throw new ValidationError(`${name}.y=${coord.y} fuori dal range [0, ${model.height - 1}]`);
    }
    if (coord.z < 0 || coord.z >= depth) {
      throw new ValidationError(
        `${name}.z=${coord.z} fuori dal range [0, ${depth - 1}] (depth del modello: ${depth})`
      );
    }

    const gridData = model.gridData as number[][][];
    if (gridData[coord.z]?.[coord.y]?.[coord.x] === 1) {
      throw new ValidationError(
        `La cella ${name} {x:${coord.x}, y:${coord.y}, z:${coord.z}} non è attraversabile (occupata)`
      );
    }
  }
}

// ─────────────────────────────────────────────
// Context (esecutore della strategia)
// ─────────────────────────────────────────────

/**
 * PathfindingContext – applica la strategia selezionata.
 *
 * Segue il pattern Strategy: il contesto delega l'esecuzione
 * alla strategia concreta, senza conoscerne i dettagli.
 */
export class PathfindingContext {
  private strategy: PathfindingStrategy;

  constructor(strategy: PathfindingStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: PathfindingStrategy): void {
    this.strategy = strategy;
  }

  execute(
    model: GridModel,
    version: ModelVersion,
    start: GridCoordinate,
    goal: GridCoordinate
  ): PathfindingResult {
    return this.strategy.execute(model, version, start, goal);
  }
}

// ─────────────────────────────────────────────
// Factory – sceglie la strategia da ModelType
// ─────────────────────────────────────────────

/**
 * PathfindingStrategyFactory – crea la strategia corretta per il tipo di modello.
 *
 * L'adapter viene creato una volta sola e condiviso tra le strategie
 * (evita di creare istanze multiple della stessa libreria esterna).
 */
export class PathfindingStrategyFactory {
  private static sharedAdapter: IPathfindingAdapter = createPathfindingAdapter();

  static create(modelType: ModelType): PathfindingStrategy {
    switch (modelType) {
      case ModelType.GRID_2D:
        return new Grid2DStrategy(this.sharedAdapter);

      case ModelType.GRID_3D:
        return new Grid3DStrategy(this.sharedAdapter);

      default:
        throw new ValidationError(`Tipo di modello non supportato: ${modelType}`);
    }
  }
}
