export type ProductGroup = "emergency" | "remote" | "damage" | "assessment" | "business"
export type ProductDefinition = {
  templateId: string; kind: string; name: string; group: ProductGroup; purpose: string
  standards: string[]; inputs: string[]; expression: string; statistics: string; boundary: string
}

const emergency = (code: string, name: string, purpose: string, inputs: string[], expression: string): ProductDefinition => ({
  templateId: `emergency:${code}`,
kind: code,
name,
group: "emergency",
purpose,
  standards: ["DB/T 101—2024", "DB/T 116—2026（2026-12-01实施）"],
inputs,
  expression,
statistics: "按图件选定的指标、统计单元和资料时点展示；不同口径不合计。",
boundary: "范围、震情、专题内容和业务复核随当前图件版本核对；模板存在不等于成果已审定。"
})

export const productDefinitions: ProductDefinition[] = [
  emergency("T30101000", "基本情况专题图", "表达地震位置及周边地理环境。", ["地震事件参数", "烈度评估分区", "基础地理"], "震中、烈度及基础地理分层表达。"),
  emergency("T30102000", "社会经济分布专题图", "表达地震影响地区的人口、经济或建筑物分布。", ["地震事件参数", "烈度评估分区", "人口／经济／建筑物任选", "基础地理"], "密度用顺序色带；总量用适当符号或统计图，不混合人口与GDP。"),
  emergency("T30103000", "重点关注目标分布专题图", "表达医院、学校、水库、桥梁等重点对象。", ["地震事件参数", "烈度评估分区", "至少一类重点目标", "基础地理"], "按对象类别配置符号；规模、状态与类别分别编码。"),
  emergency("T30201000", "快速评估地震影响范围专题图", "表达已有快速评估影响范围及相关构造环境。", ["地震事件参数", "烈度评估分区", "活动断层", "基础地理"], "按已有烈度分区表达，不生成示意椭圆替代业务成果。"),
  emergency("T30202000", "快速评估地震灾区防震减灾能力专题图", "表达灾区防震减灾能力及相关资源。", ["地震事件参数", "烈度评估分区", "防震减灾能力成果", "基础地理"], "按已交付的能力指标、设施类别和等级表达。"),
  emergency("T30203000", "快速评估地震重灾区救灾相关信息专题图", "汇集重灾区遥感、灾情及救灾相关信息。", ["地震事件参数", "烈度评估分区", "至少一类救灾专题资料", "基础地理"], "影像作底层，灾情、目标与救灾设施分层表达。"),
  { templateId: "earthquake_insar_deformation", kind: "insar-deformation", name: "InSAR 视线向形变", group: "remote", purpose: "表达已处理的视线向位移。", standards: ["DB/T 101—2024：T10805000（参照分类）"], inputs: ["LOS位移mm", "相干性", "影像对与正方向"], expression: "正负位移发散色带；低相干点单独处理。", statistics: "位移与速率分别显示，不换名代用。", boundary: "不在前端执行干涉处理、相位解缠或速率转累计位移。" },
  { templateId: "earthquake_thermal_infrared", kind: "thermal-infrared", name: "地表温度基线异常", group: "remote", purpose: "表达质量筛选后的LST时间基线标准化偏差。", standards: ["DB/T 101—2024：T10803000（参照分类）"], inputs: ["LST及温度单位", "历史均值、标准差和样本数", "基线时段与质量标识"], expression: "按已声明的基线和质量条件显示Z分数。", statistics: "分别记录有效、低质量及基线不足样本。", boundary: "亮温、单景空间背景与LST时间基线不互相替代；异常不是地震预测。" },
  { templateId: "earthquake_imagery_comparison", kind: "imagery-comparison", name: "灾前灾后遥感对比专题图", group: "remote", purpose: "对照同一范围的灾前灾后遥感影像。", standards: ["项目应用产品；不虚设行业代码"], inputs: ["同一事件时间", "可比的前后两期影像", "配准、空间分辨率及辐射处理说明"], expression: "同一地理范围左侧灾前、右侧灾后，图例记录两期时间。", statistics: "仅做影像对照；变化面积、损毁量须另有判读或评估成果。", boundary: "不同波段、不同指标或未说明配准关系的影像不自动配对。" },
  { templateId: "earthquake_building_damage", kind: "building-damage", name: "建筑物破坏评估专题图", group: "damage", purpose: "表达本次事件的建筑物评估破坏情况。", standards: ["DB/T 75—2018", "DB/T 80—2018"], inputs: ["建筑物轮廓和稳定ID", "破坏等级及等级字典", "事件、评估依据与时点"], expression: "按来源声明的破坏等级顺序设色；未知等级不自动归入完好。", statistics: "按稳定ID去重计数；不以裁切面积推算受损栋数。", boundary: "易损性指数、建筑用地和任意损毁热图不能替代逐栋破坏等级。" },
  { templateId: "earthquake_road_damage", kind: "road-damage", name: "公路震害专题图", group: "damage", purpose: "表达评估或调查确认的公路震害。", standards: ["DB/T 76—2018", "DB/T 80—2018"], inputs: ["受评估路段和稳定ID", "破坏等级及等级字典", "事件、评估依据与时点"], expression: "按破坏等级区分线色；通行状态另行保留，不由震害等级推断。", statistics: "计数为受评估路段数，不冒充道路总条数或桥梁数量。", boundary: "普通公路线和桥梁位置不能代替震害资料；桥梁专项结论需独立成果。" },
  { templateId: "earthquake_geological_disaster", kind: "geological-disaster", name: "地震地质灾害专题图", group: "damage", purpose: "表达与本次地震关联且已核查的地质灾害。", standards: ["DB/T 74—2018", "DB/T 80—2018"], inputs: ["灾害点或实际范围及稳定ID", "灾种与核查状态", "事件、评估依据与时点"], expression: "灾种分类表达；点位与实际足迹分别保留。", statistics: "按灾害ID去重计数，不把隐患点计为已发生灾害。", boundary: "地灾隐患、易发性和火灾不并入本产品的确认地质灾害统计。" },
  { templateId: "earthquake_remote_intensity", kind: "remote-intensity", name: "遥感评估地震烈度专题图", group: "damage", purpose: "表达已有遥感烈度评估分区。", standards: ["DB/T 77—2018", "DB/T 80—2018"], inputs: ["烈度分区面与烈度值", "遥感评估方法声明", "事件、评估依据与时点"], expression: "按离散烈度等级表达；不将烈度当连续热力强度。", statistics: "只展示已有分区和等级，不从底图衰减生成烈度。", boundary: "快速估算、仪器烈度和综合评定不能仅改名成为遥感烈度。" },
  { templateId: "earthquake_extreme_zone", kind: "extreme-zone", name: "地震极灾区范围专题图", group: "damage", purpose: "表达依据明确的极灾区评估范围。", standards: ["DB/T 78—2018", "DB/T 80—2018"], inputs: ["极灾区范围面与稳定ID", "范围判定依据", "事件、评估依据与时点"], expression: "突出评估边界，避免实心填色遮蔽背景。", statistics: "范围面积可另行量算；不将选区或最高烈度区自动认定为极灾区。", boundary: "必须有独立极灾区成果声明和判定依据。" },
  { templateId: "earthquake_direct_loss", kind: "direct-loss", name: "地震直接经济损失评估专题图", group: "damage", purpose: "表达已评估的直接经济损失分布。", standards: ["DB/T 79—2018", "DB/T 80—2018"], inputs: ["统计区及稳定ID", "损失金额、币值单位和价格基准年", "直接损失范围及评估依据"], expression: "金额用面积比例符号，不以大行政区深色填充暗示更高损失密度。", statistics: "保留原统计区金额；不按选区裁切比例分摊、不跨币值基准相加。", boundary: "GDP、资产暴露、风险指数不能直接作为损失金额。" },
  { templateId: "earthquake_population_exposure", kind: "population-exposure", name: "人口与资产暴露", group: "assessment", purpose: "表达处于影响范围中的人口或资产。", standards: ["项目业务扩展；不虚设行业代码"], inputs: ["人口或资产统计区", "烈度或影响分区", "指标单位、时点与口径"], expression: "人口和资产分别展示，不混合单位。", statistics: "保留完整原区统计量，不按选区面积分摊。", boundary: "暴露量不等于伤亡或经济损失。" },
  { templateId: "earthquake_building_resilience", kind: "building-resilience", name: "建筑物地震易损性", group: "assessment", purpose: "表达已有建筑物易损性评估。", standards: ["DB/T 101—2024：T20302000（参照分类）"], inputs: ["建筑物轮廓", "易损性指数", "评估模型及版本"], expression: "按既有易损性指数分级，不推断结构安全。", statistics: "以建筑对象和已有指数为准。", boundary: "易损性不是本次破坏等级，也不是建筑安全鉴定。" },
  { templateId: "earthquake_post_quake_risk", kind: "post-quake-risk", name: "地震灾害风险指数", group: "assessment", purpose: "表达已有模型的地震灾害风险成果。", standards: ["DB/T 101—2024：T20303000（参照分类）"], inputs: ["风险指数", "评估模型及版本", "适用范围和资料时点"], expression: "按模型指标显示，不自动解释为概率。", statistics: "不同模型和版本的指数不直接合计。", boundary: "风险指数不是实际灾情、伤亡或损失金额。" },
  { templateId: "earthquake_emergency_command", kind: "emergency-command", name: "救灾资源与通行状态", group: "business", purpose: "表达救灾设施、资源和通道状态。", standards: ["项目业务扩展；不虚设行业代码"], inputs: ["设施点或通道线", "资源类型及状态", "状态更新时间"], expression: "资源类别与可用、阻断、未知状态分别表达。", statistics: "未知状态单列，不作为可用资源。", boundary: "不代替道路震害评估、通达性模型或自动路线规划。" }
]

export const additionalProducts = productDefinitions.filter(product => ["damage"].includes(product.group) || product.kind === "imagery-comparison")
export function productDefinition(id: string) { return productDefinitions.find(product => product.kind === id || product.templateId === id) }
