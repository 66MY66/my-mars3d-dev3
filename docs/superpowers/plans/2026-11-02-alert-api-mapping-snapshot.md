# 告警接口映射与快照保留实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不把 Windmill Token 暴露给浏览器的前提下，将接口已有的查询和整组点位确认能力接入告警确认弹窗，并保证确认后分析结果不会因未读数据消失而丢失。

**Architecture:** 浏览器只调用同源代理 `/api/geo-anomaly-alerts`，请求体原样使用接口文档规定的 `{}`、`{"confirm":{"ids":[]}}`，暂不自动发送 `ack`。独立适配层校验并映射响应；会话内快照以服务端返回的 `ack_keys` 为主键保存原始告警组，确认成功后只更新快照中的 `points[].confirmed`。

**Tech Stack:** Vue 3、TypeScript、Axios、Vitest

**Spec:** `C:\Users\meiyan\Documents\WeChat Files\wxid_ce5xa2l2ypv522\FileStorage\File\2026-11\地表热异常告警接口文档.docx`

## Global Constraints

- 仅使用文档字段：`count`、`alerts`、`ack_keys`、`task_name`、`days`、`points`、`anomaly_index`、`trend`、`baseline_n`。
- 点位 `id` 为 integer，确认请求必须原样发送 `points[].id`。
- 不在前端源码、配置或存储中保存 Bearer Token。
- 不新增历史查询、边界、面积、扩张、目标距离或其他接口未定义能力。
- 本阶段不自动标记已读，避免查询后数据立即从未读接口消失。
- 快照仅保留在当前页面会话内，不写 localStorage 或 IndexedDB。

## Review Focus

- `anomaly_index`、`trend`、`baseline_n` 和日温度字段为 `null` 时应显示缺省值，不能产生 `NaN`。
- `ack_keys` 必须由服务端响应原样保存，不能由前端拼接。
- `confirmed` 小于请求 ids 数量时，不得把全部点位标成已确认，并提示刷新。
- 重复查询同一 `ack_key` 时应以最新服务端响应替换快照。
- 无效响应或网络失败时保留旧快照，不能清空用户正在查看的分析结果。

---

### Task 1: 接口响应映射与会话快照

**Files:**
- Create: `src/widgets/basic/alert-confirm/alert-api.ts`
- Create: `src/widgets/basic/alert-confirm/alert-api.test.ts`
- Modify: `src/widgets/basic/alert-confirm/analysis-model.ts`
- Modify: `src/widgets/basic/alert-confirm/analysis-model.test.ts`

**Interfaces:**
- Consumes: 文档定义的查询响应和确认响应 JSON。
- Produces: `queryGeoAnomalyAlerts()`、`confirmGeoAnomalyPoints(ids: number[])`、`mapAlertResponse(raw)`、`createAlertSnapshotStore()`。

- [ ] **Step 1: 写映射与快照失败测试**

  覆盖字段原样映射、整数点位 id、`null` 保留、`ack_keys` 原样保存、相同键覆盖、失败时旧快照不丢失。

- [ ] **Step 2: 运行测试并确认因接口模块不存在而失败**

  Run: `npx vitest run src/widgets/basic/alert-confirm/alert-api.test.ts src/widgets/basic/alert-confirm/analysis-model.test.ts`

- [ ] **Step 3: 实现最小接口模块**

  `queryGeoAnomalyAlerts()` 向 `/api/geo-anomaly-alerts` POST `{}`；`confirmGeoAnomalyPoints()` POST `{"confirm":{"ids": ids}}`。适配层拒绝缺少 `alerts` 或 `ack_keys` 的查询响应，快照存储仅使用模块内 `Map`。

- [ ] **Step 4: 修正分析模型点位 id 类型**

  将 `AlertPoint.id` 从 `string` 改为 `number`，模拟数据与测试同步使用整数，不改变 `days[]`、`points[]` 的分析范围。

- [ ] **Step 5: 运行测试并确认通过**

  Run: `npx vitest run src/widgets/basic/alert-confirm/alert-api.test.ts src/widgets/basic/alert-confirm/analysis-model.test.ts`

### Task 2: 弹窗查询与整组确认接入

**Files:**
- Modify: `src/widgets/basic/alert-confirm/index.vue`
- Modify: `src/widgets/basic/alert-confirm/index.test.ts`

**Interfaces:**
- Consumes: Task 1 的查询、确认和快照接口。
- Produces: 打开弹窗时查询、查询失败回退当前模拟数据、整组确认成功后更新当前快照和界面。

- [ ] **Step 1: 写弹窗接入失败测试**

  覆盖查询成功替换列表、查询失败保留当前内容、确认发送当前组全部整数 ids、部分确认提示刷新、确认后分析页仍可读取快照。

- [ ] **Step 2: 运行测试并确认失败原因是弹窗尚未调用接口模块**

  Run: `npx vitest run src/widgets/basic/alert-confirm/index.test.ts`

- [ ] **Step 3: 接入查询但保留安全回退**

  `onMounted` 查询代理；成功后从快照构建告警选择项，失败时保留现有模拟数据并显示“告警数据暂不可用”。不添加自动轮询。

- [ ] **Step 4: 接入整组确认**

  点击“确认整组告警”时发送当前组全部 `points[].id`；仅在 `confirmed === ids.length` 时将这些点更新为已确认。数量不足时保留原状态并提示“数据已变化，请刷新后重试”。

- [ ] **Step 5: 验证弹窗与结果页**

  Run: `npx vitest run src/widgets/basic/alert-confirm/index.test.ts src/widgets/basic/alert-confirm/TimeEvolutionResult.test.ts src/widgets/basic/alert-confirm/SpatialAnalysisResult.test.ts`

- [ ] **Step 6: 完整静态与回归验证**

  Run: `npx vue-tsc --noEmit --skipLibCheck`

  Run: `npx eslint src/widgets/basic/alert-confirm`

  Run: `npx vitest run`
