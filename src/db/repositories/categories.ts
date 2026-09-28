import { validateCategoryBudget, validateRequiredText } from '@/domain';
import type { Category, Cents, ThemeColorIndex } from '@/domain';

import { type Clock, type RepositoryDatabase, systemClock } from './database';
import { mapCategory, type CategoryRow } from './rows';
import { enqueueEntityMutation } from '../sync/outbox';

const categoryColumns = 'id, name, monthly_budget_cents, icon_value, color_value, theme_color_index, created_at, updated_at';
export type CategoryInput = {
  readonly name: string;
  readonly monthlyBudgetCents: Cents;
  readonly iconValue?: string;
  readonly colorValue?: string;
  readonly themeColorIndex?: ThemeColorIndex | null;
};

export async function listCategories(db: RepositoryDatabase): Promise<readonly Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(`SELECT ${categoryColumns} FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id;`);
  return rows.map(mapCategory);
}
export async function findCategoryById(db: RepositoryDatabase, id: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>(`SELECT ${categoryColumns} FROM categories WHERE id = ? AND deleted_at IS NULL;`, id);
  return row ? mapCategory(row) : null;
}
export async function createCategory(db: RepositoryDatabase, input: CategoryInput, clock: Clock = systemClock): Promise<Category> {
  const category = validated(input); const timestamp = clock();
  let created: Category | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<CategoryRow>(`INSERT INTO categories (name, monthly_budget_cents, visual_type, visual_value, icon_value, color_value, theme_color_index, created_at, updated_at) VALUES (?, ?, 'icon', ?, ?, ?, ?, ?, ?) RETURNING ${categoryColumns};`, category.name, category.monthlyBudgetCents, category.iconValue, category.iconValue, category.colorValue, category.themeColorIndex, timestamp, timestamp);
    if (!row) throw new Error('Created category was not found.');
    created = mapCategory(row);
    await enqueueEntityMutation(transaction, 'category', row.id, timestamp);
  });
  if (!created) throw new Error('Category creation did not complete.');
  return created;
}
export async function updateCategory(db: RepositoryDatabase, id: number, input: CategoryInput, clock: Clock = systemClock): Promise<Category | null> {
  const category = validated(input);
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE id = ? AND deleted_at IS NULL;', id);
    if (!existing) return;
    await transaction.runAsync('UPDATE categories SET name = ?, monthly_budget_cents = ?, visual_type = \'icon\', visual_value = ?, icon_value = ?, color_value = ?, theme_color_index = ?, updated_at = ? WHERE id = ?;', category.name, category.monthlyBudgetCents, category.iconValue, category.iconValue, category.colorValue, category.themeColorIndex, timestamp, id);
    await enqueueEntityMutation(transaction, 'category', id, timestamp);
  });
  return findCategoryById(db, id);
}
export async function deleteCategory(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const timestamp = clock();
  let wasDeleted = false;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const category = await transaction.getFirstAsync<CategoryRow>(
      `SELECT ${categoryColumns} FROM categories WHERE id = ? AND deleted_at IS NULL;`,
      id,
    );
    if (!category) return;
    const rules = await transaction.getAllAsync<{ id: number }>('SELECT id FROM recurring_rules WHERE category_id = ? AND is_active = 1;', id);
    const transactions = await transaction.getAllAsync<{ id: number }>('SELECT id FROM transactions WHERE category_id = ? AND deleted_at IS NULL;', id);
    await transaction.runAsync('UPDATE recurring_rules SET is_active = 0, category_id = NULL, deleted_at = ?, updated_at = ? WHERE category_id = ? AND is_active = 1;', timestamp, timestamp, id);
    for (const rule of rules) await enqueueEntityMutation(transaction, 'recurring_rule', rule.id, timestamp);
    await transaction.runAsync('UPDATE transactions SET category_id = NULL, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL;', timestamp, id);
    for (const item of transactions) await enqueueEntityMutation(transaction, 'transaction', item.id, timestamp);
    await transaction.runAsync('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?;', timestamp, timestamp, id);
    await enqueueEntityMutation(transaction, 'category', id, timestamp);
    wasDeleted = true;
  });
  return wasDeleted;
}
function validated(input: CategoryInput): Required<CategoryInput> {
  const name = validateRequiredText(input.name);
  const iconValue = input.iconValue ?? '🏷️';
  const colorValue = input.colorValue ?? 'theme';
  const themeColorIndex = input.themeColorIndex ?? 2;
  if (!name.ok || !validateCategoryBudget(input.monthlyBudgetCents).ok || !validateRequiredText(iconValue).ok || !validateRequiredText(colorValue).ok || (themeColorIndex !== null && (!Number.isInteger(themeColorIndex) || themeColorIndex < 0 || themeColorIndex > 4))) throw new Error('Invalid category input.');
  return { ...input, name: name.value, iconValue: iconValue.trim(), colorValue: colorValue.trim(), themeColorIndex };
}
