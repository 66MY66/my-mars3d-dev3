# Thematic Job Draft Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add task-level draft loading and saving for the thematic workbench without overwriting submitted jobs or changing backend protocols.

**Architecture:** Pass an optional `jobId` from the dataset detail entry into the workbench. Store draft cartography state locally under a dataset/job-scoped key, initialize the workbench from the submitted task plus draft, and expose an explicit save-draft action. Keep `ThematicJobs` responsible for task lookup and creation; keep draft persistence client-side.

**Tech Stack:** Vue 3, TypeScript, Vitest, existing `cartography-state` and thematic job services.

**Spec:** `C:\Users\meiyan\Desktop\【专题制图、=】弹窗合并方案.docx`

## Global Constraints

- Do not replace the dataset repository or backend API contracts.
- Do not overwrite submitted thematic jobs; drafts are client-side only.
- Keep ordinary dataset browsing, import, file management, and layer management unchanged.
- Keep existing Vue, Mars3D, Cesium, Vite, and lockfile versions unchanged.

## Review Focus

- Opening a dataset with no selected job must preserve current behavior.
- A missing or malformed draft must fall back to task parameters and then defaults.
- Switching jobs must not reuse the previous job's draft.
- Saving a draft must not call task creation, publish, or archive APIs.
- Clearing a draft must restore the task/default state on the next open.

### Task 1: Define task draft persistence

**Files:**
- Create: `src/widgets/basic/thematic-workbench/thematic-job-draft.ts`
- Test: `src/widgets/basic/thematic-workbench/thematic-job-draft.test.ts`

**Interfaces:**
- `loadThematicJobDraft(datasetId: string, jobId: string): CartographySnapshot | null`
- `saveThematicJobDraft(datasetId: string, jobId: string, snapshot: CartographySnapshot): void`
- `clearThematicJobDraft(datasetId: string, jobId: string): void`

- [ ] Write failing tests for scoped keys, malformed data fallback, save/load round-trip, and clear.
- [ ] Run the focused test and verify the expected failures.
- [ ] Implement the minimal localStorage-backed helpers with versioned JSON.
- [ ] Run the focused test and verify it passes.

### Task 2: Add task context and draft controls to the workbench

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/index.vue`
- Test: `src/widgets/basic/thematic-workbench/thematic-job-draft.test.ts`

**Interfaces:**
- Workbench props gain optional `jobId` and task cartography input.
- Workbench exposes draft save/clear behavior through the existing UI state.

- [ ] Add failing tests for initialization precedence: draft, task parameters, defaults; and for save/clear isolation by job.
- [ ] Run the focused tests and verify they fail for the missing behavior.
- [ ] Implement task context watching and explicit save/clear draft actions without invoking backend mutation APIs.
- [ ] Run focused tests and verify they pass.

### Task 3: Pass selected task context from dataset detail

**Files:**
- Modify: `src/widgets/basic/dataset-repository/components/DatasetDetail.vue`
- Modify: `src/widgets/basic/dataset-repository/components/ThematicJobs.vue`
- Test: existing `ThematicJobs.test.ts` plus a focused DatasetDetail/workbench integration test if the existing harness supports it.

- [ ] Add a failing assertion that the workbench entry carries the selected `jobId` while retaining `datasetId`.
- [ ] Run the focused test and verify failure.
- [ ] Implement the smallest entry-state addition; do not alter ordinary dataset navigation.
- [ ] Run focused tests and verify pass.

### Task 4: Verify the phase 4 boundary

- [ ] Run the thematic job, dataset, and draft tests.
- [ ] Run TypeScript checking without dependency installation.
- [ ] Inspect the diff for backend, package, router, and ordinary dataset changes.
- [ ] Report remaining gaps before starting real analysis or publish work.
