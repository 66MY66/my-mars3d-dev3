# Layer Data Loading Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify imported-layer fallback classification under `临时图层`, preserve and regression-test existing raster loading, and connect manifest-configured MVT sources to the existing map layer lifecycle without changing the current UI.

**Architecture:** Make `services/import-layer-categorizer.ts` the single classification path used by dataset revision imports and remove the duplicate page-local classifier. Keep raster creation in `workspace/restore.ts`, extract the existing MVT tile-provider implementation from `map.ts` into a reusable service, and have both thematic protocol loading and workspace restore use that service.

**Tech Stack:** Vue 3, TypeScript, Mars3D/Cesium, `@mapbox/vector-tile`, `pbf`, Vitest.

**Spec:** Conversation-approved scope from 2026-10-28; no standalone spec file was requested.

## Global Constraints

- Do not delete, redesign, or add a standalone front-end UI.
- Preserve existing valid manifest group and `pid` relationships.
- Only ungrouped/unclassifiable imported layers fall back to `临时图层`; this label does not imply automatic deletion.
- Preserve current XYZ, WMS, COG/GeoTIFF, PNG/JPG, GeoJSON, and thematic protocol behavior.
- PNG/JPG without `bounds`, `bbox`, or an equivalent spatial extent remain preview-only and must not be force-positioned on the map.
- MVT is configuration-driven in this phase and must participate in visibility, opacity, parent grouping, removal, and workspace restore through the existing layer lifecycle.

## Review Focus

- A manifest with existing valid nested groups must retain its hierarchy rather than being flattened into generated type groups.
- Unknown, empty, and mixed-case source types must reliably fall back to `临时图层` without hiding the layer.
- A `.png` or `.jpg` URL without spatial bounds must not be inferred as a map image layer.
- An MVT URL must contain all `{z}`, `{x}`, and `{y}` placeholders; invalid templates must fail with an actionable error rather than silently becoming XYZ.
- MVT tile fetch/decode failures and missing `sourceLayer` data must not break unrelated map layers or leave an unremovable layer instance.

---

### Task 1: Make imported-layer classification use one canonical service

**Files:**
- Modify: `src/widgets/basic/dataset-repository/services/layer-classifier.ts`
- Modify: `src/widgets/basic/dataset-repository/services/import-layer-categorizer.ts`
- Modify: `src/widgets/basic/dataset-repository/services/import-layer-categorizer.test.ts`
- Modify: `src/widgets/basic/dataset-repository/components/DatasetDetail.vue:2730-2795`
- Modify: `src/widgets/basic/dataset-repository/components/DatasetDetail.test.ts`

**Interfaces:**
- Consumes: `classifyLayer(layer: LayerMetadata): string` and `DEFAULT_GROUP`.
- Produces: `categorizeLayersForImport(layers: ImportLayer[], prefixHint?: string): ImportLayer[]` as the only revision-import categorizer used by `DatasetDetail.vue`.

- [ ] **Step 1: Add failing service tests for all agreed classifications**

Add assertions that `cog`, `geotiff`, `png/image`, `jpg/image`, `xyz`, and `wms` produce `栅格`; `geojson` and `mvt` produce `矢量`; an unknown type produces `临时图层`; and valid pre-existing groups remain unchanged.

- [ ] **Step 2: Run the classification tests and verify the new coverage fails where the canonical rules are incomplete**

Run: `npx vitest run src/widgets/basic/dataset-repository/services/layer-classifier.test.ts src/widgets/basic/dataset-repository/services/import-layer-categorizer.test.ts --reporter=verbose`

Expected: at least one new assertion fails before implementation.

- [ ] **Step 3: Complete canonical type normalization**

Update `detectCategory(layer: LayerMetadata)` so explicit image aliases and case-normalized configured types map consistently, while unknown values still return `DEFAULT_GROUP`.

- [ ] **Step 4: Replace the page-local categorizer**

Import `categorizeLayersForImport` from `../services/import-layer-categorizer` in `DatasetDetail.vue`, delete its duplicate local implementation, and keep all current call arguments and import flow unchanged.

- [ ] **Step 5: Add a page-level regression test**

Assert that a revision import containing an unknown ungrouped layer reaches workspace restore with a generated parent group named `临时图层`, while a revision with a valid existing parent retains that parent.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/widgets/basic/dataset-repository/services/layer-classifier.test.ts src/widgets/basic/dataset-repository/services/import-layer-categorizer.test.ts src/widgets/basic/dataset-repository/components/DatasetDetail.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/basic/dataset-repository/services/layer-classifier.ts src/widgets/basic/dataset-repository/services/import-layer-categorizer.ts src/widgets/basic/dataset-repository/services/import-layer-categorizer.test.ts src/widgets/basic/dataset-repository/components/DatasetDetail.vue src/widgets/basic/dataset-repository/components/DatasetDetail.test.ts
git commit -m "fix: unify imported layer classification"
```

### Task 2: Lock down existing raster configuration behavior

**Files:**
- Modify: `src/widgets/basic/dataset-repository/workspace/restore.ts:285-650`
- Modify: `src/widgets/basic/dataset-repository/workspace/restore.test.ts`
- Modify: `src/widgets/basic/dataset-repository/services/result-loader-utils.test.ts`

**Interfaces:**
- Consumes: manifest layer fields `sourceType`, `sourceRef`, `options`, `visible`, `opacity`, and `pid`.
- Produces: unchanged Mars3D layer creation behavior for `cog/geotiff`, `image`, `xyz`, and `wms`, plus deterministic URL inference that does not misclassify MVT or unreferenced images.

- [ ] **Step 1: Add failing raster inference and option-preservation tests**

Cover COG/GeoTIFF configuration, PNG/JPG with bounds, PNG/JPG without bounds, XYZ placeholders, WMS `layers/format/transparent/styles/version`, and `.mvt`/`.pbf` templates taking precedence over generic XYZ placeholder inference.

- [ ] **Step 2: Run workspace restore tests and confirm the new edge assertions fail**

Run: `npx vitest run src/widgets/basic/dataset-repository/workspace/restore.test.ts src/widgets/basic/dataset-repository/services/result-loader-utils.test.ts --reporter=verbose`

Expected: new MVT precedence or option-preservation assertion fails before implementation.

- [ ] **Step 3: Make source inference ordering explicit**

Update `inferSourceTypeFromUrl(url: string, layerOptions?: any): string` so `.mvt`/`.pbf` tile templates infer `mvt` before the generic placeholder branch, while PNG/JPG inference continues to require a spatial extent.

- [ ] **Step 4: Preserve raster protocol configuration**

Ensure the existing `storedOptions` merge passes WMS protocol fields and image/COG spatial/style fields unchanged to `LayerUtil.create` or the current fallback constructors; do not add new UI defaults.

- [ ] **Step 5: Run focused raster tests**

Run: `npx vitest run src/widgets/basic/dataset-repository/workspace/restore.test.ts src/widgets/basic/dataset-repository/services/result-loader-utils.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/basic/dataset-repository/workspace/restore.ts src/widgets/basic/dataset-repository/workspace/restore.test.ts src/widgets/basic/dataset-repository/services/result-loader-utils.test.ts
git commit -m "test: harden raster layer configuration restore"
```

### Task 3: Reuse one MVT layer implementation in protocol loading and workspace restore

**Files:**
- Create: `src/widgets/basic/dataset-repository/services/mvt-layer.ts`
- Create: `src/widgets/basic/dataset-repository/services/mvt-layer.test.ts`
- Modify: `src/widgets/basic/dataset-repository/services/thematic-mvt.ts`
- Modify: `src/widgets/basic/dataset-repository/map.ts:698-728`
- Modify: `src/widgets/basic/dataset-repository/map.test.ts`
- Modify: `src/widgets/basic/dataset-repository/workspace/restore.ts:338-600`
- Modify: `src/widgets/basic/dataset-repository/workspace/restore.test.ts`

**Interfaces:**
- Consumes: `createMvtLayer(options: MvtLayerOptions): mars3d.layer.BaseTileLayer`, where `MvtLayerOptions` includes `id`, `name?`, `url`, `pid?`, `show?`, `opacity?`, `minimumLevel?`, `maximumLevel?`, `bounds?`, `sourceLayer?`, `fillColor?`, and `lineColor?`.
- Produces: a Mars3D `BaseTileLayer` backed by a Cesium imagery provider whose `requestImage(x, y, level, request)` fetches an ArrayBuffer and calls `paintVectorTile`.

- [ ] **Step 1: Add failing MVT service tests**

Assert rejection of incomplete URL templates, propagation of ID/name/pid/show/opacity and min/max levels, bounds conversion, `{z}/{x}/{y}` request substitution, `sourceLayer`/style forwarding, and a transparent tile or controlled rejection for fetch/decode failure.

- [ ] **Step 2: Run the new service test and verify it fails because the reusable factory does not exist**

Run: `npx vitest run src/widgets/basic/dataset-repository/services/mvt-layer.test.ts --reporter=verbose`

Expected: FAIL because `mvt-layer.ts` or `createMvtLayer` is missing.

- [ ] **Step 3: Implement the reusable MVT factory**

Create `createMvtLayer(options: MvtLayerOptions): mars3d.layer.BaseTileLayer`; validate the three required placeholders, construct the Cesium URL-template imagery provider, override `requestImage` to fetch PBF bytes and call `paintVectorTile`, and retain Mars3D lifecycle fields on the layer.

- [ ] **Step 4: Replace the inline thematic MVT class**

Change `addThematicProtocolLayer` in `map.ts` to call `createMvtLayer({ ...options, id, url })`; preserve its WMS/WMTS branches and existing public signature.

- [ ] **Step 5: Add the workspace restore MVT branch**

Add `case "mvt"` in `restoreLayer` using `createMvtLayer` with the resolved URL and merged manifest options; preserve `pid`, visibility, opacity, bounds, zoom limits, source layer, and style fields.

- [ ] **Step 6: Add integration regression tests**

In `map.test.ts`, assert thematic MVT delegates to the shared factory. In `restore.test.ts`, assert an MVT manifest creates a removable map layer under its supplied vector parent and is not constructed as `XyzLayer`.

- [ ] **Step 7: Run MVT and restore tests**

Run: `npx vitest run src/widgets/basic/dataset-repository/services/mvt-layer.test.ts src/widgets/basic/dataset-repository/map.test.ts src/widgets/basic/dataset-repository/workspace/restore.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/widgets/basic/dataset-repository/services/mvt-layer.ts src/widgets/basic/dataset-repository/services/mvt-layer.test.ts src/widgets/basic/dataset-repository/services/thematic-mvt.ts src/widgets/basic/dataset-repository/map.ts src/widgets/basic/dataset-repository/map.test.ts src/widgets/basic/dataset-repository/workspace/restore.ts src/widgets/basic/dataset-repository/workspace/restore.test.ts
git commit -m "feat: restore configured MVT layers"
```

### Task 4: Full regression verification

**Files:**
- Verify only; no planned product-file changes.

**Interfaces:**
- Consumes: outputs from Tasks 1-3.
- Produces: evidence that classification, raster restore, MVT loading, dataset detail, and layer management remain compatible.

- [ ] **Step 1: Run the complete affected test set**

Run: `npx vitest run src/widgets/basic/dataset-repository src/widgets/basic/manage-layers --reporter=verbose`

Expected: PASS with no new failures.

- [ ] **Step 2: Run type checking**

Run the repository's existing TypeScript check script from `package.json`.

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run the repository's existing production build script from `package.json`.

Expected: exit code 0.

- [ ] **Step 4: Confirm scope preservation**

Run: `git diff --check` and inspect `git diff --stat` plus the final diff to confirm no UI template structure or unrelated behavior changed.

Expected: no whitespace errors; changes limited to the planned classification, restore, MVT service, tests, and this plan.

