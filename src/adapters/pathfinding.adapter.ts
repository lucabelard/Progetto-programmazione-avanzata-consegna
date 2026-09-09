/**
 * Adapter Pattern per la libreria PathFinding3D.js
 *
 * PathFinding3D.js è una libreria JavaScript senza tipizzazioni TypeScript complete.
 * Questo modulo definisce l'interfaccia pulita che il resto dell'app usa,
 * e implementa l'adapter che traduce le chiamate verso la libreria esterna.
 *
 * Vantaggi dell'approccio Adapter:
 *   - Il resto dell'app non dipende direttamente da PathFinding3D.js
 *   - Se volessimo cambiare libreria, modificheremmo solo questo file
 *   - Il codice rimane completamente tipizzato in TypeScript
 */

import { Coordinate2D, Coordinate3D } from '../types/common';

// ─────────────────────────────────────────────
// Interfacce dell'adapter
// ─────────────────────────────────────────────

/** Rappresentazione interna della griglia pronta per il pathfinder */
export interface AdapterGrid {
  width: number;
  height: number;
  depth: number;      // Sempre 1 per le griglie 2D
  data: number[][][]; // [z][y][x] = 0 (libero) | 1 (occupato)
}

/** Risultato restituito dall'algoritmo di pathfinding */
export interface PathfindingAdapterResult {
  found: boolean;
  path: Coordinate3D[]; // Per 2D, z e sempre 0
  nodesExplored: number;
  cost: number; // Costo ottimo del percorso calcolato dall'algoritmo A*
}

/**
 * Interfaccia che il resto dell'applicazione usa per il pathfinding.
 * Qualunque implementazione concreta (PathFinding3D.js, A*, Dijkstra...)
 * deve rispettare questo contratto.
 */
export interface IPathfindingAdapter {
  findPath(
    grid: AdapterGrid,
    start: Coordinate3D,
    goal: Coordinate3D
  ): Promise<PathfindingAdapterResult>;
}

// ─────────────────────────────────────────────
// Implementazione dell'Adapter per PathFinding3D.js
// ─────────────────────────────────────────────

/**
 * Adapter concreto che incapsula PathFinding3D.js.
 *
 * PathFinding3D.js usa un sistema di coordinate [x, y, z] con z che indica
 * il layer nella voxel-grid. Questo adapter normalizza l'interfaccia
 * e gestisce le differenze tra la libreria e il nostro dominio.
 *
 * Nota: la libreria viene caricata con require() dinamico per evitare
 * errori di import nei moduli ES. Se non è installata, l'adapter
 * lancia un errore chiaro con istruzioni per installarla.
 */
export class PathFinding3DAdapter implements IPathfindingAdapter {

  /**
   * Esegue il pathfinding usando A* (algoritmo predefinito di PathFinding3D.js).
   *
   * @param grid   La griglia normalizzata [z][y][x]
   * @param start  Coordinata di partenza
   * @param goal   Coordinata di arrivo
   * @returns      Percorso trovato (o found=false se non esiste)
   */
  async findPath(
    grid: AdapterGrid,
    start: Coordinate3D,
    goal: Coordinate3D
  ): Promise<PathfindingAdapterResult> {

    // Importazione dinamica della libreria (la importa al volo quando si chiama questa funzione)
    let PF: any;
    try {
      PF = require('pathfinding3d');
    } catch {
      throw new Error(
        'Libreria PathFinding3D.js non trovata. ' +
        'Esegui: npm install pathfinding3d'
      );
    }

    // Costruisce la griglia PathFinding3D dal nostro formato [z][y][x]
    // PathFinding3D accetta width, height, depth e un array flat di walkability
    const pfGrid = new PF.Grid(grid.width, grid.height, grid.depth);

    // Imposta i nodi non attraversabili (occupati = 1)
    for (let z = 0; z < grid.depth; z++) {
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (grid.data[z]?.[y]?.[x] === 1) {
            pfGrid.setWalkableAt(x, y, z, false);
          }
        }
      }
    }

    // Crea il finder A* con heuristica 3D
    const finder = new PF.AStarFinder({
      allowDiagonal: false,    // Solo movimenti ortogonali
      dontCrossCorners: true,
    });

    // Esegue il pathfinding: PathFinding3D.js ritorna un array di [x, y, z]
    let rawPath: [number, number, number][] = [];
    try {
      rawPath = finder.findPath(
        start.x, start.y, start.z,
        goal.x, goal.y, goal.z,
        pfGrid
      );

    } catch (err) {
      // Nessun percorso trovato o errore interno della libreria
      return { found: false, path: [], nodesExplored: 0, cost: 0 };
    }

    // Conteggio reale dei nodi esplorati: dopo l'esecuzione di A*,
    // PathFinding3D.js marca i nodi della griglia come 'opened' o 'closed'.
    // Iteriamo sulla griglia per contare quanti nodi sono stati effettivamente visitati.
    let nodesExplored = 0;
    try {
      for (let z = 0; z < grid.depth; z++) {
        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            const node = pfGrid.getNodeAt(x, y, z);
            if (node && (node.closed || node.opened)) {
              nodesExplored++;
            }
          }
        }
      }
    } catch {
      // Fallback: se l'API della griglia non espone lo stato dei nodi,
      // usiamo il numero di passi del percorso come stima conservativa.
      nodesExplored = rawPath.length > 0 ? rawPath.length : 0;
    }

    if (!rawPath || rawPath.length === 0) {
      return { found: false, path: [], nodesExplored, cost: 0 };
    }

    // Converte l'array [x, y, z][] nel nostro tipo Coordinate3D[]
    const path: Coordinate3D[] = rawPath.map(([x, y, z]) => ({ x, y, z }));

    // Costo ottimo: per griglie a costo uniforme (0/1) equivale al numero di passi.
    // Per griglie pesate, sarebbe la somma dei pesi delle celle attraversate.
    const cost = path.length - 1;

    return { found: true, path, nodesExplored, cost };
  }
}

/**
 * Adapter di fallback con implementazione A* manuale.
 *
 * Usato nei test o quando PathFinding3D.js non è disponibile.
 * Implementa A* con euristica di Manhattan in 3D.
 */
export class FallbackPathfindingAdapter implements IPathfindingAdapter {

  async findPath(
    grid: AdapterGrid,
    start: Coordinate3D,
    goal: Coordinate3D
  ): Promise<PathfindingAdapterResult> {

    // Struttura di un nodo nell'algoritmo A*
    interface AStarNode {
      x: number; y: number; z: number;
      g: number; // costo dal nodo di partenza
      h: number; // euristica verso il goal
      f: number; // g + h
      parent: AStarNode | null;
    }

    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const isWalkable = (x: number, y: number, z: number): boolean => {
      if (x < 0 || y < 0 || z < 0) return false;
      if (x >= grid.width || y >= grid.height || z >= grid.depth) return false;
      return (grid.data[z]?.[y]?.[x] ?? 1) === 0;
    };

    const heuristic = (a: Coordinate3D, b: Coordinate3D): number =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

    // Direzioni di movimento (6 direzioni ortogonali in 3D)
    const directions = [
      { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 },
    ];

    //openSet: contiene i nodi da esplorare 
    const openSet = new Map<string, AStarNode>();
    //closedSet: contiene i nodi già esplorati
    const closedSet = new Set<string>();
    let nodesExplored = 0;

    const startNode: AStarNode = {
      ...start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null,
    };
    openSet.set(key(start.x, start.y, start.z), startNode);

    let iterations = 0;
    while (openSet.size > 0) {
      // Cessione del controllo all'Event Loop (Yielding) ogni 1000 iterazioni
      // Questo previene l'Event Loop Starvation durante calcoli CPU intensivi
      if (++iterations % 1000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }

      // Prendi il nodo con f più basso
      let current: AStarNode | null = null;
      for (const node of openSet.values()) {
        if (!current || node.f < current.f) current = node;
      }
      if (!current) break;

      openSet.delete(key(current.x, current.y, current.z));
      closedSet.add(key(current.x, current.y, current.z));
      nodesExplored++;

      // Abbiamo raggiunto il goal?
      if (current.x === goal.x && current.y === goal.y && current.z === goal.z) {
        // Ricostruisce il percorso a ritroso
        const path: Coordinate3D[] = [];
        let node: AStarNode | null = current;
        while (node) {
          //aggiunge l'elemento all'inizio della lista in modo che il percorso sia al contrario
          path.unshift({ x: node.x, y: node.y, z: node.z });
          node = node.parent;
        }
        // current.g e il costo ottimo calcolato dall'algoritmo A*
        return { found: true, path, nodesExplored, cost: current.g };
      }

      // Esplora i vicini
      for (const { dx, dy, dz } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;
        const nKey = key(nx, ny, nz);

        if (closedSet.has(nKey) || !isWalkable(nx, ny, nz)) continue;

        const gScore = current.g + 1;
        const existing = openSet.get(nKey);

        if (!existing || gScore < existing.g) {
          const h = heuristic({ x: nx, y: ny, z: nz }, goal);
          openSet.set(nKey, { x: nx, y: ny, z: nz, g: gScore, h, f: gScore + h, parent: current });
        }
      }
    }

    return { found: false, path: [], nodesExplored, cost: 0 };
  }
}

/**
 * Factory che ritorna l'adapter appropriato.
 *
 * Prova prima PathFinding3D.js; se non è installato, usa il fallback A*.
 */
export function createPathfindingAdapter(): IPathfindingAdapter {
  try {
    require('pathfinding3d');
    return new PathFinding3DAdapter();
  } catch {
    return new FallbackPathfindingAdapter();
  }
}
