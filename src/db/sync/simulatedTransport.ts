import {
  asSyncIdentifier,
  type SyncCommand,
  type SyncEvent,
  type SyncReceipt,
} from '@/domain/sync/contracts';

export type SimulatedConflict = {
  readonly command: SyncCommand;
  readonly current: SyncEvent;
  readonly reason: 'version_mismatch' | 'dependency_rejected' | 'generation_closed';
};

export type SimulatedPushResult = {
  readonly receipts: readonly SyncReceipt[];
  readonly conflicts: readonly SimulatedConflict[];
};

export type SimulatedFaults = {
  readonly dropPushResponse?: boolean;
  readonly duplicateEvents?: boolean;
  readonly reverseEvents?: boolean;
  readonly reverseCommands?: boolean;
  readonly interruptAfterCommands?: number;
};

type ServerEntity = {
  readonly event: SyncEvent;
};

export interface SyncTransport {
  push(commands: readonly SyncCommand[]): Promise<SimulatedPushResult>;
  pull(afterCursor: string | null): Promise<SyncPullResult>;
}

export type SyncPullResult = {
  readonly cursor: string | null;
  readonly events: readonly SyncEvent[];
};

export class SimulatedSyncTransport implements SyncTransport {
  private readonly entities = new Map<string, ServerEntity>();
  private readonly receipts = new Map<string, SyncReceipt>();
  private readonly conflicts = new Map<string, SimulatedConflict>();
  private readonly events: SyncEvent[] = [];
  private faults: SimulatedFaults;

  public constructor(faults: SimulatedFaults = {}) {
    this.faults = faults;
  }

  public setFaults(faults: SimulatedFaults): void {
    this.faults = faults;
  }

  public async push(commands: readonly SyncCommand[]): Promise<SimulatedPushResult> {
    const ordered = this.faults.reverseCommands ? [...commands].reverse() : [...commands];
    const pending = [...ordered];
    let processed = 0;
    let madeProgress = true;

    while (pending.length > 0 && madeProgress) {
      madeProgress = false;
      for (let index = 0; index < pending.length;) {
        const command = pending[index];
        const known = this.receipts.get(command.commandId);
        if (known) {
          pending.splice(index, 1);
          madeProgress = true;
          continue;
        }
        const unresolved = command.dependsOn.some((dependency) => !this.receipts.has(dependency));
        if (unresolved) {
          index += 1;
          continue;
        }
        this.process(command);
        pending.splice(index, 1);
        processed += 1;
        madeProgress = true;
        if (this.faults.interruptAfterCommands === processed) throw new Error('Simulated transport interruption.');
      }
    }

    for (const command of pending) this.rejectDependency(command);
    const result = this.resultFor(commands);
    if (this.faults.dropPushResponse) throw new Error('Simulated lost push response.');
    return result;
  }

  public async pull(afterCursor: string | null): Promise<SyncPullResult> {
    const cursor = afterCursor ? parseCursor(afterCursor) : 0;
    const fresh = this.events.filter((event) => parseCursor(event.cursor.value) > cursor);
    const ordered = this.faults.reverseEvents ? [...fresh].reverse() : fresh;
    return {
      cursor: fresh.at(-1)?.cursor.value ?? afterCursor,
      events: this.faults.duplicateEvents ? ordered.flatMap((event) => [event, event]) : ordered,
    };
  }

  private process(command: SyncCommand): void {
    const rejectedDependency = command.dependsOn.some(
      (dependency) => this.receipts.get(dependency)?.status === 'rejected',
    );
    if (rejectedDependency) {
      this.rejectDependency(command);
      return;
    }
    const key = entityKey(command.entity.kind, command.entity.syncId);
    const current = this.entities.get(key)?.event;
    const expected = current?.version ?? 0;
    if (command.expectedVersion !== expected) {
      const receipt = rejectedReceipt(command, 'version_mismatch');
      this.receipts.set(command.commandId, receipt);
      this.conflicts.set(command.commandId, {
        command,
        current: current ?? syntheticEmptyEvent(command, expected),
        reason: 'version_mismatch',
      });
      return;
    }
    const version = expected + 1;
    const cursor = this.events.length + 1;
    const event: SyncEvent = {
      eventId: asSyncIdentifier(`event-${cursor}`)!,
      cursor: { value: asSyncIdentifier(`cursor-${cursor}`)! },
      entity: command.entity,
      operation: command.operation,
      version,
      payload: command.payload,
    };
    this.events.push(event);
    this.entities.set(key, { event });
    this.receipts.set(command.commandId, {
      commandId: command.commandId,
      status: 'accepted',
      entityVersion: version,
      rejectionCode: null,
    });
  }

  private rejectDependency(command: SyncCommand): void {
    if (this.receipts.has(command.commandId)) return;
    const current = this.entities.get(entityKey(command.entity.kind, command.entity.syncId))?.event
      ?? syntheticEmptyEvent(command, 0);
    const receipt = rejectedReceipt(command, 'dependency_rejected');
    this.receipts.set(command.commandId, receipt);
    this.conflicts.set(command.commandId, { command, current, reason: 'dependency_rejected' });
  }

  private resultFor(commands: readonly SyncCommand[]): SimulatedPushResult {
    return {
      receipts: commands.flatMap((command) => {
        const receipt = this.receipts.get(command.commandId);
        return receipt ? [receipt] : [];
      }),
      conflicts: commands.flatMap((command) => {
        const conflict = this.conflicts.get(command.commandId);
        return conflict ? [conflict] : [];
      }),
    };
  }
}

function rejectedReceipt(command: SyncCommand, code: string): SyncReceipt {
  return {
    commandId: command.commandId,
    status: 'rejected',
    entityVersion: null,
    rejectionCode: code,
  };
}

function syntheticEmptyEvent(command: SyncCommand, version: number): SyncEvent {
  return {
    eventId: asSyncIdentifier(`current-${command.entity.kind}-${command.entity.syncId}`)!,
    cursor: { value: asSyncIdentifier('cursor-0')! },
    entity: command.entity,
    operation: 'tombstone',
    version,
    payload: {},
  };
}

function entityKey(kind: string, syncId: string): string {
  return `${kind}:${syncId}`;
}

function parseCursor(value: string): number {
  const match = /^cursor-(\d+)$/.exec(value);
  if (!match) throw new Error('Invalid simulated cursor.');
  return Number(match[1]);
}
