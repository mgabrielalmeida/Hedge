type DevelopmentSeedSession = {
  runAsync: (source: string, ...parameters: (string | number | null)[]) => Promise<unknown>;
};

type DevelopmentSeedDatabase = {
  getFirstAsync: <T>(source: string, ...parameters: (string | number | null)[]) => Promise<T | null>;
  withExclusiveTransactionAsync: (
    task: (transaction: DevelopmentSeedSession) => Promise<void>,
  ) => Promise<void>;
};

/**
 * Inserts the fictional dataset used while developing the app.
 *
 * This function is intentionally not part of a migration: demo data must
 * never be copied into an existing user's database or into a production build.
 */
export async function seedDevelopmentData(db: DevelopmentSeedDatabase): Promise<boolean> {
  const existingAccount = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM accounts LIMIT 1;',
  );

  // Do not reset or merge with a developer's own data. A fresh database is the
  // only database eligible for the automatic development seed.
  if (existingAccount) return false;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO accounts
        (id, name, institution_name, visual_type, visual_value, icon_value,
         color_value, theme_color_index, is_archived, archived_at,
         created_at, updated_at)
       VALUES
        (1, 'Conta principal', 'Banco Horizonte', 'icon', 'wallet', 'wallet', '#276749', 0, 0, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        (2, 'Reserva', 'Cooperativa Aurora', 'icon', 'landmark', 'landmark', '#2b6cb0', 1, 0, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        (3, 'Cartão do dia a dia', 'Cartão Horizonte', 'icon', 'credit-card', 'credit-card', '#805ad5', 2, 0, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z');`,
    );

    await transaction.runAsync(
      `INSERT INTO categories
        (id, name, monthly_budget_cents, visual_type, visual_value, icon_value,
         color_value, theme_color_index, created_at, updated_at)
       VALUES
        (6, 'Transporte', 70000, 'icon', '🚗', '🚗', '#dd6b20', 3, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        (7, 'Saúde', 50000, 'icon', '❤️', '❤️', '#c53030', 4, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        (8, 'Casa', 120000, 'icon', '🏠', '🏠', '#319795', NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z');`,
    );

    await transaction.runAsync(
      `INSERT INTO transactions
        (kind, account_id, destination_account_id, category_id, name,
         description, amount_cents, transaction_date, created_at, updated_at)
       VALUES
        ('opening_balance', 1, NULL, NULL, 'Saldo inicial', 'Conta principal para as despesas mensais.', 1250000, '2026-09-01', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        ('opening_balance', 2, NULL, NULL, 'Saldo inicial', 'Reserva de emergência fictícia.', 800000, '2026-09-01', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        ('opening_balance', 3, NULL, NULL, 'Saldo inicial', 'Limite já utilizado representado no cartão de teste.', -120000, '2026-09-01', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        ('income', 1, NULL, NULL, 'Salário', 'Recebimento mensal fictício.', 650000, '2026-09-05', '2026-09-05T12:00:00.000Z', '2026-09-05T12:00:00.000Z'),
        ('expense', 1, NULL, 8, 'Aluguel', 'Moradia do mês.', -220000, '2026-09-06', '2026-09-06T12:00:00.000Z', '2026-09-06T12:00:00.000Z'),
        ('expense', 3, NULL, 4, 'Mercado da semana', 'Compras para casa e refeições.', -18650, '2026-09-07', '2026-09-07T12:00:00.000Z', '2026-09-07T12:00:00.000Z'),
        ('expense', 1, NULL, 6, 'Combustível', 'Abastecimento do carro.', -9500, '2026-09-08', '2026-09-08T12:00:00.000Z', '2026-09-08T12:00:00.000Z'),
        ('expense', 3, NULL, 3, 'Cinema', 'Sessão de fim de semana.', -4200, '2026-09-12', '2026-09-12T12:00:00.000Z', '2026-09-12T12:00:00.000Z'),
        ('expense', 1, NULL, 7, 'Farmácia', 'Itens de saúde.', -7350, '2026-09-14', '2026-09-14T12:00:00.000Z', '2026-09-14T12:00:00.000Z'),
        ('transfer', 1, 2, NULL, 'Reserva mensal', 'Transferência para a reserva.', -100000, '2026-09-15', '2026-09-15T12:00:00.000Z', '2026-09-15T12:00:00.000Z'),
        ('income', 1, NULL, NULL, 'Freelance', 'Projeto fictício recebido no mês.', 185000, '2026-09-18', '2026-09-18T12:00:00.000Z', '2026-09-18T12:00:00.000Z'),
        ('expense', 3, NULL, 1, 'Compra para casa', 'Pequenos itens domésticos.', -12700, '2026-09-20', '2026-09-20T12:00:00.000Z', '2026-09-20T12:00:00.000Z'),
        ('expense', 1, NULL, 2, 'Streaming', 'Assinatura mensal fictícia.', -5590, '2026-09-22', '2026-09-22T12:00:00.000Z', '2026-09-22T12:00:00.000Z'),
        ('expense', 3, NULL, 4, 'Restaurante', 'Jantar com amigos.', -8900, '2026-09-25', '2026-09-25T12:00:00.000Z', '2026-09-25T12:00:00.000Z'),
        ('expense', 1, NULL, 6, 'Aplicativo de transporte', 'Corrida fictícia.', -2600, '2026-08-28', '2026-08-28T12:00:00.000Z', '2026-08-28T12:00:00.000Z'),
        ('income', 1, NULL, NULL, 'Salário', 'Recebimento mensal fictício.', 650000, '2026-08-05', '2026-08-05T12:00:00.000Z', '2026-08-05T12:00:00.000Z'),
        ('expense', 1, NULL, 8, 'Aluguel', 'Moradia do mês anterior.', -220000, '2026-08-06', '2026-08-06T12:00:00.000Z', '2026-08-06T12:00:00.000Z'),
        ('expense', 3, NULL, 4, 'Mercado', 'Compras do mês anterior.', -23400, '2026-08-10', '2026-08-10T12:00:00.000Z', '2026-08-10T12:00:00.000Z'),
        ('expense', 1, NULL, 3, 'Show', 'Entretenimento fictício.', -7600, '2026-08-16', '2026-08-16T12:00:00.000Z', '2026-08-16T12:00:00.000Z');`,
    );

    await transaction.runAsync(
      `INSERT INTO recurring_rules
        (kind, account_id, category_id, name, description, amount_cents,
         frequency, charge_day, charge_month, start_date, processing_start_date,
         end_date, is_active, deleted_at, created_at, updated_at)
       VALUES
        ('income', 1, NULL, 'Salário mensal', 'Regra fictícia para testar recorrências de entrada.', 650000, 'monthly', 5, NULL, '2026-09-05', '2026-09-05', NULL, 1, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        ('expense', 1, 8, 'Aluguel mensal', 'Regra fictícia para testar despesas recorrentes.', -220000, 'monthly', 6, NULL, '2026-09-06', '2026-09-06', NULL, 1, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
        ('expense', 3, 2, 'Streaming mensal', 'Regra fictícia pausada para testar retomada.', -5590, 'monthly', 22, NULL, '2026-08-22', '2026-08-22', NULL, 0, NULL, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z');`,
    );
  });

  return true;
}
