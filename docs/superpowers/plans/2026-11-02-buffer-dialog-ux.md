# Buffer Dialog UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the buffer-analysis popup while preserving explicit single-ring radius input and multi-ring distance input.

**Architecture:** Keep the existing Turf/API request contract and map rendering. Add pure presentation/validation helpers to `buffer-model.ts`, consume them from the existing Vue workflow, and refine the existing scoped styles without introducing dependencies.

**Tech Stack:** Vue 3, TypeScript, Mars3D, Turf, Vitest

**Spec:** Approved user direction in the 2026-11-02 task: retain the single/multi selector, single-ring radius, and multi-ring distance values while applying the proposed popup and visual improvements.

## Global Constraints

- Preserve both `single` and `multi` modes.
- Single mode must expose one editable ring radius.
- Multi mode must expose editable enabled ring distances.
- Do not fabricate population, building, or earthquake counts when those data layers are unavailable.
- Do not add dependencies or change the backend request contract.

## Review Focus

- Switching modes must not discard the values of the other mode.
- Multi-ring values must remain sorted/normalized only in the request, not unexpectedly rewrite user inputs.
- Invalid, duplicate, or non-increasing enabled distances must produce visible guidance.
- Preview and formal analysis arbitration must remain intact.
- Existing point, line, and polygon targets must remain supported.

---

### Task 1: Buffer input guidance model

**Files:**
- Modify: `src/widgets/basic/analysis-tool/buffer-model.ts`
- Test: `src/widgets/basic/analysis-tool/buffer-model.test.ts`

**Interfaces:**
- Produces: `getBufferInputState(input: BufferModelInput)` with validity, message, selected distances, and range rows.

- [ ] Write failing tests for single radius guidance and multi-ring duplicate/non-increasing guidance.
- [ ] Run focused tests and confirm expected failure.
- [ ] Implement the minimal pure helper.
- [ ] Run focused tests and confirm pass.

### Task 2: Popup information hierarchy and controls

**Files:**
- Modify: `src/widgets/basic/analysis-tool/index.vue`

**Interfaces:**
- Consumes: `getBufferInputState` from Task 1.
- Preserves: `buildBufferRequestParams`, preview flow, formal analysis, exports, and templates.

- [ ] Add an explicit mode switch card with descriptions for single and multi modes.
- [ ] Label single input as ring radius and multi inputs as outer distances with calculated interval previews.
- [ ] Show validation/guidance text and disable preview/analysis for invalid inputs.
- [ ] Clarify that geometric distance buffers are not hazard-model simulations.
- [ ] Refine scoped styles for hierarchy, spacing, ring colors, and responsive layout.

### Task 3: Verification

**Files:**
- Verify only; no production file ownership.

- [ ] Run focused buffer-model and spatial-analysis tests.
- [ ] Run Vue type checking without autofix.
- [ ] Inspect the final diff for unrelated edits.

