import { initialSchemaMigration } from './001_initial_schema';
import { categoryVisualsMigration } from './002_category_visuals';
import { defaultCategoryIconsMigration } from './003_default_category_icons';
import { composedVisualIndicatorsMigration } from './004_composed_visual_indicators';
import { themeColorIndicesMigration } from './005_theme_color_indices';
import type { Migration } from './migration';

export const migrations: readonly Migration[] = [initialSchemaMigration, categoryVisualsMigration, defaultCategoryIconsMigration, composedVisualIndicatorsMigration, themeColorIndicesMigration];
