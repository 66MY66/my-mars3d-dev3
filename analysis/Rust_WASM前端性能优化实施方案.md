# Rust WASM 前端性能优化实施方案

## 1 方案定位

本方案面向当前 Mars3D Cesium 3D WebGIS 项目，目标不是简单替换 JavaScript，而是建立一条可测量、可回退、可逐步扩展的 Rust/WASM 数据处理链路。

方案的核心判断是：Rust/WASM 最适合处理前端中“输入数据大、计算量稳定、结果可序列化、与 UI 解耦”的任务；它不适合直接接管 Cesium 渲染、Vue 响应式系统、网络调度或浏览器 GPU 管线。因此建议采用“主线程负责交互和提交渲染，Worker 负责调度，Rust/WASM 负责高密度计算”的分层架构。

## 2 当前项目与优化目标

项目使用 Vue 3、TypeScript、Mars3D 3.10.12、Cesium、ECharts/ECharts GL，并包含 GeoJSON、栅格、XYZ、地形、3D Tiles、EOAPI、TiTiler、专题工作台、数据导入和媒体导出等功能。

当前最适合从 Rust/WASM 方向验证的工作包括：

- 大 GeoJSON、PBF/MVT 或自定义二进制数据的解析；
- 几何简化、抽稀、坐标转换和索引构建；
- bbox、网格索引、R-tree 等空间查询结构的构建；
- 栅格逐像素计算、分类、重采样和颜色映射；
- 点数据聚合、分桶和视口级数据裁剪；
- Draco 或其他几何压缩格式的 CPU 解码。

优化目标应定义为“降低主线程阻塞和交互延迟”，而不是只比较 Rust 函数的单次执行时间。最终需要同时关注：Long Task、输入延迟、FPS、内存峰值、数据复制次数、WASM 初始化成本和中低端设备表现。

## 3 Rust/WASM 的边界

### 3.1 Rust/WASM 能解决的问题

Rust/WASM 可以将计算密集型逻辑从 JavaScript 主线程中移出，并在 Worker 中执行，从而减少 UI、地图交互和 Cesium 提交所受到的阻塞。对于大数组和规则明确的算法，Rust 的内存布局、TypedArray 互操作和批处理能力较适合以下任务：

1. 对大文件做增量解析、分块解析和字段裁剪。
2. 将大量坐标转换为连续的 Float32Array 或 Float64Array。
3. 对线、面和点进行抽稀、简化、聚合和 bbox 计算。
4. 创建空间索引，支持视口范围、点选和行政区查询。
5. 对像素数组执行分类、阈值处理、色带映射和统计。
6. 对压缩几何或矢量瓦片进行解码。

### 3.2 Rust/WASM 不能直接解决的问题

以下问题不应通过切换语言来掩盖：

- Cesium 的 draw call、shader、纹理采样和 GPU 显存压力；
- `requestRenderMode`、场景持续渲染和 3D Tiles 可见性策略；
- HTTP 请求数量、服务端响应时间、瓦片组织和网络带宽；
- Vue watch 链、组件重复渲染和深层响应式代理；
- `setInterval` 轮询重叠、事件监听器泄漏和组件生命周期问题；
- localStorage 同步读写、重复 JSON 序列化和大对象持久化；
- 首屏加载了过多 ECharts、XLSX、PDF、GIF 或其他重型依赖。

因此，Rust/WASM 是数据处理加速层，而不是全局性能开关。

## 4 推荐总体架构

```text
数据服务
  ├─ 视口 bbox / 时间 / 字段过滤
  ├─ 瓦片化与多级 LOD
  └─ 预聚合与缓存

主线程
  ├─ Vue UI 与交互状态
  ├─ Mars3D / Cesium 场景与图层
  ├─ 轻量结果状态
  └─ Worker 调度器

Worker
  ├─ 任务队列、取消、优先级和版本校验
  ├─ Rust/WASM 解码与计算
  ├─ TypedArray / ArrayBuffer 管理
  └─ 分块结果回传
```

主线程不应把原始大 GeoJSON 或像素矩阵直接放入 Vue 深层响应式对象。Worker 接收 ArrayBuffer、文件分片或 URL，返回经过裁剪、简化和索引后的结果。主线程只保存当前视口或当前任务所需的轻量结果，并将结果提交给地图或图表。

## 5 Worker 与 WASM 的职责划分

### 5.1 Worker 负责调度

Worker 层应提供统一任务协议，而不是让每个业务组件直接调用 WASM 函数。建议每个任务包含：

```ts
type TaskRequest = {
  taskId: string
  version: number
  operation: string
  payload: ArrayBuffer | Uint8Array | Record<string, unknown>
  options?: Record<string, unknown>
}
```

返回值应包含任务状态、处理统计和可转移结果：

```ts
type TaskResponse = {
  taskId: string
  version: number
  ok: boolean
  result?: ArrayBuffer | Record<string, unknown>
  stats?: { inputBytes: number; outputBytes: number; elapsedMs: number }
  error?: { code: string; message: string }
}
```

Worker 需要支持以下能力：

- 任务排队和优先级；
- 新版本任务取消旧版本任务；
- 页面关闭或图层隐藏时主动取消；
- 分块结果回传；
- 过期结果丢弃；
- 统计 WASM 初始化、计算和数据传输时间；
- 异常时回退到 JavaScript 实现或服务端结果。

### 5.2 Rust/WASM 负责纯计算

Rust 模块应尽量保持纯函数特征：输入明确、输出明确、不访问 DOM、不持有 Cesium 对象、不依赖 Vue 状态。建议优先使用连续内存和数值数组，减少字符串和深层对象在 JS 与 WASM 之间往返。

不建议把大量小对象逐个传给 WASM。更适合的方式是：

```text
GeoJSON / PBF / 栅格文件
  → ArrayBuffer
  → Worker
  → Rust/WASM
  → 连续坐标数组、索引数组、属性列、统计结果
  → 主线程
```

## 6 三类核心业务的落地设计

### 6.1 大 GeoJSON 和矢量数据

#### 建议流程

1. 主线程读取文件或接收网络响应，不把完整文本复制到多个响应式对象。
2. 将 ArrayBuffer 转移给 Worker。
3. Worker 调用 Rust/WASM 做解析、字段裁剪、坐标转换和 bbox 计算。
4. 根据当前视口进行空间过滤和几何简化。
5. 按块返回点、线、面结果。
6. 主线程把结果转成 Mars3D 所需的最小对象，并分批加入图层。

#### 关键原则

- 不要把完整原始 GeoJSON 作为 Vue reactive 状态保存。
- 属性字段采用列式或紧凑结构，显示时再按需还原。
- 几何和属性分离，避免点选时复制完整 Feature。
- 视口变化时只提交增量请求，不重复解析整份数据。
- 对高缩放级别使用更细几何，对远景使用抽稀结果。

### 6.2 几何简化和空间索引

几何简化与空间索引非常适合 Rust/WASM，因为它们是确定性算法，输入和输出边界清晰，并且可以在 Worker 中批量执行。

建议建立以下处理链：

```text
原始几何
  → 坐标标准化
  → bbox 预计算
  → LOD 几何简化
  → R-tree / 网格索引
  → 视口查询
  → Mars3D 图层提交
```

索引需要绑定数据版本和图层版本。数据更新时生成新索引，不在主线程中原地修改大型索引。点选和框选只返回命中的 ID，再由主线程按需读取属性。

### 6.3 栅格像素处理

栅格处理建议采用 Worker + OffscreenCanvas 或 Worker + TypedArray。Rust/WASM 负责像素分类、阈值、色带、归一化和统计，浏览器 Canvas 负责最终显示或导出。

处理链建议为：

```text
ImageBitmap / 原始像素
  → Worker
  → Rust/WASM 像素计算
  → Uint8ClampedArray
  → OffscreenCanvas 或主线程 Canvas
  → 预览 / 导出
```

预览阶段应限制分辨率和计算频率，用户点击导出时再处理原始分辨率。颜色映射参数变化时，只重算必要的像素通道，不重复加载原始文件。

## 7 数据传输与内存设计

### 7.1 优先使用 Transferable

大数组通过 `postMessage(data, [data.buffer])` 转移所有权，避免结构化克隆。转移后原线程不能继续使用该 ArrayBuffer，因此必须明确所有权和生命周期。

### 7.2 控制复制链

需要避免以下数据链：

```text
Response → string → JSON 对象 → reactive 对象 → 图层对象 → 导出对象
```

应尽量变为：

```text
Response ArrayBuffer → Worker → 紧凑数组 → 当前视口结果 → 图层对象
```

### 7.3 分块与背压

单次回传过大的结果会重新阻塞主线程。建议以固定字节数、Feature 数量或时间片为单位分块回传，并设置背压：当地图提交速度低于 Worker 计算速度时，暂停继续发送或丢弃过期块。

## 8 性能基线与验收指标

Rust/WASM 项目必须先建立 JavaScript 基线，再比较迁移后的结果。建议至少记录以下指标：

| 指标 | 基线方式 | 目标方向 |
|---|---|---|
| 主线程 Long Task | Chrome Performance | 数量和最长时长下降 |
| 输入延迟 | Interaction to Next Paint / Performance | 交互期间无明显长阻塞 |
| Worker 计算耗时 | task stats | 总耗时不高于 JS 基线 |
| WASM 初始化时间 | 首次任务与热任务分开记录 | 通过复用实例摊平 |
| JS 与 WASM 复制耗时 | 记录 clone/transfer | 以 Transferable 为主 |
| 内存峰值 | Chrome Memory | 不因缓存和索引持续增长 |
| 地图帧率 | Cesium/Performance | 数据处理期间保持可交互 |
| 结果提交耗时 | 主线程埋点 | 分块提交、避免单次突刺 |

验收必须覆盖桌面高性能设备和中低端设备，并分别测试冷启动、热启动、首次数据加载、重复加载、取消任务、切换图层和页面销毁。

## 9 分阶段实施路线

### 阶段一 建立基线

- 为 GeoJSON 导入、栅格预览、点聚合和空间查询增加耗时埋点。
- 记录 JS 解析、计算、对象构造、地图提交和 GC 时间。
- 建立固定数据集和固定操作脚本。
- 形成 JavaScript 版本的正确性和性能基准。

### 阶段二 完成 Worker 化

- 先将现有 JavaScript 计算迁移到 Worker，确认主线程是否明显改善。
- 建立任务 ID、取消、版本和分块回传机制。
- 将原始数据从 Vue 响应式状态中移出。
- 只有在 Worker 化后仍存在明显计算瓶颈时，才引入 Rust/WASM。

### 阶段三 Rust/WASM 试点

建议优先选择“栅格像素处理”或“大 GeoJSON 解析 + bbox + 抽稀”作为试点。原因是输入输出清晰、容易与 JavaScript 实现对比、收益可以通过主线程阻塞和处理耗时直接衡量。

试点必须包含：

- JavaScript 参考实现；
- Rust 单元测试和边界数据；
- wasm-bindgen 接口测试；
- Worker 集成测试；
- 取消和异常回退测试；
- 大数据、空数据、坏数据和极端坐标测试。

### 阶段四 扩展到空间索引和矢量瓦片

在试点验证通过后，再迁移 PBF/MVT 解码、空间索引、几何简化和点聚合。此阶段重点关注内存复用、索引更新、视口变化时的增量计算和结果背压。

### 阶段五 评估复杂几何解码

最后再评估 Draco、复杂 3D Tiles 或自定义几何解码。此类任务需要确认 Cesium/Mars3D 是否允许替换解码路径，并核对版本兼容性、线程安全、浏览器支持和数据格式稳定性。

## 10 风险与控制措施

### 10.1 WASM 初始化抵消收益

控制措施：Worker 长驻、WASM 模块复用、预热和冷启动单独统计。小任务不进入 WASM，设置最小数据量阈值。

### 10.2 JS 与 WASM 数据复制过多

控制措施：优先 ArrayBuffer、TypedArray 和 Transferable；避免 JSON 字符串和对象数组在边界反复转换。

### 10.3 结果提交仍阻塞主线程

控制措施：分块回传、按帧提交、限制单帧加入 Graphic 的数量，并在地图不可见时暂停低优先级结果。

### 10.4 Rust 版本与浏览器兼容性

控制措施：明确最低浏览器版本，保留 JavaScript 回退路径，对 SharedArrayBuffer、OffscreenCanvas、WebAssembly SIMD 等能力进行特性检测。

### 10.5 正确性和坐标精度风险

控制措施：对坐标转换、投影、几何简化和栅格数值建立 golden dataset，对误差、空值、NaN、经度跨越和极端范围进行专项测试。

### 10.6 工程复杂度上升

控制措施：先统一任务协议和 Worker 调度器，再增加 WASM 算法；禁止业务组件直接管理底层 WASM 内存；每个迁移点都必须有回退开关。

## 11 最终建议

本项目适合引入 Rust/WASM，但应定位为“前端数据计算加速层”，而不是替代 Mars3D/Cesium 或重写整个前端。最可行的路线是：先建立基线，再 Worker 化，再选择一个可量化的 Rust/WASM 试点，最后扩展到解码、几何简化和空间索引。

建议的第一批目标为：

1. 大 GeoJSON 的解析、字段裁剪、bbox 和抽稀；
2. 栅格像素处理和预览计算；
3. 点数据聚合和空间索引；
4. PBF/MVT 或自定义矢量数据解码。

如果性能采样显示主要瓶颈来自 GPU、3D Tiles 内容、持续渲染或网络服务，Rust/WASM 不能作为主要解决方案，应同步推进 LOD、图层可见性、服务端切片、请求控制和 Cesium 渲染策略优化。

