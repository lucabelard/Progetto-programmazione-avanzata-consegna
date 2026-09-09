import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  CreatedAt,
  ForeignKey,
  BelongsTo,
  Default,
} from 'sequelize-typescript';
import { GridModel } from './grid-model.model';
import { User } from './user.model';

/**
 * Modello ModelVersion  storico delle versioni approvate di una griglia.
 *
 * Ogni volta che una richiesta di aggiornamento viene accettata,
 * viene creata una nuova versione del modello che conserva:
 *   - Uno snapshot completo della griglia (gridData) in quel momento
 *   - Il numero di versione progressivo
 *   - Chi ha proposto e chi ha approvato la modifica
 *
 * La versione pi recente rappresenta lo stato corrente del modello.
 * In caso di richieste pending, l'esecuzione usa sempre l'ultima versione approvata.
 */
@Table({
  tableName: 'model_versions',
  timestamps: true,
  updatedAt: false, // Le versioni sono immutabili
})
export class ModelVersion extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  /** Riferimento al modello a cui questa versione appartiene */
  @ForeignKey(() => GridModel)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare modelId: number;

  @BelongsTo(() => GridModel, { foreignKey: 'modelId', as: 'model', onDelete: 'CASCADE' })
  declare model: GridModel;

  /**
   * Numero di versione progressivo per il modello.
   * La versione 1  sempre quella di creazione iniziale.
   */
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare versionNumber: number;

  /**
   * Snapshot completo della griglia in questa versione.
   * Formato identico a GridModel.gridData.
   */
  @AllowNull(false)
  @Column(DataType.JSONB)
  declare gridData: number[][] | number[][][];

  /**
   * Chi ha proposto la modifica che ha generato questa versione.
   * Per la versione 1 (creazione), coincide con il creatore del modello.
   */
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare proposedBy: number;

  @BelongsTo(() => User, { foreignKey: 'proposedBy', as: 'proposer', onDelete: 'CASCADE' })
  declare proposer: User;

  /**
   * Chi ha approvato la modifica.
   * Per la versione 1 (creazione),  lo stesso del proposer.
   * Per le versioni successive,  sempre il creatore del modello.
   */
  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare approvedBy: number | null;

  @BelongsTo(() => User, { foreignKey: 'approvedBy', as: 'approver', onDelete: 'SET NULL' })
  declare approver: User | null;

  /** Data in cui questa versione  diventata effettiva */
  @CreatedAt
  declare createdAt: Date;
}
