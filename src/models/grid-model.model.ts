import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { ModelType } from '../types/common';
import { User } from './user.model';
import { ModelVersion } from './model-version.model';
import { UpdateRequest } from './update-request.model';

/**
 * Modello GridModel – rappresenta una griglia di pathfinding.
 *
 * Supporta due tipologie:
 *   GRID_2D → griglia width × height con coordinate {x, y}
 *   GRID_3D → voxel-grid width × height × depth con coordinate {x, y, z}
 *
 * La griglia è serializzata in JSON come array multidimensionale di 0/1:
 *   - 0 = cella libera (attraversabile)
 *   - 1 = cella occupata (ostacolo)
 *
 * Ogni modifica accettata genera una nuova ModelVersion, che conserva
 * uno snapshot completo della griglia in quel momento.
 */

//@table definisce la tabella postgresql e le sue proprietà globali come:
//tableName: il nome della tabella
//timestamps: se true, aggiunge le colonne createdAt e updatedAt
//model: il modello da utilizzare
//@column definisce una colonna della tabella
@Table({
  tableName: 'grid_models',
  timestamps: true,
})
export class GridModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(200),
    validate: {
      len: [2, 200],
    },
  })
  declare name: string;

  /**
   * Tipologia del modello: GRID_2D o GRID_3D.
   * Determina come vengono interpretate le coordinate e la struttura gridData.
   */
  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(ModelType)),
  })
  declare modelType: ModelType;

  /** Larghezza della griglia (asse X) */
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    validate: { min: 1 },
  })
  declare width: number;

  /** Altezza della griglia (asse Y) */
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    validate: { min: 1 },
  })
  declare height: number;

  /**
   * Profondità della griglia (asse Z).
   * Obbligatoria per GRID_3D, null per GRID_2D.
   */
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    validate: { min: 1 },
  })
  declare depth: number | null;

  /**
   * Rappresentazione serializzata della griglia corrente (versione approvata più recente).
   *
   * Per GRID_2D → array 2D: number[][] (height righe, width colonne)
   *   gridData[y][x] = 0 | 1
   *
   * Per GRID_3D → array 3D: number[][][] (depth layer, height righe, width colonne)
   *   gridData[z][y][x] = 0 | 1
   */

  //JSONB qui permette di memorizzare un array bidimensionale o tridimensionale in formato binario
  @AllowNull(false)
  @Column(DataType.JSONB)
  declare gridData: number[][] | number[][][];

  /** Riferimento al creatore del modello */
  // FOREIGN KEY per collegare questo modello all'utente che l'ha creato
  // => risolve la dipendenza circolare tra User e GridModel
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare creatorId: number;

  /** Associazione con l'utente creatore */
  /** Relazione One-to-Many: un utente può creare molti modelli */
  @BelongsTo(() => User, { foreignKey: 'creatorId', as: 'creator', onDelete: 'CASCADE' })
  declare creator: User;

  /** Relazione One-to-Many con ModelVersion (un modello può avere molte versioni) */
  @HasMany(() => ModelVersion, { foreignKey: 'modelId', as: 'versions' })
  declare versions: ModelVersion[];

  /** Relazione One-to-Many con UpdateRequest (un modello può avere molte richieste di aggiornamento) */
  @HasMany(() => UpdateRequest, { foreignKey: 'modelId', as: 'updateRequests' })
  declare updateRequests: UpdateRequest[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // ─────────────────────────────────────────────
  // Metodi di istanza
  // ─────────────────────────────────────────────

  /**
   * Calcola il numero totale di celle della griglia.
   * Usato per calcolare il costo in token di creazione ed esecuzione.
   */
  get cellCount(): number {
    if (this.modelType === ModelType.GRID_3D && this.depth !== null) {
      return this.width * this.height * this.depth;
    }
    return this.width * this.height;
  }

  /**
   * Calcola il costo in token per la creazione/esecuzione di questo modello.
   * Formula: 0.025 × numero_di_celle
   */
  get tokenCost(): number {
    return parseFloat((0.025 * this.cellCount).toFixed(4));
  }
}
