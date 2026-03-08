# Refactoring Backlog

This file tracks cleanup work that is larger than a safe one-pass edit. Items below were identified during a repository-wide review on 2026-03-08.

## Done in this pass

- Replaced repeated secret-key lookup logic with `getSecretStorageKey()` in host code.
- Removed unused host-to-webview message variants and dead UI branches.
- Replaced a couple of unnecessary `innerHTML` writes with safer DOM updates.
- Removed a stale `npm run compile` reference from `CONTRIBUTING.md`.

## Next steps

### 1. Webview message routing simplification

Current state:
- `src/webview/ui/main.ts` has long `if / else if` chains per section.
- Message routing logic is correct but repetitive and easy to drift.

Planned change:
- Introduce per-section handler maps keyed by `msg.event`.
- Keep message typing narrow so unsupported events fail at compile time where possible.

Expected benefit:
- Less branching noise.
- Easier feature additions and lower regression risk.

### 2. Test fixture typing cleanup

Current state:
- Tests rely heavily on `as any` for VS Code mocks and agent stubs.
- This is acceptable for speed, but it hides broken assumptions in refactors.

Planned change:
- Add typed helper factories under `test/unit/helpers/`.
- Replace broad `any` casts with `Partial<T>` + narrow adapters for common mock shapes.

Expected benefit:
- Better refactor safety.
- Cleaner tests with less repeated mock boilerplate.

### 3. Document set rationalization

Current state:
- `docs/` contains multiple point-in-time review files:
  `CODEREVIEW.md`, `CODEREVIEW_1.md`, `CODEREVIEW_2.md`, `CODEREVIEW_3.md`, `CODEREVIEW_4.md`, `CODEREVIEW_ux1.md`.
- They are useful as history, but they add maintenance noise and make the current source of truth unclear.

Planned change:
- Keep one current review summary.
- Move older reports into an `docs/archive/` folder or merge them into a compact historical index.

Expected benefit:
- Lower documentation clutter.
- Clearer maintenance path for new contributors.

### 4. Repository metadata consistency audit

Current state:
- Repository, homepage, and issue-tracker links in `package.json` do not fully align.
- README messaging also mixes "production-ready" and "experimental prototype".

Planned change:
- Align all package metadata to one canonical repository.
- Decide whether the product is still preview/beta or ready for stable positioning, then update README copy accordingly.

Expected benefit:
- Better trust at release time.
- Fewer avoidable support and marketplace issues.
