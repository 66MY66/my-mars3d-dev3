# eoAPI 数据集存储分析报告（聚焦：图层与版本）

适用范围：/program/eoAPI（后端）与 /program/Mars3D/mars3d（前端对接方）  
报告目标：从 eoAPI 后端源码出发，梳理数据集存储的核心实现逻辑，重点围绕“图层（layers）”与“版本（revisions）”两条主线，说明存储结构、元数据管理、索引、权限与服务链路，以及 CRUD/生命周期与回滚路径。  
说明：本报告以仓库现状为准；其中 STAC FastAPI / pgstac / TiTiler / TiPG 等为第三方镜像组件，本文仅说明其在当前项目中的编排、调用与映射方式。

---

## 1. 部署架构与数据流总览

### 1.1 组件拆分（按 docker-compose）

编排文件：[docker-compose.yml](file:///program/eoAPI/docker-compose.yml)

- datasets-api（5960）：自研 FastAPI，负责“用户数据集”与“版本/manifest/附件/收藏/统计”。
- stac-fastapi（5951）：第三方 stac-fastapi-pgstac 镜像，负责 STAC Collections/Items、搜索与空间索引查询。
- titiler-pgstac（5952）：第三方瓦片服务（基于 pgstac 镶嵌/切片）。
- titiler（5955）：第三方瓦片服务（本地 COG/DEM 等文件切片）。
- tipg（5953）：第三方矢量 API 服务。
- database（5950→5432）：pgstac + PostGIS（实际存储层）。

### 1.2 核心存储落点（关键结论）

eoAPI 项目中“数据集/版本”的持久化主要发生在同一个 Postgres（pgstac 容器）内：

- datasets-api 自建表（用于管理能力）：`eoapi_datasets`、`eoapi_dataset_revisions`、`eoapi_artifacts`、`eoapi_chunked_uploads`、`eoapi_favorites`、`eoapi_metric_events`  
  定义见：[app.py:_init_db](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L340-L475)
- STAC Collections/Items 由 pgstac 管理（datasets-api 通过 pgstac 的 upsert 函数写入映射数据）：
  - `pgstac.upsert_collection(jsonb)`  
    见：[app.py:_upsert_stac_collection](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L285-L303)
  - `pgstac.upsert_item(jsonb)`  
    见：[app.py:_upsert_stac_item](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L305-L338)

---

## 2. 图层方向：存储结构、元数据、索引、权限与服务链路

### 2.1 图层在后端的“实体形态”（关键结论）

在 datasets-api 源码中，图层并不是一张独立的数据库表，也没有“图层级 CRUD API”。图层数据以 **manifest 的一部分**整体存储：

- 图层承载：`eoapi_dataset_revisions.manifest`（JSONB）内部的 `manifest.layers` 数组（由前端或上游生成）。
- 后端行为：写入时不做结构化拆解；读取时原样返回。

插入位置（版本创建写入 manifest）：[create_revision](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L590-L628)  
读取位置（按版本取 manifest）：[get_manifest](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L631-L647)

### 2.2 图层元数据管理方式

图层元数据（示例字段：`id/name/sourceType/sourceRef/pid/order/visible/opacity/options/data...`）全部位于 manifest JSON 内，由前端/业务决定，datasets-api 不校验也不维护其一致性。

datasets-api 管理的“元数据”粒度主要在数据集与版本级：
- 数据集级：`eoapi_datasets`（name/description/visibility/tags/publish_status/时间戳等）
- 版本级：`eoapi_dataset_revisions`（message/created_at_ms/manifest/artifact_refs）

### 2.3 空间索引实现（版本级索引，不是图层级）

datasets-api 为了让“用户数据集”也能通过 STAC 方式被检索，会把版本（revision）同步映射为 STAC Item，并写入 bbox 与 geometry：

- bbox 取自 `manifest.viewState.bbox`，不合法则回退全球范围  
  见：[app.py:_manifest_bbox](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L233-L245)
- geometry 为 bbox 转 Polygon  
  见：[app.py:_bbox_to_polygon](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L217-L231)
- 写入 STAC Item（pgstac.upsert_item）  
  见：[app.py:_upsert_stac_item](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L305-L338)

结论：
- 当前 eoAPI 的空间索引可用粒度是“版本（Item）级”。
- 不存在“图层级空间索引”（无法按单独图层做空间过滤或检索）。

### 2.4 权限配置逻辑（现状）

datasets-api 源码没有实现鉴权/认证（无 token、无用户体系）。所谓权限相关字段主要是元数据表达：

- 数据集创建时可写 `visibility`（private/shared/public）  
  见：[CreateDatasetRequest](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L32-L37)、[create_dataset](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L542-L563)
- 发布状态字段 `publish_status`（private/reviewing/published）及相关时间戳  
  见：[publish_request/cancel/withdraw/get_publish_status](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L654-L745)
- favorites/metrics 默认 `user_id=anonymous`（无真正用户隔离）  
  见：[favorites](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L1150-L1205)、[metrics](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L1207-L1288)

结论：
- visibility/publish_status 在当前实现中不会阻断访问（list/get 接口未根据权限过滤）。
- 若需要“图层级权限”，必须扩展 manifest schema 并在导入/渲染链路增加过滤与鉴权。

### 2.5 图层服务调用链路（端到端）

图层服务在系统中的角色分工如下：

- datasets-api：存储与分发 manifest（含图层定义）
- stac-fastapi（pgstac）：提供 Collections/Items、搜索、空间过滤等 STAC 能力
- titiler/titiler-pgstac：根据 URL/collection/item 等参数生成瓦片
- tipg：提供矢量服务能力（与 Postgres 相连）
- 前端（mars3d）：把 manifest.layers 转换为 Mars3D 图层对象并加载到地图

典型链路：
1) 前端获取版本列表：`GET /collections/{datasetId}/items`（5951）  
2) 前端获取版本 manifest：`GET /datasets/{datasetId}/revisions/{revisionId}/manifest`（5960）或通过 STAC item.assets.manifest.href 跳转  
3) 前端根据 manifest.layers 的 sourceRef/sourceType 等生成实际图层，向 titiler/tipg 发起瓦片/矢量请求

---

## 3. 版本方向：管控机制、隔离存储、变更记录、多版本与回滚

### 3.1 版本的定义与生成规则

版本存储表：`eoapi_dataset_revisions`（主键：dataset_id + revision_id）  
表定义见：[app.py:_init_db](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L366-L382)

版本创建 API：
- `POST /datasets/{dataset_id}/revisions`  
  见：[create_revision](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L590-L628)

版本号（revision_id）命名规则（现实现）：
- `revision_id = f"rev_{_now_ms()}"`  
  见：[create_revision](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L591-L593)

版本列表：
- `GET /datasets/{dataset_id}/revisions`（按 created_at_ms desc）  
  见：[list_revisions](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L566-L588)

### 3.2 版本数据隔离存储方案（快照式）

每个版本存一份完整 `manifest` JSONB，这是一种典型快照模型：
- 新版本不会覆盖旧版本的 manifest
- 读取某个版本时按 `(dataset_id, revision_id)` 精确返回

读取 API：
- `GET /datasets/{dataset_id}/revisions/{revision_id}/manifest`  
  见：[get_manifest](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L631-L647)

### 3.3 版本迭代的变更记录存储方式（现状）

变更记录字段只有：
- `message`（版本说明）
- `created_at_ms`
- `artifact_refs`（与附件关联用）

没有：
- manifest 的 diff/patch
- 变更集/操作日志（如“新增图层/删除图层/改名/调序”等结构化事件）

结论：要对比版本差异只能对比两份 manifest JSON 内容。

### 3.4 多版本共存的资源调度逻辑

从 datasets-api 源码看，“调度”主要体现为：
- 每个 revision 同步为 STAC Item，供 stac-fastapi 查询与检索  
  见：[app.py:_upsert_stac_item](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L305-L338)
- Item 里写入 manifest 的 links/assets，使前端可从 STAC 侧发现 manifest  
  manifest_href 规则：`/api/eoapi/datasets/{dataset_id}/revisions/{revision_id}/manifest`  
  见：[app.py:_upsert_stac_item](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L307-L335)

真正的“资源访问与渲染调度”发生在：
- titiler/tipg（按 URL/collection/item/资产参数做切片/查询）
- 前端导入策略（overlay/replace）与图层冲突处理（不在 eoAPI 后端内）

### 3.5 版本回滚实现路径（现状可行路径）

datasets-api 未提供 `rollback` 或 `delete revision` 的专用接口。按当前模型，“回滚”应采用：
1) 读取目标旧版本 manifest：`GET /datasets/{dataset_id}/revisions/{old_revision}/manifest`
2) 创建一个新版本，把旧 manifest 原样提交（message 可写“回滚到 old_revision”）：`POST /datasets/{dataset_id}/revisions`

结果：产生一个新的 revision_id，作为“回滚后的当前版本”。

---

## 4. 图层与版本的耦合点（风险与一致性约束）

### 4.1 STAC 映射的一致性约束

datasets-api 在创建数据集/版本后，会尝试 upsert STAC collection/item。若 upsert 失败（异常被吞掉），可能出现：
- datasets-api 数据存在，但 stac-fastapi 侧不可见或不完整

相关逻辑：
- 创建数据集后：尝试 `_upsert_stac_collection`，失败忽略  
  见：[create_dataset](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L559-L563)
- 创建版本后：尝试 `_upsert_stac_collection` + `_upsert_stac_item`，失败忽略  
  见：[create_revision](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L617-L627)

### 4.2 版本空间范围质量

版本 bbox 完全由 `manifest.viewState.bbox` 决定。若该 bbox 缺失/不合法，会退化为全球范围，影响：
- STAC 侧空间检索准确性
- 前端定位/预览准确性

逻辑见：[app.py:_manifest_bbox](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L233-L245)

### 4.3 图层可用性依赖 manifest 质量

datasets-api 不校验 `manifest.layers`；即使为空也会存储并返回。  
因此图层是否可导入、是否呈现预期层级与顺序，完全依赖前端生成 manifest 时的规范性。

---

## 5. 数据库表与索引（datasets-api 自建部分）

初始化逻辑：[app.py:_init_db](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L340-L475)

- `eoapi_datasets`
  - 主键：dataset_id
  - 元数据：name/description/visibility/tags
  - 发布：publish_status/publish_requested_at_ms/published_at_ms/rejection_reason
  - 时间：created_at_ms/updated_at_ms
- `eoapi_dataset_revisions`
  - 主键：(dataset_id, revision_id)
  - 存储：manifest(jsonb)、artifact_refs(jsonb)、message、created_at_ms
  - 索引：`idx_eoapi_dataset_revisions_dataset (dataset_id, created_at_ms desc)`
- `eoapi_artifacts`
  - 本地文件 URL：`/uploads/artifacts/{artifactId}.{ext}`（文件实际写入容器目录 `/app/uploads/artifacts`）
  - 索引：dataset_id、revision_id、job_id、type 多个索引
- `eoapi_chunked_uploads`：分片上传状态
- `eoapi_favorites`：收藏（dataset_id + user_id）
- `eoapi_metric_events`：事件埋点（dataset_id / revision_id / event_type）

---

## 6. CRUD 全流程（按“图层/版本”拆解）

### 6.1 图层（manifest.layers）CRUD（快照模式）

- 创建图层：创建新版本时提交包含新图层的 manifest（后端不单独存 layer）
- 更新图层：创建新版本时提交更新后的 manifest（覆盖在新版本快照中）
- 查询图层：查询指定版本的 manifest 并读取 layers
- 删除图层：创建新版本时提交不包含该 layer 的 manifest

### 6.2 版本 CRUD/生命周期

- 创建：`POST /datasets` → `POST /datasets/{id}/revisions`
- 查询：
  - 数据集列表：`GET /datasets`（datasets-api）或 `GET /collections`（stac-fastapi）
  - 版本列表：`GET /datasets/{id}/revisions`（datasets-api）或 `GET /collections/{id}/items`（stac-fastapi）
  - 版本内容：`GET /datasets/{id}/revisions/{rev}/manifest`
- 删除：未提供 API（数据库层面支持 cascade，但源码未实现 endpoint）
- 回滚：读取旧 manifest → 创建新 revision（见 3.5）

---

## 7. 与前端（Mars3D 数据集仓库）对接的关键约定

前端获取版本/manifest 的优先级与兼容策略见：
- [getRevisionManifest](file:///program/Mars3D/mars3d/src/widgets/basic/dataset-repository/services/eoapi-datasets.ts#L702-L819)

关键点：
- 若后端提供 `/datasets/.../manifest`：直接使用 datasets-api 存储的 manifest
- 若仅提供 STAC：尝试从 STAC item 的 `links.rel=manifest` 或 `assets.manifest.href` 获取
- 若仍无：前端会从 STAC assets 构建 fallback manifest（用于把“版本与图层”分离并可导入）

---

## 8. 现状缺口与改进方向（用于后续规划）

- 图层级能力缺口：
  - 无 layer 表/索引 → 不能做图层级检索、权限、统计
  - 无图层级 CRUD → 必须走“新版本快照”模型
- 权限缺口：
  - 无鉴权体系 → visibility/publish_status 仅为标签
  - 若要实现“版本/图层权限”，需引入用户身份与鉴权中间件，并将权限落库
- 存储可靠性：
  - artifacts 默认写入容器内目录 `/app/uploads/artifacts`，compose 未挂载 volume 时重建会丢数据（建议为 uploads 绑定持久卷）
- 版本治理：
  - 无 diff/变更集 → 如需审计/回滚/合并策略，建议引入结构化变更记录（例如把图层操作写入 revisions 的 change-log 表）

---

## 9. 源码定位索引（快速入口）

- datasets-api 主实现：[app.py](file:///program/eoAPI/dockerfiles/datasets_api/app.py)
  - DB 初始化：[_init_db](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L340-L475)
  - STAC 映射：[_upsert_stac_collection](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L285-L303)、[_upsert_stac_item](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L305-L338)
  - 版本 API：[/datasets/{id}/revisions](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L566-L647)
  - 附件 API：[/artifacts...](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L748-L1148)
  - 收藏/统计：[/favorites](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L1150-L1205)、[/metrics](file:///program/eoAPI/dockerfiles/datasets_api/app.py#L1207-L1288)
- 服务编排：[docker-compose.yml](file:///program/eoAPI/docker-compose.yml)

