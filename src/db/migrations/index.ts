import { initialSchemaMigration } from './001_initial_schema';
import { categoryVisualsMigration } from './002_category_visuals';
import type { Migration } from './migration';

export const migrations: readonly Migration[] = [initialSchemaMigration, categoryVisualsMigration];
