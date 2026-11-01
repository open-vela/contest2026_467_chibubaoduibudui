# Training Boundary Fixes Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans and test-driven-development; one final independent review.

**Goal:** Fix review findings F1, F2, F4 as authorized by the user on 2026-10-26.

**Architecture:** Keep the existing page state machine and foreground clocks. Give completed boxing rounds precedence over terminal sensor callbacks; share target synchronization between timer and punch paths; use a natural-breathing tail when another full breathing cycle cannot fit.

**Tech Stack:** Vela UX / JavaScript, existing Node page harness and AIoT build runner.

**Spec:** `output/review-vulnerabilities-20261026/review.md`, findings F1/F2/F4 and the user's request to modify these three issues. Implementation choices are recorded here; the user has already authorized these fixes.

## Global Constraints

- Preserve 60-second breathing, 30-second boxing, 4.5 movement threshold, 350ms debounce, 100/70/40 scoring, heart-rate beat mapping, fighter preferences, sensor readiness and independent health-result validity.
- Preserve untracked history and old outputs; use current `codex/training-session-integrity` checkout, whose tracked files are clean at `76964f0`.
- F3 (last boxing target window) and F5 (foreground overdue-target replay) are outside this change. Do not widen the early-hit window or add dependencies.
- Keep Release free of `--optimize-css-attr`; back up existing dist before building. A subsequent user instruction authorizes committing these fixes and fast-forwarding local main; remote push and PR remain outside scope.

## Review Focus

- Error/invalid/tick/hide permutations at and after the deadline must produce one completed result and one resource cleanup; before the deadline errors still interrupt.
- Target-boundary punches must preserve score and combo regardless of timer/sensor ordering, without bypassing debounce or scoring a target twice.
- Heart-rate tempo and resumed effective time must drive the same target schedule in both callback paths.
- Standard/calming/bidirectional switches must not start an incomplete final inhale; complete cycles that fit exactly must remain unchanged.
- Natural-breathing tail must freeze in background, retain health end-window comparison and finish at exactly 60 foreground seconds.

## Tasks

### 1. Completion precedence (F1)

- [x] Add callback-driven deadline/order tests and pre-deadline failure controls to `test/page-health.test.js`; verify RED.
- [x] In `index.ux::handleMotionUnavailable`, complete an already-finished running round before failure handling; verify the page and full suites GREEN.

### 2. Timer-independent punch scoring (F2)

- [x] Add callback-order tests at exact target and scoring boundaries, consecutive targets and resume; verify RED.
- [x] Extract current target progression to `index.ux::syncBoxingTarget(now, elapsed)` and invoke it from timer and punch paths; preserve all existing scheduling rules; verify page and full suites GREEN.

### 3. Breathing tail (F4)

- [x] Add complete-cycle, mixed-pattern and paused-tail page scenarios; verify RED.
- [x] For a final remainder shorter than the selected full cycle, show `自然呼吸` / `收尾放松`, a neutral still frame and the original countdown; verify page and full suites GREEN.

### 4. Delivery validation

- [x] Review the complete diff with a fresh reviewer and address material regressions using failing tests first.
- [x] Back up existing dist; run Debug then Release builds serially; preserve logs and copy final artifacts with SHA-256.
- [x] Check source diff, update the execution record, and report exact checks and remaining F3/F5 scope. Do not claim simulator or device validation.
