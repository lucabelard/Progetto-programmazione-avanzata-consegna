/**
 * Test del middleware di autenticazione JWT (auth.middleware.ts)
 *
 * Copre i requisiti delle specifiche:
 *    Test autenticazione JWT
 *    Test controllo credito (middleware checkCredit)
 *
 * Usa SQLite in memoria (NODE_ENV=test) per non richiedere un database reale.
 */

import request   from 'supertest';
import jwt       from 'jsonwebtoken';
import { createApp } from '../src/app';
import { sequelize } from '../src/config/database';
import { User }      from '../src/models/user.model';

// Garantisce che l'ambiente sia impostato su 'test'
process.env['NODE_ENV'] = 'test';

const app = createApp();

beforeAll(async () => {
  // Sincronizza il DB in memoria (SQLite) prima di tutti i test
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// -----------------------------------------------------------------------------
// TEST 1: Autenticazione JWT - token mancante
// -----------------------------------------------------------------------------
describe('Middleware authenticate - JWT', () => {

  test('deve rifiutare richieste senza token (401)', async () => {
    const res = await request(app)
      .get('/api/v1/models')
      // Nessun header Authorization
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/token/i);
  });

  test('deve rifiutare token malformati (401)', async () => {
    const res = await request(app)
      .get('/api/v1/models')
      .set('Authorization', 'Bearer questo-non-e-un-jwt-valido')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  test('deve rifiutare token firmati con chiave sbagliata (401)', async () => {
    // Firma il token con una chiave diversa da quella del server
    const fakeToken = jwt.sign(
      { userId: 1, email: 'test@test.it', role: 'user' },
      'chiave-sbagliata'
    );

    const res = await request(app)
      .get('/api/v1/models')
      .set('Authorization', `Bearer ${fakeToken}`)
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  test('deve accettare un token valido e popolare req.user', async () => {
    // Prima registra un utente per ottenere un token valido
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name:     'Test Utente',
        email:    'test.jwt@gridpath.it',
        password: 'Password123!',
      });

    expect(registerRes.status).toBe(201);
    const token = registerRes.body.data.token;
    expect(token).toBeDefined();

    // Usa il token per accedere a una route protetta
    const res = await request(app)
      .get('/api/v1/models')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// TEST 2: Middleware checkCredit - controllo credito
// -----------------------------------------------------------------------------
describe('Middleware checkCredit - controllo credito token', () => {

  test("deve rifiutare la creazione di un modello se il credito e' esaurito (401)", async () => {
    // Registra un utente e azzera il suo credito manualmente
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name:     'Utente Senza Credito',
        email:    'zero.tokens@gridpath.it',
        password: 'Password123!',
      });

    const { token } = registerRes.body.data;
    const { user }  = registerRes.body.data;

    // Azzera i token dell'utente direttamente nel DB
    await User.update({ tokens: 0 }, { where: { id: user.id } });

    // Tenta di creare un modello (operazione a pagamento)
    const res = await request(app)
      .post('/api/v1/models')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name:      'Modello Test',
        modelType: 'GRID_2D',
        width:     3,
        height:    3,
        gridData:  [[0,0,0],[0,0,0],[0,0,0]],
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/credito/i);
  });

  test("deve permettere la richiesta se il credito e' sufficiente", async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name:     'Utente Con Credito',
        email:    'with.tokens@gridpath.it',
        password: 'Password123!',
      });

    const { token } = registerRes.body.data;

    // L'utente ha il credito iniziale (100 token) - la creazione dovrebbe andare a buon fine
    const res = await request(app)
      .post('/api/v1/models')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name:      'Modello Con Credito',
        modelType: 'GRID_2D',
        width:     2,
        height:    2,
        gridData:  [[0,0],[0,0]],
      });

    // Non ci aspettiamo 401 (credito insufficiente)
    expect(res.status).not.toBe(401);
    expect(res.body.success).toBe(true);
  });
});
