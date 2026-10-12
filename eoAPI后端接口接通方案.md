# eoAPI 后端接口接通方案

## 1. 文档目标

本文档用于说明如何将当前前端 `mars3d` 项目与后端 `eoAPI` 项目完成接口接通，重点覆盖以下两类内容：

1. 让前端现有的数据集仓库、我的仓库、版本管理、附件、发布状态等功能与后端接口真正联通。
2. 针对目前“已完成但复验失败”的条目，给出后端侧最小可落地的改造路径，使其从“界面存在但链路不通”变成“可验收”。

## 2. 结论摘要

当前 `eoAPI` 并不是“完全没有后端接口”，而是已经有一套可用的业务 API 原型，核心实现位于：

- `/program/eoAPI/dockerfiles/datasets_api/app.py`

前端也已经预埋了大量对接代码，核心调用位于：

- `/program/Mars3D/mars3d/src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`
- `/program/Mars3D/mars3d/src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`

所以本次“接通”的重点不是从零设计，而是：

1. 对齐前端已经在调用的端点。
2. 补齐少数缺失或不稳定的接口。
3. 打通代理路径、权限、测试数据、发布审核流。
4. 给出可复验的数据与账号方案。

## 3. 当前架构现状

### 3.1 eoAPI 服务组成

`/program/eoAPI/docker-compose.yml` 当前编排了以下服务：

- `database`：Postgres + pgSTAC
- `stac-fastapi`：标准 STAC 元数据接口，端口 `5951`
- `titiler-pgstac`：基于 STAC 的栅格服务，端口 `5952`
- `tipg`：矢量服务，端口 `5953`
- `stac-browser`：目录浏览 UI，端口 `5954`
- `datasets-api`：自定义业务 API，端口 `5960`

其中与前端“成果管理 / 数据集仓库 / 版本 / 附件 / 发布”直接相关的，不是 STAC 标准服务本身，而是 `datasets-api`。

### 3.2 datasets-api 已具备的业务能力

`datasets-api` 已经实现了以下能力：

- 数据集列表、创建、删除
- 版本列表、创建、删除、manifest 读取
- 血缘关系查询、fork
- 发布申请、取消申请、撤回、状态查询
- 附件列表、上传、下载、删除、元数据更新、关联
- 分片上传 / 伪预签名上传
- 导入会话、撤销导入、清空导入
- 收藏、目录锁、指标统计
- WebSocket 数据同步通道

这意味着后端“主干”已经存在，问题主要集中在：

- 端点语义和前端预期还不完全一致
- 部分链路缺管理端或审核端闭环
- 权限控制过弱
- 代理路径和部署路径未完全固化
- 缺少用于复验的标准测试数据

## 4. 前端实际需要的接口能力

### 4.1 数据集仓库

前端当前主要依赖以下接口：

- `GET /collections`
- `GET /collections/{id}`
- `GET /collections/{id}/items`
- `GET /datasets/{datasetId}/revisions`
- `GET /datasets/{datasetId}/revisions/{revisionId}/manifest`

用途：

- 数据集列表
- 数据集详情
- 版本列表
- 历史版本 manifest 读取
- 导入到地图前的配置恢复

### 4.2 我的仓库

前端当前依赖：

- `GET /datasets`
- `DELETE /datasets/{datasetId}`
- `GET /datasets/{datasetId}/revisions`
- `GET /datasets/{datasetId}/revisions/{revisionId}/manifest`

用途：

- 我的成果列表
- 打开最新成果
- 删除成果
- 管理版本

### 4.3 发布流

前端当前依赖：

- `POST /datasets/{datasetId}/publish-request`
- `POST /datasets/{datasetId}/cancel-request`
- `POST /datasets/{datasetId}/withdraw`

后端已实现但前端接通不稳定或依赖不足的：

- `GET /datasets/{datasetId}/publish-status`

### 4.4 附件与大文件

前端当前依赖：

- `GET /artifacts`
- `GET /artifacts/{artifactId}/download`
- `POST /artifacts/upload`
- `POST /artifacts/dedup-check`
- `POST /artifacts/chunked/init`
- `PUT /artifacts/chunked/{uploadId}/chunks/{index}`
- `POST /artifacts/chunked/complete`
- `DELETE /artifacts/{artifactId}`
- `POST /artifacts/{artifactId}/link`
- `POST /artifacts/{artifactId}/metadata`

### 4.5 导入 / 当前任务 / 同步

前端所需但目前复验困难的能力：

- 数据集导入会话创建
- 导入后的图层分组、定位、撤销
- 导入内容清除
- 地图状态与目录实时同步
- 一键回退 / 打开旧版本

`datasets-api` 已实现导入会话相关接口，但链路仍缺以下要素：

- 前端统一使用的对接封装
- 导入成功后目录与地图状态的标准数据结构
- 用于复验的标准数据集和示例任务

## 5. 当前缺口分析

### 5.1 已有但需要直接接通的接口

以下接口后端已存在，优先应直接接入与联调：

- 数据集：`GET /datasets`、`POST /datasets`、`DELETE /datasets/{id}`
- 版本：`GET /datasets/{id}/revisions`、`POST /datasets/{id}/revisions`、`DELETE /datasets/{id}/revisions/{rev}`、`GET /datasets/{id}/revisions/{rev}/manifest`
- 发布：`POST /publish-request`、`POST /cancel-request`、`POST /withdraw`、`GET /publish-status`
- 附件：`GET /artifacts`、`POST /artifacts/upload`、`GET /artifacts/{id}/download`、`DELETE /artifacts/{id}`
- 导入：`POST /imports/sessions`、`POST /imports/sessions/{groupId}/undo`、`POST /imports/sessions/{groupId}/clear`
- 收藏：`POST /favorites/{datasetId}`、`DELETE /favorites/{datasetId}`、`GET /favorites`

### 5.2 缺少或建议新增的接口

这些接口不是必须从零重构，但建议补齐，以降低前端复杂度并提高验收成功率。

#### A. 数据集详情与更新

建议新增：

- `GET /datasets/{datasetId}`
- `PATCH /datasets/{datasetId}`

作用：

- 前端“我的仓库”详情、标签、封面、描述、权限变更不必再混用 `/collections/{id}` 与 `/datasets` 返回结构。

#### B. 版本回滚专用接口

当前前端的“回滚”实际上是：

1. 读取旧版本 manifest
2. 再创建一个新 revision

建议新增：

- `POST /datasets/{datasetId}/revisions/{revisionId}/rollback`

作用：

- 后端统一回滚逻辑
- 写入审计日志
- 便于复验 “一键回退打开”

#### C. 发布审核接口

当前只有“用户发起申请”和“查询状态”，缺少审核端闭环。

建议新增：

- `GET /publish-requests`
- `POST /datasets/{datasetId}/approve`
- `POST /datasets/{datasetId}/reject`

请求建议：

```json
{
  "reason": "缺少必要元数据"
}
```

作用：

- 打通 `private -> reviewing -> published`
- 支持“拒绝 -> 退回”
- 支持前端显示驳回原因

#### D. 导入结果查询接口

建议新增：

- `GET /imports/sessions/{groupId}`
- `GET /imports/sessions`

作用：

- 便于前端恢复导入结果
- 便于定位“导入后快捷操作 / 分组 / 清理 / 撤销”链路

#### E. 目录与任务状态接口

建议新增：

- `GET /datasets/{datasetId}/tree`
- `POST /datasets/{datasetId}/tree/reorder`
- `POST /datasets/{datasetId}/tree/search`

作用：

- 对应工单 `3-27`、`3-28`、`3-29`、`3-30`
- 避免前端从 manifest 临时拼目录树

### 5.3 部署与代理缺口

当前 `datasets-api` 默认跑在 `5960`，前端通过 `/api/eoapi` 访问。需要明确增加统一反向代理规则。

建议代理目标：

- `/api/eoapi/collections` -> `http://eoapi-stac-fastapi:5951/collections`
- `/api/eoapi/search` -> `http://eoapi-stac-fastapi:5951/search`
- `/api/eoapi/datasets` -> `http://eoapi-datasets-api:5960/datasets`
- `/api/eoapi/artifacts` -> `http://eoapi-datasets-api:5960/artifacts`
- `/api/eoapi/imports` -> `http://eoapi-datasets-api:5960/imports`
- `/api/eoapi/favorites` -> `http://eoapi-datasets-api:5960/favorites`
- `/api/eoapi/ws/dataset-sync` -> `ws://eoapi-datasets-api:5960/ws/dataset-sync`

建议原则：

- 前端永远只认一个前缀：`/api/eoapi`
- 所有 manifest 返回地址必须也走这个统一前缀
- 不再在前端或 docker 配置里硬编码 `192.168.0.15`

## 6. 推荐接通方案

### 第一阶段：最小可用接通

目标：先让前端已经写好的主流程跑起来，不做大规模重构。

实施内容：

1. 统一代理 `/api/eoapi` 到 `5951 + 5960`
2. 核对并稳定以下接口返回结构：
   - `GET /datasets`
   - `GET /datasets/{id}/revisions`
   - `GET /datasets/{id}/revisions/{rev}/manifest`
   - `GET /artifacts`
   - `GET /artifacts/{id}/download`
   - `POST /datasets/{id}/publish-request`
   - `POST /datasets/{id}/cancel-request`
   - `POST /datasets/{id}/withdraw`
3. 提供一套固定测试数据：
   - 至少 3 个数据集
   - 每个数据集 2 到 3 个版本
   - 每个版本至少 1 个附件
   - 至少 1 个处于 `reviewing`
   - 至少 1 个处于 `published`
4. 提供 3 类测试账号：
   - 普通用户
   - 审核员
   - 管理员

阶段结果：

- 可复验 `3-13`、`3-18`、`3-20`、`3-21`、`3-23`
- “我的仓库 / 数据集详情 / 版本管理 / 提交审核 / 撤回”链路可跑通

### 第二阶段：导入与同步链路打通

目标：解决目前复验失败最多的“导入后无可操作路径”问题。

实施内容：

1. 前端正式接入导入接口：
   - `POST /imports/sessions`
   - `POST /imports/sessions/{groupId}/undo`
   - `POST /imports/sessions/{groupId}/clear`
2. 补 `GET /imports/sessions/{groupId}` 与列表接口
3. 约定导入结果结构：
   - 导入数据集 ID
   - 生成的图层列表
   - 目录节点映射
   - 默认视角
   - 标注信息
4. 打通 `WebSocket /ws/dataset-sync`
5. 明确“导入后快捷操作”的后端返回：
   - 可定位图层 ID
   - 打开资源 URL
   - 可撤销 groupId

阶段结果：

- 可复验 `3-8`、`3-9`、`3-10`、`3-11`、`3-12`
- 同步、撤销、分组管理、导入恢复都具备后端依据

### 第三阶段：审核、附件、大文件、目录树完善

目标：覆盖难点工单与长期稳定性。

实施内容：

1. 增加审核端接口：
   - `GET /publish-requests`
   - `POST /datasets/{id}/approve`
   - `POST /datasets/{id}/reject`
2. 增强附件体系：
   - 真正接入对象存储预签名上传
   - 上传完成后回写 artifact 元数据
   - 支持封面图分类与来源标识
3. 增加目录树与搜索能力：
   - `GET /datasets/{id}/tree`
   - `POST /datasets/{id}/tree/reorder`
   - `POST /datasets/{id}/tree/search`
4. 增加版本回滚专用接口
5. 增加审计日志

阶段结果：

- 可复验 `3-24`、`3-25`、`3-28`、`3-29`、`3-30`
- 可推进 `3-36`、`3-37`、`3-38`、`3-39`、`3-40`、`3-41`、`3-42`

## 7. 数据结构对齐建议

### 7.1 数据集返回结构

建议 `GET /datasets` 与 `GET /datasets/{id}` 返回统一字段：

```json
{
  "datasetId": "ds_xxx",
  "name": "测试数据集",
  "description": "说明",
  "visibility": "private",
  "publishStatus": "reviewing",
  "rejectionReason": null,
  "tags": ["SAR", "云南"],
  "coverUrl": "/api/eoapi/artifacts/xxx/download",
  "createdAt": 1720000000000,
  "updatedAt": 1720000000000,
  "ownerId": "u001",
  "ownerName": "张三"
}
```

### 7.2 版本返回结构

建议 `GET /datasets/{id}/revisions` 统一返回：

```json
{
  "items": [
    {
      "revisionId": "rev_xxx",
      "datasetId": "ds_xxx",
      "message": "回滚到 7 月 1 日版本",
      "createdAt": 1720000000000,
      "artifactCount": 3,
      "hasManifest": true,
      "isCurrent": true
    }
  ],
  "total": 1
}
```

### 7.3 附件返回结构

建议 `GET /artifacts` 补充以下字段：

- `category`
- `sourceType`
- `datasetId`
- `revisionId`
- `previewUrl`
- `downloadUrl`
- `hash`

这样前端才能稳定支持：

- 封面图三种来源
- 6 类附件管理
- 下载 / 预览 / 去重

## 8. 权限与鉴权方案

当前 `datasets-api` 更偏原型实现，很多接口仍靠 `user_id` query 参数或弱校验。建议改为：

### 8.1 鉴权

- 网关统一解析登录态
- 通过请求头透传：
  - `X-User-Id`
  - `X-User-Name`
  - `X-User-Roles`
  - `X-User-Permissions`

### 8.2 权限分层

- 普通用户：
  - 查看自己的私有数据集
  - 创建 revision
  - 上传附件
  - 发起发布申请
- 审核员：
  - 查看审核列表
  - 审批 / 驳回
- 管理员：
  - 目录锁
  - 强制撤回
  - 清理异常上传

### 8.3 权限落点

建议后端在以下接口显式鉴权：

- `DELETE /datasets/{id}`
- `DELETE /datasets/{id}/revisions/{rev}`
- `POST /datasets/{id}/withdraw`
- `POST /datasets/{id}/approve`
- `POST /datasets/{id}/reject`
- `POST /locks/directories/{directoryId}`

## 9. 与复验失败工单的映射

### 9.1 第一优先级

这些工单最适合通过“后端接口接通 + 测试数据补齐”直接转为可复验：

- `3-8 数据集导入弹窗`
- `3-9 数据集一键同步`
- `3-10 导入后快捷操作`
- `3-11 导入图层分组管理`
- `3-12 撤销导入功能`
- `3-13 数据集详情页开发`
- `3-18 数据集版本管理`
- `3-20 数据集状态流转`
- `3-22 数据集更新图层`
- `3-23 一键回退打开`
- `3-24 血缘关系标注`
- `3-25 清除导入内容`

### 9.2 第二优先级

这些工单更依赖对象存储、目录结构或更完整的数据闭环：

- `3-15 下载`
- `3-28 目录搜索高亮`
- `3-29 图层点击定位闪烁`
- `3-30 批量显隐控制`
- `3-36 空内容拦截`
- `3-37 重名校验`
- `3-38 大文件上传处理`
- `3-39 网络中断草稿保留`
- `3-40 封面图三种来源`
- `3-41 动态图层时态保存`
- `3-42 6 类附件管理`

## 10. 实施顺序建议

建议按以下顺序推进：

1. 固化代理路径 `/api/eoapi`
2. 联调已存在的 `datasets / revisions / artifacts / publish-status` 接口
3. 产出标准测试数据与账号
4. 打通导入会话与 WebSocket 同步
5. 补发布审核接口
6. 补回滚、目录树、导入查询接口
7. 替换伪预签名为真实对象存储方案

## 11. 验收建议

后端接通完成后，建议按以下顺序复验：

### A. 基础链路

- 数据集列表
- 数据集详情
- 我的仓库列表
- 版本列表
- manifest 读取

### B. 发布链路

- 提交审核
- 审核通过
- 审核驳回
- 发布撤回
- 状态查询

### C. 导入链路

- 导入数据集
- 导入后分组
- 导入后定位
- 撤销导入
- 清除导入

### D. 附件链路

- 上传小文件
- 上传大文件
- 断点续传
- 下载附件
- 封面图设置
- 附件分类展示

## 12. 最小交付清单

如果要以最小成本让当前前端“能跑能验”，建议后端本轮至少交付：

- 统一代理后的 `/api/eoapi` 路由
- 稳定可用的 `datasets / revisions / manifest / artifacts / publish-status`
- 导入会话查询接口
- 发布审核接口
- 一套标准测试数据
- 三类账号权限

做到以上 6 项后，前端当前多数“复验失败”项都可以重新进入复验。

## 13. 建议输出物

建议后端最终交付以下文档或配置：

- 接口 Swagger / OpenAPI
- 统一错误码表
- 测试数据初始化脚本
- 审核账号与权限说明
- 反向代理配置样例
- WebSocket 使用说明

## 14. 一句话方案

本项目后端接口接通的最佳策略不是重写 `eoAPI`，而是以现有 `datasets-api` 为核心，先完成“代理统一、现有接口联调、审核流补齐、导入链路补强、测试数据补齐”，再逐步把附件、大文件、目录树和权限体系做成稳定的业务后端。

## 15. 接口清单表

本节按“方法 / 路径 / 请求 / 响应 / 前端调用文件”输出当前接通清单，便于后端逐项对照联调。

说明：

- `请求` 仅列当前前端实际使用或建议补齐的关键字段。
- `响应` 仅列前端渲染或流程判断依赖的关键字段。
- `前端调用文件` 优先列服务封装文件，再列主要业务页面。

### 15.1 STAC 数据集仓库接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| GET | `/collections` | Query: `bbox?`, `limit?` | `collections[]`, `links[]` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetEntry.vue`；`src/widgets/basic/my-repository/index.vue` |
| GET | `/collections/{collectionId}` | Path: `collectionId` | `id`, `title`, `description`, `extent`, `summaries` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue` |
| GET | `/collections/{collectionId}/items` | Query: `limit?`, `offset?`, `bbox?`, `datetime?` | `features[]` 或 `items[]`，每项含 `id`, `properties.datetime`, `links/assets` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue` |
| GET | `/search` | Query/Body: STAC 标准搜索参数 | `features[]` | 当前方案建议纳入统一代理，前端已有 STAC 搜索能力基础，可供后续专题检索扩展 |

### 15.2 数据集管理接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| GET | `/datasets` | Query: `limit?`, `offset?`；建议后续支持 `ownerOnly?`, `publishStatus?` | `datasets[]` 或数组；每项建议含 `datasetId`, `name`, `description`, `visibility`, `publishStatus`, `rejectionReason`, `coverUrl`, `tags`, `createdAt`, `updatedAt` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/my-repository/index.vue` |
| POST | `/datasets` | Body: `{ name, description?, visibility, tags[] }` | `{ datasetId }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/SaveManifestDialog.vue` |
| DELETE | `/datasets/{datasetId}` | Path: `datasetId` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/my-repository/index.vue` |
| GET | `/datasets/{datasetId}` | 建议新增；Path: `datasetId` | 建议返回完整数据集详情：`datasetId`, `name`, `description`, `visibility`, `publishStatus`, `rejectionReason`, `coverUrl`, `tags`, `ownerId`, `ownerName`, `createdAt`, `updatedAt` | 当前前端暂无统一调用，建议后续由 `my-repository` 与详情抽屉统一改用 |
| PATCH | `/datasets/{datasetId}` | 建议新增；Body: `{ name?, description?, visibility?, tags?, coverUrl? }` | `{ success, dataset }` | 当前前端暂无统一调用，建议用于“更新描述/标签/封面/权限” |
| POST | `/datasets/{datasetId}/share` | Body: `{ visibility, allowFork?, allowView? }` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；当前主流程 UI 未主用 |

### 15.3 版本管理接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| GET | `/datasets/{datasetId}/revisions` | Query: `limit?`, `offset?` | `revisions[]` 或 `items[]`；每项至少含 `revisionId`, `datasetId`, `message`, `createdAt` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue`；`src/widgets/basic/my-repository/index.vue` |
| POST | `/datasets/{datasetId}/revisions` | Body: `{ message?, manifest, artifactRefs? }` | `{ revisionId }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/SaveManifestDialog.vue`；`src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue` |
| DELETE | `/datasets/{datasetId}/revisions/{revisionId}` | Path: `datasetId`, `revisionId` | `{ success, deletedArtifactCount }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue` |
| GET | `/datasets/{datasetId}/revisions/{revisionId}/manifest` | Path: `datasetId`, `revisionId` | `manifest JSON`，至少含 `layers`, `viewState`, `attachments?` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue`；`src/widgets/basic/my-repository/index.vue` |
| GET | `/datasets/{datasetId}/revisions/{revisionId}/manifest.json` | 与上相同 | 与上相同 | 后端已兼容导出，可作为文件下载或直链读取别名 |
| POST | `/datasets/{datasetId}/revisions/{revisionId}/rollback` | 建议新增；Body: `{ message? }` | `{ revisionId }` 或 `{ success, revisionId }` | 当前前端回滚由“读取 manifest + 新建 revision”模拟，建议后续替换 |
| GET | `/datasets/{datasetId}/latest-manifest` | 可选建议新增；无需参数 | `{ manifest, revisionId }` | 当前前端通过“先查 revisions limit=1 再读 manifest”完成，可由后端聚合降低复杂度 |

### 15.4 血缘与派生接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/datasets/{datasetId}/fork` | Body: `{ revisionId?, newName? }` | `{ datasetId, sourceDatasetId, sourceRevisionId, createdAt }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts` |
| GET | `/datasets/{datasetId}/lineage` | Path: `datasetId` | `{ datasetId, parent, sources[], forks[] }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；可供 `DatasetDetail.vue` 后续增强血缘展示 |

### 15.5 发布与审核接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/datasets/{datasetId}/publish-request` | 空 Body 或 `{}` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/SaveManifestDialog.vue`；`src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`；`src/widgets/basic/my-repository/index.vue` |
| POST | `/datasets/{datasetId}/cancel-request` | 空 Body 或 `{}` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`；`src/widgets/basic/my-repository/index.vue` |
| POST | `/datasets/{datasetId}/withdraw` | 空 Body 或 `{}` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue` |
| GET | `/datasets/{datasetId}/publish-status` | Path: `datasetId` | `{ datasetId, status, rejectionReason?, publishRequestedAt?, publishedAt? }` | 前端方案建议纳入稳定对接，当前主要由 `/datasets` 或 `collection.summaries` 字段兜底 |
| GET | `/publish-requests` | 建议新增；Query: `status?`, `ownerId?`, `page?`, `pageSize?` | `{ items: [{ datasetId, name, ownerId, ownerName, requestedAt, status }], total }` | 当前前端无审核端页面，建议为后续审核台准备 |
| POST | `/datasets/{datasetId}/approve` | 建议新增；Body: `{ comment? }` | `{ success, status: "published", publishedAt }` | 当前前端无审核端页面，建议后续补审核入口 |
| POST | `/datasets/{datasetId}/reject` | 建议新增；Body: `{ reason }` | `{ success, status: "private", rejectionReason }` | 当前前端无审核端页面，前端已有 `rejectionReason` 展示预期 |

### 15.6 附件查询与下载接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| GET | `/artifacts` | Query: `datasetId?`, `revisionId?`, `jobId?`, `type?`, `limit?`, `offset?` | `artifacts[]`；每项至少含 `artifactId`, `name`, `type`, `url`, `mime`, `size`, `metadata`, `createdAt`；建议补 `datasetId`, `revisionId`, `previewUrl`, `downloadUrl` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue`；`src/widgets/basic/current-task/index.vue` |
| GET | `/artifacts/{artifactId}` | Path: `artifactId` | 单个 artifact 详情 | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| GET | `/artifacts/{artifactId}/download` | Path: `artifactId` | `{ downloadUrl, expiresAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue`；`src/widgets/basic/current-task/index.vue` |

### 15.7 附件上传与元数据接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/artifacts/upload` | `multipart/form-data`：`file`, `name`, `type`, `description?`, `datasetId?`, `revisionId?`, `jobId?` | `{ artifactId, url, name, type, mime, size, createdAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`；`src/widgets/basic/dataset-repository/components/SaveManifestDialog.vue`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue`；`src/widgets/basic/current-task/index.vue` |
| POST | `/artifacts/{artifactId}/metadata` | Body: 任意键值，如 `{ md5, originalName, lastModified }` | 更新后的 artifact 或 `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| POST | `/artifacts/{artifactId}/link` | Body: `{ datasetId?, revisionId?, jobId? }` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`；`src/widgets/basic/current-task/index.vue` |
| DELETE | `/artifacts/{artifactId}` | Path: `artifactId` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts`；`src/widgets/basic/current-task/index.vue` |
| POST | `/artifacts/dedup-check` | Body: `{ md5, size, mime }` | 命中去重时建议返回 `{ artifactId, url, name, type, mime, size, createdAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |

### 15.8 大文件 / 分片上传接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/artifacts/presigned` | Body: `{ name, type, mime, size }` | `{ uploadUrl, artifactId, expiresAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| POST | `/artifacts/confirm` | Body: `{ artifactId, name, type, datasetId?, revisionId?, jobId? }` | `{ artifactId, url, name, type, mime, size, createdAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| POST | `/artifacts/chunked/init` | Body: `{ name, type, mime, size, chunkCount, chunkSize }` | `{ uploadId, artifactId, chunks: [{ index, uploadUrl, expiresAt }], expiresAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| GET | `/artifacts/chunked/{uploadId}` | Path: `uploadId` | `{ uploadId, artifactId, fileName, fileType, fileSize, mime, uploadedChunks[], chunkCount, chunkSize, expiresAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| PUT | `/artifacts/chunked/{uploadId}/chunks/{chunkIndex}` | 二进制分片流；Header: `Content-Type: application/octet-stream` | 建议返回 `204 No Content` 或 `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| POST | `/artifacts/chunked/complete` | Body: `{ uploadId, artifactId, name, type, mime, size, datasetId?, revisionId?, jobId? }` | `{ artifactId, url, name, type, mime, size, createdAt }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |
| DELETE | `/artifacts/chunked/{uploadId}` | Path: `uploadId` | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-artifacts.ts` |

### 15.9 导入与当前任务接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/imports/sessions` | 当前建议至少含：`datasetId`, `revisionId?`, `mode?`, `targetTaskId?`；若支持精细化导入，建议补 `selectedLayerIds[]` | 建议返回 `{ groupId, datasetId, revisionId, importedLayerIds[], directoryNodes[], defaultViewState?, markers?, createdAt }` | 前端当前尚缺统一服务封装，建议新增到 `eoapi-datasets.ts` 或独立 `eoapi-imports.ts` |
| GET | `/imports/sessions` | 建议新增；Query: `datasetId?`, `taskId?`, `status?`, `limit?`, `offset?` | `{ items: [...], total }` | 建议用于恢复导入历史、复验导入链路 |
| GET | `/imports/sessions/{groupId}` | 建议新增；Path: `groupId` | 返回单次导入结果详情 | 建议用于导入完成后快捷操作恢复 |
| POST | `/imports/sessions/{groupId}/undo` | Path: `groupId` | `{ success, removedLayerIds[], restoredState? }` | 当前前端尚缺统一服务封装，建议补上 |
| POST | `/imports/sessions/{groupId}/clear` | Path: `groupId` | `{ success, removedLayerIds[] }` | 当前前端尚缺统一服务封装，建议补上 |
| WS | `/ws/dataset-sync` | WebSocket；建议握手携带 `datasetId?`, `taskId?`, `token?` | 推送建议含 `{ type, datasetId, revisionId?, reason, payload, ts }` | 前端已有同步基础封装，当前主要用于数据集相关状态刷新 |

### 15.10 收藏接口

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| POST | `/favorites/{datasetId}` | Path: `datasetId`；建议从鉴权上下文识别用户 | `{ success }` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetEntry.vue`；`src/widgets/basic/dataset-repository/components/DatasetDetail.vue` |
| DELETE | `/favorites/{datasetId}` | Path: `datasetId` | `{ success }` | 同上 |
| GET | `/favorites` | 建议支持 Query: `limit?`, `offset?` | `favorites[]`；建议每项含 `datasetId`, `createdAt`, `datasetName?`, `coverUrl?` | `src/widgets/basic/dataset-repository/services/eoapi-datasets.ts`；`src/widgets/basic/dataset-repository/components/DatasetEntry.vue` |

### 15.11 目录树与任务结构接口（建议新增）

| 方法 | 路径 | 请求 | 响应 | 前端调用文件 |
|---|---|---|---|---|
| GET | `/datasets/{datasetId}/tree` | Path: `datasetId`；可选 Query: `revisionId?` | `{ nodes: [{ id, pid, name, type, visible, locked, sourceType, order, datasetId, revisionId }] }` | 建议供 `current-task/index.vue`、`DatasetDetail.vue`、目录树组件统一使用 |
| POST | `/datasets/{datasetId}/tree/reorder` | Body: `{ revisionId?, changes: [{ id, pid?, order }] }` | `{ success }` | 对应目录拖拽排序 |
| POST | `/datasets/{datasetId}/tree/search` | Body: `{ keyword, revisionId? }` | `{ matches: [{ id, name, path, highlightedName }] }` | 对应目录搜索高亮 |

### 15.12 建议的统一返回规范

为减少前端适配成本，建议后端统一遵循以下约束：

1. 列表接口固定返回数组或 `{ items, total }`，不要在不同接口中混用 `datasets / revisions / features / data` 多种壳结构。
2. 时间字段统一返回毫秒时间戳，前端当前大量按 `Number(createdAt)` 解析。
3. 状态字段统一枚举：
   - `visibility`: `private | shared | public`
   - `publishStatus`: `private | reviewing | published`
4. 下载类接口统一返回：

```json
{
  "downloadUrl": "/api/eoapi/artifacts/art_xxx/download/file",
  "expiresAt": 1720000000000
}
```

5. 错误结构建议统一：

```json
{
  "code": 409,
  "message": "数据集名称已存在",
  "detail": "dataset name conflict"
}
```

### 15.13 最小联调顺序

建议后端按以下顺序对照本清单联调：

1. `GET /datasets`
2. `POST /datasets`
3. `GET /datasets/{id}/revisions`
4. `POST /datasets/{id}/revisions`
5. `GET /datasets/{id}/revisions/{rev}/manifest`
6. `GET /artifacts`
7. `POST /artifacts/upload`
8. `GET /artifacts/{id}/download`
9. `POST /datasets/{id}/publish-request`
10. `POST /datasets/{id}/cancel-request`
11. `GET /datasets/{id}/publish-status`
12. `POST /imports/sessions`
13. `POST /imports/sessions/{groupId}/undo`
14. `POST /imports/sessions/{groupId}/clear`

做到以上 14 项后，当前前端的大部分主流程就可以从“界面存在”升级到“可联调、可复验”。
