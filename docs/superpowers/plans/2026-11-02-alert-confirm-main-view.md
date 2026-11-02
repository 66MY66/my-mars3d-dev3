# 告警确认主视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将告警确认弹窗改造成以整组快速确认为主任务的概览页，同时保留确认前后均可使用的计算入口和待接入保存按钮。

**Architecture:** 继续使用现有 `AlertInfo` Mock 数据和既有分析模型，不在本次接入后端。主组件新增面向接口文档语义的概览派生状态、折叠异常点摘要和本地确认状态；时间演化及空间分析结果组件保持不变。

**Tech Stack:** Vue 3、TypeScript、Mars UI、Vitest、Vue Test Utils、Less

**Spec:** 2026-11-02 对话中已批准的【告警确认主视图】设计

## Global Constraints

- 本次只实施【告警确认主视图】，不得改造时间演化和空间分析结果页。
- 不接入后端接口，继续使用现有 Mock 数据作为前端占位来源。
- 主视图只突出任务、日期、异常指数、趋势、温差和点位数量。
- 异常点详情默认收起。
- 计算在整组确认前后都可使用。
- 保存按钮保留但禁用，并明确标示“待接入”。
- 确认成功后弹窗保持打开，分析入口继续可用。
- 保留工作区现有未提交修改，不回退或覆盖无关改动。

## Review Focus

- 菜单首次进入无选中告警时应保持空状态，不出现确认或计算操作。
- 切换告警后必须重置折叠详情、分析结果和当前告警的本地确认展示。
- 确认前和确认后都必须能够运行当前选择的分析计算。
- 重复点击已经确认的整组告警不得重复派发确认事件。
- 保存按钮必须不可点击，且不得继续写入 `localStorage`。

---

### Task 1: 用测试锁定整组快速确认行为

**Files:**
- Modify: `src/widgets/basic/alert-confirm/index.test.ts`
- Test: `src/widgets/basic/alert-confirm/index.test.ts`

**Interfaces:**
- Consumes: 现有 `AlertConfirm` setup 状态和 Mock `AlertInfo`
- Produces: 主视图字段、折叠状态、保存禁用、确认后不关闭及计算不受确认状态限制的行为约束

- [ ] **Step 1: 编写失败测试**

新增断言：主视图显示任务/日期/异常指数/趋势/温差/点位数量；异常点详情默认收起且可展开；保存按钮禁用；确认后状态变为已确认、弹窗不调用 `disable`、只派发一次事件；确认前后均可计算。

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx vitest run src/widgets/basic/alert-confirm/index.test.ts`
Expected: 新增测试因概览字段、确认状态或保存禁用尚未实现而 FAIL。

- [ ] **Step 3: 保留失败证据后进入 Task 2**

记录具体失败断言，不调整分析结果组件测试。

### Task 2: 实施告警确认主视图

**Files:**
- Modify: `src/widgets/basic/alert-confirm/index.vue`
- Modify: `src/shell/alerts.ts`
- Test: `src/widgets/basic/alert-confirm/index.test.ts`

**Interfaces:**
- Consumes: `AlertInfo` 及现有 `calculateTemporalAnalysis`、`calculateSpatialAnalysis`
- Produces: `alertOverview`、`pointSummary`、`pointsExpanded`、`groupConfirmed`、`confirmGroupAlert()` 等主视图状态与交互

- [ ] **Step 1: 扩展 Mock 展示模型**

在 `AlertInfo` 增加仅供当前前端占位的任务、异常日期、异常指数、趋势、观测温度、预报温度和异常点统计字段；三条 Mock 数据提供确定值。

- [ ] **Step 2: 重排主视图模板**

将旧基本信息和监测结果改为紧凑概览；增加默认收起的异常点摘要；保留两个分析选项及参数区，不改结果组件。

- [ ] **Step 3: 调整底部操作和确认状态**

计算按钮始终受“已选择告警”控制而不受确认状态控制；保存按钮禁用并显示“保存（待接入）”；确认按钮改为“确认整组告警”，成功后保留弹窗并显示“整组已确认”。

- [ ] **Step 4: 删除伪保存写入**

移除或停用 `saveOperation()` 中的 `localStorage.setItem`，确保空按钮不产生持久化副作用。

- [ ] **Step 5: 运行定向测试**

Run: `npx vitest run src/widgets/basic/alert-confirm/index.test.ts`
Expected: PASS。

### Task 3: 回归验证与范围检查

**Files:**
- Verify: `src/widgets/basic/alert-confirm/index.vue`
- Verify: `src/widgets/basic/alert-confirm/index.test.ts`
- Verify: `src/widgets/basic/alert-confirm/analysis-model.test.ts`
- Verify: `src/widgets/basic/alert-confirm/TimeEvolutionResult.test.ts`
- Verify: `src/widgets/basic/alert-confirm/SpatialAnalysisResult.test.ts`

**Interfaces:**
- Consumes: Task 2 完成后的主视图实现
- Produces: 主视图及既有分析功能无回归的验证证据

- [ ] **Step 1: 运行告警确认相关测试集**

Run: `npx vitest run src/widgets/basic/alert-confirm/index.test.ts src/widgets/basic/alert-confirm/analysis-model.test.ts src/widgets/basic/alert-confirm/TimeEvolutionResult.test.ts src/widgets/basic/alert-confirm/SpatialAnalysisResult.test.ts`
Expected: 全部 PASS。

- [ ] **Step 2: 运行类型检查**

Run: `npx vue-tsc --noEmit --skipLibCheck`
Expected: 无新增类型错误；若仓库已有错误，记录并区分是否与本次文件有关。

- [ ] **Step 3: 检查变更范围**

Run: `git diff -- src/widgets/basic/alert-confirm/index.vue src/widgets/basic/alert-confirm/index.test.ts src/shell/alerts.ts`
Expected: 仅包含已批准主视图设计和对应测试，不包含结果页重构或后端接入。
