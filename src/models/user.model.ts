import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
} from 'sequelize-typescript';
import { GridModel } from './grid-model.model';

/**
 * Modello User – rappresenta un utente del sistema.
 *
 * Ogni utente ha un "portafoglio" di token (credito) che viene
 * scalato ad ogni operazione a pagamento:
 *   - Creazione modello:    0.025 × numero_celle
 *   - Proposta aggiornamento: 0.25 × celle_coinvolte
 *   - Esecuzione pathfinding: pari al costo di creazione del modello
 *
 * La password viene salvata come hash bcrypt (NON in chiaro).
 */

//paranoid:true fa si che l'utente venga eliminato logicamente (rimane nel db ma non viene mostrato)
//-> viene aggiunto un campo deletedAt. settandolo a falso viene eliminato e basta
@Table({
  tableName: 'users',
  timestamps: true,
  paranoid: false,
})
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(100),
    validate: {
      len: [2, 100],
    },
  })
  declare name: string;

  // isEmail viene usato per validare che l'email sia nel formato corretto 
  // (che ci sia la @ e il dominio)
  @Unique
  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    validate: {
      isEmail: true,
    },
  })
  declare email: string;

  /**
   * Password salvata come hash bcrypt.
   * L'hashing viene fatto nel service, non nel modello,
   * per mantenere la responsabilità nel layer corretto.
   */
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare password: string;

  @Default('user')
  @Column({
    type: DataType.ENUM('user', 'admin'),
  })
  declare role: 'user' | 'admin';

  /**
   * Credito in token dell'utente.
   * Viene inizializzato tramite seed al valore di INITIAL_USER_TOKENS.
   * Non può scendere sotto 0 (controlliamo nel service prima di scalare).
   */
  @AllowNull(false)
  @Default(100)
  @Column({
    type: DataType.FLOAT,
    validate: {
      min: 0,
    },
  })
  declare tokens: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // ─────────────────────────────────────────────
  // Associazioni
  // ─────────────────────────────────────────────

  /** Modelli di griglia creati da questo utente */
  @HasMany(() => GridModel, { foreignKey: 'creatorId', as: 'createdModels' })
  declare createdModels: GridModel[];

  // ─────────────────────────────────────────────
  // Metodi di istanza
  // ─────────────────────────────────────────────

  /**
   * Ritorna la rappresentazione pubblica dell'utente (senza password).
   * Usato nelle risposte API per non esporre dati sensibili.
   */
  toPublicJSON(): Omit<User, 'password'> {
    const { password, ...publicData } = this.toJSON() as User & { password: string };
    return publicData as Omit<User, 'password'>;
  }
}
