/**
 * Tipi e interfacce condivisi tra tutti i layer dell'applicazione.
 *
 * Questo file centralizza:
 * - Gli enum fondamentali del dominio (ModelType, UpdateRequestStatus)
 * - Le interfacce per le coordinate 2D e 3D
 * - Il payload JWT tipizzato
 * - I tipi di risposta API standardizzati
 */

// ---------------------------------------------
// Enum del dominio
// ---------------------------------------------

/**
 * Tipo di modello di griglia supportato.
 * GRID_2D -> griglia bidimensionale con coordinate {x, y}
 * GRID_3D -> voxel-grid tridimensionale con coordinate {x, y, z}
 */
export enum ModelType {
  GRID_2D = 'GRID_2D',
  GRID_3D = 'GRID_3D',
}

/**
 * Stato di una richiesta di aggiornamento (crowd-sourcing).
 * PENDING  -> in attesa di decisione del creatore
 * ACCEPTED -> approvata e applicata alla griglia
 * REJECTED -> rifiutata, griglia invariata
 */
export enum UpdateRequestStatus {
  PENDING  = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

// ---------------------------------------------
// Coordinate
// ---------------------------------------------

/** Coordinata per una griglia 2D */
export interface Coordinate2D {
  x: number;
  y: number;
}

/** Coordinata per una voxel-grid 3D */
export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
}

/** Tipo unione per entrambe le coordinate */
export type GridCoordinate = Coordinate2D | Coordinate3D;

// ---------------------------------------------
// JWT Payload
// ---------------------------------------------

/**
 * Payload contenuto nel token JWT.
 * Contiene solo i metadati essenziali dell'utente, come da specifiche.
 */
export interface JwtPayload {
  userId: number;
  email: string;
  role: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

// ---------------------------------------------
// Risposta API standardizzata
// ---------------------------------------------

/** Risposta di successo generica */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  count?: number;
}

/** Risposta di errore generica */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[];
  stack?: string;
}

// ---------------------------------------------
// Parametri di paginazione e ricerca
// ---------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------
// Filtri per le interrogazioni
// ---------------------------------------------

/**
 * Filtri per la lista delle richieste di aggiornamento.
 * Tutti i campi sono opzionali.
 */
export interface UpdateRequestFilters {
  status?: UpdateRequestStatus;
  modelType?: ModelType;
  startDate?: Date;
  endDate?: Date;
  layerZ?: number; // Solo per modelli 3D
}

// ---------------------------------------------
// Risultato del pathfinding
// ---------------------------------------------

/**
 * Risultato restituito dall'esecuzione di un modello.
 * Include tutte le informazioni richieste dalle specifiche.
 */
export interface PathfindingResult {
  path: GridCoordinate[];
  found: boolean;
  pathCost: number;
  nodesExplored: number;
  executionTimeMs: number;
  modelVersionId: number;
}

// ---------------------------------------------
// Tipi di utilita'
// ---------------------------------------------

export type NumericId = number;
export type Dictionary<T = unknown> = Record<string, T>;
