/**
 * Test di autorizzazione - verifica che solo il creatore possa approvare/rifiutare
 *
 * Copre i requisiti delle specifiche:
 *    Test autorizzazione del creatore nella fase di approvazione/rifiuto
 *    Test validazione coordinate 3D
 */

import request   from 'supertest';
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

// Helper per registrare un utente e ottenere il token
async function registerUser(name: string, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password: 'Password123!' });
  return { token: res.body.data.token, user: res.body.data.user };
}

// Helper per creare un modello 2D
async function createModel2D(token: string) {
  return request(app)
    .post('/api/v1/models')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name:      'Modello Test Autorizzazione',
      modelType: 'GRID_2D',
      width:     3,
      height:    3,
      gridData:  [[0,0,0],[0,0,0],[0,0,0]],
    });
}

// -----------------------------------------------------------------------------
// TEST 3: Autorizzazione del creatore - approvazione/rifiuto
// -----------------------------------------------------------------------------
describe('Autorizzazione creatore - approvazione/rifiuto richieste', () => {

  test("un utente diverso dal creatore non puo' approvare la richiesta (403)", async () => {
    const creator = await registerUser('Creatore', 'creatore@test.it');
    const other   = await registerUser('Altro',    'altro@test.it');

    // Il creatore crea un modello
    const modelRes = await createModel2D(creator.token);
    expect(modelRes.status).toBe(201);
    const modelId = modelRes.body.data.model.id;

    // L'altro utente propone un aggiornamento
    const proposeRes = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ cells: [{ x: 0, y: 0, newValue: 1 }] });

    expect(proposeRes.status).toBe(201);
    const requestId = proposeRes.body.data.id;

    // L'altro utente tenta di approvare (deve essere 403)
    const decideRes = await request(app)
      .post(`/api/v1/models/${modelId}/updates/${requestId}/decide`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ action: 'approve' })
      .expect(403);

    expect(decideRes.body.success).toBe(false);
    expect(decideRes.body.message).toMatch(/creatore/i);
  });

  test("il creatore puo' approvare una richiesta PENDING", async () => {
    const creator = await registerUser('Creatore2', 'creatore2@test.it');
    const other   = await registerUser('Altro2',    'altro2@test.it');

    const modelRes = await createModel2D(creator.token);
    const modelId  = modelRes.body.data.model.id;

    const proposeRes = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ cells: [{ x: 1, y: 1, newValue: 1 }] });

    const requestId = proposeRes.body.data.id;

    // Il creatore approva (deve avere successo)
    const decideRes = await request(app)
      .post(`/api/v1/models/${modelId}/updates/${requestId}/decide`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ action: 'approve' })
      .expect(200);

    expect(decideRes.body.success).toBe(true);
    expect(decideRes.body.data.status).toBe('ACCEPTED');
  });

  test("non si puo' approvare una richiesta gia' decisa (409)", async () => {
    const creator = await registerUser('Creatore3', 'creatore3@test.it');
    const other   = await registerUser('Altro3',    'altro3@test.it');

    const modelRes = await createModel2D(creator.token);
    const modelId  = modelRes.body.data.model.id;

    const proposeRes = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ cells: [{ x: 2, y: 2, newValue: 1 }] });

    const requestId = proposeRes.body.data.id;

    // Prima approvazione (ok)
    await request(app)
      .post(`/api/v1/models/${modelId}/updates/${requestId}/decide`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ action: 'approve' });

    // Seconda approvazione sulla stessa richiesta (deve fallire con 409)
    const res = await request(app)
      .post(`/api/v1/models/${modelId}/updates/${requestId}/decide`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({ action: 'reject' })
      .expect(409);

    expect(res.body.success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// TEST 4: Validazione coordinate 3D
// -----------------------------------------------------------------------------
describe('Validazione coordinate 3D', () => {

  let token: string;
  let modelId: number;

  beforeAll(async () => {
    const user = await registerUser('Creatore3D', 'creatore3d@test.it');
    token = user.token;

    // Crea un modello 3D 3x3x3
    const res = await request(app)
      .post('/api/v1/models')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name:      'Modello 3D Test Coordinate',
        modelType: 'GRID_3D',
        width:     3,
        height:    3,
        depth:     3,
        gridData: [
          [[0,0,0],[0,0,0],[0,0,0]],
          [[0,0,0],[0,0,0],[0,0,0]],
          [[0,0,0],[0,0,0],[0,0,0]],
        ],
      });

    modelId = res.body.data.model.id;
  });

  test('deve rifiutare coordinate z mancante per modello 3D (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        // Manca la coordinata z, obbligatoria per 3D
        cells: [{ x: 1, y: 1, newValue: 1 }],
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/z/i);
  });

  test('deve rifiutare coordinate z fuori dai limiti (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        // z=99 e' fuori dalla depth=3
        cells: [{ x: 0, y: 0, z: 99, newValue: 1 }],
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/z=/i);
  });

  test('deve rifiutare celle duplicate nella stessa richiesta (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cells: [
          { x: 0, y: 0, z: 0, newValue: 1 },
          { x: 0, y: 0, z: 0, newValue: 1 }, // duplicato!
        ],
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/duplicat/i);
  });

  test('deve accettare coordinate 3D valide', async () => {
    const res = await request(app)
      .post(`/api/v1/models/${modelId}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cells: [{ x: 1, y: 1, z: 1, newValue: 1 }],
      });

    // Deve avere successo (201 o 200, non 400)
    expect(res.status).toBeLessThan(400);
    expect(res.body.success).toBe(true);
  });
});
