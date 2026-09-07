import { Transaction } from 'sequelize';
import { BaseRepository } from './base.repository';
import { User } from '../models/user.model';
import { NotFoundError } from '../middleware/error.middleware';

/**
 * UserRepository  accesso ai dati degli utenti.
 *
 * Estende BaseRepository con metodi specifici del dominio utente:
 * ricerca per email, gestione del credito token, ecc.
 *
 * Tutta la logica di query Sequelize  confinata qui:
 * i service usano questo repository senza conoscere i dettagli ORM.
 */
export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  /**
   * Cerca un utente tramite email (case-insensitive).
   * Usato nel login per verificare le credenziali.
   */
  async findByEmail(email: string): Promise<User | null> {
    return User.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Cerca un utente per ID, lanciando un errore se non trovato.
   * Versione "strict" di findById, utile nei service dove l'utente deve esistere.
   */
  async findByIdOrFail(id: number): Promise<User> {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`Utente con ID ${id}`);
    }
    return user;
  }

  /**
   * Scala il credito token dell'utente.
   *
   * Questa operazione  eseguita in transazione quando fa parte
   * di operazioni pi complesse (es. approvazione richiesta).
   *
   * @param userId   ID dell'utente
   * @param amount   Quantit da scalare (deve essere > 0)
   * @param t        Transazione Sequelize opzionale
   * @returns        Utente aggiornato
   */
  async decrementTokens(userId: number, amount: number, t?: Transaction): Promise<User> {
    const user = await User.findByPk(userId, { transaction: t, lock: true });
    if (!user) throw new NotFoundError(`Utente con ID ${userId}`);

    const newBalance = parseFloat((user.tokens - amount).toFixed(4));
    await user.update({ tokens: newBalance }, { transaction: t });
    return user;
  }

  /**
   * Aggiunge credito token all'utente (es. ricarica amministrativa).
   */
  async incrementTokens(userId: number, amount: number, t?: Transaction): Promise<User> {
    const user = await User.findByPk(userId, { transaction: t, lock: true });
    if (!user) throw new NotFoundError(`Utente con ID ${userId}`);

    const newBalance = parseFloat((user.tokens + amount).toFixed(4));
    await user.update({ tokens: newBalance }, { transaction: t });
    return user;
  }
}

/** Istanza singleton del repository */
export const userRepository = new UserRepository();
