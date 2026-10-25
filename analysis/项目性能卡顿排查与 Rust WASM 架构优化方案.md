# 项目性能卡顿排查与 Rust WASM 架构优化方案

## 1 结论摘要

本项目的卡顿不太可能由单一原因造成，更可能是主线程计算、数据处理、轮询与响应式更新、Cesium 持续渲染以及多源图层和瓦片请求叠加的结果。

Rust/WASM 具有明确价值，但适用范围主要是数据解码、几何计算、空间索引和栅格像素处理，不能直接解决 GPU draw call、Cesium 内部调度、网络传输或数据组织问题。建议先通过浏览器 Performance、Memory、Network 和 Cesium 指标确认热点，再将稳定且计算密集的任务迁移到 Worker + Rust/WASM。

本文基于当前仓库代码与配置进行静态排查，不替代真实设备上的运行时采样。

## 2 项目技术结构

项目采用 Vue 3、TypeScript、Mars3D 3.10.12、Cesium、Vite、ECharts/ECharts GL，并同时承担地图渲染、专题分析、GeoJSON/栅格处理、文件导入导出、任务轮询和 EOAPI 数据访问。

重点入口包括：

- `src/components/mars-work/mars-map.vue`
- `src/widgets/basic/thematic-workbench/index.vue`
- `src/widgets/basic/eoapi-workbench/map.ts`
- `public/config/config.json`

依赖入口为 `package.json`。其中 ECharts、XLSX、JSZip、jsPDF、Three、SHP 解析等依赖均可能影响首屏和主线程负载。

## 3 四层性能排查

### 3.1 渲染层

`public/config/config.json` 当前设置了 `requestRenderMode: false`，意味着 Cesium 持续渲染，即使场景没有变化也会持续消耗 GPU 和浏览器合成资源。同时设置了 `preserveDrawingBuffer: true`，会为截图和导出保留帧缓冲，可能增加显存和合成开销。

`mars-map.vue` 中还明确保留了禁用 requestRenderMode 的兼容性说明。这表明项目当前优先保证图层切换后的可见性，但代价是空闲场景仍持续渲染。

配置中包含地形、XYZ 底图、GeoJSON 和多个 3D Tiles 图层。需要在实际运行时确认可见 tile 数量、draw call、GPU 时间、纹理显存、地形请求数量以及地图空闲时的 FPS。

Rust/WASM 对该层帮助有限，不能直接减少 Cesium draw call、shader 开销、纹理采样或浏览器 GPU 队列压力。

### 3.2 调度层

专题工作台同时承担地震数据、GeoJSON、栅格处理、图表、模板、地图联动、导出和历史记录等职责。`index.vue` 中存在全量 JSON 快照比较、深拷贝、ECharts 初始化、Canvas 图像处理和多处导出逻辑，容易形成状态变化到地图、图表和 Canvas 的级联更新。

最值得优先验证的代码是：

```ts
const isDirty = computed(() => JSON.stringify(snapshotDraft()) !== savedDraftJson.value)
```

项目中还存在多个 `setInterval`、`setTimeout` 和轮询点。需要确认组件重复打开后旧 timer 是否仍存在，异步轮询是否重叠，页面隐藏和任务完成后是否真正停止，以及同一任务是否被多个组件重复轮询。

这些问题属于调度和生命周期问题，Rust/WASM 不能直接解决。

### 3.3 数据解码层

数据解码层是最适合引入 Worker/WASM 的位置。当前代码存在大 JSON/GeoJSON 主线程解析、栅格逐像素处理、`getImageData`/`putImageData`、Canvas 导出、视频帧编码等场景。

典型热点包括：

- `thematic-workbench/index.vue` 中的 GeoJSON 导入和结果导出；
- `DisplaySettings.vue` 中的图像读取、逐像素处理和深拷贝；
- `export-media.ts` 中的 Canvas 绘制、像素读取、VideoFrame 创建和编码循环。

这类任务可以采用 Worker + OffscreenCanvas 或 Worker + TypedArray。大数组应使用 Transferable ArrayBuffer，避免结构化克隆。

### 3.4 数据层

项目多处同步读写 `localStorage`，并对 manifest、上传状态、专题草稿和统计状态执行 JSON 序列化。大对象同步写入会阻塞主线程，建议改为 IndexedDB、增量写入或批量写入。

分片上传默认并发数为 5，上传期间会同时发生文件读取、网络请求、状态更新和 UI 刷新，应根据设备与网络动态限流。

项目同时使用 Mars3D 地形、高德/天地图瓦片、TiTiler、EOAPI、GeoJSON 服务和多组 3D Tiles，需要通过 Network 确认重复请求、旧请求未取消、失败重试风暴和切换图层后的残留请求。

## 4 非渲染引擎的优化点

### 4.1 主线程计算

- 全量 `JSON.stringify` dirty 检测；
- `JSON.parse(JSON.stringify(...))` 深拷贝；
- 大 GeoJSON 解析；
- 栅格逐像素处理；
- 行政区空间判断、bbox 计算和点聚合；
- 视频、GIF、PDF 导出；
- 模板预览和图表数据转换。

### 4.2 调度和响应式

- 对大型 GeoJSON、图表数据和栅格数据使用 `shallowRef` 或 `markRaw`；
- 合并重复 watch；
- 对拖动、缩放、输入和相机变化统一使用 requestAnimationFrame；
- 对分析、搜索和预览输入使用 debounce；
- 为异步任务增加任务 ID、取消机制和过期结果丢弃；
- 避免一次状态变化同时触发地图、图表、模板和持久化。

### 4.3 网络和请求

- 请求去重和缓存；
- AbortController；
- 请求并发池；
- 轮询改成请求完成后再安排下一次；
- 页面隐藏时暂停低优先级轮询；
- 根据视口 bbox、时间和字段进行服务端过滤；
- 避免全量拉取 STAC 或 GeoJSON。

### 4.4 数据组织

- 大 GeoJSON 不直接进入深层响应式；
- 对点数据做分层、抽稀和聚合；
- 对行政区预先建立 bbox 和空间索引；
- 对栅格预先生成多级瓦片和缩略图；
- 检查 3D Tiles 的层级、几何误差、纹理大小和 tile 内容组织；
- 优先使用 MVT、FlatGeobuf 或其他适合切片/流式读取的格式。

### 4.5 生命周期和构建

- 统一 dispose ECharts；
- 统一销毁 Worker、Timer、AbortController、事件监听器和 Blob URL；
- 限制 undo 历史数量；
- 动态加载 ECharts、XLSX、PDF、GIF、SHP 等重依赖；
- 检查生产环境是否保留高频 console；
- 通过构建分析确认真实首屏 JavaScript 和 Cesium chunk 大小。

## 5 Rust/WASM 可行性判断

### 5.1 适合迁移的任务

| 场景 | 适合程度 | 判断 |
|---|---:|---|
| 大 GeoJSON/二进制数据解析 | 高 | 计算密集且结构稳定 |
| PBF/MVT 解码 | 高 | 适合线性内存和 TypedArray |
| Draco 或自定义几何解码 | 高 | CPU 密集，适合 Worker 隔离 |
| 几何简化、抽稀、法线和索引计算 | 高 | 算法型计算，易于基准测试 |
| bbox、R-tree、网格索引 | 高 | 适合构建可复用空间索引 |
| 栅格逐像素处理 | 高 | Rust + Worker + TypedArray 适配度高 |
| 点数据聚合 | 中高 | 需要分块、增量和取消 |
| JSON dirty 检测 | 低 | 更应改成增量状态管理 |
| localStorage/IndexedDB | 低 | 瓶颈是存储 API 和调用方式 |
| HTTP 请求调度 | 低 | 属于应用调度问题 |
| Vue 响应式更新 | 无 | WASM 不会替代 Vue 调度 |
| Cesium tile 调度 | 很低 | 受引擎内部实现约束 |
| WebGL/GPU draw call | 无 | WASM 不能直接优化 GPU 管线 |

### 5.2 推荐架构

```text
主线程：Vue UI、Cesium/Mars3D、轻量状态、Worker 调度
Worker：Rust/WASM 解码、几何简化、空间索引、栅格处理
数据服务：bbox/时间/字段过滤、瓦片化、服务端聚合、多级 LOD
```

WASM 不应直接操作 Cesium 对象。Worker 负责调度和取消，Rust/WASM 输出 TypedArray、顶点缓冲、索引或轻量结构，主线程只负责将结果提交给 Mars3D/Cesium。任务必须支持分块、版本号、取消和过期结果丢弃。

## 6 落地方案

### P0 运行时确认

使用 Chrome Performance 录制首次打开地图、打开专题工作台、加载大 GeoJSON、切图层、缩放地图、栅格预览和媒体导出等场景。记录 Long Task、JS self time、GC、JSON.stringify、getImageData、Vue 更新、ECharts 更新、Cesium render、网络等待和 GPU 帧时间。

使用 Memory 观察专题工作台、图层管理和任务组件反复打开关闭后的 JS Heap。使用 Network 检查重复请求、轮询重叠、失败重试和旧瓦片下载。

### P1 先做非 Rust 治理

1. 将全量 dirty 序列化改为增量 dirty 标记。
2. 大对象使用 shallowRef/markRaw，避免深响应式。
3. 合并重复 watch，统一调度和 debounce。
4. 轮询改成串行调度并增加 AbortController。
5. 统一 ECharts、Worker、Timer 和 Blob URL 生命周期。
6. 将 localStorage 改为 IndexedDB 或增量持久化。
7. 对 ECharts、XLSX、PDF、GIF、SHP 使用动态导入。

### P2 WASM 试点

建议顺序为：栅格像素处理、大 GeoJSON 解析和 bbox、点数据抽稀与网格聚合、PBF/MVT 解码、几何简化与空间索引，最后再评估复杂 3D Tiles/Draco 解码。

每个试点都应比较主线程阻塞时间、Long Task 数量、总耗时、内存峰值、初始化成本、JS/WASM 数据复制成本以及中低端设备收益。

## 7 最终判断

当前最值得优先怀疑的因素是：专题工作台主线程计算过重；Canvas、栅格和媒体导出未 Worker 化；大 JSON/GeoJSON 解析和对象转换；全量快照、深拷贝和响应式更新；轮询和异步任务重叠；持续渲染；preserveDrawingBuffer；多图层和多 3D Tiles 叠加；同步 localStorage；以及首屏依赖过重。

推荐对外表述为：不是“切换到 Rust 就能解决卡顿”，而是“先用性能数据确认瓶颈，再把稳定、计算密集、数据密集的前端任务迁移到 Worker + Rust/WASM，同时治理渲染策略、任务调度、响应式更新、网络请求和数据组织”。

