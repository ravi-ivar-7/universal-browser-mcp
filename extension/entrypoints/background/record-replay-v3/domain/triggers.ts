/**
 * @fileoverview Trigger type definitions
 * @description Defines trigger specifications used in Record-Replay
 */

import type { JsonObject, UnixMillis } from './json';
import type { FlowId, TriggerId } from './ids';

/** Trigger type */
export type TriggerKind =
  | 'manual'
  | 'url'
  | 'cron'
  | 'interval'
  | 'once'
  | 'command'
  | 'contextMenu'
  | 'dom';

/**
 * Trigger base interface
 */
export interface TriggerSpecBase {
  /** Trigger ID */
  id: TriggerId;
  /** Trigger type */
  kind: TriggerKind;
  /** Whether enabled */
  enabled: boolean;
  /** Associated Flow ID */
  flowId: FlowId;
  /** Arguments passed to Flow */
  args?: JsonObject;
}

/**
 * URL match rule
 */
export interface UrlMatchRule {
  kind: 'url' | 'domain' | 'path';
  value: string;
}

/**
 * Trigger specification union type
 */
export type TriggerSpec =
  // Manual trigger
  | (TriggerSpecBase & { kind: 'manual' })

  // URL trigger
  | (TriggerSpecBase & {
    kind: 'url';
    match: UrlMatchRule[];
  })

  // Cron scheduled trigger
  | (TriggerSpecBase & {
    kind: 'cron';
    cron: string;
    timezone?: string;
  })

  // Interval scheduled trigger (fixed interval repetition)
  | (TriggerSpecBase & {
    kind: 'interval';
    /** Interval in minutes, minimum 1 */
    periodMinutes: number;
  })

  // Once scheduled trigger (triggers once at specified time then auto-disables)
  | (TriggerSpecBase & {
    kind: 'once';
    /** Trigger timestamp (Unix milliseconds) */
    whenMs: UnixMillis;
  })

  // Hotkey trigger
  | (TriggerSpecBase & {
    kind: 'command';
    commandKey: string;
  })

  // Context menu trigger
  | (TriggerSpecBase & {
    kind: 'contextMenu';
    title: string;
    contexts?: ReadonlyArray<string>;
  })

  // DOM element appearance trigger
  | (TriggerSpecBase & {
    kind: 'dom';
    selector: string;
    appear?: boolean;
    once?: boolean;
    debounceMs?: UnixMillis;
  });

/**
 * Trigger fire context
 * @description Describes context information when trigger is fired
 */
export interface TriggerFireContext {
  /** Trigger ID */
  triggerId: TriggerId;
  /** Trigger type */
  kind: TriggerKind;
  /** Fire time */
  firedAt: UnixMillis;
  /** Source Tab ID */
  sourceTabId?: number;
  /** Source URL */
  sourceUrl?: string;
}

/**
 * Get typed trigger spec by trigger type
 */
export type TriggerSpecByKind<K extends TriggerKind> = Extract<TriggerSpec, { kind: K }>;

/**
 * Check if trigger is enabled
 */
export function isTriggerEnabled(trigger: TriggerSpec): boolean {
  return trigger.enabled;
}

/**
 * Create trigger fire context
 */
export function createTriggerFireContext(
  trigger: TriggerSpec,
  options?: { sourceTabId?: number; sourceUrl?: string },
): TriggerFireContext {
  return {
    triggerId: trigger.id,
    kind: trigger.kind,
    firedAt: Date.now(),
    sourceTabId: options?.sourceTabId,
    sourceUrl: options?.sourceUrl,
  };
}
