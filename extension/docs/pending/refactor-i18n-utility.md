# Pending Change: Refactor i18n into a Thin Wrapper

## Overview
Currently, `extension/utils/i18n.ts` contains a 200-line `fallbackMessages` object that duplicates every string in `_locales/en/messages.json`. This causes a heavy maintenance burden and has already led to "dead wood" (legacy keys).

## Rationale
- **Single Source of Truth**: All strings should live ONLY in `_locales/en/messages.json`.
- **Maintenance**: Adding a new string currently requires manual duplication in two files.
- **Developer Experience**: A thin wrapper still provides the convenience of a short function name (`getMessage`) while removing the risk of out-of-sync strings.
- **Environment Safety**: The wrapper will still protect against crashes in non-extension environments (like tests).

## Proposed New Implementation
The new implementation will look like this:

```typescript
export function getMessage(key: string, substitutions?: string[]): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) return message;
    }
  } catch (error) {
    console.warn(`i18n error for "${key}":`, error);
  }

  // Fallback: If in Dev mode or missing key, return the key itself
  // This makes missing translations obvious in the UI during dev.
  return `[${key}]`;
}
```

## Affected Files
1.  **`extension/utils/i18n.ts`**
    - Action: Delete the entire `fallbackMessages` object.
    - Action: Simplify `getMessage` to the logic shown above.
2.  **`extension/docs/pending/cleanup-legacy-i18n-keys.md`**
    - Action: Delete this file after the refactor because it is superseded by the full removal of fallbacks.

## Implementation Steps
1.  Verify that no critical business logic depends on specific fallback strings being present in non-Chrome environments.
2.  Refactor `utils/i18n.ts` to remove the hardcoded records.
3.  Add a development-mode check to `getMessage` to highlight missing keys more aggressively (e.g., `!!MISSING_KEY!!`).
