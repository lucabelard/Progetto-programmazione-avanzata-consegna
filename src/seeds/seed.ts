import 'reflect-metadata';
import dotenv from 'dotenv';
import path   from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sequelize } from '../config/database';
import { User }          from '../models/user.model';
import { GridModel }     from '../models/grid-model.model';
import { ModelVersion }  from '../models/model-version.model';
import { UpdateRequest } from '../models/update-request.model';
import { ModelType, UpdateRequestStatus } from '../types/common';
import bcrypt from 'bcryptjs';

/**
 * Script di seed  popola il database con dati di demo.
 *
 * Crea:
 *   - 3 utenti (1 admin + 2 user)
 *   - 2 modelli GRID_2D
 *   - 2 modelli GRID_3D (uno con pi versioni, uno con richieste in tutti gli stati)
 *   - Versioni e richieste di aggiornamento di esempio
 *
 * Come richiesto dalle specifiche:
 *    Almeno 2 modelli GRID_2D e 2 GRID_3D
 *    Almeno un modello 3D con 2+ versioni approvate
 *    Almeno un modello 3D con richieste PENDING, ACCEPTED e REJECTED
 *    Demo del workflow: utente propone  creatore approva/rifiuta
 */
async function seed(): Promise<void> {
  console.log(' Avvio seed del database...');

  // Sincronizza i modelli (crea le tabelle se non esistono)
  await sequelize.sync({ force: true });
  console.log(' Tabelle sincronizzate');

  //  Creazione utenti 
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const admin = await User.create({
    name:     'Admin Sistema',
    email:    'admin@gridpath.it',
    password: hashedPassword,
    role:     'admin',
    tokens:   1000,
    isActive: true,
  });

  const alice = await User.create({
    name:     'Alice Rossi',
    email:    'alice@gridpath.it',
    password: hashedPassword,
    role:     'user',
    tokens:   100,
    isActive: true,
  });

  const bob = await User.create({
    name:     'Bob Verdi',
    email:    'bob@gridpath.it',
    password: hashedPassword,
    role:     'user',
    tokens:   50,
    isActive: true,
  });

  console.log(' Utenti creati: admin, alice, bob');

  //  Modello 1: GRID_2D semplice (creatore: alice) 
  const grid2D_1: number[][] = [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
  ];

  const model2D_1 = await GridModel.create({
    name:      'Labirinto 2D Piccolo',
    modelType: ModelType.GRID_2D,
    width:     5,
    height:    5,
    depth:     null,
    gridData:  grid2D_1,
    creatorId: alice.id,
  });

  await ModelVersion.create({
    modelId:       model2D_1.id,
    versionNumber: 1,
    gridData:      grid2D_1,
    proposedBy:    alice.id,
    approvedBy:    alice.id,
  });

  // Scala i token di alice per la creazione (0.025  25 celle = 0.625)
  await alice.update({ tokens: alice.tokens - 0.625 });

  //  Modello 2: GRID_2D pi grande (creatore: bob) 
  const grid2D_2: number[][] = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const model2D_2 = await GridModel.create({
    name:      'Griglia 2D Magazzino',
    modelType: ModelType.GRID_2D,
    width:     8,
    height:    6,
    depth:     null,
    gridData:  grid2D_2,
    creatorId: bob.id,
  });

  await ModelVersion.create({
    modelId:       model2D_2.id,
    versionNumber: 1,
    gridData:      grid2D_2,
    proposedBy:    bob.id,
    approvedBy:    bob.id,
  });

  await bob.update({ tokens: bob.tokens - (0.025 * 48) }); // 86 = 48 celle

  //  Modello 3: GRID_3D con pi versioni approvate (creatore: alice) 
  // Voxel-grid 333  struttura: [z][y][x]
  const grid3D_1_v1: number[][][] = [
    [ [0,0,0], [0,1,0], [0,0,0] ],  // z=0
    [ [0,0,0], [0,0,0], [0,0,0] ],  // z=1
    [ [0,0,0], [0,0,0], [0,0,0] ],  // z=2
  ];

  const model3D_1 = await GridModel.create({
    name:      'Voxel 3D Edificio',
    modelType: ModelType.GRID_3D,
    width:     3,
    height:    3,
    depth:     3,
    gridData:  grid3D_1_v1,
    creatorId: alice.id,
  });

  const version3D_1_v1 = await ModelVersion.create({
    modelId:       model3D_1.id,
    versionNumber: 1,
    gridData:      grid3D_1_v1,
    proposedBy:    alice.id,
    approvedBy:    alice.id,
  });

  // Seconda versione approvata (alice stessa modifica il proprio modello)
  const grid3D_1_v2: number[][][] = [
    [ [0,0,0], [0,1,0], [0,0,0] ],
    [ [0,0,0], [0,1,0], [0,0,0] ],  // z=1  aggiunto ostacolo
    [ [0,0,0], [0,0,0], [0,0,0] ],
  ];

  // Richiesta ACCEPTED del creatore stesso
  const req3D_1_accepted_alice = await UpdateRequest.create({
    modelId:       model3D_1.id,
    baseVersionId: version3D_1_v1.id,
    proposerId:    alice.id,
    approverId:    alice.id,
    cells:         [{ x: 1, y: 1, z: 1, newValue: 1 }],
    status:        UpdateRequestStatus.ACCEPTED,
    decidedAt:     new Date(),
  });

  const version3D_1_v2 = await ModelVersion.create({
    modelId:       model3D_1.id,
    versionNumber: 2,
    gridData:      grid3D_1_v2,
    proposedBy:    alice.id,
    approvedBy:    alice.id,
  });

  await req3D_1_accepted_alice.update({ resultVersionId: version3D_1_v2.id });
  await model3D_1.update({ gridData: grid3D_1_v2 });
  await alice.update({ tokens: alice.tokens - (0.025 * 27) - (0.25 * 1) }); // creazione + aggiornamento

  // Terza versione approvata (bob propone, alice approva)
  const grid3D_1_v3: number[][][] = [
    [ [0,0,0], [0,1,0], [0,0,0] ],
    [ [0,0,0], [0,1,0], [0,0,0] ],
    [ [0,0,0], [0,0,1], [0,0,0] ],  // z=2  aggiunto da bob, approvato da alice
  ];

  const req3D_1_bob = await UpdateRequest.create({
    modelId:       model3D_1.id,
    baseVersionId: version3D_1_v2.id,
    proposerId:    bob.id,
    approverId:    alice.id,
    cells:         [{ x: 2, y: 2, z: 2, newValue: 1 }],
    status:        UpdateRequestStatus.ACCEPTED,
    decidedAt:     new Date(),
  });

  const version3D_1_v3 = await ModelVersion.create({
    modelId:       model3D_1.id,
    versionNumber: 3,
    gridData:      grid3D_1_v3,
    proposedBy:    bob.id,
    approvedBy:    alice.id,
  });

  await req3D_1_bob.update({ resultVersionId: version3D_1_v3.id });
  await model3D_1.update({ gridData: grid3D_1_v3 });
  await bob.update({ tokens: bob.tokens - 0.25 }); // costo richiesta

  console.log(` Modello 3D "${model3D_1.name}" creato con 3 versioni approvate`);

  //  Modello 4: GRID_3D con PENDING, ACCEPTED, REJECTED (creatore: bob) 
  const grid3D_2: number[][][] = [
    [ [0,0,0,0], [0,0,0,0], [0,0,0,0] ],  // z=0
    [ [0,0,0,0], [0,1,1,0], [0,0,0,0] ],  // z=1 con ostacoli
    [ [0,0,0,0], [0,0,0,0], [0,0,0,0] ],  // z=2
    [ [0,0,0,0], [0,0,0,0], [0,0,0,0] ],  // z=3
  ];

  const model3D_2 = await GridModel.create({
    name:      'Voxel 3D Parcheggio Multipiano',
    modelType: ModelType.GRID_3D,
    width:     4,
    height:    3,
    depth:     4,
    gridData:  grid3D_2,
    creatorId: bob.id,
  });

  const version3D_2_v1 = await ModelVersion.create({
    modelId:       model3D_2.id,
    versionNumber: 1,
    gridData:      grid3D_2,
    proposedBy:    bob.id,
    approvedBy:    bob.id,
  });

  await bob.update({ tokens: bob.tokens - (0.025 * 48) }); // 434 = 48 celle

  // Richiesta PENDING (alice propone, bob non ha ancora deciso)
  const req3D_2_pending = await UpdateRequest.create({
    modelId:       model3D_2.id,
    baseVersionId: version3D_2_v1.id,
    proposerId:    alice.id,
    cells:         [{ x: 0, y: 0, z: 3, newValue: 1 }],
    status:        UpdateRequestStatus.PENDING,
  });

  await alice.update({ tokens: alice.tokens - 0.25 });

  // Richiesta ACCEPTED (alice propone, bob approva)
  const grid3D_2_v2: number[][][] = JSON.parse(JSON.stringify(grid3D_2));
  grid3D_2_v2[2][0][3] = 1; // x=3, y=0, z=2

  const req3D_2_accepted = await UpdateRequest.create({
    modelId:       model3D_2.id,
    baseVersionId: version3D_2_v1.id,
    proposerId:    alice.id,
    approverId:    bob.id,
    cells:         [{ x: 3, y: 0, z: 2, newValue: 1 }],
    status:        UpdateRequestStatus.ACCEPTED,
    decidedAt:     new Date(),
  });

  const version3D_2_v2 = await ModelVersion.create({
    modelId:       model3D_2.id,
    versionNumber: 2,
    gridData:      grid3D_2_v2,
    proposedBy:    alice.id,
    approvedBy:    bob.id,
  });

  await req3D_2_accepted.update({ resultVersionId: version3D_2_v2.id });
  await model3D_2.update({ gridData: grid3D_2_v2 });
  await alice.update({ tokens: alice.tokens - 0.25 });

  // Richiesta REJECTED (alice propone di occupare un voxel, bob rifiuta)
  const req3D_2_rejected = await UpdateRequest.create({
    modelId:       model3D_2.id,
    baseVersionId: version3D_2_v2.id,
    proposerId:    alice.id,
    approverId:    bob.id,
    cells:         [{ x: 1, y: 1, z: 0, newValue: 1 }],
    status:        UpdateRequestStatus.REJECTED,
    reason:        'Questo voxel deve rimanere libero per il percorso principale di uscita dal parcheggio.',
    decidedAt:     new Date(),
  });

  await alice.update({ tokens: alice.tokens - 0.25 });

  console.log(` Modello 3D "${model3D_2.name}" creato con richieste PENDING, ACCEPTED e REJECTED`);

  //  Riepilogo finale 
  console.log('\n Riepilogo seed:');
  console.log(`   Utenti creati: 3 (admin, alice, bob)`);
  console.log(`   Modelli 2D:    2 ("Labirinto 2D Piccolo", "Griglia 2D Magazzino")`);
  console.log(`   Modelli 3D:    2 ("Voxel 3D Edificio" con 3 versioni, "Voxel 3D Parcheggio")`);
  console.log(`   Richieste:     ACCEPTED2, PENDING1, REJECTED1`);
  console.log('\n Credenziali di accesso:');
  console.log(`  admin: admin@gridpath.it / Password123!`);
  console.log(`  alice: alice@gridpath.it / Password123!`);
  console.log(`    bob:   bob@gridpath.it / Password123!`);
  console.log('\n Seed completato con successo!');

  await sequelize.close();
}

seed().catch((err) => {
  console.error(' Errore durante il seed:', err);
  process.exit(1);
});
