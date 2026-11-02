# 告警分析路线A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为告警确认增加可配置、可计算、可视化的时间演化与空间分析，并以两个独立结果弹窗展示。

**Architecture:** 在告警模块内新增纯前端模拟时空数据与确定性计算模型；告警确认弹窗负责参数配置和发起计算；时间演化与空间分析分别由独立Vue组件展示结果。首期不接后端、不改现有通用时间轴和空间分析Widget。

**Tech Stack:** Vue 3、TypeScript、Vitest、项目现有Mars UI、SVG/CSS轻量可视化。

**Spec:** 当前任务对话中已确认的“路线A”设计（无独立规格文件）。

## Global Constraints

- 使用现有3条模拟告警，分别呈现增强、稳定、减弱趋势。
- 全部计算在前端完成，不请求后端，不新增依赖。
- 点击计算后使用独立二级弹窗，不覆盖告警确认状态。
- 时间演化与空间分析使用各自独立结果组件。
- 保持通知入口、告警选择、定位、确认和目录锁定行为不变。

## Review Focus

- 未选择告警或未定位时不得发起计算，并应保持现有空状态。
- 切换告警后参数和旧计算结果不能串到新告警。
- 时间范围内数据不足两点时应返回“数据不足”，不能产生虚假趋势。
- 空间边界缺失或无效时应安全返回空结果，不能破坏弹窗。
- 二级结果弹窗关闭后应回到原告警上下文，且不改变确认状态。

---

### Task 1: 时空模拟数据与计算模型

**Files:**
- Create: `src/widgets/basic/alert-confirm/analysis-model.ts`
- Test: `src/widgets/basic/alert-confirm/analysis-model.test.ts`

**Interfaces:**
- Consumes: `AlertInfo.alertNo`、时间范围、空间缓冲半径与目标类型。
- Produces: `getAlertAnalysisDataset(alertNo)`、`calculateTemporalAnalysis(dataset, options)`、`calculateSpatialAnalysis(dataset, options)`及其结果类型。

- [ ] **Step 1: Write failing tests for enhanced, stable and weakening temporal trends**
- [ ] **Step 2: Run `npx vitest run src/widgets/basic/alert-confirm/analysis-model.test.ts` and verify missing-module failure**
- [ ] **Step 3: Add three deterministic time series, multi-temporal GeoJSON-like boundaries and nearby targets**
- [ ] **Step 4: Implement temporal metrics: temperature delta/rate, area growth, peak, duration, data quality and conclusion**
- [ ] **Step 5: Implement spatial metrics: area/perimeter, overlap, centroid shift, direction, buffer target counts and conclusion**
- [ ] **Step 6: Add tests for insufficient temporal records and missing boundary data**
- [ ] **Step 7: Run model tests and verify all pass**

### Task 2: 时间演化独立结果弹窗

**Files:**
- Create: `src/widgets/basic/alert-confirm/TimeEvolutionResult.vue`
- Test: `src/widgets/basic/alert-confirm/TimeEvolutionResult.test.ts`

**Interfaces:**
- Consumes: `TemporalAnalysisResult`、告警编号、关闭事件。
- Produces: 指标摘要、温度/面积SVG趋势图、逐时明细和自然语言结论。

- [ ] **Step 1: Write failing component test for title, metrics, chart points, table and close event**
- [ ] **Step 2: Run the component test and verify failure**
- [ ] **Step 3: Implement the standalone Mars dialog and accessible SVG trend chart**
- [ ] **Step 4: Run the component test and verify pass**

### Task 3: 空间分析独立结果弹窗

**Files:**
- Create: `src/widgets/basic/alert-confirm/SpatialAnalysisResult.vue`
- Test: `src/widgets/basic/alert-confirm/SpatialAnalysisResult.test.ts`

**Interfaces:**
- Consumes: `SpatialAnalysisResult`、告警编号、关闭事件。
- Produces: 边界SVG画面、缓冲区与目标图层、空间指标、目标清单和结论。

- [ ] **Step 1: Write failing component test for title, boundary layers, metrics, target list and close event**
- [ ] **Step 2: Run the component test and verify failure**
- [ ] **Step 3: Implement the standalone Mars dialog and normalized SVG spatial view**
- [ ] **Step 4: Run the component test and verify pass**

### Task 4: 告警确认参数配置与计算衔接

**Files:**
- Modify: `src/widgets/basic/alert-confirm/index.vue`
- Modify: `src/widgets/basic/alert-confirm/index.test.ts`

**Interfaces:**
- Consumes: Task 1计算接口及Task 2/3结果组件。
- Produces: 算子对应参数表单、计算校验、结果弹窗状态和告警切换复位。

- [ ] **Step 1: Write failing tests for temporal parameters, spatial parameters, compute dispatch and alert-switch reset**
- [ ] **Step 2: Run alert-confirm tests and verify expected failures**
- [ ] **Step 3: Add temporal options: range, interval, metrics and comparison baseline**
- [ ] **Step 4: Add spatial options: current/comparison period, buffer radius, target types and history toggle**
- [ ] **Step 5: Replace toast-only calculation with model invocation and the matching result dialog**
- [ ] **Step 6: Preserve save/confirm behavior and reset result state when alert or operator changes**
- [ ] **Step 7: Run targeted tests and verify pass**

### Task 5: 集成验证

**Files:**
- Verify all files above.

**Interfaces:**
- Consumes: 完成的分析流程。
- Produces: 可验证的告警选择→定位→配置→计算→结果→关闭闭环。

- [ ] **Step 1: Run all alert and notification tests**
- [ ] **Step 2: Run `npm run lint -- --pretty false`**
- [ ] **Step 3: Run `npm run test:unit` and report both related results and unrelated baseline failures**
- [ ] **Step 4: Inspect `git diff` to confirm no existing analysis widgets or backend files changed**
