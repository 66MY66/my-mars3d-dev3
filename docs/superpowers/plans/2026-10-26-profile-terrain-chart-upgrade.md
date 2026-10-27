# Profile Terrain Sampling and Chart Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sample real terrain at every generated profile coordinate, then provide an interactive, map-linked and visually clear elevation chart.

**Architecture:** Keep pure sampling transformations in `utils.ts`, Cesium terrain access and map highlighting in `map.ts`, and ECharts interaction/layout in `index.vue`. Generate evenly spaced coordinates first, call `sampleTerrainMostDetailed` for that full set, then attach returned elevations before optional smoothing.

**Tech Stack:** Vue 3, TypeScript, Mars3D/Cesium, ECharts, Vitest

**Spec:** User-approved order in the active task: correct real terrain sampling first, chart interaction and visual polish second.

## Global Constraints

- Do not add dependencies.
- Preserve existing line-object and hand-drawn-line entry paths.
- CSV values must be the same samples displayed by the chart.
- Terrain sampling failures must not crash the panel and must be reported as fallback data.

## Review Focus

- Every requested sample coordinate, not only source vertices, is sent to terrain sampling.
- Returned heights remain aligned with distance, longitude and latitude.
- Smoothing changes only elevation, never coordinates or distance.
- Chart zoom and reset work for long profiles.
- Chart hover does not leave stale map markers after the panel closes.

---

### Task 1: Correct terrain sampling pipeline

**Files:**
- Modify: `src/widgets/basic/insar-profile/utils.ts`
- Modify: `src/widgets/basic/insar-profile/utils.test.ts`
- Modify: `src/widgets/basic/insar-profile/map.ts`

**Interfaces:**
- Produces `applyTerrainHeights(samples, heights)` and full-sample terrain queries.

- [x] Add failing tests proving every returned height maps to its matching sample.
- [x] Generate all sample coordinates before calling Cesium terrain sampling.
- [x] Apply terrain heights and smoothing without changing distance or coordinates.
- [x] Verify profile utility tests.

### Task 2: Interactive chart and map linkage

**Files:**
- Modify: `src/widgets/basic/insar-profile/index.vue`
- Modify: `src/widgets/basic/insar-profile/map.ts`

**Interfaces:**
- Produces chart zoom/pan/reset, coordinate tooltips and `showProfilePosition(index)`.

- [x] Add inside and slider data zoom plus restore controls.
- [x] Show distance, elevation, longitude and latitude in the tooltip.
- [x] Synchronize chart pointer to a temporary map marker.
- [x] Clear the marker when the pointer leaves or the panel closes.

### Task 3: Result-panel visual hierarchy

**Files:**
- Modify: `src/widgets/basic/insar-profile/index.vue`

**Interfaces:**
- Produces a responsive result header, metric strip, chart stage and compact export actions.

- [x] Open the result step immediately after successful analysis.
- [x] Style the chart as the primary content and keep summary/export secondary.
- [x] Verify lint, type checking, focused tests and browser loading.
