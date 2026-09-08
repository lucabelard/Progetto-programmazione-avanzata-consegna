import { Router } from 'express';
import { body, param } from 'express-validator';
import { userController } from '../controllers/user.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * Regole di validazione riutilizzabili
 */
const createUserValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Il nome è obbligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Il nome deve essere tra 2 e 100 caratteri'),
  body('email')
    .trim()
    .notEmpty().withMessage("L'email è obbligatoria")
    .isEmail().withMessage("Email non valida")
    .normalizeEmail(),
  body('password')
    .trim()
    .notEmpty().withMessage('La password è obbligatoria')
    .isLength({ min: 6 }).withMessage('La password deve essere di almeno 6 caratteri'),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'moderator']).withMessage('Ruolo non valido'),
];

const updateUserValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID non valido'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Il nome deve essere tra 2 e 100 caratteri'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email non valida')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'moderator']).withMessage('Ruolo non valido'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive deve essere un booleano'),
  body('tokens')
    .optional()
    .isFloat({ min: 0 }).withMessage('I token devono essere un numero non negativo'),
];

// ─────────────────────────────────────────────
// Route Definitions
// ─────────────────────────────────────────────

/**
 * @route   GET /api/v1/users
 * @desc    Lista tutti gli utenti
 * @access  Public (da proteggere con authenticate in produzione)
 */
router.get('/', userController.getAll);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Recupera un utente per ID
 * @access  Public
 */
router.get(
  '/:id',
  validate([param('id').isInt({ min: 1 }).withMessage('ID non valido')]),
  userController.getById
);

/**
 * @route   POST /api/v1/users
 * @desc    Crea un nuovo utente
 * @access  Public (o Protected con authenticate)
 */
router.post(
  '/',
  validate(createUserValidation),
  userController.create
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Aggiorna un utente
 * @access  Protected
 */
router.put(
  '/:id',
  authenticate,
  validate(updateUserValidation),
  userController.update
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Elimina un utente
 * @access  Protected (solo admin)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  validate([param('id').isInt({ min: 1 }).withMessage('ID non valido')]),
  userController.delete
);

/**
 * @route   POST /api/v1/users/:id/recharge
 * @desc    Ricarica i token di un utente
 * @access  Protected (solo admin)
 */
router.post(
  '/:id/recharge',
  authenticate,
  requireAdmin,
  validate([
    param('id').isInt({ min: 1 }).withMessage('ID non valido'),
    body('amount').isFloat({ gt: 0 }).withMessage("L'importo deve essere maggiore di 0")
  ]),
  userController.recharge
);

export default router;
