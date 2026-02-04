/**
 * Action Type System for Record & Replay
 * Commercial-grade Record Replay Core Type Definitions
 *
 * Design Principles:
 * - Type Safety (No any)
 * - Support all action types
 * - Support Retry, Timeout, Error Handling policies
 * - Support Selector Candidates and Stability Score
 * - Support Variable System
 * - Follow SOLID principles (interface extensible via declaration merging)
 */

// ================================
// Basic Types
// ================================

export type Milliseconds = number;
export type ISODateTimeString = string;
export type NonEmptyArray<T> = [T, ...T[]];

// JSON Types
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

// ID Types
export type FlowId = string;
export type ActionId = string;
export type SubflowId = string;
export type EdgeId = string;
export type VariableName = string;

// ================================
// Edge Labels
// ================================

export const EDGE_LABELS = {
  DEFAULT: 'default',
  TRUE: 'true',
  FALSE: 'false',
  ON_ERROR: 'onError',
} as const;

export type BuiltinEdgeLabel = (typeof EDGE_LABELS)[keyof typeof EDGE_LABELS];
export type EdgeLabel = string;

// ================================
// Error Handling
// ================================

export type ActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'TAB_NOT_FOUND'
  | 'FRAME_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'NAVIGATION_FAILED'
  | 'NETWORK_REQUEST_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'ASSERTION_FAILED'
  | 'SCRIPT_FAILED'
  | 'UNKNOWN';

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  data?: JsonValue;
}

// ================================
// Execution Policy
// ================================

export interface TimeoutPolicy {
  ms: Milliseconds;
  /** 'attempt' = timer per attempt, 'action' = total timer for action */
  scope?: 'attempt' | 'action';
}

export type BackoffKind = 'none' | 'exp' | 'linear';

export interface RetryPolicy {
  /** Retry count (excluding first attempt) */
  retries: number;
  /** Retry interval */
  intervalMs: Milliseconds;
  /** Backoff strategy */
  backoff?: BackoffKind;
  /** Max interval (for exp/linear) */
  maxIntervalMs?: Milliseconds;
  /** Jitter strategy */
  jitter?: 'none' | 'full';
  /** Retry only on these error codes */
  retryOn?: ReadonlyArray<ActionErrorCode>;
}

export type ErrorHandlingStrategy =
  | { kind: 'stop' }
  | { kind: 'continue'; level?: 'warning' | 'error' }
  | { kind: 'goto'; label: EdgeLabel };

export interface ArtifactCapturePolicy {
  screenshot?: 'never' | 'onFailure' | 'always';
  saveScreenshotAs?: VariableName;
  includeConsole?: boolean;
  includeNetwork?: boolean;
}

export interface ActionPolicy {
  timeout?: TimeoutPolicy;
  retry?: RetryPolicy;
  onError?: ErrorHandlingStrategy;
  artifacts?: ArtifactCapturePolicy;
}

// ================================
// Variable System
// ================================

export interface VariableDefinitionBase {
  name: VariableName;
  label?: string;
  description?: string;
  sensitive?: boolean;
  required?: boolean;
}

export interface VariableStringRules {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface VariableNumberRules {
  min?: number;
  max?: number;
  integer?: boolean;
}

export type VariableDefinition =
  | (VariableDefinitionBase & {
    kind: 'string';
    default?: string;
    rules?: VariableStringRules;
  })
  | (VariableDefinitionBase & {
    kind: 'number';
    default?: number;
    rules?: VariableNumberRules;
  })
  | (VariableDefinitionBase & {
    kind: 'boolean';
    default?: boolean;
  })
  | (VariableDefinitionBase & {
    kind: 'enum';
    options: NonEmptyArray<string>;
    default?: string;
  })
  | (VariableDefinitionBase & {
    kind: 'array';
    item: 'string' | 'number' | 'boolean' | 'json';
    default?: JsonValue[];
  })
  | (VariableDefinitionBase & {
    kind: 'json';
    default?: JsonValue;
  });

export type VariableStore = Record<VariableName, JsonValue>;

export type VariableScope = 'flow' | 'run' | 'env' | 'secret';
export type VariablePathSegment = string | number;

export interface VariablePointer {
  scope?: VariableScope;
  name: VariableName;
  path?: ReadonlyArray<VariablePathSegment>;
}

// ================================
// Expressions and Templates
// ================================

export type ExpressionLanguage = 'js' | 'rr';

export interface Expression<_T = JsonValue> {
  language: ExpressionLanguage;
  code: string;
}

export interface VariableValue<T> {
  kind: 'var';
  ref: VariablePointer;
  default?: T;
}

export interface ExpressionValue<T> {
  kind: 'expr';
  expr: Expression<T>;
  default?: T;
}

export type TemplateFormat = 'text' | 'json' | 'urlEncoded';

export type TemplatePart =
  | { kind: 'text'; value: string }
  | { kind: 'insert'; value: Resolvable<JsonValue>; format?: TemplateFormat };

export interface StringTemplate {
  kind: 'template';
  parts: NonEmptyArray<TemplatePart>;
}

export type Resolvable<T> =
  | T
  | VariableValue<T>
  | ExpressionValue<T>
  | ([T] extends [string] ? StringTemplate : never);

export type DataPath = string; // dot/bracket path: e.g. "data.items[0].id"
export type Assignments = Record<VariableName, DataPath>;

// ================================
// Conditional Expressions
// ================================

export type CompareOp =
  | 'eq'
  | 'eqi'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'containsI'
  | 'notContains'
  | 'notContainsI'
  | 'startsWith'
  | 'endsWith'
  | 'regex';

export type Condition =
  | { kind: 'expr'; expr: Expression<boolean> }
  | {
    kind: 'compare';
    left: Resolvable<JsonValue>;
    op: CompareOp;
    right: Resolvable<JsonValue>;
  }
  | { kind: 'truthy'; value: Resolvable<JsonValue> }
  | { kind: 'falsy'; value: Resolvable<JsonValue> }
  | { kind: 'not'; condition: Condition }
  | { kind: 'and'; conditions: NonEmptyArray<Condition> }
  | { kind: 'or'; conditions: NonEmptyArray<Condition> };

// ================================
// Selector System
// ================================

export type SelectorCandidateSource = 'recorded' | 'user' | 'generated';

export interface SelectorStability {
  /** Stability Score 0-1 */
  score: number;
  signals?: {
    usesId?: boolean;
    usesAria?: boolean;
    usesText?: boolean;
    usesNthOfType?: boolean;
    usesAttributes?: boolean;
    usesClass?: boolean;
  };
  note?: string;
}

export interface SelectorCandidateBase {
  weight?: number;
  stability?: SelectorStability;
  source?: SelectorCandidateSource;
}

export type SelectorCandidate =
  | (SelectorCandidateBase & { type: 'css'; selector: Resolvable<string> })
  | (SelectorCandidateBase & { type: 'xpath'; xpath: Resolvable<string> })
  | (SelectorCandidateBase & { type: 'attr'; selector: Resolvable<string> })
  | (SelectorCandidateBase & {
    type: 'aria';
    role?: Resolvable<string>;
    name?: Resolvable<string>;
  })
  | (SelectorCandidateBase & {
    type: 'text';
    text: Resolvable<string>;
    tagNameHint?: string;
    match?: 'exact' | 'contains';
  });

export type FrameTarget =
  | { kind: 'top' }
  | { kind: 'index'; index: Resolvable<number> }
  | { kind: 'urlContains'; value: Resolvable<string> };

export interface TargetHint {
  tagName?: string;
  role?: string;
  name?: string;
  text?: string;
}

export interface ElementTargetBase {
  frame?: FrameTarget;
  hint?: TargetHint;
}

export type ElementTarget =
  | (ElementTargetBase & {
    /** Temporary Reference (Fast Path) */
    ref: string;
    candidates?: ReadonlyArray<SelectorCandidate>;
  })
  | (ElementTargetBase & {
    ref?: string;
    candidates: NonEmptyArray<SelectorCandidate>;
  });

// ================================
// Action Parameter Definitions
// ================================

export type BrowserWorld = 'MAIN' | 'ISOLATED';

// --- Page Interaction ---

export interface ClickParams {
  target: ElementTarget;
  button?: 'left' | 'middle' | 'right';
  before?: { scrollIntoView?: boolean; waitForSelector?: boolean };
  after?: { waitForNavigation?: boolean; waitForNetworkIdle?: boolean };
}

export interface FillParams {
  target: ElementTarget;
  value: Resolvable<string>;
  clearFirst?: boolean;
  mode?: 'replace' | 'append';
}

export interface KeyParams {
  keys: Resolvable<string>; // e.g. "Backspace Enter" or "cmd+a"
  target?: ElementTarget;
}

export type ScrollMode = 'element' | 'offset' | 'container';

export interface ScrollOffset {
  x?: Resolvable<number>;
  y?: Resolvable<number>;
}

export interface ScrollParams {
  mode: ScrollMode;
  target?: ElementTarget;
  offset?: ScrollOffset;
}

export interface Point {
  x: number;
  y: number;
}

export interface DragParams {
  start: ElementTarget;
  end: ElementTarget;
  path?: ReadonlyArray<Point>;
}

// --- Navigation ---

export interface NavigateParams {
  url: Resolvable<string>;
  refresh?: boolean;
}

// --- Wait and Assert ---

export type WaitCondition =
  | { kind: 'sleep'; sleep: Resolvable<Milliseconds> }
  | { kind: 'navigation' }
  | { kind: 'networkIdle'; idleMs?: Resolvable<Milliseconds> }
  | { kind: 'text'; text: Resolvable<string>; appear?: boolean }
  | { kind: 'selector'; selector: Resolvable<string>; visible?: boolean };

export interface WaitParams {
  condition: WaitCondition;
}

export type Assertion =
  | { kind: 'exists'; selector: Resolvable<string> }
  | { kind: 'visible'; selector: Resolvable<string> }
  | { kind: 'textPresent'; text: Resolvable<string> }
  | {
    kind: 'attribute';
    selector: Resolvable<string>;
    name: Resolvable<string>;
    equals?: Resolvable<string>;
    matches?: Resolvable<string>;
  };

export type AssertFailStrategy = 'stop' | 'warn' | 'retry';

export interface AssertParams {
  assert: Assertion;
  failStrategy?: AssertFailStrategy;
}

// --- Data and Scripts ---

export type ExtractParams =
  | {
    mode: 'selector';
    selector: Resolvable<string>;
    attr?: Resolvable<string>; // "text" | "textContent" | attribute name
    saveAs: VariableName;
  }
  | {
    mode: 'js';
    code: string;
    world?: BrowserWorld;
    saveAs: VariableName;
  };

export type ScriptTiming = 'before' | 'after';

export interface ScriptParams {
  world?: BrowserWorld;
  code: string;
  when?: ScriptTiming;
  args?: Record<string, Resolvable<JsonValue>>;
  saveAs?: VariableName;
  assign?: Assignments;
}

export interface ScreenshotParams {
  selector?: Resolvable<string>;
  fullPage?: boolean;
  saveAs?: VariableName;
}

// --- HTTP ---

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HttpHeaders = Record<string, Resolvable<string>>;
export type HttpFormData = Record<string, Resolvable<string>>;

export type HttpBody =
  | { kind: 'none' }
  | { kind: 'text'; text: Resolvable<string>; contentType?: Resolvable<string> }
  | { kind: 'json'; json: Resolvable<JsonValue> };

export type HttpOkStatus =
  | { kind: 'range'; min: number; max: number }
  | { kind: 'list'; statuses: NonEmptyArray<number> };

export interface HttpParams {
  method?: HttpMethod;
  url: Resolvable<string>;
  headers?: HttpHeaders;
  body?: HttpBody;
  formData?: HttpFormData;
  okStatus?: HttpOkStatus;
  saveAs?: VariableName;
  assign?: Assignments;
}

// --- DOM Utilities ---

export interface TriggerEventParams {
  target: ElementTarget;
  event: Resolvable<string>;
  bubbles?: boolean;
  cancelable?: boolean;
}

export interface SetAttributeParams {
  target: ElementTarget;
  name: Resolvable<string>;
  value?: Resolvable<JsonValue>;
  remove?: boolean;
}

export interface SwitchFrameParams {
  target: FrameTarget;
}

export interface LoopElementsParams {
  selector: Resolvable<string>;
  saveAs?: VariableName;
  itemVar?: VariableName;
  subflowId: SubflowId;
}

// --- Tab Management ---

export interface OpenTabParams {
  url?: Resolvable<string>;
  newWindow?: boolean;
}

export interface SwitchTabParams {
  tabId?: number;
  urlContains?: Resolvable<string>;
  titleContains?: Resolvable<string>;
}

export interface CloseTabParams {
  tabIds?: ReadonlyArray<number>;
  url?: Resolvable<string>;
}

export interface HandleDownloadParams {
  filenameContains?: Resolvable<string>;
  waitForComplete?: boolean;
  saveAs?: VariableName;
}

// --- Control Flow ---

export interface ExecuteFlowParams {
  flowId: FlowId;
  inline?: boolean;
  args?: Record<string, Resolvable<JsonValue>>;
}

export interface ForeachParams {
  listVar: VariableName;
  itemVar?: VariableName;
  subflowId: SubflowId;
  concurrency?: number;
}

export interface WhileParams {
  condition: Condition;
  subflowId: SubflowId;
  maxIterations?: number;
}

export interface IfBranch {
  id: string;
  label: EdgeLabel;
  condition: Condition;
}

export type IfParams =
  | {
    mode: 'binary';
    condition: Condition;
    trueLabel?: EdgeLabel;
    falseLabel?: EdgeLabel;
  }
  | {
    mode: 'branches';
    branches: NonEmptyArray<IfBranch>;
    elseLabel?: EdgeLabel;
  };

export interface DelayParams {
  sleep: Resolvable<Milliseconds>;
}

// --- Triggers ---

export type TriggerUrlRuleKind = 'url' | 'domain' | 'path';

export interface TriggerUrlRule {
  kind: TriggerUrlRuleKind;
  value: Resolvable<string>;
}

export interface TriggerUrlConfig {
  rules?: ReadonlyArray<TriggerUrlRule>;
}

export interface TriggerModeConfig {
  manual?: boolean;
  url?: boolean;
  contextMenu?: boolean;
  command?: boolean;
  dom?: boolean;
  schedule?: boolean;
}

export interface TriggerContextMenuConfig {
  title?: Resolvable<string>;
  enabled?: boolean;
}

export interface TriggerCommandConfig {
  commandKey?: Resolvable<string>;
  enabled?: boolean;
}

export interface TriggerDomConfig {
  selector?: Resolvable<string>;
  appear?: boolean;
  once?: boolean;
  debounceMs?: Milliseconds;
  enabled?: boolean;
}

export type TriggerScheduleType = 'once' | 'interval' | 'daily';

export interface TriggerSchedule {
  id: string;
  type: TriggerScheduleType;
  when: Resolvable<string>; // ISO/cron-like string
  enabled?: boolean;
}

export interface TriggerParams {
  enabled?: boolean;
  description?: Resolvable<string>;
  modes?: TriggerModeConfig;
  url?: TriggerUrlConfig;
  contextMenu?: TriggerContextMenuConfig;
  command?: TriggerCommandConfig;
  dom?: TriggerDomConfig;
  schedules?: ReadonlyArray<TriggerSchedule>;
}

// ================================
// Action Core Definitions
// ================================

/**
 * ActionParamsByType using interface declaration
 * Allows external modules to extend Action types via declaration merging (OCP principle)
 */
export interface ActionParamsByType {
  // UI/Build time
  trigger: TriggerParams;
  delay: DelayParams;

  // Page Interaction
  click: ClickParams;
  dblclick: ClickParams;
  fill: FillParams;
  key: KeyParams;
  scroll: ScrollParams;
  drag: DragParams;

  // Synchronization and Validation
  wait: WaitParams;
  assert: AssertParams;

  // Data and Scripts
  extract: ExtractParams;
  script: ScriptParams;
  http: HttpParams;
  screenshot: ScreenshotParams;

  // DOM Utilities
  triggerEvent: TriggerEventParams;
  setAttribute: SetAttributeParams;

  // Frames and Loops
  switchFrame: SwitchFrameParams;
  loopElements: LoopElementsParams;

  // Control Flow
  if: IfParams;
  foreach: ForeachParams;
  while: WhileParams;
  executeFlow: ExecuteFlowParams;

  // Tabs
  navigate: NavigateParams;
  openTab: OpenTabParams;
  switchTab: SwitchTabParams;
  closeTab: CloseTabParams;
  handleDownload: HandleDownloadParams;
}

export type ActionType = keyof ActionParamsByType;

export interface ActionBase<T extends ActionType> {
  id: ActionId;
  type: T;
  name?: string;
  disabled?: boolean;
  tags?: ReadonlyArray<string>;
  policy?: ActionPolicy;
  ui?: { x: number; y: number };
}

export type Action<T extends ActionType = ActionType> = ActionBase<T> & {
  params: ActionParamsByType[T];
};

export type AnyAction = { [T in ActionType]: Action<T> }[ActionType];

export type ExecutableActionType = Exclude<ActionType, 'trigger'>;
export type ExecutableAction<T extends ExecutableActionType = ExecutableActionType> = Action<T>;

// ================================
// Action Outputs
// ================================

export interface HttpResponse {
  url: string;
  status: number;
  headers?: Record<string, string>;
  body?: JsonValue | string | null;
}

export type DownloadState = 'in_progress' | 'complete' | 'interrupted' | 'canceled';

export interface DownloadInfo {
  id: string;
  filename: string;
  url?: string;
  state?: DownloadState;
  size?: number;
}

/**
 * Action Output Type Mapping (Extensible via declaration merging)
 */
export interface ActionOutputsByType {
  screenshot: { base64Data: string };
  extract: { value: JsonValue };
  script: { result: JsonValue };
  http: { response: HttpResponse };
  handleDownload: { download: DownloadInfo };
  loopElements: { elements: string[] };
}

export type ActionOutput<T extends ActionType> = T extends keyof ActionOutputsByType
  ? ActionOutputsByType[T]
  : undefined;

// ================================
// Execution Interface
// ================================

export type ValidationResult = { ok: true } | { ok: false; errors: NonEmptyArray<string> };

/**
 * Execution flags for coordinating with orchestrator policies.
 * Used to avoid duplicate retry/nav-wait when StepRunner owns these policies.
 */
export interface ExecutionFlags {
  /**
   * When true, navigation waiting should be handled by StepRunner.
   * Action handlers (click, navigate) should skip their internal nav-wait logic.
   */
  skipNavWait?: boolean;
}

export interface ActionExecutionContext {
  vars: VariableStore;
  tabId: number;
  frameId?: number;
  runId?: string;
  /** Logging Function */
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  /** Screenshot Function */
  captureScreenshot?: () => Promise<string>;
  /**
   * Optional structured log sink for replay UIs (legacy RunLogger integration).
   * Action handlers may emit richer entries (e.g. selector fallback) via this hook.
   */
  pushLog?: (entry: unknown) => void;
  /**
   * Execution flags provided by the orchestrator.
   * Handlers should respect these flags to avoid duplicating StepRunner policies.
   */
  execution?: ExecutionFlags;
}

export type ControlDirective =
  | {
    kind: 'foreach';
    listVar: VariableName;
    itemVar: VariableName;
    subflowId: SubflowId;
    concurrency?: number;
  }
  | {
    kind: 'while';
    condition: Condition;
    subflowId: SubflowId;
    maxIterations: number;
  };

export interface ActionExecutionResult<T extends ActionType = ActionType> {
  status: 'success' | 'failed' | 'skipped' | 'paused';
  output?: ActionOutput<T>;
  error?: ActionError;
  /** Next edge label (for conditional branching) */
  nextLabel?: EdgeLabel;
  /** Control flow directive (foreach/while) */
  control?: ControlDirective;
  /** Execution duration */
  durationMs?: Milliseconds;
  /**
   * New tab ID after tab operations (openTab/switchTab).
   * Used to update execution context for subsequent steps.
   */
  newTabId?: number;
}

/**
 * Action Handler Interface
 */
export interface ActionHandler<T extends ExecutableActionType = ExecutableActionType> {
  type: T;
  /** Validate action configuration */
  validate?: (action: Action<T>) => ValidationResult;
  /** Execute action */
  run: (ctx: ActionExecutionContext, action: Action<T>) => Promise<ActionExecutionResult<T>>;
  /** Generate action description (for UI display) */
  describe?: (action: Action<T>) => string;
}

// ================================
// Flow Graph Structure
// ================================

export interface ActionEdge {
  id: EdgeId;
  from: ActionId;
  to: ActionId;
  label?: EdgeLabel;
}

export interface FlowBinding {
  type: 'domain' | 'path' | 'url';
  value: string;
}

export interface FlowMeta {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  domain?: string;
  tags?: ReadonlyArray<string>;
  bindings?: ReadonlyArray<FlowBinding>;
  tool?: { category?: string; description?: string };
  exposedOutputs?: ReadonlyArray<{ nodeId: ActionId; as: VariableName }>;
}

export interface Flow {
  id: FlowId;
  name: string;
  description?: string;
  version: number;
  meta: FlowMeta;
  variables?: ReadonlyArray<VariableDefinition>;

  /** DAG Nodes */
  nodes: ReadonlyArray<AnyAction>;
  /** DAG Edges */
  edges: ReadonlyArray<ActionEdge>;
  /** Subflows (for foreach/while/loopElements) */
  subflows?: Record<
    SubflowId,
    { nodes: ReadonlyArray<AnyAction>; edges: ReadonlyArray<ActionEdge> }
  >;
}

// ================================
// Action Specification (for UI)
// ================================

export type ActionCategory = 'Flow' | 'Actions' | 'Logic' | 'Tools' | 'Tabs' | 'Page';

export interface ActionSpecDisplay {
  label: string;
  description?: string;
  category: ActionCategory;
  icon?: string;
  docUrl?: string;
}

export interface ActionSpecPorts {
  inputs: number | 'any';
  outputs: Array<{ label?: EdgeLabel }> | 'any';
  maxConnection?: number;
  allowedInputs?: boolean;
}

export interface ActionSpec<T extends ActionType = ActionType> {
  type: T;
  version: number;
  display: ActionSpecDisplay;
  ports: ActionSpecPorts;
  defaults?: Partial<ActionParamsByType[T]>;
  /** Field paths requiring template substitution */
  refDataKeys?: ReadonlyArray<string>;
}

// ================================
// Constant Exports
// ================================

export const ACTION_TYPES: ReadonlyArray<ActionType> = [
  'trigger',
  'delay',
  'click',
  'dblclick',
  'fill',
  'key',
  'scroll',
  'drag',
  'wait',
  'assert',
  'extract',
  'script',
  'http',
  'screenshot',
  'triggerEvent',
  'setAttribute',
  'switchFrame',
  'loopElements',
  'if',
  'foreach',
  'while',
  'executeFlow',
  'navigate',
  'openTab',
  'switchTab',
  'closeTab',
  'handleDownload',
] as const;

export const EXECUTABLE_ACTION_TYPES: ReadonlyArray<ExecutableActionType> = ACTION_TYPES.filter(
  (t): t is ExecutableActionType => t !== 'trigger',
);
