import { Model, ModelStatic, FindOptions, CreateOptions, UpdateOptions, DestroyOptions } from 'sequelize';

/**
 * Repository Base Generico – Pattern Repository / DAO.
 *
 * Fornisce le operazioni CRUD standard per qualsiasi modello Sequelize.
 * I repository specifici estendono questa classe e aggiungono metodi
 * di query particolari per quel dominio.
 *
 * Vantaggi di questo pattern:
 * - Separa la logica di accesso ai dati dalla business logic (Service)
 * - Facilita il testing (il repository può essere mockato)
 * - Centralizza le query Sequelize
 * - Permette di cambiare ORM senza toccare il Service layer
 *
 * @template T - Il tipo del modello Sequelize
 */
export abstract class BaseRepository<T extends Model> {
  protected readonly model: ModelStatic<T>;

  constructor(model: ModelStatic<T>) {
    this.model = model;
  }

  /**
   * Recupera tutti i record con opzioni di query opzionali.
   */
  async findAll(options?: FindOptions): Promise<T[]> {
    //tutti metodi interni forniti da sequelize (anche in quelli sotto)
    return this.model.findAll(options);
  }

  /**
   * Recupera un record tramite la sua chiave primaria.
   * Ritorna null se non trovato.
   */
  async findById(id: number | string, options?: FindOptions): Promise<T | null> {
    return this.model.findByPk(id, options);
  }

  /**
   * Recupera il primo record che corrisponde alle condizioni.
   */
  async findOne(options: FindOptions): Promise<T | null> {
    return this.model.findOne(options);
  }

  /**
   * Crea un nuovo record nel database.
   * Partial è usato perché potremmo non passare tutte le colonne, ma solo quelle necessarie (es. nome, email, (data di creazione o id vengono aggiunti automaticamente dal DB)) 
   */
  async create(data: Partial<T['_creationAttributes']>, options?: CreateOptions): Promise<T> {
    return this.model.create(data as T['_creationAttributes'], options);
  }

  /**
   * Aggiorna i record che corrispondono alle condizioni.
   * Ritorna il numero di righe aggiornate.
   */
  async update(
    data: Partial<T['_attributes']>,
    options: UpdateOptions
  ): Promise<[number, T[]]> {
    return this.model.update(data, { ...options, returning: true }) as Promise<[number, T[]]>;
  }

  /**
   * Aggiorna un record tramite ID.
   * Ritorna il record aggiornato o null se non trovato.
   */
  async updateById(id: number | string, data: Partial<T['_attributes']>): Promise<T | null> {
    const record = await this.findById(id);
    if (!record) return null;
    return record.update(data);
  }

  /**
   * Elimina i record che corrispondono alle condizioni.
   * Ritorna il numero di righe eliminate.
   */
  async delete(options: DestroyOptions): Promise<number> {
    return this.model.destroy(options);
  }

  /**
   * Elimina un record tramite ID.
   * Ritorna true se eliminato, false se non trovato.
   */

  // never va messo perche typescript non può sapere
  // a priori se tutti i modelli avranno una colonna id
  async deleteById(id: number | string): Promise<boolean> {
    const deleted = await this.model.destroy({ where: { id } as never });
    return deleted > 0;
  }

  /**
   * Conta i record che corrispondono alle condizioni.
   */
  async count(options?: FindOptions): Promise<number> {
    return this.model.count(options);
  }

  /**
   * Verifica se esiste almeno un record con le condizioni date.
   */
  async exists(options: FindOptions): Promise<boolean> {
    const count = await this.count(options);
    return count > 0;
  }

  /**
   * Trova o crea un record (upsert).
   * Ritorna [record, created] dove created indica se è stato creato o trovato.
   */
  async findOrCreate(
    options: FindOptions & { defaults?: Partial<T['_creationAttributes']> }
  ): Promise<[T, boolean]> {
    return this.model.findOrCreate(options as never);
  }
}
