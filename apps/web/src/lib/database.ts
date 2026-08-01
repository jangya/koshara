import {createDatabase, type KosharaDatabase} from '@koshara/database';

import {getServerEnvironment} from './environment';

let database: KosharaDatabase | undefined;

export function getDatabase(): KosharaDatabase {
  database ??= createDatabase(getServerEnvironment().DATABASE_URL);
  return database;
}
