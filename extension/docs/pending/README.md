# Pending Changes

This directory contains documentation for planned refactorings, deprecations, and code improvements identified during analysis. These changes are intended to be applied sequentially to ensure codebase stability.

## Approach

1. **Identification**: During code analysis, if a systemic issue or cleanup opportunity is found, a dedicated markdown file is created here.
2. **Detailing**: Each file contains specific file paths, code snippets, and the rationale for the change to avoid redundant research in the future.
3. **Execution**: Changes should be applied one by one, verifying the build and functionality after each step.
4. **Completion**: Once a change is fully implemented and verified, its corresponding documentation file should be moved to an `applied` folder or deleted.

## Current Pending Changes

- [Deprecate SendMessageType](./deprecate-send-message-type.md): Cleanup of legacy message type enum.
- [Refactor i18n Utility](./refactor-i18n-utility.md): Convert `i18n.ts` to a thin wrapper and remove duplicate strings.
