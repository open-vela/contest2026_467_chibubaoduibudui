---
name: verifying-openvela-watch-submission
description: Use when auditing or preparing an openvela watch quick app for the 2026 contest, especially before packaging, recording a demo, or merging the final submission PR.
---

# Verifying an openvela watch submission

Turn contest requirements into reproducible evidence. Treat the official `dev-ai-contest-2026` documentation as authoritative when it conflicts with repository notes.

## Workflow

1. Run `node scripts/verify-contest-submission.js` from the team repository root. Fix every `ERROR`; report each `WARN` as an external-delivery item or add the missing material.
2. Enter the quick-app directory named by `contest2026_*.xml`. Run `npm ci`, `npm test`, and `npm run build:release`.
3. Confirm the release artifact name matches `<manifest.package>.release.<manifest.versionName>.rpk`, is non-empty, and contains `manifest.json`, `META-INF/CERT`, and compiled `.jsc` files.
4. Copy only the reviewed release RPK to `artifacts/`. Record its byte size, SHA-256, toolkit version, build command, and signing purpose in `artifacts/README.md`.
5. Validate AI logs with the organizer-provided `validate-log.py`. Never edit JSONL events; remove an unwanted session as a whole before committing.
6. Reproduce the README instructions from a clean checkout and run the simulator acceptance matrix before the final PR.

## Required evidence

| Requirement | Evidence |
| --- | --- |
| Based on openvela | Contest manifest maps the quick app into `packages/apps`; the app declares and uses openvela features |
| Runnable submission | Source project plus production-mode release RPK |
| AI Coding | Validated `logs/` sessions plus at least one reusable Skill |
| Original and open source | Apache-2.0 `LICENSE` and third-party provenance |
| Complete delivery | README, presentation document, demo video no longer than five minutes, and repository URL |

## Safety rules

- Never commit `sign/`, `private.pem`, tokens, credentials, local caches, `node_modules/`, or ordinary `build/` and `dist/` directories.
- Do not relabel a debug package as release. A release artifact must be produced by the production build.
- Do not claim simulator or device validation from unit tests alone.
- Keep health messaging non-diagnostic and avoid efficacy claims based on a single reading.

## Common mistakes

- Keeping only `debug.rpk` in `artifacts/`.
- Listing a build command that a clean checkout cannot run.
- Treating screenshots as a substitute for the required presentation document or demo video.
- Updating code without syncing the current AI session logs before the deadline.
