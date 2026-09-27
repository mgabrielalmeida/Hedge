import {
  asSyncIdentifier,
  isSyncCommand,
  isSyncConflict,
  isSyncEvent,
  isSyncReceipt,
  isSyncSnapshot,
  isSyncValue,
} from './contracts';

const identifier = asSyncIdentifier('command-1')!;
const command = {
  commandId: identifier,
  entity: { kind: 'transaction' as const, syncId: asSyncIdentifier('transaction-1')! },
  operation: 'upsert' as const,
  expectedVersion: 3,
  dependsOn: [asSyncIdentifier('account-1')!],
  payload: { amountCents: -1_250, metadata: { tags: ['food'] } },
};
const event = {
  eventId: asSyncIdentifier('event-1')!,
  cursor: { value: asSyncIdentifier('cursor-1')! },
  entity: command.entity,
  operation: 'upsert' as const,
  version: 4,
  payload: command.payload,
};

describe('sync contracts', () => {
  it('accepts the executable command, receipt, event, snapshot, and conflict contracts', () => {
    expect(isSyncCommand(command)).toBe(true);
    expect(isSyncReceipt({ commandId: identifier, status: 'accepted', entityVersion: 4, rejectionCode: null })).toBe(true);
    expect(isSyncEvent(event)).toBe(true);
    expect(isSyncSnapshot({ cursor: event.cursor, entities: [event] })).toBe(true);
    expect(isSyncConflict({ command, current: event, reason: 'version_mismatch' })).toBe(true);
  });

  it('rejects invalid identifiers, non-finite values, and incoherent receipts', () => {
    expect(asSyncIdentifier('   ')).toBeNull();
    expect(isSyncValue({ amount: Number.NaN })).toBe(false);
    expect(isSyncCommand({ ...command, expectedVersion: -1 })).toBe(false);
    expect(isSyncReceipt({ commandId: identifier, status: 'accepted', entityVersion: null, rejectionCode: null })).toBe(false);
    expect(isSyncReceipt({ commandId: identifier, status: 'rejected', entityVersion: 4, rejectionCode: 'version_mismatch' })).toBe(false);
  });
});
