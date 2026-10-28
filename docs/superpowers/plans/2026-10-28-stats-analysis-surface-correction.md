# Statistics Analysis Surface Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct 【上图展示】 so its visible boundary is the terrain-clamped original drawing and its interior is a temporary, vivid, irregular vector-style analysis surface.

**Architecture:** Keep the existing grid only as an invisible spatial index for safe column anchors. Build one triangulated surface from the exact source ring, sample real terrain heights at its vertices, and interpolate a coherent elevation palette continuously across the mesh. Keep the result in the statistics overlay lifecycle rather than dataset/layer/basemap business state.

**Tech Stack:** Vue 3, TypeScript, Mars3D/Cesium, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-stats-terrain-overlay-design.md` plus the user's correction in this task.

## Global Constraints

- The visible boundary must be the normalized original drawing ring, never the grid union boundary.
- Grid cells remain invisible and exist only for spatial calculation and safe column placement.
- The analysis surface is temporary statistics-rendering state and must not enter dataset repository, layer tree, imported layers, basemap state, or workspace persistence.
- Surface and boundary must clamp to terrain.
- No new runtime dependency.

## Review Focus

- Concave source rings keep their exact visible boundary and never expose grid stair-steps.
- Surface color changes continuously with sampled terrain elevation; triangle edges and grid cells are never shown.
- Tiny regions and terrain-sampling failures still show the exact terrain-clamped fallback surface.
- Column footprints remain fully inside the original source ring.
- Clearing the last statistics card destroys both columns and the temporary surface.

---

### Task 1: Correct the spatial presentation model

**Files:**
- Modify: `src/utils/stats-terrain-overlay.ts`
- Modify: `src/utils/stats-terrain-overlay.test.ts`

**Interfaces:**
- Produces: exact `outlines: [sourceRing]`, hidden safe anchors, and deterministic elevation-domain/color helpers.
- Consumes: the existing normalized source ring and hidden calculation cells.

- [x] Write failing tests for exact visible outline, deterministic elevation mapping, anchor containment, and flat/invalid terrain fallback.
- [ ] Run the focused test and confirm the new assertions fail.
- [x] Implement continuous palette interpolation without exposing grid or triangulation geometry.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Render the temporary analysis surface

**Files:**
- Modify: `src/components/mars-work/mars-map.vue`

**Interfaces:**
- Consumes: `StatsAnalysisRegion.sourceRing` and sampled terrain elevation.
- Produces: terrain-clamped exact fallback surface, continuous elevation-colored terrain mesh, and original-ring terrain-clamped boundary.

- [ ] Replace grid-derived polygon rendering with source-ring rendering.
- [x] Render a coherent vivid elevation palette continuously across an edge-free triangulated mesh.
- [ ] Rename runtime concepts and attributes to “analysis surface overlay” semantics.
- [ ] Verify typecheck, lint, focused tests, and production build.
