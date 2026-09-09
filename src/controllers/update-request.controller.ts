import { Request, Response, NextFunction } from 'express';
import { updateRequestService } from '../services/update-request.service';
import { exportService } from '../services/export.service';
import { UpdateRequestStatus, UpdateRequestFilters } from '../types/common';
import { StatusCodes } from 'http-status-codes';
import { ValidationError } from '../middleware/error.middleware';

/**
 * UpdateRequestController – gestisce le route per le richieste di aggiornamento.
 *
 * Endpoints:
 *   POST  /api/v1/models/:id/updates                → proponi aggiornamento
 *   GET   /api/v1/models/:id/updates                → lista aggiornamenti (con filtri)
 *   POST  /api/v1/models/:id/updates/:reqId/decide  → approva o rifiuta
 *   POST  /api/v1/models/:id/updates/bulk-decide    → approvazione/rifiuto bulk
 */
export class UpdateRequestController {

  /**
   * POST /api/v1/models/:id/updates
   *
   * Propone una modifica alle celle del modello.
   *
   * Body:
   *   { cells: [{ x, y, newValue }, ...] }              ← per GRID_2D
   *   { cells: [{ x, y, z, newValue }, ...] }           ← per GRID_3D
   *
   * Costo: 0.25 token × numero di celle
   */
  async propose(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modelId = Number(req.params.id);
      const proposerId = req.user!.userId;
      const { cells } = req.body;

      if (!cells || !Array.isArray(cells) || cells.length === 0) {
        throw new ValidationError('cells deve essere un array non vuoto di modifiche alle celle');
      }

      const request = await updateRequestService.proposeUpdate(modelId, cells, proposerId);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: request.status === UpdateRequestStatus.ACCEPTED
          ? 'Aggiornamento applicato direttamente (sei il creatore del modello)'
          : 'Richiesta di aggiornamento registrata come PENDING, in attesa di approvazione',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/models/:id/updates
   *
   * Restituisce la lista delle richieste di aggiornamento.
   *
   * Query params opzionali:
   *   status     → PENDING | ACCEPTED | REJECTED
   *   startDate  → data di inizio (ISO 8601)
   *   endDate    → data di fine (ISO 8601)
   *   layerZ     → filtra per layer z (solo modelli 3D)
   *   modelType  → filtra per tipo di modello (GRID_2D o GRID_3D)
   *   format     → 'json' (default) | 'pdf'
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modelId = Number(req.params.id);
      const { status, startDate, endDate, layerZ, format, modelType } = req.query;

      const filters: UpdateRequestFilters = {};

      if (status) {
        if (!Object.values(UpdateRequestStatus).includes(status as UpdateRequestStatus)) {
          throw new ValidationError(`status non valido: ${status}. Valori accettati: PENDING, ACCEPTED, REJECTED`);
        }
        filters.status = status as UpdateRequestStatus;
      }
      //trasforma le date in oggetti Date in modo che il service
      //possa usarle per filtrare le richieste (i parametri di query viaggiano come testo grezzo)
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      // non if (layerZ) perchè 0 è falsy quindi con z=0 l'if sarebbe risultato falso
      if (layerZ !== undefined) filters.layerZ = Number(layerZ);
      
      if (modelType) filters.modelType = modelType as any;

      const requests = await updateRequestService.getRequestsByModel(modelId, filters);

      // Formato di risposta: JSON (default) o PDF
      if (format === 'pdf') {
        const pdfData = requests.map(r => ({
          id: r.id,
          stato: r.status,
          proponente: r.proposer?.email ?? r.proposerId,
          celle: JSON.stringify(r.cells),
          dataRichiesta: r.requestedAt,
          dataDecisione: r.decidedAt,
          motivazione: r.reason ?? '—',
        }));

        const pdfBuffer = await exportService.toPDF(
          `Richieste di aggiornamento – Modello #${modelId}`,
          pdfData
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="updates-model-${modelId}.pdf"`);
        res.status(StatusCodes.OK).send(pdfBuffer);
        return;
      }

      // Risposta JSON (default)
      res.status(StatusCodes.OK).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/updates
   *
   * Restituisce la lista GLOBALE delle richieste di aggiornamento (su tutti i modelli).
   * Supporta gli stessi filtri di list(), con l'aggiunta di modelId opzionale.
   */
  async listGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, startDate, endDate, layerZ, format, modelType, modelId } = req.query;

      const filters: UpdateRequestFilters = {};

      if (status) {
        if (!Object.values(UpdateRequestStatus).includes(status as UpdateRequestStatus)) {
          throw new ValidationError(`status non valido: ${status}. Valori accettati: PENDING, ACCEPTED, REJECTED`);
        }
        filters.status = status as UpdateRequestStatus;
      }
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (layerZ !== undefined) filters.layerZ = Number(layerZ);
      if (modelType) filters.modelType = modelType as any;

      let requests: any[];
      if (modelId) {
        requests = await updateRequestService.getRequestsByModel(Number(modelId), filters);
      } else {
        requests = await updateRequestService.getAllRequests(filters);
      }

      // Formato di risposta: JSON (default) o PDF
      if (format === 'pdf') {
        const pdfData = requests.map(r => ({
          id: r.id,
          modello: r.model?.name ?? r.modelId,
          stato: r.status,
          proponente: r.proposer?.email ?? r.proposerId,
          celle: JSON.stringify(r.cells),
          dataRichiesta: r.requestedAt,
          dataDecisione: r.decidedAt,
          motivazione: r.reason ?? '—',
        }));

        const pdfBuffer = await exportService.toPDF(
          modelId ? `Richieste di aggiornamento – Modello #${modelId}` : `Richieste di aggiornamento globali`,
          pdfData
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="updates${modelId ? `-model-${modelId}` : '-global'}.pdf"`);
        res.status(StatusCodes.OK).send(pdfBuffer);
        return;
      }

      res.status(StatusCodes.OK).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/models/:id/updates/:reqId/decide
   *
   * Il creatore del modello approva o rifiuta una richiesta PENDING.
   *
   * Body: { action: 'approve' | 'reject', reason?: string }
   */
  async decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = Number(req.params.reqId);
      const approverId = req.user!.userId;
      const { action, reason } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        throw new ValidationError('action deve essere "approve" o "reject"');
      }

      const result = await updateRequestService.decideRequest(
        requestId,
        approverId,
        action,
        reason
      );

      res.status(StatusCodes.OK).json({
        success: true,
        message: action === 'approve'
          ? 'Richiesta approvata e griglia aggiornata con una nuova versione'
          : 'Richiesta rifiutata. La griglia rimane invariata.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/models/:id/updates/bulk-decide
   *
   * Approva o rifiuta più richieste PENDING in una sola chiamata.
   *
   * Body: {
   *   items: [
   *     { requestId: 1, action: 'approve' },
   *     { requestId: 2, action: 'reject', reason: 'Motivo...' },
   *     ...
   *   ]
   * }
   */
  async bulkDecide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approverId = req.user!.userId;
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError('items deve essere un array non vuoto di decisioni');
      }

      const results = await updateRequestService.bulkDecide(items, approverId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: `${results.length} richieste elaborate`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const updateRequestController = new UpdateRequestController();
