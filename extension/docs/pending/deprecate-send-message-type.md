# Pending Change: Deprecate `SendMessageType`

## Overview
The `SendMessageType` enum in `extension/common/message-types.ts` is a legacy artifact. All core functionality has migrated to more granular objects like `BACKGROUND_MESSAGE_TYPES`, `OFFSCREEN_MESSAGE_TYPES`, and `TOOL_MESSAGE_TYPES`.

## Rationale
- **Redundancy**: Most values in `SendMessageType` (e.g., `ScreenshotPreparePageForCapture`) are identical to strings in `TOOL_MESSAGE_TYPES`.
- **Inconsistency**: In `extension/entrypoints/offscreen/main.ts`, the switch statement uses both `SendMessageType` and `OFFSCREEN_MESSAGE_TYPES`, which is confusing and error-prone.
- **Type Safety**: The new objects are defined as `as const` and used with type unions, providing better type safety than the old enum.

## Affected Files
1.  **`extension/common/message-types.ts`**
    - Targeted line: ~187 (`export enum SendMessageType`)
    - Action: Add `@deprecated` JSDoc tag and prepare for eventual removal.
2.  **`extension/entrypoints/offscreen/main.ts`**
    - Imports `SendMessageType`.
    - Uses `SendMessageType.SimilarityEngineInit` and `SendMessageType.SimilarityEngineComputeBatch`.
    - Action: Replace usage with `OFFSCREEN_MESSAGE_TYPES`.

## Implementation Steps
1.  Add `@deprecated` to `SendMessageType` in `extension/common/message-types.ts`.
2.  Add `SIMILARITY_ENGINE_COMPUTE_BATCH: 'similarityEngineComputeBatch'` to `OFFSCREEN_MESSAGE_TYPES` (as it is currently missing from that specific object but used in the handler).
3.  Update `extension/entrypoints/offscreen/main.ts` to remove all references to `SendMessageType`.
4.  Remove `SendMessageType` import and definition once no usages remain.

## Detected Bug to Fix During This Refactor
`SemanticSimilarityEngineProxy.computeSimilarityBatch` (in `utils/semantic-similarity-engine.ts`) sends `OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE` but with a `pairs` payload. However, the offscreen handler in `main.ts` for that type expects `texts`. This needs to be unified.
