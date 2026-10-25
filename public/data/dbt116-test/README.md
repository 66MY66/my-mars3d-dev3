# 地震应急响应制图测试数据

本目录与业务数据分离。所有 `T*.json` 均为**本地合成测试数据**，不是实际地震、烈度评估、行政区、人口或救灾建议。不得用于应急决策、公开发布或正式业务出图。

## 在页面中测试

当前统一使用原有“专题制图工作台”：同一“模板库”包含六类应急响应规范模板与原有 22 个分析辅助模板。六类模板依据用户提供的《地震应急响应专题图制作要求》2025-05-05 报批稿及 DB/T 101-2024 分类，选择后进入原“编辑”页。点击“加载测试数据”即可查看本目录对应 `T*.json` 的实际渲染，不使用规范的整幅示例截图替代图件。

两类模板都使用原 `CartographyComposer` 排版工作台。六类规范模板的实际渲染按标题、主图、说明与统计、图例、来源、制作单位、时间、比例尺等区块进入排版，支持移动、旋转和撤销；说明与单位修改回写右侧数据编辑。自由调整后的输出是带水印校样。正式输出目前要求恢复受支持的基准四区版式、通过数据与最终高分辨率渲染检查，并完成复核；任意新增或调整的元素不自动视为合规。

尚未导入数据时，编辑页先显示当前地图的四区版式草稿，不会自动装入虚构震情，也不会弹出空白画板遮挡编辑。可点击“取当前视图”更新底图，或“框选底图”后在地图上双击起点、双击终点并确认范围；右键取消会保留原预览。草稿中的屏幕影像不作为地理配准栅格，不绘制虚假的烈度、人口、指北针或比例尺。它只保存在当前会话的预览状态，不写入制图数据包。

“加载测试数据”或导入有效制图数据后切换至数据图件。此后采集地图不会覆盖已有数据，可用“返回数据图件”恢复数据渲染。草稿校样始终保留禁止正式使用标识；正式出图仍按原规范检查数据、范围和复核记录，不接受任意框选截图作为合规依据。

六份数据包可直接通过“导入制图数据”导入。坐标保持原值，范围由快速评估烈度面、震级和专题类别确定，外扩 10 km 后围绕震中居中适配图框。不把真实数据移动或拉伸到任意框选位置。底图、专题、图例、统计及导出使用同一数据包。测试数据有不可通过复核勾选消除的测试标识。

图层中可导入单层 GeoJSON FeatureCollection，或内嵌 PNG/JPG 栅格；栅格必须填写真实地理范围与匀光/晕渲依据。格式是项目适配格式，不是标准规定的交换格式。内置 DEM 是数学曲面生成的分级晕渲，不是真实高程。

下面的 22 份样本用于同一模板库中的“分析辅助模板”，不可直接作为六类应急响应正式成果发布。两种数据格式不同。在原模板编辑底部展开“规范校核”，选择应急响应类别和现有数据角色，再点“纳入规范制图”，可带入说明、制作单位、草稿底图及现有 GeoJSON。原始几何与属性保持不变，不把普通数值改名为人口/烈度；内置合成数据保留测试标识，不伪造权威来源或 CGCS2000 转换。未获得原始要素的屏幕 RGB 结果只带入草稿底图。

## 分析辅助模板

点击“使用模板”进入编辑页，框选地图后点击“加载测试数据”，再“应用模板”。默认勾选“适配框选范围”：内置合成样本按当前框选区域生成，分级设色和唯一值分类的面分区覆盖完整范围；重新框选后会使用新范围。点、线、灾害足迹和烈度分区保留各自的布局关系，不强行填满框内所有位置。

“下载测试数据”在已框选且启用适配时下载当前区域的合成样本。取消“适配框选范围”，或尚未框选时下载，得到原始样本，其固定位置为 **东经104.8–106.6°、北纬28.2–29.7°**。

只有“加载测试数据”选择的内置测试模式会跟随框选范围。通过文件按钮手动导入的数据始终保持文件坐标，即使文件带 `usage=test` 也不会自动移动；更换框选范围不会拉伸真实调查数据。

在电脑上手动选择原始样本时，进入：`I:\1.玻尔智脑\球所项目\my-mars3d-dev\public\data\dbt116-test\templates`。例如“烈度分布”导入 `intensity-distribution.geojson`，“次生灾害”导入 `secondary-hazard.geojson`。这些静态文件仍使用上述原始范围。

## 22 份可导入文件

| 模板 | templates/ 内文件 | 测试内容 |
| --- | --- | --- |
| 分级设色 | choropleth.geojson | 不规则统计分区、人口密度 value |
| 唯一值分类 | unique-value.geojson | 地类分区 category |
| 分级符号 | graduated-symbol.geojson | 站点报告数，大小符号 |
| 点热力 | point-heat.geojson | 三簇带权报告点 |
| 栅格色带 | raster-ramp.geojson | 36×28连续高程场，合成值 |
| 栅格阈值 | raster-threshold.geojson | 同一采样场的数值分段 |
| 等值线 | contour.geojson | 规则采样网格提取等值线 |
| 轨迹回放 | trajectory.geojson | 两辆合成车辆的带时间轨迹 |
| 流向 | flow-direction.geojson | 有向河段、flow_rate、m³/s |
| 风险叠加 | risk-overlay.geojson | H×E×V相对筛查指数 |
| 时序对比 | time-compare.geojson | 同一分区两期报告数及差值 |
| 图表联动 | chart-linkage.geojson | 同源分区指标与统计条形 |
| 异常综合 | anomaly-composite.geojson | 三项0–1指标及声明权重 |
| 热红外 | thermal-infrared.geojson | LST、基线均值/标准差、质量标志 |
| 震后风险 | post-quake-risk.geojson | 合成的已评估风险指数 |
| 震群轨迹 | swarm-trajectory.geojson | 时刻、震群编号、震级、深度 |
| InSAR形变 | insar-deformation.geojson | 合成LOS双叶场、相干性 |
| 烈度分布 | intensity-distribution.geojson | VI–IX度、不重叠嵌套等震分区 |
| 次生灾害 | secondary-hazard.geojson | 五类灾害点和局部影响面 |
| 房屋抗震 | building-resilience.geojson | 88个合成建筑轮廓与脆弱性 |
| 人口经济暴露 | population-exposure.geojson | 人口、资产和烈度字段 |
| 应急指挥 | emergency-command.geojson | 设施点和有状态的救援通道 |

`templates/manifest.json` 记录文件、名称、数量、单位和内容说明。可用 `node scripts/generate-catalog-template-sample.mjs` 确定性重新生成全部样本。所有样本声明 `metadata.usage=test`；CRS84 合成经纬度不代表完成 CGCS2000 转换。

栅格样本是规则 Point 网格 GeoJSON，不是 GeoTIFF。原 RGB 亮度方式仍保留；加载测试数据会切换到网格导入。等值线必须是完整规则网格。六份 `T*.json` 用于六类规范模板的数据编辑，不能直接导入分析辅助模板的单层 GeoJSON 输入。

分析辅助模板仍支持框选、GeoJSON 和自由排版，但所有导出均带校样标识。六类规范模板的正式输出须经过来源、坐标、范围、内容、版式、渲染和人工复核检查；设置 300 DPI 不代表源数据自动具备足够精度。

官方断层压缩包是独立的原始参考数据，不是本项目的完整制图 JSON 数据包，不能直接替代包含震情、烈度面和底图图层的六份测试数据。

## 文件

- `templates/`：上述22份独立 GeoJSON 和清单，专供现有模板编辑器导入。
- `T30101000.json`：基本情况专题图。
- `T30102000.json`：社会经济分布专题图。
- `T30103000.json`：重点关注目标分布专题图。
- `T30201000.json`：快速评估地震影响范围专题图。
- `T30202000.json`：快速评估地震灾区防震减灾能力专题图。
- `T30203000.json`：快速评估地震重灾区救灾相关信息专题图。
- `official-reference/eryuan-20250605-faults.zip`：国家地震科学数据中心原始断层 GeoJSON 压缩包，与合成测试数据不混合使用。

六份测试包生成方式：在项目根目录执行 `node scripts/generate-dbt116-test-data.mjs`。数据坐标是为绘图测试直接构造的角度数值，不代表完成过坐标基准转换。等震线由椭圆公式构造，不是快速评估模型输出。`usage: "test"` 会保留校样水印并阻止正式出图；仅改为 `operational` 不能消除来源检查。

## 实际查到的公开来源

1. [国家地震科学数据中心：2025 年洱源地震相关产品](https://data.earthquake.cn/gxdt/info/2025/334673554.html)。页面公开提供震中 500 公里范围断层 GeoJSON 下载。原始包：[20250605160316_790.zip](https://data.earthquake.cn/upload/4fbb5b9d-9dbc-499f-974e-062f4500445c/file/20250605/20250605160316_790.zip)。本地保存时间 2026-09-30，71833 字节；GeoJSON 内声明 `urn:ogc:def:crs:OGC:1.3:CRS84`，**不能直接认定为 EPSG:4490**。原始名称与属性保持不变。
2. [国家地震科学数据中心：数据服务流程](https://data.earthquake.cn/fwlc/info/2024/334672344.html)。部分目录可直接下载，其他数据根据分类分级需要申请，不能假设均有匿名 API。
3. [全国地理信息资源目录服务系统：公众版基础地理数据](https://www.webmap.cn/commres.do?method=result100W)。本次未获得可直接用于项目的完整基础地理数据包。
4. [中国地震台网中心：泸定地震烈度速报](https://data.earthquake.cn/20220905ldsb/info/2022/334669353.html)。公开产品包含图片，不能把图片或 RGB 像素颜色当作可计算的烈度面矢量。

官方压缩包 SHA-256：`370bcc8ef7bb15f667568e56dc9368475c7c330d6232615bc53b954f58f31296`。

## 项目导入结构

JSON 结构是本项目的适配格式，**不是制作要求报批稿或 DB/T 101 指定的文件格式**。标准规定内容与表达，不规定此 JSON。

- `version: 1`、`usage: "test" | "operational"`、`crs`。
- `classification.instance`：两位实例代码；`classification.spatial`：一位空间范围代码；最终形成 T 加八位数字。`crsEvidence` 记录原始坐标依据或实际转换成果。
- `event`：time/place/magnitude/magnitudeType/longitude/latitude/authority/bulletin。
- `region`：zone（R1/R2/R3）、province/prefecture/evidence；需按标准表 1 核验。
- `agency`、`createdAt`、`description`：制作单位、制图时间和该类别内容说明。
- `layers`：id/name/role/authority/publishedAt/source/crs/security/scale/data。
- 图层的 `enabled` 控制参与制图；`coverage` 是数据覆盖矩形（west/south/east/north），`coverageEvidence` 记录范围内完整性证据，`crsEvidence` 记录坐标依据。它们是待核验的来源声明，软件不能独立证明其真实性。
- `raster`：内嵌 PNG/JPG 的 `image`、实际定位 `bounds`、`rendering`（hillshade/imagery/classified）、`radiometry`。不能把普通截图直接声明为 CGCS2000 栅格；不自动重投影。分辨率不足会阻止正式导出。
- `legend`：label/color 条目；`colorStandard` 为配色依据。PGA 还须 `parameterEvidence`，说明 GB 18306（含适用修改单）和 GB 55002 的对应关系，程序不自造映射。
- `data` 使用 GeoJSON 形状的 FeatureCollection，坐标顺序为经度、纬度。这里的 EPSG:4490 是明确声明的项目交换约定，不冒充 RFC 7946 的 WGS84。
- `properties.symbol` 为 `dbt-*` 附录 B 符号编码；`label` 为注记，烈度面需 `intensity`（1–12 整数）；历史地震、余震需 magnitude/occurredAt。
- 历史地震还需 casualties；目标、灾害、能力要素需 category。人口用 population（人），经济指标用 value 与图层 unit。相交的完整统计单元参与汇总，跨图框的统计单元不能直接作为正式的范围内总量，不按面积摊分。
- 影响范围图的 `assessment` 包含 longAxisKm/shortAxisKm/azimuth。烈度面的 `zonePopulation` 指该烈度带的独立人口，不是包含所有更高烈度区的累积人口；面积先扣除更高烈度面，避免嵌套重复计量。软件计算采用 Turf 球面几何，正式统计仍须与权威评估结果复核。
- 近海 R3 需要 role=land 的权威陆地面；范围和统计面按陆地裁切，制图时裁切原始等震线，不把海岸线画成等震线。
- 用于正式出图的数据还须通过来源、坐标、内容与人工复核；仅把 usage 改为 operational 不代表数据合规。

原工作台已接入四区版式、A3 画幅、透明 PNG 符号及 300 DPI JPG/PDF 输出。统计图表为辅助分析，不是标准强制要求的六种业务图。RGB 统计保留其像素语义，不改名为烈度、灾情或人口统计。

**本目录不能生成正式业务成果。** 软件提供数据与渲染检查、按分区列出底图层级要求、人工逐项复核和正式导出门禁，不等于取得标准认证。完整权威数据、真实 CGCS2000 转换、飞地/重合界线/境外注记、影像匀光以及引用标准的参数关系需要生产数据和专业复核。等震线默认采用红色线表达，不擅造烈度填色色标。正式导出附带含 SHA-256 数据摘要的检查记录。
