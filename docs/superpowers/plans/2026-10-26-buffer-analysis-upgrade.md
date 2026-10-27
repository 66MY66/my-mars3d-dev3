# Buffer Analysis Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade buffer analysis to support point, line and polygon inputs, selectable units, single/multi-ring output, quick distances, live source linkage, preview, and explicit clearing.

**Architecture:** Use GeoJSON-compatible analysis targets and Turf for geometry-correct buffering. Keep UI state in the existing Vue widget, map rendering and source-event binding in `map.ts`, and context extraction in the right-click menu adapter.

**Tech Stack:** Vue 3, TypeScript, Mars3D, Turf, Vitest

**Spec:** User requirements in the active task and the previously accepted optimization proposal.

## Global Constraints

- Do not add dependencies.
- Preserve existing overlay and neighbor polygon behavior.
- Internal distance values are meters; UI may display meters or kilometers.
- Preview updates are debounced and stale async results must not replace newer results.

## Review Focus

- Point, line, polygon, Polygon and MultiPolygon buffer geometry.
- Unit switching preserves physical distance.
- Disabled multi-ring levels do not create zero-radius features.
- Source edits update preview and source removal clears the result.
- Preview races cannot render stale results.

---

### Task 1: Geometry and parameter model

**Files:**
- Modify: `src/api/spatialAnalysis.ts`
- Modify: `src/api/spatialAnalysis.test.ts`
- Create: `src/widgets/basic/analysis-tool/buffer-model.ts`
- Create: `src/widgets/basic/analysis-tool/buffer-model.test.ts`

**Interfaces:**
- Produces `AnalysisTarget`, `buildBufferRequestParams`, and geometry-correct `runBufferAnalysis` output.

- [ ] Write failing tests for point/line/polygon geometry, unit conversion, single/multi mode and selected rings.
- [ ] Run tests and confirm failures describe missing behavior.
- [ ] Implement the model and Turf-backed buffer generation.
- [ ] Run tests and confirm they pass.

### Task 2: Map selection, rendering and source linkage

**Files:**
- Modify: `src/widgets/basic/analysis-tool/map.ts`
- Modify: `src/utils/contextmenu/context-menu.ts`

**Interfaces:**
- Consumes the Task 1 `AnalysisTarget` contract.
- Produces point/line/polygon drawing, MultiPolygon rendering, and source edit/remove subscriptions.

- [ ] Add target extraction coverage through pure geometry helpers where practical.
- [ ] Implement selection and rendering for all geometry types.
- [ ] Pass the actual source graphic from the right-click entry and subscribe to edit/remove events.
- [ ] Verify relevant tests and type checking.

### Task 3: Buffer workflow UI

**Files:**
- Modify: `src/widgets/basic/analysis-tool/index.vue`

**Interfaces:**
- Consumes Task 1 parameter builder and Task 2 map bindings.

- [ ] Add point/line/polygon selection, single/multi switch, meter/kilometer selector, editable ring distances, quick presets, and explicit preview/result clearing.
- [ ] Debounce previews with request tokens and update from source geometry callbacks.
- [ ] Run lint, type checking, focused tests and browser verification.

### Task 4: Visible and stable analysis results

**Files:**
- Modify: `src/api/spatialAnalysis.ts`
- Modify: `src/api/spatialAnalysis.test.ts`
- Modify: `src/widgets/basic/analysis-tool/buffer-model.ts`
- Modify: `src/widgets/basic/analysis-tool/buffer-model.test.ts`
- Modify: `src/widgets/basic/analysis-tool/index.vue`
- Modify: `src/widgets/basic/analysis-tool/map.ts`

**Interfaces:**
- Produces `createBufferRunCoordinator`, `buildBufferResultView`, `summary.ringStats`, and `flyToAnalysisResult`.

- [x] Add failing tests for formal-analysis/preview arbitration and visible result models.
- [x] Add per-ring range and area statistics for single- and multi-ring results.
- [x] Prevent delayed previews from invalidating a formal analysis.
- [x] Open the result step immediately and focus the map on the rendered buffer.
- [x] Present key metric cards, ring rows, legend, exports, and data-availability guidance.
