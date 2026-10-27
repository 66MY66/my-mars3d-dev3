# Imports Proxy and Undo Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route import-session APIs to port 5960 and prevent a failed backend undo from being reported as successful.

**Architecture:** Add specific `/api/eoapi/imports` rules before the generic STAC proxy in both development and deployment configurations. Validate the API response before restoring the local map snapshot.

**Tech Stack:** Vue 3, TypeScript, Vite, Nginx, Vitest.

**Spec:** User request in this task.

## Global Constraints

- Preserve all unrelated working-tree changes.
- Do not change service ports other than routing `imports` to existing port 5960.
- Keep STAC requests on port 5951.

## Review Focus

- Specific proxy rule must precede the generic `/api/eoapi` rule.
- Both Vite and Nginx must route imports consistently.
- A `{ success: false }` response must not continue into local snapshot restoration.

---

### Task 1: Proxy routing contract

**Files:**
- Modify: `vite.config.ts`
- Modify: `nginx.conf`
- Create: `src/config/imports-proxy.test.ts`

- [ ] Write and run a failing configuration contract test.
- [ ] Add the two specific proxy rules targeting `192.168.10.15:5960`.
- [ ] Run the contract test and confirm it passes.

### Task 2: Undo response validation

**Files:**
- Modify: `src/widgets/basic/dataset-repository/components/DatasetDetail.vue`
- Create: `src/widgets/basic/dataset-repository/services/import-session-result.ts`
- Create: `src/widgets/basic/dataset-repository/services/import-session-result.test.ts`

- [ ] Write and run failing tests for successful and failed API responses.
- [ ] Implement response validation and use it before restoring the snapshot.
- [ ] Run focused tests and the relevant workspace tests.

