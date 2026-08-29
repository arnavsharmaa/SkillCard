# Security Policy

## Supported versions

SkillCard is pre-1.0. Only the latest commit on `main` is supported.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately to **arnsharma401@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the commit or version affected.

You can expect an acknowledgement within a few days. Once a fix is available it will be
released on `main` and the reporter credited (unless they prefer otherwise).

## Scope notes

- SkillCard ships with **no authentication** and is intended to run locally or behind your
  own access controls. Exposing the API to an untrusted network is outside the supported
  threat model. Defense-in-depth that is in place: a CORS allowlist (`CORS_ORIGIN`),
  a 10 kB JSON body cap, per-IP rate limiting (`RATE_LIMIT_RPM`, default 300/min), and
  JSON-only error responses.
- The `OPENAI_API_KEY` lives only in your local `.env`, which is gitignored. Never commit it.
- All payments and settlements are **simulated**. There is no integration with real card or
  payout rails, so no financial credentials are handled by this codebase.
