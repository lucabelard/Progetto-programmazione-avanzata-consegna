import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { User } from '../models/user.model';
import { JwtPayload } from '../types/common';
import { ConflictError, UnauthorizedError, ValidationError } from '../middleware/error.middleware';

/** Numero di round per bcrypt (12 è un buon compromesso tra sicurezza e performance) */
const BCRYPT_ROUNDS = 12;

/**
 * AuthService – gestisce la registrazione, il login e la generazione dei token JWT.
 *
 * Responsabilità di questo service:
 *   - Hashing delle password con bcrypt
 *   - Verifica delle credenziali al login
 *   - Generazione di JWT firmati con RS256 (chiave privata RSA)
 *
 * Le chiavi RSA vengono lette dal file .env e permettono di:
 *   - Firmare i token lato server (chiave privata)
 *   - Verificarli su qualunque servizio con la sola chiave pubblica
 *   - Revocare i token cambiando la coppia di chiavi
 */
export class AuthService {

  /**
   * Registra un nuovo utente nel sistema.
   *
   * Verifica che l'email non sia già in uso, poi crea l'utente con:
   *   - Password hashata con bcrypt
   *   - Credito iniziale di token (da .env → INITIAL_USER_TOKENS)
   *
   * @returns L'utente creato (senza password) e il suo JWT
   */

  //toPublicJSON() serve a rendere l'utente "pubblico", cioé senza la password o dati sensibili visibili
  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: ReturnType<User['toPublicJSON']>; token: string }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    // Verifica unicità dell'email
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(`L'email ${normalizedEmail} è già registrata`);
    }

    // Validazione password (minimo 8 caratteri)
    if (data.password.length < 8) {
      throw new ValidationError('La password deve contenere almeno 8 caratteri');
    }

    // Hash della password – MAI salvare la password in chiaro
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await userRepository.create({
      name: data.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      tokens: env.INITIAL_USER_TOKENS,
      isActive: true,
    });

    const token = this.generateToken(user);

    return { user: user.toPublicJSON(), token };
  }

  /**
   * Autentica un utente esistente.
   *
   * Verifica email e password, poi restituisce il JWT.
   * Il messaggio di errore è volutamente generico per non rivelare
   * se l'email esiste o meno nel sistema (sicurezza).
   *
   * @returns Il JWT se le credenziali sono valide
   */
  async login(email: string, password: string): Promise<{ user: ReturnType<User['toPublicJSON']>; token: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Cerca l'utente (messaggio generico se non trovato)
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('Credenziali non valide');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account disabilitato. Contatta l\'amministratore.');
    }

    // Verifica la password con bcrypt (confronto sicuro contro timing attacks)
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedError('Credenziali non valide');
    }

    const token = this.generateToken(user);

    return { user: user.toPublicJSON(), token };
  }

  /**
   * Genera un JWT firmato con RS256.
   *
   * Il payload contiene solo i metadati essenziali dell'utente,
   * come richiesto dalle specifiche: userId, email, role.
   *
   * RS256 = RSA Signature with SHA-256
   * Il token è firmato con la chiave privata e verificabile con la pubblica.
   */
  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // In ambiente di test usiamo HS256 per semplicità (niente chiavi RSA)
    if (env.NODE_ENV === 'test') {
      return jwt.sign(payload, 'test-secret-key', { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    }

    return jwt.sign(payload, env.JWT_PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Verifica e decodifica un JWT.
   * Usato dal middleware di autenticazione.
   *
   * @throws UnauthorizedError se il token è scaduto, malformato o invalido
   */
  verifyToken(token: string): JwtPayload {
    try {
      if (env.NODE_ENV === 'test') {
        return jwt.verify(token, 'test-secret-key') as JwtPayload;
      }

      return jwt.verify(token, env.JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
      }) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token scaduto. Effettua nuovamente il login.');
      }
      throw new UnauthorizedError('Token non valido o malformato.');
    }
  }
}

export const authService = new AuthService();
