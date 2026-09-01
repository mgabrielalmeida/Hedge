import { initialSchemaMigration } from './001_initial_schema';
import type { Migration } from './migration';

export const migrations: readonly Migration[] = [initialSchemaMigration];
