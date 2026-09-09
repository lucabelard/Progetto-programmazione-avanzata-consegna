import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { UpdateRequestStatus } from '../types/common';
import { GridModel } from './grid-model.model';
import { ModelVersion } from './model-version.model';
import { User } from './user.model';

/**
 * CellChange  descrive la modifica di una singola cella della griglia.
 * Salvata all'interno del campo `cells` (array JSON) della richiesta.
 */
export interface CellChange {
  x: number;
  y: number;
  z?: number;        // Solo per GRID_3D
  newValue: 0 | 1;  // 0 = libero, 1 = occupato
}

/**
 * Modello UpdateRequest  rappresenta una proposta di modifica delle celle.
 *
 * Ciclo di vita (State Pattern):
 *   PENDING   proposta in attesa di decisione del creatore del modello
 *   ACCEPTED  approvata: la griglia  stata aggiornata e una nuova versione  stata creata
 *   REJECTED  rifiutata: la griglia  rimasta invariata
 *
 * Costo: 0.25 token per ogni cella coinvolta, addebitato al momento della proposta.
 *
 * Solo il creatore del modello pu approvare o rifiutare le richieste.
 * Il creatore stesso, se propone una modifica, ottiene direttamente ACCEPTED.
 */
@Table({
  tableName: 'update_requests',
  timestamps: true,
  updatedAt: false,
})
export class UpdateRequest extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  /** Modello di griglia a cui si riferisce questa richiesta */
  @ForeignKey(() => GridModel)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare modelId: number;

  @BelongsTo(() => GridModel, { foreignKey: 'modelId', as: 'model', onDelete: 'CASCADE' })
  declare model: GridModel;

  /**
   * Versione del modello su cui si basa questa richiesta.
   * Permette di rilevare conflitti nel caso di richieste concorrenti.
   */
  @ForeignKey(() => ModelVersion)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare baseVersionId: number;

  @BelongsTo(() => ModelVersion, { foreignKey: 'baseVersionId', as: 'baseVersion', onDelete: 'CASCADE' })
  declare baseVersion: ModelVersion;

  /**
   * Se la richiesta viene accettata, qui viene memorizzata la versione creata.
   * Null finch la richiesta  PENDING o se viene REJECTED.
   */
  @ForeignKey(() => ModelVersion)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare resultVersionId: number | null;

  /** Chi ha proposto questa modifica */
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare proposerId: number;

  @BelongsTo(() => User, { foreignKey: 'proposerId', as: 'proposer', onDelete: 'CASCADE' })
  declare proposer: User;

  /** Chi ha preso la decisione (null finch la richiesta  PENDING) */
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare approverId: number | null;

  @BelongsTo(() => User, { foreignKey: 'approverId', as: 'approver', onDelete: 'SET NULL' })
  declare approver: User | null;

  /**
   * Lista delle modifiche proposte alle celle.
   * Ogni elemento descrive una cella e il suo nuovo valore (0/1).
   */
  @AllowNull(false)
  @Column(DataType.JSONB)
  declare cells: CellChange[];

  /**
   * Stato corrente della richiesta.
   * Segue il pattern PENDING  ACCEPTED | REJECTED.
   */
  @AllowNull(false)
  @Default(UpdateRequestStatus.PENDING)
  @Column({
    type: DataType.ENUM(...Object.values(UpdateRequestStatus)),
  })
  declare status: UpdateRequestStatus;

  /**
   * Motivazione testuale del rifiuto (opzionale).
   * Valorizzato solo quando status = REJECTED.
   */
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare reason: string | null;

  /** Data in cui la richiesta  stata creata */
  @CreatedAt
  declare requestedAt: Date;

  /** Data in cui  stata presa la decisione (null se ancora PENDING) */
  @AllowNull(true)
  @Column(DataType.DATE)
  declare decidedAt: Date | null;
}
