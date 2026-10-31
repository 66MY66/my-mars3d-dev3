# Population and GDP Grid Density Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace estimated population/economy card data with real COG grid statistics selected by a 40% cell-coverage threshold.

**Architecture:** A focused grid-statistics module reads only the native COG window intersecting the drawn polygon, applies deterministic per-cell coverage selection, converts density to totals using geodesic cell area, and emits histogram rows. The map component owns request cancellation/state and temporary same-source imagery overlays.

**Tech Stack:** Vue 3, TypeScript, GeoTIFF.js, Turf, Mars3D/Cesium, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-grid-density-statistics-design.md`

## Global Constraints

- Coverage threshold is exactly `0.40`, inclusive.
- Selected boundary cells count as full cells.
- Nodata `-9999` is excluded.
- Density sums are never presented as population or GDP totals.
- Existing user worktree changes must be preserved.

## Review Focus

- A cell at exactly 40% is included; a cell below 40% is excluded.
- Concave polygons and rectangles produce deterministic selections.
- Nodata and zero-density cells are handled separately.
- Requests outside raster bounds return an empty result without invalid windows.
- Large windows fail with a user-facing range warning rather than freezing.

---

### Task 1: Pure grid selection and histogram model

**Files:**
- Create: `src/utils/grid-density-statistics.ts`
- Test: `src/utils/grid-density-statistics.test.ts`

**Interfaces:**
- Produces: `computeGridDensityStatistics(input): GridDensityStatisticsResult` and source band definitions.

- [ ] Write tests for inclusive 40%, below-threshold exclusion, nodata, totals, and histogram bins.
- [ ] Run the focused test and verify failure.
- [ ] Implement the pure computation.
- [ ] Run the focused test and verify success.

### Task 2: Native COG window reader and proxy

**Files:**
- Modify: `src/utils/grid-density-statistics.ts`
- Modify: `vite.config.ts`
- Modify: `nginx.conf`
- Modify: `package.json`, lockfiles
- Test: `src/config/imports-proxy.test.ts`

**Interfaces:**
- Produces: `loadGridDensityStatistics(dataset, ring, signal)`.

- [ ] Test the source proxy rewrite and raster window derivation.
- [ ] Implement the GeoTIFF window reader with maximum-cell guard and abort support.
- [ ] Run focused tests.

### Task 3: Real chart integration

**Files:**
- Modify: `src/components/mars-work/mars-map.vue`
- Modify: `src/utils/stats-chart-model.ts`
- Test: `src/utils/stats-chart-model.test.ts`

**Interfaces:**
- Consumes: `loadGridDensityStatistics`.
- Produces: asynchronous real population/GDP rows and loading/error/empty states.

- [ ] Add chart tests for density-bin population and GDP rows.
- [ ] Replace administrative level controls and estimated rows for these two cards.
- [ ] Cancel stale requests when the ring changes and refresh charts when results arrive.
- [ ] Run focused tests and type checking.

### Task 4: Same-source on-map imagery

**Files:**
- Modify: `src/components/mars-work/mars-map.vue`
- Modify: `src/components/mars-work/stats-on-map-removal.test.ts`

**Interfaces:**
- Produces: mutually exclusive population/GDP visual overlays clipped to the active polygon.

- [ ] Replace the inert-button test with overlay lifecycle assertions.
- [ ] Implement toggle, refresh, cleanup, and stale-request handling.
- [ ] Run focused tests and final verification.

