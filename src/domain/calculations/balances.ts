import type { Cents, EntityId, Transaction } from '../models/financial';
import { addCents, assertSafeCents } from '../models/money';

export function getTransactionEffectForAccount(
  transaction: Transaction,
  accountId: EntityId,
): Cents {
  assertSafeCents(transaction.amountCents);

  if (transaction.accountId === accountId) {
    return transaction.amountCents;
  }

  if (transaction.kind === 'transfer' && transaction.destinationAccountId === accountId) {
    return -transaction.amountCents;
  }

  return 0;
}

export function calculateAccountBalance(
  transactions: readonly Transaction[],
  accountId: EntityId,
): Cents {
  return transactions.reduce(
    (balance, transaction) => addCents(balance, getTransactionEffectForAccount(transaction, accountId)),
    0,
  );
}

export function calculateConsolidatedBalance(transactions: readonly Transaction[]): Cents {
  return transactions.reduce(
    (balance, transaction) => {
      assertSafeCents(transaction.amountCents);
      return transaction.kind === 'transfer' ? balance : addCents(balance, transaction.amountCents);
    },
    0,
  );
}
