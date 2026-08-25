# Contributing to SkillCard

Thanks for your interest. This document covers how to get a working environment, the
conventions the codebase follows, and how changes get merged.

## Getting set up

```bash
git clone https://github.com/arnavsharmaa/SkillCard.git
cd SkillCard
cp .env.example .env        # optional: add OPENAI_API_KEY for live reasoning
nvm use                     # Node 22 (see .nvmrc); Node >=22.13 is supported
npm run install:all
npm run dev                 # API on :3001, client on :5173
```

Run the test suite before opening a pull request:

```bash
npm test
```

The suite boots the server on a scratch port with `RUN_STUBBED=1`, so it needs no API key
and is fully deterministic. It should finish in under a few seconds.

## Project layout

| Path | What lives there |
|---|---|
| `server/loop.js` | The stage loop and the **deterministic policy engine**. Governance rules go here. |
| `server/openai.js` | The two model calls. Both must stay strict-JSON and fall back on any error. |
| `server/seed.js` | Robots, tasks, and the skill marketplace. |
| `server/store.js` | File-backed persistence. |
| `client/src/views/` | One file per top-level view (Live Run, Marketplace, Receipts, Review, Fleet). |
| `client/src/components/` | Shared UI. |
| `client/src/api.js` | All server calls plus the spend-alert and anomaly helpers. |
| `test/` | End-to-end smoke suite (`node --test`). |

## Ground rules for changes

- **Policy is code, not prompts.** Anything that decides whether money moves belongs in
  `applyPolicy` / `server/loop.js`, never in a model prompt. The model explains; it does not
  authorize.
- **Never surface a raw error.** Model calls and network paths must degrade to a
  deterministic fallback. If you add a new external call, wrap it.
- **Keep the loop deterministic under `RUN_STUBBED=1`.** The test suite depends on it.
- **Add a test for new governance behavior.** A new block/flag/override rule should come
  with an assertion in `test/smoke.test.js`.
- Match the surrounding style (2-space indent, no semicolon-free style changes, Tailwind
  utility classes in JSX). `.editorconfig` is provided.

## Commit messages

Use a short conventional prefix so history is scannable:

```
feat: …      new user-facing capability
fix: …       bug fix
refactor: …  no behavior change
test: …      tests only
docs: …      documentation only
chore: …     tooling, deps, config
ci: …        workflow changes
```

Keep the subject under ~72 characters; put rationale in the body when it isn't obvious
from the diff.

## Pull requests

1. Branch from `main`.
2. Make sure `npm test` and `npm run build` pass locally — CI runs both on Node 22/24.
3. Fill in the PR template. Link an issue if one exists.
4. One logical change per PR. Large features are easier to review as a short series.

## Reporting bugs and requesting features

Open an issue using the provided templates. For security problems, **do not** open a
public issue — see [SECURITY.md](SECURITY.md).
