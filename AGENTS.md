# Hydro (hydrooj) — Agent Guide

Hydro is a high-performance online judge (OJ) system. TypeScript monorepo, Yarn 4 workspaces, MongoDB backend. Licensed AGPL-3.0 with additional terms (see README-EN.md); external contributions require signing a CLA (`CLA.md`, enforced by CI).

## Layout

- `packages/hydrooj/` — the core app (`hydrooj` on npm). Layers: `src/service` (DI services), `src/model` (DB layer), `src/handler` (HTTP/URI handlers), `src/commands`, `src/script`, `src/loader.ts` (plugin loader), `src/context.ts`.
- `packages/common/` — `@hydrooj/common`: shared types, permissions, status, problem cases.
- `packages/ui-default/` — legacy frontend (jQuery + webpack, `.page.tsx` entry points, built via `yarn build:ui`).
- `packages/ui-next/` — new React + Vite frontend (`yarn build:ui-next`).
- `packages/hydrojudge/` — judge daemon; `vendor/testlib` is a git submodule (`git submodule update --init` if needed).
- Other `packages/*` — optional plugins (vjudge, blog, center, import-* …). All features ship as plugins loaded by the core.
- `framework/` — `@hydrooj/framework` (cordis-style service framework), `@hydrooj/register` (esbuild require hook: run `.ts` directly with `node -r @hydrooj/register`), `@hydrooj/eslint-config`.
- `test/` — e2e tests (`test/entry.js` boots the app against mongodb-memory-server). Unit specs live next to code as `*.spec.ts` using `node:test`.

## Commands

```
yarn                 # install (postinstall runs build/prepare.js)
yarn build           # node build/prepare.js && tsc -b  (typecheck+emit to .cache/ts-out)
yarn test            # unit specs + e2e suite (needs Node >= 18.8; downloads mongodb-memory-server)
node -r @hydrooj/register packages/common/tests/subtask.spec.ts   # run one spec file
yarn lint            # eslint --fix over packages/plugins/modules/framework
yarn oxlint          # fast lint via oxlint
yarn start           # run hydrooj (packages/hydrooj/bin/hydrooj.js)
yarn debug           # run with --debug --template
yarn build:ui        # build legacy UI; yarn build:ui:dev for dev server
```

Gotcha: root `tsconfig*.json` files are **generated** by `build/prepare.js` — after adding/moving a workspace package, re-run `node build/prepare.js` (or `yarn build`), don't hand-edit them.

## Conventions

- Indent: 4 spaces in backend TS; 2 spaces in `ui-default` / `ui-next` / `frontend` files (eslint enforces per-file overrides). Follow the surrounding file.
- Imports are sorted by `simple-import-sort`: side-effect → node builtins → third-party → `@hydrooj`/`hydrooj` → root-relative → `./`. UI files also group `vj/` aliases. Run `yarn lint` to normalize.
- Typecheck is not fully `strict` (`strict: false`, `strictBindCallApply: true` at tsconfig base) — don't assume type errors elsewhere are safe to fix wholesale in one PR.
- Commit messages: scoped prefixes in the style `feat: …`, `ui: …`, `core: …`, `core&ui: …`, `problem: …`. Keep changes minimal. Per CONTRIBUTING.md: never add AI agents/assistants as commit co-authors (mentions in PR description are fine); auto-submissions are rejected.
- i18n: user-facing strings go through backend `_()` (templates) / `i18n()` (code) / frontend `substitute(i18n(...), …)`. Translations live in `packages/*/locale/<lang_id>.yml` per package (never mixed), keys sorted alphabetically, file names like `ko_KR.yml` (underscore). Fallback: `ko_KR` → `ko` → `en` → key. Only native-speaker translations accepted; no machine translation.
- Plugins/monorepo workspaces listed in root `package.json` (`plugins/*`, `modules/*`) may be absent in a fresh clone; they exist in downstream/plugin repos.

## Before touching sensitive areas

- Service/DI: read `packages/hydrooj/src/context.ts` and `framework/framework/` — services declare `static inject`, and handlers/commands are registered through the `@hydrooj/framework` decorators.
- Permission changes: `packages/hydrooj/src/permission`-related code in `packages/common/permission.ts` and `PRIV` in `model/builtin.ts`; the permission system is fine-grained per domain.
- Judge changes: `packages/hydrojudge/` — check the docs at https://docs.hydro.ac / https://hydro.js.org first.
- Dev environment: repo targets nix (`.envrc` → `use flake`) and Linux; `.devcontainer/` provides a preset. On Windows, most yarn scripts work but UI builds and judge tests are Linux-oriented.
