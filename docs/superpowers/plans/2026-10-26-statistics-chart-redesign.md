# Statistics Chart Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the five comprehensive-statistics cards so each uses a two-dimensional chart and grouping model appropriate to its data.

**Architecture:** Keep the existing panel, card lifecycle, exports, ordering, and map-overlay toggles. Extract pure ECharts option builders into a focused utility, reshape the existing deterministic demo rows in `mars-map.vue`, and cover chart semantics with Vitest.

**Tech Stack:** Vue 3, TypeScript, ECharts 5, Vitest.

**Spec:** User-approved in-chat design from 2026-10-26.

## Global Constraints

- Population uses ranked horizontal bars and distinguishes total population from density.
- Housing uses 100% stacked horizontal bars across five seismic-risk grades.
- Economy uses a treemap for regional economic composition.
- Thermal radiation uses a trend line, normal-range band, baseline, and anomaly markers.
- Vegetation uses a 100% stacked area composition plus an average NDVI line.
- Preserve current panel entry, exports, card controls, and 3D map-display entry.
- Do not introduce new runtime dependencies.

## Review Focus

- Empty row arrays must produce valid ECharts options without throwing.
- Housing and vegetation percentage series must remain comparable on a 0–100% axis.
- Thermal anomaly markers must contain only values outside the normal range.
- Population bars must be sorted from highest to lowest.
- Economy treemap values must remain non-negative.

---

### Task 1: Pure chart option builders

**Files:**
- Create: `src/utils/stats-chart-model.ts`
- Create: `src/utils/stats-chart-model.test.ts`

**Interfaces:**
- Produces: `buildStatsChartOption(key, rows)` and `getStatsDivisionLabel(key)`.

- [ ] Write failing tests asserting the five required chart types, axes, stacks, range band, anomaly markers, and labels.
- [ ] Run the focused test and confirm failure because the utility is missing.
- [ ] Implement the minimal pure option builders.
- [ ] Run the focused test and confirm it passes.

### Task 2: Panel data models and integration

**Files:**
- Modify: `src/components/mars-work/mars-map.vue`

**Interfaces:**
- Consumes: `buildStatsChartOption(key, rows)` and `getStatsDivisionLabel(key)`.

- [ ] Reshape deterministic demo rows for population density, seismic-risk composition, thermal baseline/range/anomaly, and vegetation coverage composition.
- [ ] Replace the local generic chart builder with the extracted chart option builder.
- [ ] Show each card's grouping basis beside its title and hide administrative-level controls for non-administrative time-series cards.
- [ ] Preserve export and map-overlay value extraction compatibility.

### Task 3: Verification

**Files:**
- Verify all modified files.

- [ ] Run focused Vitest coverage for the new utility.
- [ ] Run Vue TypeScript checking.
- [ ] Run the broader unit suite and report any unrelated failures explicitly.
- [ ] Inspect the final diff for accidental changes.
