/**
 * @fileoverview StoragePort Interface Definition
 * @description Defines abstract interface for Storage layer, used for dependency injection
 */

import type { FlowId, RunId, TriggerId } from '../../domain/ids';
import type { FlowV3 } from '../../domain/flow';
import type { RunEvent, RunEventInput, RunRecordV3 } from '../../domain/events';
import type { PersistentVarRecord, PersistentVariableName } from '../../domain/variables';
import type { TriggerSpec } from '../../domain/triggers';
import type { RunQueue } from '../queue/queue';

/**
 * FlowsStore Interface
 */
export interface FlowsStore {
  /** List all Flows */
  list(): Promise<FlowV3[]>;
  /** Get single Flow */
  get(id: FlowId): Promise<FlowV3 | null>;
  /** Save Flow */
  save(flow: FlowV3): Promise<void>;
  /** Delete Flow */
  delete(id: FlowId): Promise<void>;
}

/**
 * RunsStore Interface
 */
export interface RunsStore {
  /** List all Run records */
  list(): Promise<RunRecordV3[]>;
  /** Get single Run record */
  get(id: RunId): Promise<RunRecordV3 | null>;
  /** Save Run record */
  save(record: RunRecordV3): Promise<void>;
  /** Partially update Run record */
  patch(id: RunId, patch: Partial<RunRecordV3>): Promise<void>;
}

/**
 * EventsStore Interface
 * @description seq allocation must be done atomically inside append()
 */
export interface EventsStore {
  /**
   * Append event and atomically allocate seq
   * @description In single transaction: read RunRecordV3.nextSeq -> write event -> increment nextSeq
   * @param event Event input (excluding seq)
   * @returns Complete event (including allocated seq and ts)
   */
  append(event: RunEventInput): Promise<RunEvent>;

  /**
   * List events
   * @param runId Run ID
   * @param opts Query options
   */
  list(runId: RunId, opts?: { fromSeq?: number; limit?: number }): Promise<RunEvent[]>;
}

/**
 * PersistentVarsStore Interface
 */
export interface PersistentVarsStore {
  /** Get persistent variable */
  get(key: PersistentVariableName): Promise<PersistentVarRecord | undefined>;
  /** Set persistent variable */
  set(
    key: PersistentVariableName,
    value: PersistentVarRecord['value'],
  ): Promise<PersistentVarRecord>;
  /** Delete persistent variable */
  delete(key: PersistentVariableName): Promise<void>;
  /** List persistent variables */
  list(prefix?: PersistentVariableName): Promise<PersistentVarRecord[]>;
}

/**
 * TriggersStore Interface
 */
export interface TriggersStore {
  /** List all triggers */
  list(): Promise<TriggerSpec[]>;
  /** Get single trigger */
  get(id: TriggerId): Promise<TriggerSpec | null>;
  /** Save trigger */
  save(spec: TriggerSpec): Promise<void>;
  /** Delete trigger */
  delete(id: TriggerId): Promise<void>;
}

/**
 * StoragePort Interface
 * @description Aggregates all storage interfaces for dependency injection
 */
export interface StoragePort {
  /** Flows Storage */
  flows: FlowsStore;
  /** Runs Storage */
  runs: RunsStore;
  /** Events Storage */
  events: EventsStore;
  /** Queue Storage */
  queue: RunQueue;
  /** Persistent Vars Storage */
  persistentVars: PersistentVarsStore;
  /** Triggers Storage */
  triggers: TriggersStore;
}

/**
 * Create NotImplemented Store
 * @description Avoid Proxy generating 'then' resulting in thenable behavior
 */
function createNotImplementedStore<T extends object>(name: string): T {
  const target = {} as T;
  return new Proxy(target, {
    get(_, prop) {
      // Avoid thenable behavior by returning undefined for 'then'
      if (prop === 'then') {
        return undefined;
      }
      return async () => {
        throw new Error(`${name}.${String(prop)} not implemented`);
      };
    },
  });
}

/**
 * Create NotImplemented StoragePort
 * @description Phase 0 placeholder implementation
 */
export function createNotImplementedStoragePort(): StoragePort {
  return {
    flows: createNotImplementedStore<FlowsStore>('FlowsStore'),
    runs: createNotImplementedStore<RunsStore>('RunsStore'),
    events: createNotImplementedStore<EventsStore>('EventsStore'),
    queue: createNotImplementedStore<RunQueue>('RunQueue'),
    persistentVars: createNotImplementedStore<PersistentVarsStore>('PersistentVarsStore'),
    triggers: createNotImplementedStore<TriggersStore>('TriggersStore'),
  };
}
