import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { userService } from '../services/user.service';

/**
 * Controller layer per gli utenti.
 *
 * Responsabilità del Controller:
 * - Estrarre i dati dalla richiesta HTTP (req.body, req.params, req.query)
 * - Chiamare il Service con i dati estratti
 * - Formattare e inviare la risposta HTTP
 * - Gestire gli errori passandoli a next(error) per l'error handler globale
 *
 * Il Controller NON deve contenere business logic.
 * Ogni metodo segue il pattern: extract → delegate → respond
 */
export class UserController {

  /**
   * GET /users
   * Recupera la lista di tutti gli utenti.
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await userService.getAllUsers();
      res.status(StatusCodes.OK).json({
        success: true,
        data: users,
        count: users.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /users/:id
   * Recupera un singolo utente per ID.
   */

  //parseInt converte la stringa req.params.id in un numero intero (base 10)
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = await userService.getUserById(id);
      res.status(StatusCodes.OK).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /users
   * Crea un nuovo utente.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password, role } = req.body;
      const user = await userService.createUser({ name, email, password, role });
      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Utente creato con successo',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /users/:id
   * Aggiorna un utente esistente.
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, email, role, isActive, tokens } = req.body;
      const user = await userService.updateUser(id, { name, email, role, isActive, tokens });
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Utente aggiornato con successo',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /users/:id
   * Elimina un utente.
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await userService.deleteUser(id);
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Utente eliminato con successo',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /users/:id/recharge
   * Ricarica i token di un utente.
   */
  recharge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { amount } = req.body;
      const user = await userService.rechargeTokens(id, parseFloat(amount));
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Token ricaricati con successo',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };
}

// Esporta un'istanza singleton del controller
export const userController = new UserController();
