/**
 * State Pattern per le richieste di aggiornamento
 *
 * Ogni richiesta di aggiornamento (UpdateRequest) attraversa stati definiti:
 *   PENDING -> ACCEPTED  (approvazione del creatore)
 *   PENDING -> REJECTED  (rifiuto del creatore)
 *
 * Gli stati ACCEPTED e REJECTED sono finali: non possono essere modificati.
 *
 * Il pattern State incapsula il comportamento specifico di ogni stato
 * e impedisce transizioni non valide (es. approvare una richiesta gia' REJECTED).
 */

import { UpdateRequestStatus } from '../types/common';
import { AppError } from '../middleware/error.middleware';
import { StatusCodes } from 'http-status-codes';

// ---------------------------------------------
// Interfaccia dello stato
// ---------------------------------------------

/**
 * Contratto che ogni stato deve implementare.
 * Definisce le operazioni possibili e i vincoli di transizione.
 */
export interface IUpdateRequestState {
  /** Nome dello stato corrente */
  readonly name: UpdateRequestStatus;

  /** Verifica se e' possibile approvare la richiesta in questo stato */
  canApprove(): boolean;

  /** Verifica se e' possibile rifiutare la richiesta in questo stato */
  canReject(): boolean;

  /**
   * Tenta la transizione verso ACCEPTED.
   * @throws AppError se la transizione non e' consentita
   */
  approve(): IUpdateRequestState;

  /**
   * Tenta la transizione verso REJECTED.
   * @throws AppError se la transizione non e' consentita
   */
  reject(): IUpdateRequestState;
}

// ---------------------------------------------
// Implementazioni degli stati
// ---------------------------------------------

/**
 * Stato PENDING: la richiesta e' in attesa di decisione.
 *
 * Questo e' l'unico stato da cui si puo' transire:
 * puo' diventare ACCEPTED o REJECTED.
 */
export class PendingState implements IUpdateRequestState {
  readonly name = UpdateRequestStatus.PENDING;

  canApprove(): boolean { return true; }
  canReject():  boolean { return true; }

  approve(): IUpdateRequestState {
    return new AcceptedState();
  }

  reject(): IUpdateRequestState {
    return new RejectedState();
  }
}

/**
 * Stato ACCEPTED: la richiesta e' stata approvata ed applicata.
 *
 * Stato terminale: nessuna ulteriore transizione e' possibile.
 * La griglia e' gia' stata aggiornata e una nuova versione e' stata creata.
 */
export class AcceptedState implements IUpdateRequestState {
  readonly name = UpdateRequestStatus.ACCEPTED;

  canApprove(): boolean { return false; }
  canReject():  boolean { return false; }

  approve(): IUpdateRequestState {
    throw new AppError(
      "Impossibile approvare: la richiesta e' gia' stata accettata.",
      StatusCodes.CONFLICT
    );
  }

  reject(): IUpdateRequestState {
    throw new AppError(
      "Impossibile rifiutare: la richiesta e' gia' stata accettata.",
      StatusCodes.CONFLICT
    );
  }
}

/**
 * Stato REJECTED: la richiesta e' stata rifiutata.
 *
 * Stato terminale: la griglia non e' stata modificata.
 */
export class RejectedState implements IUpdateRequestState {
  readonly name = UpdateRequestStatus.REJECTED;

  canApprove(): boolean { return false; }
  canReject():  boolean { return false; }

  approve(): IUpdateRequestState {
    throw new AppError(
      "Impossibile approvare: la richiesta e' gia' stata rifiutata.",
      StatusCodes.CONFLICT
    );
  }

  reject(): IUpdateRequestState {
    throw new AppError(
      "Impossibile rifiutare: la richiesta e' gia' stata rifiutata.",
      StatusCodes.CONFLICT
    );
  }
}

// ---------------------------------------------
// Factory di stato
// ---------------------------------------------

/**
 * Crea l'istanza di stato corretta da un valore UpdateRequestStatus.
 * Usato per ricostruire lo stato da un record recuperato dal DB.
 */
export function createState(status: UpdateRequestStatus): IUpdateRequestState {
  switch (status) {
    case UpdateRequestStatus.PENDING:  return new PendingState();
    case UpdateRequestStatus.ACCEPTED: return new AcceptedState();
    case UpdateRequestStatus.REJECTED: return new RejectedState();
    default:
      throw new AppError(`Stato sconosciuto: ${status}`, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// ---------------------------------------------
// Context (gestisce la transizione)
// ---------------------------------------------

/**
 * UpdateRequestStateContext: gestisce lo stato corrente di una richiesta
 * e ne orchesta le transizioni in modo sicuro.
 *
 * Uso tipico:
 *   const ctx = new UpdateRequestStateContext(request.status);
 *   const newState = ctx.approve(); // lancia errore se non e' PENDING
 *   request.status = newState.name;
 */
export class UpdateRequestStateContext {
  private currentState: IUpdateRequestState;

  constructor(initialStatus: UpdateRequestStatus) {
    this.currentState = createState(initialStatus);
  }

  get state(): IUpdateRequestState {
    return this.currentState;
  }

  get status(): UpdateRequestStatus {
    return this.currentState.name;
  }

  /**
   * Transisce verso ACCEPTED.
   * @throws AppError se la richiesta non e' in stato PENDING
   */
  approve(): UpdateRequestStatus {
    this.currentState = this.currentState.approve();
    return this.currentState.name;
  }

  /**
   * Transisce verso REJECTED.
   * @throws AppError se la richiesta non e' in stato PENDING
   */
  reject(): UpdateRequestStatus {
    this.currentState = this.currentState.reject();
    return this.currentState.name;
  }
}
