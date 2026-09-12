# Sync Motion Fixes to Contest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the contest branch contains the current steady-60 breathing and Rhythm Boxing centering/smoothness fixes, then publish and validate a fresh release RPK.

**Architecture:** Treat the root `main` checkout as the starting point for the reviewed UI fixes and `codex/contest-compliance` as the contest submission workspace. Preserve the target branch's contest-specific packaging and compliance files, then harden the animations for the AIOTJS device runtime with JS-driven phase classes before publishing the exact generated release RPK to the root `artifacts/` directory.

**Tech Stack:** openvela Quick App `.ux`, Node.js 24, AIoT Toolkit 2.0.5, Node test runner scripts.

**Spec:** User request dated 2026-09-12 in the current Codex task.

## Global Constraints

- Do not alter or clean the dirty `main` checkout.
- Target branch is `codex/contest-compliance` in its existing linked worktree.
- The committed submission artifact must be a freshly generated non-empty release RPK, not a debug package.
- Report simulator/device visual checks as manual unless actually performed.

---

### Task 1: Verify and synchronize the UI fixes

**Files:**
- Source: `src/pages/index/components/breathing.ux`
- Source: `src/pages/index/components/boxing.ux`
- Source: `test/component-contract.test.js`
- Target: `quickapp/wrist-rhythm/src/pages/index/components/breathing.ux`
- Target: `quickapp/wrist-rhythm/src/pages/index/components/boxing.ux`
- Target: `quickapp/wrist-rhythm/src/pages/index/steady.js`
- Target: `quickapp/wrist-rhythm/src/pages/index/boxing.js`
- Target: `quickapp/wrist-rhythm/src/pages/index/index.ux`
- Target: `quickapp/wrist-rhythm/test/component-contract.test.js`
- Target: `quickapp/wrist-rhythm/test/steady.test.js`

**Interfaces:**
- Consumes: reviewed working-tree implementations and component contracts.
- Produces: contest quick-app sources with equivalent behavior and a device-runtime-compatible motion implementation.

- [x] **Step 1: Compare source and target while ignoring line-ending differences**

Run `git diff --no-index --ignore-space-at-eol` for each source/target pair.

Expected: preserve the reviewed layout while replacing device-rejected CSS keyframes with testable JS-driven visual phases where simulator evidence requires it.

- [x] **Step 2: Run the component contract test**

Run: `node test/component-contract.test.js`

Expected: breathing and boxing contracts pass, including a fixed core on regular/compact/short layouts, visible ring scale/opacity range, full-screen fighter centering, short-viewport pixel geometry, and phase transitions short enough to complete within each JS motion window.

### Task 2: Build and publish the release RPK

**Files:**
- Generated: `quickapp/wrist-rhythm/dist/com.openvela.wristrhythm.release.1.0.0.rpk`
- Modify: `artifacts/com.openvela.wristrhythm.release.1.0.0.rpk`
- Modify: `artifacts/README.md`

**Interfaces:**
- Consumes: synchronized quick-app source and the repository's controlled release runner.
- Produces: the exact release package submitted for review plus its byte size and SHA-256 record.

- [x] **Step 1: Build the production package**

Run: `npm run build:release`

Expected: exit code 0; JSC, CSS attribute optimization, PNG8, and console removal are enabled; the expected release RPK is freshly generated.

- [x] **Step 2: Publish the generated package**

Copy the generated RPK to `artifacts/com.openvela.wristrhythm.release.1.0.0.rpk`, then calculate its byte size and SHA-256.

- [x] **Step 3: Update release provenance**

Replace the recorded byte size and SHA-256 in `artifacts/README.md` with the freshly calculated literals.

### Task 3: Run the contest submission gate

**Files:**
- Verify: `scripts/verify-contest-submission.js`
- Verify: `test/contest-compliance.test.js`

**Interfaces:**
- Consumes: the complete contest tree and published artifact.
- Produces: fresh evidence for code contracts, release validity, logs, licensing, manifest mapping, skill metadata, and repository hygiene.

- [x] **Step 1: Run the full quick-app test suite**

Run: `npm test`

Expected: all steady, runtime, lifecycle, component, release-runner, and contest-compliance tests pass.

- [x] **Step 2: Run the submission validator directly**

Run: `node scripts/verify-contest-submission.js .` from the contest repository root.

Expected: `Contest submission contract: PASS`; presentation/video warnings may remain and must be reported as manual confirmations.

- [x] **Step 3: Verify repository and artifact state**

Run `git diff --check`, inspect `git status --short`, verify the generated and submitted RPK hashes match, and list the final changed files.

Expected: no whitespace errors, identical release hashes, and no unrelated changes.
