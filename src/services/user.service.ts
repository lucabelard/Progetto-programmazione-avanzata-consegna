import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/user.repository';
import { User } from '../models/user.model';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../middleware/error.middleware';

/**
 * DTO (Data Transfer Object) per la creazione di un utente.
 */
export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

/**
 * DTO per l'aggiornamento di un utente.
 */
export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: 'user' | 'admin';
  isActive?: boolean;
  tokens?: number;
}

/**
 * Service layer per la gestione degli utenti.
 *
 * Contiene tutta la business logic relativa agli utenti:
 * - Validazioni semantiche (es. email già in uso)
 * - Hashing della password
 * - Orchestrazione di più repository se necessario
 * - Trasformazione dei dati prima di restituirli al Controller
 *
 * Il Service NON deve:
 * - Accedere direttamente a req/res (quello è compito del Controller)
 * - Conoscere i dettagli dell'HTTP (status code, headers, ecc.)
 */
export class UserService {
  /**
   * Recupera tutti gli utenti.
   */
  async getAllUsers(): Promise<User[]> {
    return userRepository.findAll({
      attributes: { exclude: ['password'] },
    });
  }

  /**
   * Recupera un utente per ID.
   * Lancia NotFoundError se non esiste.
   */
  async getUserById(id: number): Promise<User> {
    const user = await userRepository.findById(id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new NotFoundError(`Utente con ID ${id}`);
    }

    return user;
  }

  /**
   * Crea un nuovo utente.
   * Valida che l'email non sia già in uso.
   */
  async createUser(dto: CreateUserDTO): Promise<User> {
    // Verifica unicità email
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError(`Email '${dto.email}' già in uso`);
    }

    // Hashing della password con bcrypt
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await userRepository.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: dto.role ?? 'user',
    });

    // Non restituire la password
    const { password, ...userPublic } = user.toJSON() as User & { password: string };
    //doppio casting per comunicare al compilatore TypeScript che stiamo rimuovendo
    //la password dal JSON ma di considerarlo comunque come user
    return userPublic as unknown as User;
  }

  /**
   * Aggiorna un utente esistente.
   */
  async updateUser(id: number, dto: UpdateUserDTO): Promise<User> {
    // Verifica che l'utente esista
    await this.getUserById(id);

    // Se si aggiorna l'email, verifica che non sia già in uso da altri
    if (dto.email) {
      const existing = await userRepository.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Email '${dto.email}' già in uso`);
      }
      dto.email = dto.email.toLowerCase();
    }

    const updated = await userRepository.updateById(id, dto as Partial<User['_attributes']>);

    if (!updated) {
      throw new NotFoundError(`Utente con ID ${id}`);
    }

    return updated.toPublicJSON() as unknown as User;
  }

  /**
   * Ricarica il credito token di un utente.
   */
  async rechargeTokens(id: number, amount: number): Promise<User> {
    if (amount <= 0) {
      throw new ValidationError("L'importo deve essere maggiore di 0");
    }
    const updated = await userRepository.incrementTokens(id, amount);
    return updated.toPublicJSON() as unknown as User;
  }

  /**
   * Elimina un utente per ID.
   */
  async deleteUser(id: number): Promise<void> {
    const deleted = await userRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError(`Utente con ID ${id}`);
    }
  }
}

// Esporta un'istanza singleton del service
export const userService = new UserService();
