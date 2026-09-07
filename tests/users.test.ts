/**
 * Test di base per le route di autenticazione e health check.
 *
 * Le route `/api/v1/users` non sono parte del progetto:
 * la gestione degli utenti avviene tramite /api/v1/auth.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { sequelize } from '../src/config/database';

process.env['NODE_ENV'] = 'test';

const app = createApp();

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

//it e test sono sinonimi
describe('Health Check & Auth API', () => {

  describe('GET /health', () => {
    it('deve restituire 200 OK con lo stato dell\'applicazione', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.env).toBe('test');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('deve registrare un nuovo utente e restituire il JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Mario Rossi', email: 'mario@test.it', password: 'Password123!' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('mario@test.it');
      expect(res.body.data.token).toBeDefined();
    });

    it('deve restituire 400 per email non valida', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Test', email: 'non-una-email', password: 'Password123!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('deve restituire 400 per campi mancanti', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Solo Nome' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('deve restituire 409 se l\'email è già registrata', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Utente Duplicato', email: 'duplicato@test.it', password: 'Password123!' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Utente Duplicato 2', email: 'duplicato@test.it', password: 'Password123!' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeAll(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Login User', email: 'login@test.it', password: 'Password123!' });
    });

    it('deve restituire il JWT con credenziali corrette', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.it', password: 'Password123!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('deve restituire 401 con credenziali errate', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.it', password: 'PasswordSbagliata!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('deve restituire 404 per route non trovate', async () => {
      const res = await request(app).get('/api/v1/questa-route-non-esiste').expect(404);
      expect(res.body.success).toBe(false);
    });
  });
});
