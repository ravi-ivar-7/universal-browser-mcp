/**
 * @fileoverview Trigger Handler Interface Definition
 * @description Defines unified interface for various triggers
 */

import type { TriggerSpec, TriggerKind } from '../../domain/triggers';

/**
 * Trigger Handler Interface
 * @description Each trigger type must implement this interface
 */
export interface TriggerHandler<K extends TriggerKind = TriggerKind> {
  /** Trigger Kind */
  readonly kind: K;

  /**
   * Install Trigger
   * @description Register chrome API listeners etc.
   * @param trigger Trigger Spec
   */
  install(trigger: Extract<TriggerSpec, { kind: K }>): Promise<void>;

  /**
   * Uninstall Trigger
   * @description Remove chrome API listeners etc.
   * @param triggerId Trigger ID
   */
  uninstall(triggerId: string): Promise<void>;

  /**
   * Uninstall All Triggers
   * @description Clean up all triggers of this type
   */
  uninstallAll(): Promise<void>;

  /**
   * Get list of installed trigger IDs
   */
  getInstalledIds(): string[];
}

/**
 * Trigger Fire Callback
 * @description Callback injected by TriggerManager to handlers
 */
export interface TriggerFireCallback {
  /**
   * Called when trigger is fired
   * @param triggerId Trigger ID
   * @param context Trigger Context
   */
  onFire(
    triggerId: string,
    context: {
      sourceTabId?: number;
      sourceUrl?: string;
    },
  ): Promise<void>;
}

/**
 * Trigger Handler Factory
 */
export type TriggerHandlerFactory<K extends TriggerKind> = (
  fireCallback: TriggerFireCallback,
) => TriggerHandler<K>;
