import { migrations } from '.';
import { INITIAL_SCHEMA_SQL, initialSchemaMigration } from './001_initial_schema';

describe('initialSchemaMigration', () => {
  it('is registered as the immutable first migration', () => {
    expect(initialSchemaMigration.version).toBe(1);
    expect(migrations[0]).toBe(initialSchemaMigration);
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('creates the complete v1 schema as strict tables', () => {
    const tableNames = [
      'accounts',
      'categories',
      'recurring_rules',
      'transactions',
      'recurring_occurrences',
    ];

    for (const tableName of tableNames) {
      expect(INITIAL_SCHEMA_SQL).toContain(`CREATE TABLE ${tableName}`);
    }

    expect(INITIAL_SCHEMA_SQL.match(/\) STRICT;/g)).toHaveLength(tableNames.length);
  });

  it('freezes the financial and referential invariants of v1', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('amount_cents < 0');
    expect(INITIAL_SCHEMA_SQL).toContain('amount_cents > 0');
    expect(INITIAL_SCHEMA_SQL).toContain('destination_account_id <> account_id');
    expect(INITIAL_SCHEMA_SQL).toContain('ON DELETE RESTRICT');
    expect(INITIAL_SCHEMA_SQL).toContain('ON DELETE SET NULL');
    expect(INITIAL_SCHEMA_SQL).toContain(
      'UNIQUE (recurring_rule_id, scheduled_date)',
    );
    expect(INITIAL_SCHEMA_SQL).toContain(
      'transactions_one_opening_balance_per_account',
    );
  });

  it('seeds the five categories defined by the MVP', () => {
    for (const [category, budget] of [
      ['Compras', 100_000],
      ['Assinatura', 10_000],
      ['Entretenimento', 100_000],
      ['Alimentação', 100_000],
      ['Outros', 100_000],
    ]) {
      expect(INITIAL_SCHEMA_SQL).toContain(`('${category}', ${budget})`);
    }
  });

  it('executes the frozen schema in a single migration call', async () => {
    const execAsync = jest.fn(async () => undefined);

    await initialSchemaMigration.up({ execAsync });

    expect(execAsync).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledWith(INITIAL_SCHEMA_SQL);
  });
});
