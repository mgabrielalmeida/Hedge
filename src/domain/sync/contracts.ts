export type SyncEntityKind = 'account' | 'category' | 'transaction' | 'recurring_rule' | 'recurring_occurrence';
export type SyncOperation = 'upsert' | 'tombstone';

declare const syncIdentifierBrand: unique symbol;
export type SyncIdentifier = string & { readonly [syncIdentifierBrand]: true };

export type SyncValue =
  | null
  | boolean
  | number
  | string
  | readonly SyncValue[]
  | { readonly [key: string]: SyncValue };

export type SyncPayload = Readonly<Record<string, SyncValue>>;

export interface SyncEntityReference {
  readonly kind: SyncEntityKind;
  readonly syncId: SyncIdentifier;
}

export interface SyncCommand {
  readonly commandId: SyncIdentifier;
  readonly entity: SyncEntityReference;
  readonly operation: SyncOperation;
  readonly expectedVersion: number | null;
  readonly dependsOn: readonly SyncIdentifier[];
  readonly payload: SyncPayload;
}

export interface SyncReceipt {
  readonly commandId: SyncIdentifier;
  readonly status: 'accepted' | 'rejected';
  readonly entityVersion: number | null;
  readonly rejectionCode: string | null;
}

export interface SyncCursor {
  readonly value: SyncIdentifier;
}

export interface SyncEvent {
  readonly eventId: SyncIdentifier;
  readonly cursor: SyncCursor;
  readonly entity: SyncEntityReference;
  readonly operation: SyncOperation;
  readonly version: number;
  readonly payload: SyncPayload;
}

export interface SyncSnapshot {
  readonly cursor: SyncCursor;
  readonly entities: readonly SyncEvent[];
}

export interface SyncConflict {
  readonly command: SyncCommand;
  readonly current: SyncEvent;
  readonly reason: 'version_mismatch' | 'dependency_rejected' | 'generation_closed';
}

export function asSyncIdentifier(value: unknown): SyncIdentifier | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value as SyncIdentifier
    : null;
}

export function isSyncValue(value: unknown): value is SyncValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isSyncValue);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(isSyncValue);
}

export function isSyncPayload(value: unknown): value is SyncPayload {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && isSyncValue(value);
}

export function isSyncEntityReference(value: unknown): value is SyncEntityReference {
  if (!isRecord(value) || !isEntityKind(value.kind)) return false;
  return asSyncIdentifier(value.syncId) !== null;
}

export function isSyncCommand(value: unknown): value is SyncCommand {
  if (!isRecord(value) || asSyncIdentifier(value.commandId) === null || !isSyncEntityReference(value.entity)) return false;
  return isOperation(value.operation)
    && (value.expectedVersion === null || isVersion(value.expectedVersion))
    && Array.isArray(value.dependsOn)
    && value.dependsOn.every((dependency) => asSyncIdentifier(dependency) !== null)
    && isSyncPayload(value.payload);
}

export function isSyncReceipt(value: unknown): value is SyncReceipt {
  if (!isRecord(value) || asSyncIdentifier(value.commandId) === null) return false;
  const status = value.status;
  if (status !== 'accepted' && status !== 'rejected') return false;
  return (value.entityVersion === null || isVersion(value.entityVersion))
    && (value.rejectionCode === null || asSyncIdentifier(value.rejectionCode) !== null)
    && ((status === 'accepted' && value.entityVersion !== null && value.rejectionCode === null)
      || (status === 'rejected' && value.entityVersion === null && value.rejectionCode !== null));
}

export function isSyncEvent(value: unknown): value is SyncEvent {
  if (!isRecord(value) || asSyncIdentifier(value.eventId) === null || !isSyncEntityReference(value.entity)) return false;
  return isCursor(value.cursor) && isOperation(value.operation) && isVersion(value.version) && isSyncPayload(value.payload);
}

export function isSyncSnapshot(value: unknown): value is SyncSnapshot {
  return isRecord(value) && isCursor(value.cursor) && Array.isArray(value.entities) && value.entities.every(isSyncEvent);
}

export function isSyncConflict(value: unknown): value is SyncConflict {
  return isRecord(value) && isSyncCommand(value.command) && isSyncEvent(value.current)
    && (value.reason === 'version_mismatch' || value.reason === 'dependency_rejected' || value.reason === 'generation_closed');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEntityKind(value: unknown): value is SyncEntityKind {
  return value === 'account' || value === 'category' || value === 'transaction'
    || value === 'recurring_rule' || value === 'recurring_occurrence';
}

function isOperation(value: unknown): value is SyncOperation {
  return value === 'upsert' || value === 'tombstone';
}

function isVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCursor(value: unknown): value is SyncCursor {
  return isRecord(value) && asSyncIdentifier(value.value) !== null;
}
