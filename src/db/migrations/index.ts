import { initialSchemaMigration } from './001_initial_schema';
import { categoryVisualsMigration } from './002_category_visuals';
import { defaultCategoryIconsMigration } from './003_default_category_icons';
import { composedVisualIndicatorsMigration } from './004_composed_visual_indicators';
import { themeColorIndicesMigration } from './005_theme_color_indices';
import { accountArchivingMigration } from './006_account_archiving';
import { defaultCategoryColorsMigration } from './007_default_category_colors';
import { queryPerformanceIndexesMigration } from './008_query_performance_indexes';
import { globalIdentityMigration } from './009_global_identity';
import { localProfileMigration } from './010_local_profile';
import type { Migration } from './migration';

export const migrations: readonly Migration[] = [
  initialSchemaMigration,
  categoryVisualsMigration,
  defaultCategoryIconsMigration,
  composedVisualIndicatorsMigration,
  themeColorIndicesMigration,
  accountArchivingMigration,
  defaultCategoryColorsMigration,
  queryPerformanceIndexesMigration,
  globalIdentityMigration,
  localProfileMigration,
];
