import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';

/**
 * Router per l'autenticazione.
 *
 * Route pubbliche (non richiedono JWT):
 *   POST /api/v1/auth/register  registra un nuovo utente
 *   POST /api/v1/auth/login     autentica e ritorna il JWT
 */
const authRouter = Router();

const registerValidation = [
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
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage("L'email è obbligatoria")
    .isEmail().withMessage("Email non valida")
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La password è obbligatoria'),
];

authRouter.post('/register', validate(registerValidation), (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', validate(loginValidation), (req, res, next) => authController.login(req, res, next));

export default authRouter;
