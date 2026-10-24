<template>
  <mars-dialog
    ref="dialogRef"
    v-model:visible="dialogVisible"
    title="专题制图工作台"
    icon="workbench"
    :custom-class="dialogClass"
    :draggable="!chartPanelVisible"
    :handles="chartPanelVisible ? false : DIALOG_RESIZE_HANDLES"
    :persist-layout="!chartPanelVisible"
    :width="dialogInitialWidth"
    :height="SIDE_PANEL_HEIGHT"
    :min-width="dialogMinWidth"
    :min-height="480"
    :position="dialogPosition"
    :beforeClose="handleBeforeClose"
    @closed="handleClose"
    @fold="handleFold"
  >
    <template #headerRight>
      <div class="header-actions">
        <button v-if="workbenchMode === 'analysis'" type="button" class="header-text-btn" title="图层样式与三维" aria-label="图层样式与三维" @mousedown.stop @click="displaySettingsOpen = true"><mars-icon icon="config" :width="16" /></button>
        <button
          v-if="workbenchMode === 'analysis' && !chartPanelVisible"
          type="button"
          class="header-text-btn"
          title="打开图表展示"
          @mousedown.stop
          @click="openChartPanel"
        >
          图表展示
        </button>
        <button
          v-if="workbenchMode === 'analysis' && chartPanelVisible"
          type="button"
          class="header-text-btn is-active"
          @mousedown.stop
          @click="showCartographyPanel"
        >
          返回制图
        </button>
        <button
          v-if="workbenchMode === 'analysis' && !chartPanelVisible"
          type="button"
          class="header-text-btn"
          :disabled="!isDirty"
          title="保存制图草稿"
          @mousedown.stop
          @click="saveDraft"
        >
          保存草稿
        </button>
        <button
          type="button"
          class="header-text-btn"
          :title="isFold ? '恢复工作台' : '最小化工作台'"
          @mousedown.stop
          @click="toggleWorkbenchFold"
        >
          {{ isFold ? "恢复" : "最小化" }}
        </button>
      </div>
    </template>

    <div class="workbench-shell" :class="{ 'has-chart-panel': chartPanelVisible }">
      <aside v-show="chartPanelVisible && templateLayoutEditing" class="chart-showcase-panel template-live-panel" aria-label="模板实时编辑">
        <div class="template-live-heading"><strong>{{ draft.templateName }}</strong><mars-button size="small" @click="openChartPanel"><mars-icon icon="chart-histogram" :width="15" />分析结果</mars-button></div>
        <label class="template-live-palette">配色方案<select v-model="draft.palette" aria-label="排版模板配色"><option v-for="option in paletteOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <div id="thematic-template-live-host"></div>
      </aside>
      <aside v-if="chartPanelVisible && !templateLayoutEditing" class="chart-showcase-panel" :class="{ 'is-board-mode': chartViewMode === 'board' && analysisWorkspaceMode === 'raster' && earthquakeOutputView === 'result', 'is-earthquake-mode': analysisWorkspaceMode === 'earthquake' }">
        <section class="side-layout-section operator-section">
          <div class="panel-section-head">
            <div class="analysis-mode-control">
              <span>分析模块</span>
              <a-select :value="analysisWorkspaceMode" size="small" aria-label="分析模块" @change="onAnalysisModeChange">
                <a-select-option value="raster">栅格计算</a-select-option>
                <a-select-option value="temporal">时序分析</a-select-option>
                <a-select-option value="signal">信号处理</a-select-option>
                <a-select-option value="statistics">统计分析</a-select-option>
                <a-select-option value="spatial">空间分析</a-select-option>
                <a-select-option value="background">背景场运算</a-select-option>
                <a-select-option value="numeric">数值变换</a-select-option>
                <a-select-option value="earthquake">地震专题</a-select-option>
              </a-select>
            </div>
            <span class="section-state" :class="{ 'is-ready': activeAnalysisReady }">{{ activeAnalysisStatusLabel }}</span>
          </div>
          <div v-if="analysisWorkspaceMode === 'raster'" class="raster-operator-grid" role="group" aria-label="栅格计算算子">
            <button
              v-for="operator in rasterOperatorOptions"
              :key="operator.value"
              type="button"
              class="raster-operator-card"
              :class="{ 'is-active': selectedRasterOperation === operator.value }"
              :aria-pressed="selectedRasterOperation === operator.value"
              :disabled="rasterRunning"
              :title="operator.description"
              @click="runRasterCalculation(operator.value)"
            >
              <span class="raster-operator-icon" aria-hidden="true">
                <mars-icon :icon="operator.icon" :width="17" />
              </span>
              <span class="raster-operator-copy">
                <strong>{{ operator.label }}</strong>
                <small>{{ operator.short }}</small>
              </span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'temporal'" class="raster-operator-grid" role="group" aria-label="时序分析算子">
            <button
              v-for="operator in temporalOperatorOptions"
              :key="operator.value"
              type="button"
              class="raster-operator-card"
              :class="{ 'is-active': selectedTemporalOperation === operator.value }"
              :aria-pressed="selectedTemporalOperation === operator.value"
              :disabled="temporalRunning || temporalCapturing"
              :title="operator.description"
              @click="runTemporalAnalysis(operator.value)"
            >
              <span class="raster-operator-icon is-temporal" aria-hidden="true">
                <mars-icon :icon="operator.icon" :width="17" />
              </span>
              <span class="raster-operator-copy">
                <strong>{{ operator.label }}</strong>
                <small>{{ operator.short }}</small>
              </span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'signal'" class="raster-operator-grid" role="group" aria-label="信号处理算子">
            <button
              v-for="operator in signalOperatorOptions"
              :key="operator.value"
              type="button"
              class="raster-operator-card"
              :class="{ 'is-active': selectedSignalOperation === operator.value }"
              :aria-pressed="selectedSignalOperation === operator.value"
              :disabled="signalRunning"
              :title="operator.description"
              @click="runSignalAnalysis(operator.value)"
            >
              <span class="raster-operator-icon is-signal" aria-hidden="true">
                <mars-icon :icon="operator.icon" :width="17" />
              </span>
              <span class="raster-operator-copy">
                <strong>{{ operator.label }}</strong>
                <small>{{ operator.short }}</small>
              </span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'statistics'" class="raster-operator-grid" role="group" aria-label="统计分析算子">
            <button
              v-for="operator in statisticsOperatorOptions"
              :key="operator.value"
              type="button"
              class="raster-operator-card"
              :class="{ 'is-active': selectedStatisticsOperation === operator.value }"
              :aria-pressed="selectedStatisticsOperation === operator.value"
              :disabled="statisticsRunning"
              :title="operator.description"
              @click="runStatisticsAnalysis(operator.value)"
            >
              <span class="raster-operator-icon is-statistics" aria-hidden="true">
                <mars-icon :icon="operator.icon" :width="17" />
              </span>
              <span class="raster-operator-copy">
                <strong>{{ operator.label }}</strong>
                <small>{{ operator.short }}</small>
              </span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'background'" class="raster-operator-grid" role="group" aria-label="背景场运算算子">
            <button v-for="operator in backgroundOperatorOptions" :key="operator.value" type="button" class="raster-operator-card"
              :class="{ 'is-active': selectedBackgroundOperation === operator.value }" :aria-pressed="selectedBackgroundOperation === operator.value"
              :disabled="backgroundRunning || backgroundCapturing" :title="operator.description" @click="runBackgroundAnalysis(operator.value)">
              <span class="raster-operator-icon is-spatial" aria-hidden="true"><mars-icon :icon="operator.icon" :width="17" /></span>
              <span class="raster-operator-copy"><strong>{{ operator.label }}</strong><small>{{ operator.short }}</small></span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'numeric'" class="raster-operator-grid" role="group" aria-label="数值变换算子">
            <button v-for="operator in numericOperatorOptions" :key="operator.value" type="button" class="raster-operator-card"
              :class="{ 'is-active': selectedNumericOperation === operator.value }" :aria-pressed="selectedNumericOperation === operator.value"
              :disabled="numericRunning" :title="operator.description" @click="runNumericTransform(operator.value)">
              <span class="raster-operator-icon is-spatial" aria-hidden="true"><mars-icon :icon="operator.icon" :width="17" /></span>
              <span class="raster-operator-copy"><strong>{{ operator.label }}</strong><small>{{ operator.short }}</small></span>
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'earthquake'" class="raster-operator-grid earthquake-operator-grid" role="group" aria-label="地震专题算子">
            <button v-for="operator in earthquakeOperatorOptions" :key="operator.value" type="button" class="raster-operator-card"
              :class="{ 'is-active': selectedEarthquakeOperation === operator.value }" :aria-pressed="selectedEarthquakeOperation === operator.value"
              :disabled="earthquakeRunning" :title="operator.description" @click="runEarthquakeAnalysis(operator.value)">
              <span class="raster-operator-icon is-earthquake" aria-hidden="true"><mars-icon :icon="operator.icon" :width="17" /></span>
              <span class="raster-operator-copy"><strong>{{ operator.label }}</strong><small>{{ operator.short }}</small></span>
            </button>
          </div>
          <div v-else class="raster-operator-grid" role="group" aria-label="空间分析算子">
            <button
              v-for="operator in spatialOperatorOptions"
              :key="operator.value"
              type="button"
              class="raster-operator-card"
              :class="{ 'is-active': selectedSpatialOperation === operator.value }"
              :aria-pressed="selectedSpatialOperation === operator.value"
              :disabled="spatialRunning"
              :title="operator.description"
              @click="runSpatialAnalysis(operator.value)"
            >
              <span class="raster-operator-icon is-spatial" aria-hidden="true">
                <mars-icon :icon="operator.icon" :width="17" />
              </span>
              <span class="raster-operator-copy"><strong>{{ operator.label }}</strong><small>{{ operator.short }}</small></span>
            </button>
          </div>
        </section>

        <section class="side-layout-section parameter-section">
          <div class="panel-section-head">
            <div class="panel-section-title">参数区</div>
            <div class="parameter-head-actions">
              <button
                v-if="analysisWorkspaceMode === 'temporal'"
                type="button"
                class="scope-lock-reset is-capture"
                :disabled="temporalCapturing || temporalFrames.length >= MAX_TEMPORAL_FRAMES"
                @click="captureTemporalFrame()"
              >
                <mars-icon :icon="temporalCapturing ? 'loading-four' : 'camera'" :width="13" />
                <span>{{ temporalCapturing ? "采集中" : "采集帧" }}</span>
              </button>
              <button v-if="analysisWorkspaceMode === 'background'" type="button" class="scope-lock-reset is-capture"
                :disabled="!selectionScopeLocked || backgroundCapturing || backgroundRunning" @click="captureBackgroundBaseline">
                <mars-icon :icon="backgroundCapturing ? 'loading-four' : 'camera'" :width="13" />
                <span>{{ backgroundCapturing ? '采集中' : backgroundBaseline ? '重采基准' : '采集基准' }}</span>
              </button>
              <template v-if="analysisWorkspaceMode === 'earthquake'">
                <input ref="earthquakeFileInputRef" class="earthquake-file-input" type="file" accept=".json,.geojson,application/json,application/geo+json" aria-label="导入地震观测 GeoJSON" @change="onEarthquakeFileChange" />
                <button type="button" class="scope-lock-reset is-capture" title="导入带来源和单位的地震观测 GeoJSON" @click="earthquakeFileInputRef?.click()">
                  <mars-icon icon="upload" :width="13" /><span>导入观测</span>
                </button>
                <button type="button" class="scope-lock-reset" title="下载地震观测字段模板" aria-label="下载地震观测字段模板" @click="downloadEarthquakeTemplate">
                  <mars-icon icon="download" :width="13" />
                </button>
              </template>
              <button type="button" class="scope-lock-reset" @click="startChartSelectionFlow">
                <mars-icon icon="redo" :width="13" />
                <span>重绘</span>
              </button>
            </div>
          </div>
          <div class="scope-compact-bar" :class="{ 'is-locked': selectionScopeLocked }" role="status" :title="selectionScopeSummary">
            <mars-icon :icon="selectionScopeLocked ? 'lock' : 'unlock'" :width="13" />
            <span v-if="analysisWorkspaceMode === 'raster'">
              {{ selectionScopeLocked ? "制图范围已锁定，结果严格裁剪于框内" : "请先框选制图范围" }}
            </span>
            <span v-else-if="analysisWorkspaceMode === 'temporal'">
              {{ selectionScopeLocked ? `范围已锁定 · 已采集 ${temporalFrames.length} 期` : "请先框选制图范围" }}
            </span>
            <span v-else-if="analysisWorkspaceMode === 'background'">{{ !selectionScopeLocked ? '请先框选制图范围' : backgroundBaseline ? '范围已锁定 · 基准影像已采集' : '范围已锁定 · 请采集基准影像' }}</span>
            <span v-else-if="analysisWorkspaceMode === 'earthquake'">{{ selectionScopeLocked ? `范围已锁定 · ${earthquakeDataset?.features.length || 0} 个观测点` : '请先框选制图范围' }}</span>
            <span v-else>{{ selectionScopeLocked ? "范围已锁定 · 使用当前地图影像" : "请先框选制图范围" }}</span>
          </div>
          <div v-if="analysisWorkspaceMode === 'raster'" class="raster-parameter-panel">
            <label v-if="selectedRasterOperation === 'algebra'" class="raster-parameter-field">
              <span>运算公式</span>
              <a-select v-model:value="rasterAlgebraMode" size="small" aria-label="代数运算公式">
                <a-select-option value="normalize">归一化 (A-min)/(max-min)</a-select-option>
                <a-select-option value="invert">反相 1-A</a-select-option>
                <a-select-option value="log">对数增强 log(1+A)</a-select-option>
                <a-select-option value="gamma">Gamma 校正 A^γ</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedRasterOperation === 'algebra' && rasterAlgebraMode === 'gamma'" class="raster-parameter-field is-slider">
              <span>Gamma <strong>{{ rasterGamma.toFixed(1) }}</strong></span>
              <mars-slider v-model:value="rasterGamma" :min="0.4" :max="2.4" :step="0.1" />
            </label>

            <label v-if="selectedRasterOperation === 'classified'" class="raster-parameter-field">
              <span>分级方法</span>
              <a-select v-model:value="rasterClassMethod" size="small" aria-label="栅格分级方法">
                <a-select-option value="quantile">分位数</a-select-option>
                <a-select-option value="equal">等距分级</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedRasterOperation === 'classified'" class="raster-parameter-field is-slider">
              <span>分级数量 <strong>{{ rasterClassCount }} 级</strong></span>
              <mars-slider v-model:value="rasterClassCount" :min="3" :max="7" :step="1" />
            </label>

            <label v-if="selectedRasterOperation === 'threshold'" class="raster-parameter-field is-slider">
              <span>提取区间 <strong>{{ rasterThresholdRange[0] }}–{{ rasterThresholdRange[1] }}</strong></span>
              <a-slider v-model:value="rasterThresholdRange" range :min="0" :max="100" :step="1" />
            </label>

            <label v-if="selectedRasterOperation === 'mosaic'" class="raster-parameter-field">
              <span>像元尺寸</span>
              <a-select v-model:value="rasterMosaicSize" size="small" aria-label="镶嵌像元尺寸">
                <a-select-option :value="4">4 × 4 精细</a-select-option>
                <a-select-option :value="8">8 × 8 标准</a-select-option>
                <a-select-option :value="16">16 × 16 概览</a-select-option>
              </a-select>
            </label>

            <label class="raster-parameter-field is-slider">
              <span>图层透明度 <strong>{{ rasterOpacity }}%</strong></span>
              <mars-slider v-model:value="rasterOpacity" :min="30" :max="100" :step="1" />
            </label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'temporal'" class="raster-parameter-panel temporal-parameter-panel">
            <label v-if="selectedTemporalOperation === 'difference'" class="raster-parameter-field">
              <span>变化指标</span>
              <a-select v-model:value="temporalDifferenceMode" size="small" aria-label="差值计算模式">
                <a-select-option value="delta">绝对差值</a-select-option>
                <a-select-option value="rate">变化率 (%)</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedTemporalOperation === 'statistics'" class="raster-parameter-field">
              <span>统计指标</span>
              <a-select v-model:value="temporalStatisticMode" size="small" aria-label="时序统计指标">
                <a-select-option value="mean">多期均值</a-select-option>
                <a-select-option value="variance">多期方差</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedTemporalOperation === 'trend'" class="raster-parameter-field is-slider">
              <span>最低拟合度 <strong>{{ temporalMinimumR2 }}%</strong></span>
              <mars-slider v-model:value="temporalMinimumR2" :min="0" :max="90" :step="5" />
            </label>
            <label v-if="selectedTemporalOperation === 'anomaly'" class="raster-parameter-field is-slider">
              <span>异常阈值 <strong>|Z| ≥ {{ temporalAnomalyThreshold.toFixed(1) }}</strong></span>
              <mars-slider v-model:value="temporalAnomalyThreshold" :min="1" :max="3.5" :step="0.1" />
            </label>
            <label class="raster-parameter-field is-slider">
              <span>图层透明度 <strong>{{ temporalOpacity }}%</strong></span>
              <mars-slider v-model:value="temporalOpacity" :min="30" :max="100" :step="1" />
            </label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'signal'" class="raster-parameter-panel signal-parameter-panel">
            <label v-if="selectedSignalOperation === 'fourier'" class="raster-parameter-field is-slider">
              <span>高通截止 <strong>{{ signalCutoff }}%</strong></span>
              <mars-slider v-model:value="signalCutoff" :min="2" :max="45" :step="1" />
            </label>
            <label v-if="selectedSignalOperation === 'wavelet'" class="raster-parameter-field">
              <span>分解尺度</span>
              <a-select v-model:value="signalWaveletLevel" size="small" aria-label="小波分解尺度">
                <a-select-option :value="1">1 级</a-select-option>
                <a-select-option :value="2">2 级</a-select-option>
                <a-select-option :value="3">3 级</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSignalOperation === 'wavelet'" class="raster-parameter-field">
              <span>输出频带</span>
              <a-select v-model:value="signalWaveletBand" size="small" aria-label="小波输出频带">
                <a-select-option value="detail">高频细节</a-select-option>
                <a-select-option value="approximation">低频轮廓</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSignalOperation === 'filter'" class="raster-parameter-field">
              <span>滤波方法</span>
              <a-select v-model:value="signalFilter" size="small" aria-label="滤波方法">
                <a-select-option value="gaussian">高斯滤波</a-select-option>
                <a-select-option value="median">中值滤波</a-select-option>
                <a-select-option value="mean">均值滤波</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSignalOperation === 'filter'" class="raster-parameter-field">
              <span>滤波窗口</span>
              <a-select v-model:value="signalFilterWindow" size="small" aria-label="滤波窗口大小">
                <a-select-option :value="3">3 × 3</a-select-option>
                <a-select-option :value="5">5 × 5</a-select-option>
                <a-select-option :value="7">7 × 7</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSignalOperation === 'edge'" class="raster-parameter-field">
              <span>检测方法</span>
              <a-select v-model:value="signalEdgeMethod" size="small" aria-label="边缘检测方法">
                <a-select-option value="canny">Canny</a-select-option>
                <a-select-option value="sobel">Sobel</a-select-option>
                <a-select-option value="prewitt">Prewitt</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSignalOperation === 'edge'" class="raster-parameter-field is-slider">
              <span>边缘阈值 <strong>{{ signalEdgeThreshold }}%</strong></span>
              <mars-slider v-model:value="signalEdgeThreshold" :min="5" :max="80" :step="5" />
            </label>
            <label class="raster-parameter-field is-slider">
              <span>图层透明度 <strong>{{ signalOpacity }}%</strong></span>
              <mars-slider v-model:value="signalOpacity" :min="30" :max="100" :step="1" />
            </label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'statistics'" class="raster-parameter-panel statistics-parameter-panel">
            <label v-if="selectedStatisticsOperation === 'area' || selectedStatisticsOperation === 'autocorrelation'" class="raster-parameter-field">
              <span>分析格网</span>
              <a-select v-model:value="statisticsGrid" size="small" aria-label="统计分析格网">
                <a-select-option value="4x3">4 × 3</a-select-option>
                <a-select-option value="6x4">6 × 4</a-select-option>
                <a-select-option value="8x6">8 × 6</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedStatisticsOperation === 'category'" class="raster-parameter-field">
              <span>分级方法</span>
              <a-select v-model:value="statisticsClassMethod" size="small" aria-label="统计分级方法">
                <a-select-option value="equal">等距分级</a-select-option>
                <a-select-option value="quantile">分位数分级</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedStatisticsOperation === 'category'" class="raster-parameter-field is-slider">
              <span>类别数量 <strong>{{ statisticsClassCount }} 级</strong></span>
              <mars-slider v-model:value="statisticsClassCount" :min="3" :max="7" :step="1" />
            </label>
            <label v-if="selectedStatisticsOperation === 'density'" class="raster-parameter-field is-slider">
              <span>亮度阈值 <strong>{{ statisticsBrightnessThreshold }}</strong></span>
              <mars-slider v-model:value="statisticsBrightnessThreshold" :min="50" :max="230" :step="10" />
            </label>
            <label v-if="selectedStatisticsOperation === 'density'" class="raster-parameter-field">
              <span>邻域半径</span>
              <a-select v-model:value="statisticsDensityRadius" size="small" aria-label="密度邻域半径">
                <a-select-option :value="6">6 像元</a-select-option>
                <a-select-option :value="12">12 像元</a-select-option>
                <a-select-option :value="24">24 像元</a-select-option>
              </a-select>
            </label>
            <label class="raster-parameter-field is-slider">
              <span>图层透明度 <strong>{{ statisticsOpacity }}%</strong></span>
              <mars-slider v-model:value="statisticsOpacity" :min="30" :max="100" :step="1" />
            </label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'background'" class="raster-parameter-panel">
            <label v-if="selectedBackgroundOperation === 'denoise'" class="raster-parameter-field">
              <span>中值窗口</span>
              <a-select v-model:value="backgroundDenoiseWindow" size="small" aria-label="背景去噪窗口">
                <a-select-option :value="3">3 × 3</a-select-option><a-select-option :value="5">5 × 5</a-select-option>
              </a-select>
            </label>
            <label class="raster-parameter-field is-slider"><span>显示阈值 <strong>{{ backgroundSensitivity }}%</strong></span>
              <mars-slider v-model:value="backgroundSensitivity" :min="1" :max="40" :step="1" /></label>
            <label class="raster-parameter-field is-slider"><span>图层透明度 <strong>{{ backgroundOpacity }}%</strong></span>
              <mars-slider v-model:value="backgroundOpacity" :min="30" :max="100" :step="1" /></label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'numeric'" class="raster-parameter-panel">
            <label v-if="selectedNumericOperation === 'extract' || selectedNumericOperation === 'vectorize'" class="raster-parameter-field">
              <span>像元通道</span>
              <a-select v-model:value="numericChannel" size="small" aria-label="像元提取通道">
                <a-select-option value="brightness">亮度</a-select-option><a-select-option value="red">红色 R</a-select-option>
                <a-select-option value="green">绿色 G</a-select-option><a-select-option value="blue">蓝色 B</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedNumericOperation === 'extract' || selectedNumericOperation === 'vectorize'" class="raster-parameter-field is-slider">
              <span>提取阈值 <strong>≥ {{ numericThreshold }}</strong></span><mars-slider v-model:value="numericThreshold" :min="0" :max="255" :step="5" />
            </label>
            <label v-if="selectedNumericOperation === 'vectorize'" class="raster-parameter-field">
              <span>矢量网格</span><a-select v-model:value="numericBlockSize" size="small" aria-label="矢量网格尺寸">
                <a-select-option :value="4">4 × 4 px</a-select-option><a-select-option :value="8">8 × 8 px</a-select-option><a-select-option :value="16">16 × 16 px</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedNumericOperation === 'index'" class="raster-parameter-field">
              <span>RGB 指数</span><a-select v-model:value="numericIndex" size="small" aria-label="RGB 绿度指数">
                <a-select-option value="exg">ExG · 2G − R − B</a-select-option><a-select-option value="ngrdi">NGRDI · (G − R)/(G + R)</a-select-option>
              </a-select>
            </label>
            <div v-if="selectedNumericOperation === 'projection'" class="numeric-projection-note">WGS84 → Web Mercator (EPSG:3857)</div>
            <label class="raster-parameter-field is-slider"><span>图层透明度 <strong>{{ numericOpacity }}%</strong></span>
              <mars-slider v-model:value="numericOpacity" :min="30" :max="100" :step="1" /></label>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'earthquake'" class="raster-parameter-panel earthquake-parameter-panel">
            <div class="earthquake-parameter-line"><span>数据源</span><strong :title="earthquakeParameterProfile.source">{{ earthquakeParameterProfile.source }}</strong></div>
            <details class="earthquake-parameter-details" :key="selectedEarthquakeOperation">
              <summary>波段 / 规则 / 约束 <span>{{ earthquakeDataset ? `${earthquakeParameterProfile.fields.filter(field => field.count > 0).length} 个字段已加载` : '待导入' }}</span></summary>
              <div class="earthquake-field-list">
                <span v-for="field in earthquakeParameterProfile.fields" :key="field.name" class="earthquake-field-chip" :class="{ 'is-available': field.count > 0 }" :title="`${field.name} · ${field.count} 个观测点`">{{ field.name }}<i v-if="earthquakeDataset">{{ field.count }}</i></span>
              </div>
              <div class="earthquake-parameter-line"><span>规则</span><strong>{{ earthquakeParameterProfile.rule }}</strong></div>
              <div class="earthquake-parameter-line"><span>约束</span><strong>{{ earthquakeParameterProfile.constraint }}</strong></div>
            </details>
            <div v-if="earthquakeImportError" class="earthquake-import-error" role="alert">{{ earthquakeImportError }}</div>
            <label v-if="selectedEarthquakeOperation === 'thermal'" class="raster-parameter-field is-slider">
              <span>热异常阈值 <strong>Z ≥ {{ earthquakeThermalZ.toFixed(1) }}</strong></span><mars-slider v-model:value="earthquakeThermalZ" :min="1" :max="5" :step="0.1" />
            </label>
            <label v-if="selectedEarthquakeOperation === 'deformation'" class="raster-parameter-field is-slider">
              <span>最低相干性 <strong>{{ earthquakeCoherence.toFixed(2) }}</strong></span><mars-slider v-model:value="earthquakeCoherence" :min="0.2" :max="0.9" :step="0.05" />
            </label>
            <label v-if="selectedEarthquakeOperation === 'deformation'" class="raster-parameter-field is-slider">
              <span>LOS 关注阈值 <strong>{{ earthquakeDeformationMm }} mm</strong></span><mars-slider v-model:value="earthquakeDeformationMm" :min="5" :max="100" :step="5" />
            </label>
            <label v-if="selectedEarthquakeOperation === 'risk'" class="raster-parameter-field is-slider">
              <span>优先核查阈值 <strong>{{ earthquakeRiskHigh.toFixed(2) }}</strong></span><mars-slider v-model:value="earthquakeRiskHigh" :min="0.05" :max="0.8" :step="0.05" />
            </label>
            <div v-if="selectedEarthquakeOperation === 'intensity'" class="earthquake-model-note">GB/T 17742-2020 · PGA/PGV 同级初判</div>
          </div>
          <div v-else class="raster-parameter-panel spatial-parameter-panel">
            <label v-if="selectedSpatialOperation !== 'neighborhood'" class="raster-parameter-field is-slider">
              <span>亮度阈值 <strong>{{ spatialThreshold }}</strong></span>
              <mars-slider v-model:value="spatialThreshold" :min="40" :max="230" :step="5" />
            </label>
            <label v-if="selectedSpatialOperation === 'buffer' || selectedSpatialOperation === 'neighborhood'" class="raster-parameter-field">
              <span>像元半径</span>
              <a-select v-model:value="spatialRadius" size="small" aria-label="空间分析半径">
                <a-select-option :value="4">4 像元</a-select-option>
                <a-select-option :value="8">8 像元</a-select-option>
                <a-select-option :value="16">16 像元</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSpatialOperation === 'overlay'" class="raster-parameter-field">
              <span>叠加关系</span>
              <a-select v-model:value="spatialOverlayMode" size="small" aria-label="空间叠加关系">
                <a-select-option value="intersect">交集 A ∩ B</a-select-option>
                <a-select-option value="union">并集 A ∪ B</a-select-option>
                <a-select-option value="difference">差集 A − B</a-select-option>
              </a-select>
            </label>
            <label v-if="selectedSpatialOperation === 'neighborhood'" class="raster-parameter-field">
              <span>邻域指标</span>
              <a-select v-model:value="spatialNeighborhoodMetric" size="small" aria-label="邻域指标">
                <a-select-option value="mean">局部均值</a-select-option>
                <a-select-option value="variation">局部标准差</a-select-option>
              </a-select>
            </label>
            <label class="raster-parameter-field is-slider">
              <span>图层透明度 <strong>{{ spatialOpacity }}%</strong></span>
              <mars-slider v-model:value="spatialOpacity" :min="30" :max="100" :step="1" />
            </label>
          </div>
          <div v-if="analysisWorkspaceMode === 'raster'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || rasterRunning" @click="runRasterCalculation()">
              <mars-icon :icon="rasterRunning ? 'loading-four' : 'play'" :width="14" />
              {{ rasterRunning ? "正在计算" : "执行并渲染" }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!rasterResult" @click="clearRasterCalculation">
              清除结果
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'temporal'" class="raster-run-row">
            <mars-button
              type="primary"
              size="small"
              :disabled="!selectionScopeLocked || temporalFrames.length < 2 || temporalRunning || temporalCapturing"
              @click="runTemporalAnalysis()"
            >
              <mars-icon :icon="temporalRunning ? 'loading-four' : 'play'" :width="14" />
              {{ temporalRunning ? "正在计算" : "执行并渲染" }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!temporalResult" @click="clearTemporalResult">
              清除结果
            </button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'signal'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || signalRunning" @click="runSignalAnalysis()">
              <mars-icon :icon="signalRunning ? 'loading-four' : 'play'" :width="14" />
              {{ signalRunning ? "正在处理" : "执行并渲染" }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!signalResult" @click="clearSignalResult">清除结果</button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'statistics'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || statisticsRunning" @click="runStatisticsAnalysis()">
              <mars-icon :icon="statisticsRunning ? 'loading-four' : 'play'" :width="14" />
              {{ statisticsRunning ? "正在统计" : "执行并渲染" }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!statisticsResult" @click="clearStatisticsResult">清除结果</button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'background'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || !backgroundBaseline || backgroundRunning || backgroundCapturing" @click="runBackgroundAnalysis()">
              <mars-icon :icon="backgroundRunning ? 'loading-four' : 'play'" :width="14" />{{ backgroundRunning ? '正在计算' : '执行并渲染' }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!backgroundResult" @click="clearBackgroundResult">清除结果</button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'numeric'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || numericRunning" @click="runNumericTransform()">
              <mars-icon :icon="numericRunning ? 'loading-four' : 'play'" :width="14" />{{ numericRunning ? '正在变换' : '执行并渲染' }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!numericResult" @click="clearNumericResult">清除结果</button>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'earthquake'" class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || !earthquakeDataset || earthquakeRunning" @click="runEarthquakeAnalysis()">
              <mars-icon :icon="earthquakeRunning ? 'loading-four' : 'play'" :width="14" />{{ earthquakeRunning ? '正在分析' : '执行并落图' }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!earthquakeResult" @click="clearEarthquakeResult">清除结果</button>
          </div>
          <div v-else class="raster-run-row">
            <mars-button type="primary" size="small" :disabled="!selectionScopeLocked || spatialRunning" @click="runSpatialAnalysis()">
              <mars-icon :icon="spatialRunning ? 'loading-four' : 'play'" :width="14" />
              {{ spatialRunning ? "正在分析" : "执行并渲染" }}
            </mars-button>
            <button type="button" class="raster-clear-button" :disabled="!spatialResult" @click="clearSpatialResult">清除结果</button>
          </div>
        </section>

        <section class="side-layout-section chart-output-section">
          <div class="panel-section-head">
            <div class="earthquake-view-switch" role="tablist" aria-label="专题结果与图标">
              <button type="button" role="tab" :aria-selected="earthquakeOutputView === 'result'" :class="{ 'is-active': earthquakeOutputView === 'result' }" @click="earthquakeOutputView = 'result'">结果</button>
              <button type="button" role="tab" :aria-selected="earthquakeOutputView === 'symbols'" :class="{ 'is-active': earthquakeOutputView === 'symbols' }" @click="earthquakeOutputView = 'symbols'">图标区</button>
            </div>
            <div v-if="analysisWorkspaceMode === 'raster'" class="panel-section-actions">
              <a-button
                type="text"
                size="small"
                class="board-mode-btn"
                :class="{ 'is-active': chartViewMode === 'board' }"
                title="打开制图排版工作台"
                aria-label="打开制图排版工作台"
                @click="toggleBoardMode"
              >
                <mars-icon icon="page-template" :width="16" />
                <span>制图排版</span>
              </a-button>
            </div>
            <div v-else-if="analysisWorkspaceMode === 'temporal'" class="temporal-period-badge" aria-label="已采集时序帧数">
              {{ temporalFrames.length }} / {{ MAX_TEMPORAL_FRAMES }} 期
            </div>
            <div v-else-if="analysisWorkspaceMode !== 'earthquake'" class="signal-source-badge">{{ analysisSourceBadge }}</div>
          </div>
          <template v-if="analysisWorkspaceMode === 'raster' && earthquakeOutputView === 'result'">
          <div v-if="rasterResult" class="raster-result-strip" role="status">
            <img :src="rasterResult.image" :alt="`${rasterResult.label}栅格结果`" />
            <div class="raster-result-copy">
              <strong>{{ rasterResult.label }}</strong>
              <span>{{ rasterResult.detail }}</span>
            </div>
            <span class="raster-result-time">{{ rasterResult.elapsed }} ms</span>
            <div class="raster-use-actions">
              <select v-model="rasterUseRole" aria-label="结果图片用途"><option value="main">设为主图</option><option value="inset">添加为副图</option></select>
              <button type="button" :disabled="rasterRunning || rasterUsing || rasterResult.scopeKey !== lockedScopeKey" @click="useRasterResult"><mars-icon icon="check" :width="14" />{{ rasterUsing ? '使用中' : '使用' }}</button>
            </div>
          </div>
          <div class="chart-analysis-toolbar">
            <a-select
              v-model:value="selectedAnalysisMetric"
              size="small"
              class="operator-select"
              aria-label="选择图表分析指标"
              :title="selectedMetricDescription"
            >
              <a-select-option v-for="opt in analysisMetricOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-select-option>
            </a-select>
            <button type="button" class="chart-refresh-button" :disabled="analysisRunning" @click="runScreenshotAnalysis">
              <mars-icon icon="refresh" :width="13" />
            </button>
          </div>
          <div class="chart-template-row">
            <a-select v-model:value="selectedChartTemplateType" size="small" class="chart-template-select" aria-label="选择图表模板">
              <a-select-option v-for="opt in chartTypeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-select-option>
            </a-select>
            <mars-button size="small" :disabled="!screenshotAnalysis" @click="() => addChartTemplate(selectedChartTemplateType)">添加模板</mars-button>
          </div>
          <div v-if="screenshotAnalysis" class="analysis-summary-strip" role="status">
            <span>{{ screenshotAnalysis.sampledPixels.toLocaleString() }} 像素</span>
            <span>均值 {{ screenshotAnalysis.mean.toFixed(1) }}</span>
            <span>波动 {{ screenshotAnalysis.standardDeviation.toFixed(1) }}</span>
          </div>

          <div v-if="chartViewMode === 'list'" class="chart-list">
          <section class="chart-demo-section main-image-section">
            <div class="chart-demo-head">
              <div>
                <div class="chart-demo-title">主图</div>
                <div class="chart-demo-subtitle">框选截图与像素运算使用完全相同的空间范围</div>
              </div>
            </div>
            <div class="main-image-card">
              <div class="main-image-preview">
                <img v-if="mainImageUrl" :key="mainImageUrl" :src="mainImageUrl" alt="专题主图" class="main-image-tag" />
                <div v-else class="main-image-empty">锁定制图范围后，可生成框选区专题主图</div>
              </div>
              <div class="main-image-info">
                <div class="main-image-name">{{ mainImageTitle }}</div>
                <div class="main-image-meta">{{ mainImageMeta }}</div>
              </div>
            </div>
          </section>
          <div v-for="item in chartList" :key="item.id" class="chart-list-item" :data-chart-id="item.id">
            <div class="chart-list-item-head">
              <a-select
                v-model:value="item.type"
                class="chart-name-select"
                :aria-label="`${item.name}图表类型`"
                @change="(value: ChartType) => handleChartTypeChange(item.id, value)"
              >
                <a-select-option
                  v-for="opt in chartTypeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </a-select-option>
              </a-select>
              <button type="button" class="chart-list-item-remove" @click="removeChartItem(item.id)">移除</button>
            </div>
            <div class="chart-result-meta">{{ getChartItemMeta(item) }}</div>
            <div :ref="(el) => bindChartEl(item.id, el as HTMLDivElement | null)" class="chart-list-item-canvas"></div>
            <details class="linked-chart-properties">
              <summary @click="focusCompositionChart(item.id)">版面位置与样式</summary>
              <div v-if="composerLayouts[item.id]" class="linked-chart-fields">
                <label v-for="field in compositionFields" :key="field.key">{{ field.label }}<CompositionNumberInput :label="`图表${field.label}`" :value="Math.round(composerLayouts[item.id][field.key])" @change="value => setCompositionField(item.id, field.key, value)" /></label>
                <label class="linked-chart-transparent"><input type="checkbox" :checked="composerLayouts[item.id].background === 'transparent'" @change="composerRef?.updateChart(item.id, { background: ($event.target as HTMLInputElement).checked ? 'transparent' : 'white' })" />透明底色</label>
              </div>
            </details>
          </div>
        </div>

          <div v-else class="chart-board">
          <div class="chart-board-toolbar">
            <span class="chart-board-hint">画板模式：拖拽图表移动，空白处平移，滚轮缩放</span>
            <div class="chart-board-right-actions">
              <div class="chart-board-dropdowns">
                <a-dropdown :trigger="['click']" placement="bottom">
                  <button type="button" class="chart-board-dropdown-btn">
                    <span>下载</span>
                    <mars-icon icon="down" :width="12" />
                  </button>
                  <template #overlay>
                    <a-menu @click="handleBoardDownloadMenu">
                      <a-menu-item key="view">下载当前视图</a-menu-item>
                      <a-menu-item key="board">下载画板</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
                <a-dropdown :trigger="['click']" placement="bottom">
                  <button type="button" class="chart-board-dropdown-btn">
                    <span>画板尺寸</span>
                    <mars-icon icon="down" :width="12" />
                  </button>
                  <template #overlay>
                    <a-menu @click="handleBoardSizeMenu">
                      <a-menu-item key="1920x1080">1920*1080</a-menu-item>
                      <a-menu-item key="1080x1080">1080*1080</a-menu-item>
                      <a-menu-item key="custom">自定义</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
              <div class="chart-board-zoom">
                <button type="button" class="chart-board-zoom-btn" title="缩小" @click="zoomBoardOut">−</button>
                <span class="chart-board-zoom-label">{{ boardZoomLabel }}</span>
                <button type="button" class="chart-board-zoom-btn" title="放大" @click="zoomBoardIn">+</button>
                <button type="button" class="chart-board-zoom-btn chart-board-zoom-reset" @click="resetBoardZoom">重置</button>
              </div>
            </div>
          </div>
          <div
            ref="boardViewportRef"
            class="chart-board-viewport"
            :class="{ 'is-panning': isBoardPanning }"
            @mousedown="startBoardPan"
            @wheel.prevent="onBoardWheel"
          >
            <div
              class="chart-board-surface"
              :style="boardSurfaceStyle"
            >
              <div class="chart-board-safe-area" aria-hidden="true" :style="{ inset: `${BOARD_PAD}px` }"></div>
              <div v-if="chartList.length === 0 && !mainImageUrl" class="chart-board-empty">
                画板为空，点击「添加图表」后可在此自由排布
              </div>
              <div
                v-if="mainImageUrl"
                class="chart-board-card chart-board-main-image-card"
                :style="{
                  left: `${BOARD_PAD}px`,
                  top: `${BOARD_PAD}px`,
                  width: `${Math.min(BOARD_CARD_WIDTH * 2 + BOARD_GAP, boardWidth - BOARD_PAD * 2)}px`,
                  height: `${BOARD_CARD_HEIGHT + 68}px`
                }"
              >
                <div class="chart-list-item-head">
                  <div class="chart-board-main-image-title">专题主图</div>
                </div>
                <div class="chart-board-main-image-body">
                  <img :key="`board_${mainImageUrl}`" :src="mainImageUrl" alt="专题主图" class="chart-board-main-image-tag" />
                </div>
              </div>
              <div
                v-for="item in chartList"
                :key="item.id"
                class="chart-board-card"
                :class="{ 'is-dragging': draggingChartId === item.id }"
                :style="getBoardCardStyle(item)"
                @mousedown.stop="startBoardDrag(item, $event)"
              >
                <div class="chart-list-item-head">
                  <a-select
                    v-model:value="item.type"
                    class="chart-name-select"
                    :aria-label="`${item.name}图表类型`"
                    @mousedown.stop
                    @change="(value: ChartType) => handleChartTypeChange(item.id, value)"
                  >
                    <a-select-option
                      v-for="opt in chartTypeOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}｜{{ opt.scene }}｜{{ opt.summary }}
                    </a-select-option>
                  </a-select>
                  <button type="button" class="chart-list-item-remove" @mousedown.stop @click="removeChartItem(item.id)">移除</button>
                </div>
                <div :ref="(el) => bindChartEl(item.id, el as HTMLDivElement | null)" class="chart-list-item-canvas chart-board-card-canvas"></div>
                <div
                  v-for="handle in boardResizeHandles"
                  :key="handle"
                  class="chart-board-handle"
                  :class="`is-${handle}`"
                  :title="isCornerHandle(handle) ? '四角等比缩放' : '边侧缩放'"
                  @mousedown.stop="startBoardResize(item, handle, $event)"
                ></div>
              </div>
            </div>
          </div>
          </div>
          </template>

          <div v-else-if="analysisWorkspaceMode === 'temporal' && earthquakeOutputView === 'result'" class="temporal-result-body">
            <div v-if="temporalResult" class="raster-result-strip temporal-result-strip" role="status">
              <img :src="temporalResult.image" :alt="`${temporalResult.label}时序分析结果`" />
              <div class="raster-result-copy">
                <strong>{{ temporalResult.label }}</strong>
                <span>{{ temporalResult.detail }}</span>
              </div>
              <span class="raster-result-time">{{ temporalResult.elapsed }} ms</span>
            </div>

            <div class="temporal-series-head">
              <div>
                <strong>观测序列</strong>
                <span>同一锁定范围 · 统一 480 × 270 像元</span>
              </div>
              <button
                type="button"
                class="temporal-clear-series"
                :disabled="temporalFrames.length === 0"
                @click="clearTemporalFrames"
              >
                清空
              </button>
            </div>

            <div class="temporal-frame-rail" aria-label="已采集时序帧">
              <div v-for="(frame, index) in temporalFrames" :key="frame.id" class="temporal-frame-item">
                <img :src="frame.image" :alt="`第 ${index + 1} 期地图截图`" />
                <span class="temporal-frame-index">T{{ index + 1 }}</span>
                <span class="temporal-frame-label">{{ frame.label }}</span>
                <button type="button" title="移除该期" aria-label="移除该期" @click="removeTemporalFrame(frame.id)">
                  <mars-icon icon="close-small" :width="12" />
                </button>
              </div>
              <button
                v-if="temporalFrames.length < MAX_TEMPORAL_FRAMES"
                type="button"
                class="temporal-frame-add"
                :disabled="temporalCapturing || !selectionScopeLocked"
                @click="captureTemporalFrame()"
              >
                <mars-icon :icon="temporalCapturing ? 'loading-four' : 'plus'" :width="17" />
                <span>采集当前期</span>
              </button>
            </div>

            <div v-if="temporalFrames.length < 2" class="temporal-analysis-empty">
              <mars-icon icon="timeline" :width="22" />
              <strong>至少需要两个时相</strong>
              <span>使用时间轴切换日期，每次地图加载完成后采集当前帧。</span>
            </div>
            <template v-else-if="temporalResult">
              <div class="temporal-sparkline-section">
                <div class="temporal-sparkline-head">
                  <strong>区域均值序列</strong>
                  <span>{{ temporalResult.summary.frameCount }} 期连续观测</span>
                </div>
                <svg viewBox="0 0 328 54" role="img" aria-label="区域均值时序曲线">
                  <line x1="8" y1="46" x2="320" y2="46" />
                  <line x1="8" y1="8" x2="8" y2="46" />
                  <polyline :points="temporalSparklinePoints" />
                </svg>
                <div class="temporal-sparkline-axis">
                  <span>T1</span>
                  <span>T{{ temporalResult.summary.frameCount }}</span>
                </div>
              </div>
              <div class="temporal-metric-grid">
                <div v-for="metric in getTemporalMetricItems()" :key="metric.label" class="temporal-metric-item">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
              <div class="temporal-method-note">
                <mars-icon icon="check-one" :width="13" />
                <span>结果仅渲染于锁定范围，框外像元保持透明。</span>
              </div>
            </template>
            <div v-else class="temporal-analysis-ready">
              <mars-icon icon="check-one" :width="20" />
              <div>
                <strong>序列已就绪</strong>
                <span>选择上方算子，执行后立即回写地图。</span>
              </div>
            </div>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'signal' && earthquakeOutputView === 'result'" class="signal-result-body">
            <div v-if="signalResult" class="raster-result-strip signal-result-strip" role="status">
              <img :src="signalResult.image" :alt="`${signalResult.label}处理结果`" />
              <div class="raster-result-copy">
                <strong>{{ signalResult.label }}</strong>
                <span>{{ signalResult.detail }}</span>
              </div>
              <span class="raster-result-time">{{ signalResult.elapsed }} ms</span>
            </div>

            <template v-if="signalResult">
              <div class="signal-preview-head">
                <strong>影像对照</strong>
                <span>{{ SIGNAL_CAPTURE_WIDTH }} × {{ SIGNAL_CAPTURE_HEIGHT }} 像元</span>
              </div>
              <div class="signal-preview-grid">
                <div class="signal-preview-item">
                  <span>输入影像</span>
                  <img :src="signalResult.sourceImage" alt="框选范围输入影像" />
                </div>
                <div class="signal-preview-item">
                  <span>处理结果</span>
                  <img :src="signalResult.image" :alt="`${signalResult.label}处理结果预览`" />
                </div>
              </div>
              <div v-if="signalResult.operation === 'fourier'" class="signal-spectrum-section">
                <div class="signal-preview-head">
                  <strong>径向能量谱</strong>
                  <span>低频 → 高频</span>
                </div>
                <svg viewBox="0 0 328 58" role="img" aria-label="径向频谱能量曲线">
                  <line x1="8" y1="52" x2="320" y2="52" />
                  <polyline :points="signalSpectrumPoints" />
                </svg>
              </div>
              <div v-else class="signal-legend" :class="`is-${signalResult.operation}`">
                <span>{{ signalResult.operation === 'filter' ? '原始影像' : signalResult.operation === 'edge' ? '透明背景' : '低响应' }}</span>
                <i aria-hidden="true"></i>
                <span>{{ signalResult.operation === 'filter' ? '去噪影像' : signalResult.operation === 'edge' ? '边缘线' : '高响应' }}</span>
              </div>
              <div class="temporal-metric-grid signal-metric-grid">
                <div v-for="metric in getSignalMetricItems()" :key="metric.label" class="temporal-metric-item">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
              <div class="signal-provenance">
                <mars-icon icon="info" :width="13" />
                <span>基于当前地图截图的 RGB 亮度计算，数值单位为影像像元。</span>
              </div>
            </template>
            <div v-else class="signal-empty-state">
              <mars-icon icon="waves-left" :width="22" />
              <strong>当前范围可进行信号处理</strong>
              <span>选择上方算子，结果将覆盖显示在已锁定的制图范围内。</span>
            </div>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'statistics' && earthquakeOutputView === 'result'" class="signal-result-body statistics-result-body">
            <div v-if="statisticsResult" class="raster-result-strip" role="status">
              <img :src="statisticsResult.image" :alt="`${statisticsResult.label}结果`" />
              <div class="raster-result-copy">
                <strong>{{ statisticsResult.label }}</strong>
                <span>{{ statisticsResult.detail }}</span>
              </div>
              <span class="raster-result-time">{{ statisticsResult.elapsed }} ms</span>
            </div>
            <template v-if="statisticsResult">
              <div class="signal-preview-head">
                <strong>范围影像与统计结果</strong>
                <span>{{ STATISTICS_CAPTURE_WIDTH }} × {{ STATISTICS_CAPTURE_HEIGHT }}</span>
              </div>
              <div class="signal-preview-grid">
                <div class="signal-preview-item">
                  <span>输入影像</span>
                  <img :src="statisticsResult.sourceImage" alt="统计范围输入影像" />
                </div>
                <div class="signal-preview-item">
                  <span>统计图层</span>
                  <img :src="statisticsResult.image" :alt="`${statisticsResult.label}预览`" />
                </div>
              </div>
              <div class="temporal-metric-grid signal-metric-grid">
                <div v-for="metric in getStatisticsMetricItems()" :key="metric.label" class="temporal-metric-item">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </div>
              </div>
              <div class="statistics-chart-head">
                <strong>{{ statisticsChartTitle }}</strong>
                <span>{{ statisticsChartUnit }}</span>
              </div>
              <div class="statistics-chart" role="img" :aria-label="`${statisticsResult.label}统计条形图`">
                <div v-for="row in statisticsResult.summary.rows" :key="row.label" class="statistics-chart-row">
                  <span>{{ row.label }}</span>
                  <div class="statistics-chart-track"><i :style="{ width: `${getStatisticsBarWidth(row.value)}%`, backgroundColor: row.color }"></i></div>
                  <strong>{{ formatStatisticsValue(row.value) }}</strong>
                </div>
              </div>
              <div class="signal-provenance">
                <mars-icon icon="info" :width="13" />
                <span>基于框选地图截图的亮度像元统计；不代表原始业务数据或显著性检验。</span>
              </div>
            </template>
            <div v-else class="signal-empty-state">
              <mars-icon icon="chart-histogram" :width="22" />
              <strong>当前范围可进行空间统计</strong>
              <span>选择上方算子，结果将覆盖显示在已锁定的制图范围内。</span>
            </div>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'background' && earthquakeOutputView === 'result'" class="signal-result-body spatial-result-body">
            <div v-if="backgroundResult" class="raster-result-strip" role="status">
              <img :src="backgroundResult.image" :alt="`${backgroundResult.label}结果`" />
              <div class="raster-result-copy"><strong>{{ backgroundResult.label }}</strong><span>{{ backgroundResult.detail }}</span></div>
              <span class="raster-result-time">{{ backgroundResult.elapsed }} ms</span>
            </div>
            <template v-if="backgroundResult">
              <div class="signal-preview-head"><strong>同范围影像对比</strong><span>{{ backgroundResult.width }} × {{ backgroundResult.height }}</span></div>
              <div class="signal-preview-grid background-preview-grid">
                <div class="signal-preview-item"><span>基准</span><img :src="backgroundResult.baselineImage" alt="基准地图影像" /></div>
                <div class="signal-preview-item"><span>当前</span><img :src="backgroundResult.sourceImage" alt="当前地图影像" /></div>
                <div class="signal-preview-item"><span>变化</span><img :src="backgroundResult.image" alt="背景变化结果" /></div>
              </div>
              <div class="temporal-metric-grid signal-metric-grid">
                <div v-for="metric in getBackgroundMetricItems()" :key="metric.label" class="temporal-metric-item"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
              </div>
              <div class="statistics-chart-head"><strong>像元变化分布</strong><span>像元</span></div>
              <div class="statistics-chart" role="img" aria-label="背景场像元变化分布图">
                <div v-for="row in backgroundResult.summary.rows" :key="row.label" class="statistics-chart-row">
                  <span>{{ row.label }}</span><div class="statistics-chart-track"><i :style="{ width: `${getBackgroundBarWidth(row.value)}%`, backgroundColor: row.color }"></i></div><strong>{{ row.value.toLocaleString() }}</strong>
                </div>
              </div>
              <div class="signal-provenance"><mars-icon icon="info" :width="13" /><span>基于两次同范围地图截图的 RGB 亮度像元运算；归一化使用基准影像的空间标准差，不代表物理背景场。</span></div>
            </template>
            <div v-else class="signal-empty-state">
              <mars-icon icon="data-switching" :width="22" /><strong>{{ backgroundBaseline ? '基准已就绪' : '等待基准影像' }}</strong>
              <span>{{ backgroundBaseline ? '切换地图图层或时间后执行运算，结果仅渲染于锁定范围。' : '先采集基准，再切换地图图层或时间进行对比。' }}</span>
            </div>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'numeric' && earthquakeOutputView === 'result'" class="signal-result-body spatial-result-body">
            <div v-if="numericResult" class="raster-result-strip" role="status">
              <img :src="numericResult.image" :alt="`${numericResult.label}结果`" />
              <div class="raster-result-copy"><strong>{{ numericResult.label }}</strong><span>{{ numericResult.detail }}</span></div>
              <span class="raster-result-time">{{ numericResult.elapsed }} ms</span>
            </div>
            <template v-if="numericResult">
              <div class="signal-preview-head"><strong>像元变换结果</strong><span>{{ numericResult.width }} × {{ numericResult.height }}</span></div>
              <div class="signal-preview-grid">
                <div class="signal-preview-item"><span>输入影像</span><img :src="numericResult.sourceImage" alt="数值变换输入影像" /></div>
                <div class="signal-preview-item"><span>变换图层</span><img :src="numericResult.image" :alt="`${numericResult.label}预览`" /></div>
              </div>
              <div class="temporal-metric-grid signal-metric-grid">
                <div v-for="metric in getNumericMetricItems()" :key="metric.label" class="temporal-metric-item"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
              </div>
              <div v-if="numericResult.operation === 'projection'" class="numeric-coordinate-readout">
                <span>WGS84 中心：{{ numericResult.summary.centerWgs84?.map((value) => value.toFixed(5)).join(', ') }}°</span>
                <span>EPSG:3857：{{ numericResult.summary.centerMercator?.map((value) => value.toFixed(1)).join(', ') }} m</span>
              </div>
              <button v-if="numericResult.svg" type="button" class="scope-lock-reset numeric-download" @click="downloadNumericVector">
                <mars-icon icon="download" :width="14" />下载像素坐标 SVG
              </button>
              <div class="statistics-chart-head"><strong>像元选取分布</strong><span>像元</span></div>
              <div class="statistics-chart" role="img" aria-label="数值变换像元分布图">
                <div v-for="row in numericResult.summary.rows" :key="row.label" class="statistics-chart-row">
                  <span>{{ row.label }}</span><div class="statistics-chart-track"><i :style="{ width: `${getNumericBarWidth(row.value)}%`, backgroundColor: row.color }"></i></div><strong>{{ row.value.toLocaleString() }}</strong>
                </div>
              </div>
              <div class="signal-provenance"><mars-icon icon="info" :width="13" /><span>{{ numericResult.operation === 'projection' ? '仅对框选范围坐标进行投影换算；网格为示意，不对三维地图截图进行栅格重投影。' : '基于框选地图截图的 RGB 像元变换；SVG 使用像素坐标，不是 GIS 地理矢量。' }}</span></div>
            </template>
            <div v-else class="signal-empty-state"><mars-icon icon="calculator-one" :width="22" /><strong>当前范围可进行数值变换</strong><span>选择算子，结果仅在锁定的制图范围内渲染。</span></div>
          </div>
          <div v-else-if="analysisWorkspaceMode === 'earthquake' && earthquakeOutputView === 'result'" class="signal-result-body earthquake-result-body">
            <div v-if="earthquakeResult" class="earthquake-result-summary" role="status">
              <span class="earthquake-result-mark" :class="`is-${earthquakeResult.operation}`"><mars-icon :icon="earthquakeOperatorIcon" :width="18" /></span>
              <div><strong>{{ earthquakeOperatorLabel }}</strong><span>{{ earthquakeResult.method }}</span></div>
              <button type="button" class="scope-lock-reset earthquake-export" title="下载观测点分析结果 GeoJSON" aria-label="下载地震专题结果" @click="downloadEarthquakeResult"><mars-icon icon="download" :width="14" /></button>
            </div>
            <template v-if="earthquakeResult">
              <EarthquakePalette :palette="earthquakeResult.palette" />
              <div class="earthquake-filter-panel" aria-label="结果二次筛选">
                <div class="earthquake-filter-head"><strong>二次筛选</strong><span>显示 {{ earthquakeFilteredPoints.length }} / {{ earthquakeResult.points.length }}</span><button type="button" @click="resetEarthquakeFilters">重置</button></div>
                <div class="earthquake-filter-grid">
                  <label><span>数值下限</span><a-input-number v-model:value="earthquakeFilterMin" size="small" :step="earthquakeResult.operation === 'risk' ? 0.01 : 0.1" aria-label="结果数值下限" placeholder="不限" /></label>
                  <label><span>数值上限</span><a-input-number v-model:value="earthquakeFilterMax" size="small" :step="earthquakeResult.operation === 'risk' ? 0.01 : 0.1" aria-label="结果数值上限" placeholder="不限" /></label>
                </div>
                <div class="earthquake-filter-grid">
                  <label><span>空间</span><a-select v-model:value="earthquakeSpatialFilterMode" size="small" aria-label="结果空间筛选"><a-select-option value="scope">锁定范围</a-select-option><a-select-option value="custom">自定义经纬度</a-select-option></a-select></label>
                  <label><span>特征</span><a-select v-model:value="earthquakeFilterBand" size="small" aria-label="结果特征筛选"><a-select-option value="all">全部等级</a-select-option><a-select-option v-for="band in earthquakeFilterBands" :key="band" :value="band">{{ band }}</a-select-option></a-select></label>
                </div>
                <div v-if="earthquakeSpatialFilterMode === 'custom'" class="earthquake-filter-grid is-coordinates">
                  <label><span>西经度</span><a-input-number v-model:value="earthquakeFilterWest" size="small" :precision="4" aria-label="筛选西经度" /></label>
                  <label><span>东经度</span><a-input-number v-model:value="earthquakeFilterEast" size="small" :precision="4" aria-label="筛选东经度" /></label>
                  <label><span>南纬度</span><a-input-number v-model:value="earthquakeFilterSouth" size="small" :precision="4" aria-label="筛选南纬度" /></label>
                  <label><span>北纬度</span><a-input-number v-model:value="earthquakeFilterNorth" size="small" :precision="4" aria-label="筛选北纬度" /></label>
                </div>
                <span v-if="earthquakeSpatialFilterMode === 'custom' && !earthquakeSpatialFilterBounds" class="earthquake-filter-warning" role="alert">请填写有效的经纬度范围</span>
                <span v-if="earthquakeFilterMin !== null && earthquakeFilterMax !== null && earthquakeFilterMin > earthquakeFilterMax" class="earthquake-filter-warning" role="alert">数值下限不能大于上限</span>
              </div>
              <div class="earthquake-quality-line"><strong>{{ earthquakeFilteredPoints.length }}</strong> 显示点 <span>·</span> {{ earthquakeResult.excludedCount }} 质量剔除 <span>·</span> {{ earthquakeResult.unit }}</div>
              <div class="earthquake-metric-grid">
                <div v-for="metric in earthquakeVisibleMetrics" :key="metric.label" class="earthquake-metric"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
              </div>
              <div class="statistics-chart-head"><strong>等级构成</strong><span>观测点</span></div>
              <div class="statistics-chart earthquake-chart" role="img" :aria-label="`${earthquakeOperatorLabel}等级分布`">
                <div v-for="row in earthquakeFilteredRows" :key="row.label" class="statistics-chart-row">
                  <span>{{ row.label }}</span><div class="statistics-chart-track"><i :style="{ width: `${getEarthquakeBarWidth(row.value)}%`, backgroundColor: row.color }"></i></div><strong>{{ row.value }}</strong>
                </div>
                <span v-if="!earthquakeFilteredRows.length" class="earthquake-filter-warning">当前筛选无匹配观测点</span>
              </div>
              <div class="earthquake-observation-head"><strong>观测点</strong><span>前 {{ Math.min(earthquakeFilteredPoints.length, 8) }} / {{ earthquakeFilteredPoints.length }}</span></div>
              <div class="earthquake-observation-list">
                <div v-for="(point, index) in earthquakeFilteredPoints.slice(0, 8)" :key="`${point.lon}:${point.lat}:${index}`" class="earthquake-observation-row">
                  <i :style="{ backgroundColor: point.color }"></i><span>{{ point.lon.toFixed(3) }}°, {{ point.lat.toFixed(3) }}°</span><strong>{{ point.band }}</strong>
                </div>
              </div>
              <div class="signal-provenance"><mars-icon icon="info" :width="13" /><span>{{ earthquakeResult.caution }}</span></div>
            </template>
            <div v-else class="earthquake-empty-state">
              <mars-icon icon="radar-chart" :width="21" />
              <strong>{{ earthquakeDataset ? '观测数据已就绪' : '等待地震观测数据' }}</strong>
              <span>{{ earthquakeDataset ? '选择上方算子，结果将按真实经纬度落在锁定范围内。' : '导入含来源、单位和质量字段的观测 GeoJSON。' }}</span>
            </div>
          </div>
          <div v-else-if="earthquakeOutputView === 'symbols'" class="earthquake-symbol-pane" role="tabpanel" aria-label="图标区">
            <div class="earthquake-view-switch" role="tablist" aria-label="图标分类"><button type="button" role="tab" :aria-selected="symbolFamily === 'basic'" :class="{ 'is-active': symbolFamily === 'basic' }" @click="symbolFamily = 'basic'">基础地理</button><button type="button" role="tab" :aria-selected="symbolFamily === 'earthquake'" :class="{ 'is-active': symbolFamily === 'earthquake' }" @click="symbolFamily = 'earthquake'">地震专业</button></div>
            <div class="earthquake-symbol-status">{{ pendingEarthquakeSymbolKind ? '在框选区地图上单击放置图标' : '选择业务图标' }}<button v-if="pendingEarthquakeSymbolKind" type="button" @click="cancelEarthquakeSymbolPlacement">取消</button></div>
            <div class="earthquake-symbol-palette" role="group" :aria-label="symbolFamily === 'basic' ? '基础地理图标' : '地震业务图标'">
              <button v-for="symbol in earthquakeSymbolOptions" :key="symbol.kind" type="button" :class="{ 'is-pending': pendingEarthquakeSymbolKind === symbol.kind }" :disabled="!selectionScopeLocked" :title="`放置${symbol.label}图标`" :aria-label="symbol.label" @click="beginEarthquakeSymbolPlacement(symbol.kind)">
                <CartographySymbolIcon :binding="symbol" :size="26" /><span>{{ symbol.shortLabel || symbol.label }}</span>
              </button>
            </div>
            <a class="symbol-source" :href="cartographySymbolSource.url" target="_blank" rel="noopener noreferrer" title="DB/T 116-2026 附录 B 地图符号样式">{{ cartographySymbolSource.name }} · {{ cartographySymbolSource.license }}</a>
            <label class="symbol-snap-control"><input v-model="symbolSnapping" type="checkbox" @change="mapWork.setCartographySnapping(symbolSnapping)" />要素磁吸 <span>20 px</span></label>
            <div class="earthquake-symbol-style-head"><strong>{{ selectedEarthquakeSymbol ? `编辑 ${selectedEarthquakeSymbol.label}` : '新图标样式' }}</strong><span v-if="selectedEarthquakeSymbol">{{ selectedEarthquakeSymbol.lon.toFixed(3) }}°, {{ selectedEarthquakeSymbol.lat.toFixed(3) }}°</span></div>
            <div class="earthquake-symbol-controls">
              <label><span>大小 <strong>{{ earthquakeSymbolStyle.size }} px</strong></span><input type="range" min="22" max="64" step="2" :value="earthquakeSymbolStyle.size" aria-label="图标大小" @input="updateEarthquakeSymbolStyle({ size: Number(($event.target as HTMLInputElement).value) })" /></label>
              <label><span>旋转 <strong>{{ earthquakeSymbolStyle.rotation }}°</strong></span><input type="range" min="-180" max="180" step="5" :value="earthquakeSymbolStyle.rotation" aria-label="图标旋转" @input="updateEarthquakeSymbolStyle({ rotation: Number(($event.target as HTMLInputElement).value) })" /></label>
              <label><span>透明度 <strong>{{ Math.round(earthquakeSymbolStyle.opacity * 100) }}%</strong></span><input type="range" min="20" max="100" step="5" :value="earthquakeSymbolStyle.opacity * 100" aria-label="图标透明度" @input="updateEarthquakeSymbolStyle({ opacity: Number(($event.target as HTMLInputElement).value) / 100 })" /></label>
              <label class="is-color"><span>颜色</span><input type="color" :value="earthquakeSymbolStyle.color" aria-label="图标颜色" @input="updateEarthquakeSymbolStyle({ color: ($event.target as HTMLInputElement).value })" /></label>
            </div>
            <div v-if="earthquakeSymbolRows.length" class="earthquake-symbol-list" aria-label="已放置图标">
              <button v-for="row in visibleSymbolRows" :key="row.id" type="button" :class="{ 'is-selected': selectedEarthquakeSymbolId === row.id }" @click="selectEarthquakeSymbol(row.id)"><CartographySymbolIcon :binding="cartographySymbolDefinitions[row.kind]" :color="row.style.color" :size="16" /><span>{{ row.label }}</span><small>{{ row.lon.toFixed(3) }}°, {{ row.lat.toFixed(3) }}°</small></button>
            </div>
          </div>
          <div v-else class="signal-result-body spatial-result-body">
            <div v-if="spatialResult" class="raster-result-strip" role="status">
              <img :src="spatialResult.image" :alt="`${spatialResult.label}结果`" />
              <div class="raster-result-copy"><strong>{{ spatialResult.label }}</strong><span>{{ spatialResult.detail }}</span></div>
              <span class="raster-result-time">{{ spatialResult.elapsed }} ms</span>
            </div>
            <template v-if="spatialResult">
              <div class="signal-preview-head"><strong>空间像元分析</strong><span>{{ SPATIAL_CAPTURE_WIDTH }} × {{ SPATIAL_CAPTURE_HEIGHT }}</span></div>
              <div class="signal-preview-grid">
                <div class="signal-preview-item"><span>输入影像</span><img :src="spatialResult.sourceImage" alt="空间分析输入影像" /></div>
                <div class="signal-preview-item"><span>分析图层</span><img :src="spatialResult.image" :alt="`${spatialResult.label}预览`" /></div>
              </div>
              <div class="temporal-metric-grid signal-metric-grid">
                <div v-for="metric in getSpatialMetricItems()" :key="metric.label" class="temporal-metric-item">
                  <span>{{ metric.label }}</span><strong>{{ metric.value }}</strong>
                </div>
              </div>
              <div class="statistics-chart-head"><strong>{{ spatialResult.label }}构成</strong><span>{{ spatialResult.operation === 'contour' ? '线段' : '像元' }}</span></div>
              <div class="statistics-chart" role="img" :aria-label="`${spatialResult.label}分布图`">
                <div v-for="row in spatialResult.summary.rows" :key="row.label" class="statistics-chart-row">
                  <span>{{ row.label }}</span>
                  <div class="statistics-chart-track"><i :style="{ width: `${getSpatialBarWidth(row.value)}%`, backgroundColor: row.color }"></i></div>
                  <strong>{{ row.value.toLocaleString() }}</strong>
                </div>
              </div>
              <div class="signal-provenance"><mars-icon icon="info" :width="13" /><span>基于框选地图截图的像元级空间运算，距离单位为像元；不是矢量地理分析结果。</span></div>
            </template>
            <div v-else class="signal-empty-state">
              <mars-icon icon="bezier-curve" :width="22" />
              <strong>当前范围可进行空间像元分析</strong>
              <span>选择算子后，结果将只在锁定的制图范围内渲染。</span>
            </div>
          </div>
        </section>
      </aside>

      <div class="thematic-panel" @mousedown="notifyPanelFront">
      <div class="panel-section-head thematic-panel-head">
        <div class="panel-section-title">专题制图</div>
      </div>

      <div ref="thematicPanelBody" class="thematic-panel-body">
      <div class="context-bar">
        <div class="context-main">
          <div class="context-title">专题制图模板</div>
          <div class="context-desc">{{ contextDesc }}</div>
        </div>
        <div class="context-actions">
          <mars-button size="small" @click="loadTemplates" :disabled="loadingTemplates">刷新模板</mars-button>
        </div>
      </div>

      <div v-if="effectiveDatasetId" class="dataset-bar">
        <span class="dataset-bar-label">数据集</span>
        <span class="dataset-bar-value">{{ effectiveDatasetName }}</span>
      </div>

      <a-alert
        v-if="!effectiveDatasetId && activeTab === 'publish'"
        class="dataset-binding-alert"
        type="warning"
        show-icon
        message="当前未绑定数据集"
        description="可先从数据集详情或当前任务进入专题制图工作台，发布页会自动带入当前数据集。"
      />
      <div v-else-if="effectiveDatasetId && isDirty && activeTab !== 'editor'" class="workbench-tip-section">
        <a-alert type="info" show-icon>
          <template #message>存在未保存编辑内容</template>
          <template #description>关闭面板或离开编辑页时会提示确认，建议先保存草稿。</template>
        </a-alert>
      </div>

      <a-tabs :active-key="activeTab" class="workbench-tabs" @change="handleTabChange">
        <a-tab-pane key="template" tab="模板库">
          <div class="template-toolbar">
            <div class="template-toolbar-heading">
              <span class="template-toolbar-title">专题制图模板</span>
              <span class="template-filter-summary" aria-live="polite">{{ filteredTemplates.length }} / {{ templateCatalog.length }}</span>
            </div>
            <div class="template-edition-filter" role="group" aria-label="模板用途筛选">
              <button
                v-for="option in templatePurposeOptions"
                :key="option.value"
                type="button"
                class="template-edition-option"
                :class="{ 'is-active': selectedTemplatePurpose === option.value }"
                :aria-pressed="selectedTemplatePurpose === option.value"
                @click="selectTemplatePurpose(option.value)"
              >
                <span>{{ option.label }}</span>
                <strong>{{ templatePurposeCounts[option.value] }}</strong>
              </button>
            </div>
            <div class="template-filter-controls">
              <a-input
                v-model:value="templateSearchKeyword"
                class="template-search-input"
                placeholder="搜索模板名称、专题代码、场景或标签"
                allow-clear
              >
                <template #prefix>
                  <mars-icon icon="search" :width="15" />
                </template>
              </a-input>
              <div class="template-filter-row">
                <a-select v-model:value="selectedTemplateEdition" aria-label="模板领域筛选" :options="templateEditionOptions" />
                <a-select
                  v-model:value="selectedTemplateDataTypes"
                  class="template-data-type-select"
                  mode="multiple"
                  placeholder="数据类型"
                  :options="templateDataTypeOptions"
                  :max-tag-count="0"
                  :max-tag-placeholder="getTemplateDataTypeTagPlaceholder"
                  allow-clear
                  aria-label="数据类型筛选"
                />
                <a-select
                  v-model:value="selectedTemplateCategories"
                  class="template-category-select"
                  mode="multiple"
                  placeholder="专题与表达分类"
                  :options="catalogCategoryFilterOptions"
                  :max-tag-count="1"
                  allow-clear
                  aria-label="模板分类筛选"
                />
                <div class="template-complexity-filter" role="group" aria-label="模板复杂度筛选">
                  <button
                    v-for="option in templateComplexityOptions"
                    :key="option.value"
                    type="button"
                    class="template-complexity-option"
                    :class="{ 'is-active': selectedTemplateComplexity === option.value }"
                    :aria-pressed="selectedTemplateComplexity === option.value"
                    @click="selectedTemplateComplexity = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div v-if="activeTemplateFilterTags.length" class="template-active-filters">
                <span class="template-active-filter-label">已选</span>
                <span v-for="tag in activeTemplateFilterTags" :key="tag" class="template-active-filter-tag">{{ tag }}</span>
                <button type="button" class="template-filter-reset" aria-label="重置全部模板筛选" @click="resetTemplateFilters">
                  <mars-icon icon="refresh" :width="13" />
                  <span>重置</span>
                </button>
              </div>
            </div>
          </div>
          <a-empty v-if="!loadingTemplates && templateCatalog.length === 0" description="暂无模板" />
          <a-empty v-else-if="!loadingTemplates && filteredTemplates.length === 0" description="当前筛选暂无模板">
            <mars-button class="template-empty-action" size="small" @click="resetTemplateFilters">重置筛选</mars-button>
          </a-empty>
          <div v-else class="template-grid">
            <article
              v-for="tpl in filteredTemplates"
              :key="tpl.templateId"
              class="template-card"
              :data-template-id="tpl.templateId"
              :data-purpose="getTemplatePurpose(tpl)"
              :class="{ active: isTemplateSelected(tpl) }"
              :aria-label="`${tpl.name || tpl.templateId}模板卡片`"
            >
              <div class="template-card-cover">
                <EmergencyTemplatePreview
                  v-if="getEmergencyCatalogEntry(tpl)"
                  class="template-card-cover-image"
                  :template-id="getEmergencyCatalogEntry(tpl)!.emergencyId"
                  :alt="`${tpl.name}合成测试校样`"
                />
                <TemplateVisualPreview
                  v-else
                  class="template-card-cover-image"
                  :kind="getTemplateVisualKind(tpl)"
                  :palette="tpl.templateId === draft.templateId ? draft.palette : resolveStandardTemplateProfile(tpl)?.palette"
                  :rendered-image="tpl.templateId === draft.templateId ? templateResultPreview : ''"
                  :legend="tpl.templateId === draft.templateId && templateResultPreview ? cartographyContext.legend : undefined"
                  :alt="`${tpl.name || tpl.templateId}模板缩略图`"
                  compact
                />
                <span class="template-card-cover-shade"></span>
                <span class="template-card-complexity">{{ getTemplateComplexityLabel(tpl) }}</span>
                <span
                  v-if="getTemplateEditionLabel(tpl)"
                  class="template-card-edition"
                  :class="{ 'is-earthquake': getTemplateEdition(tpl) === 'earthquake' }"
                >
                  {{ getTemplateEditionLabel(tpl) }}
                </span>
                <div
                  v-if="getTemplateSymbolBindings(tpl).length"
                  class="template-card-symbols"
                  :aria-label="`${tpl.name || tpl.templateId}业务图标`"
                >
                  <span
                    v-for="binding in getTemplateSymbolBindings(tpl)"
                    :key="binding.kind"
                    class="template-map-symbol"
                    :class="`is-${binding.family}`"
                    :style="getTemplateIconBindingStyle(binding)"
                    :data-icon-family="binding.family"
                    :data-icon-kind="binding.kind"
                    :title="`${binding.label}图标`"
                    role="img"
                    :aria-label="`${binding.label}图标`"
                  >
                    <CartographySymbolIcon :binding="binding" :size="13" />
                  </span>
                </div>
              </div>
              <div class="template-card-body">
                <div class="template-card-heading">
                  <div class="template-card-title-group">
                    <span
                      v-if="getTemplatePrimaryIconBinding(tpl)"
                      class="template-business-icon"
                      :style="getTemplateAccentStyle(tpl)"
                      :data-icon-family="getTemplatePrimaryIconBinding(tpl)?.family"
                      :data-icon-kind="getTemplatePrimaryIconBinding(tpl)?.kind"
                      :title="`${getTemplateBusinessIconLabel(tpl)}图标`"
                      role="img"
                      :aria-label="`${getTemplateBusinessIconLabel(tpl)}图标`"
                    >
                      <CartographySymbolIcon :binding="getTemplatePrimaryIconBinding(tpl)" :size="15" />
                    </span>
                    <div class="template-name">{{ tpl.name || tpl.templateId }}</div>
                  </div>
                  <span class="template-version">{{ getEmergencyCatalogEntry(tpl)?.emergencyId || `v${tpl.templateVersion || '1.0'}` }}</span>
                </div>
                <div class="template-desc">{{ tpl.description || "专题图模板" }}</div>
                <div class="template-card-detail-row">
                  <span class="template-card-detail-label">类型</span>
                  <div class="template-card-tags">
                    <span v-if="getTemplateCategoryLabel(tpl)" class="template-category-tag">{{ getTemplateCategoryLabel(tpl) }}</span>
                    <span v-for="label in getTemplateDataTypeLabels(tpl)" :key="label" class="template-card-tag">{{ label }}</span>
                  </div>
                </div>
                <div class="template-card-detail-row">
                  <span class="template-card-detail-label">组件</span>
                  <div class="template-card-tags">
                    <span v-for="component in getTemplateComponentLabels(tpl)" :key="component" class="template-component-tag">
                      {{ component }}
                    </span>
                  </div>
                </div>
                <div class="template-review-status">{{ getEmergencyCatalogEntry(tpl) ? 'DB/T 101-2024 · 制作要求报批稿 · 待校核' : '分析表达 · 非正式图件' }}</div>
                <div class="template-card-actions">
                  <button type="button" class="template-card-action is-preview" @click="openTemplatePreview(tpl)">
                    <mars-icon icon="eyes" :width="14" />
                    <span>预览</span>
                  </button>
                  <button type="button" class="template-card-action is-use" @click="selectTemplate(tpl)">
                    <mars-icon icon="play" :width="14" />
                    <span>使用模板</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </a-tab-pane>

        <a-tab-pane key="editor" tab="编辑">
          <DbtStandardEditor v-if="selectedStandardTemplate" v-show="workbenchMode === 'standard'" ref="standardEditorRef" embedded :template-id="selectedStandardTemplate" :active="workbenchMode === 'standard' && activeTab === 'editor' && dialogVisible && !isFold" :map-preview="standardMapPreview" :map-busy="standardMapBusy" :map-error="standardMapError" :composition-issues="standardLayoutIssues" :composed-preview="standardComposedPreview" @capture-map="captureStandardPreview(false)" @select-range="startStandardSelection" @rendered="handleStandardRendered" @open-composition="openStandardComposition" @export-proof="exportStandardProof" />
          <template v-if="workbenchMode === 'analysis'">
          <Teleport to="#thematic-template-live-host" :disabled="!chartPanelVisible || !templateLayoutEditing">
            <TemplateMapEditor v-if="selectedTemplate" ref="templateMapEditorRef" :kind="getTemplateVisualKind(selectedTemplate)" :palette="draft.palette" :title="draft.title" :legend-title="draft.legendTitle" :scope-key="lockedScopeKey" :scope-label="selectionAreaText" :observations="earthquakeDataset" @select-range="startTemplateSelection" @applied="handleTemplateApplied" @layout="openTemplateLayout" @invalidate="clearTemplatePreview" />
          </Teleport>
          <div class="editor-layout">
            <div class="editor-form">
              <a-form layout="vertical">
                <a-form-item label="模板">
                  <a-input :value="draft.templateName || '未选择模板'" disabled />
                </a-form-item>
                <a-form-item label="专题标题">
                  <a-input v-model:value="draft.title" placeholder="请输入专题标题" />
                </a-form-item>
                <a-form-item label="副标题">
                  <a-input v-model:value="draft.subtitle" placeholder="请输入副标题" />
                </a-form-item>
                <a-form-item label="图例标题">
                  <a-input v-model:value="draft.legendTitle" placeholder="请输入图例标题" />
                </a-form-item>
                <a-form-item label="配色方案">
                  <a-select v-model:value="draft.palette">
                    <a-select-option v-for="option in paletteOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="专题说明">
                  <a-textarea v-model:value="draft.notes" :rows="5" placeholder="记录业务口径、专题说明或图层备注" />
                </a-form-item>
                <a-form-item label="制图单位">
                  <a-input v-model:value="draft.agency" placeholder="填写实际制图单位" aria-label="模板制图单位" />
                </a-form-item>
              </a-form>
            </div>

            <div class="editor-side">
              <div class="preview-card">
                <div class="preview-note">{{ templateResultPreview ? '本次模板实际渲染结果' : '模板样式示例（待应用）' }}</div>
                <TemplateVisualPreview
                  v-if="selectedTemplate"
                  class="editor-template-visual"
                  :kind="getTemplateVisualKind(selectedTemplate)"
                  :palette="draft.palette"
                  :rendered-image="templateResultPreview"
                  :title="draft.title"
                  :description="draft.notes"
                  :legend="templateResultPreview ? cartographyContext.legend : undefined"
                  :alt="`${draft.templateName}样式预览`"
                />
                <div class="preview-card-content">
                  <div class="preview-title">{{ draft.title || "未命名专题图" }}</div>
                  <div class="preview-subtitle">{{ draft.subtitle || "请在左侧补充副标题" }}</div>
                  <div class="preview-palette">
                    <span class="palette-title">{{ templateResultPreview ? cartographySettings.legendTitle : draft.legendTitle || "图例" }}</span>
                    <div class="palette-strip" :class="`palette-${draft.palette}`"></div>
                  </div>
                  <div v-if="selectedTemplate" class="preview-icon-bindings">
                    <span class="preview-icon-bindings-label">专题图标</span>
                    <div class="template-icon-binding-list">
                      <span
                        v-for="binding in getTemplateDisplayIconBindings(selectedTemplate)"
                        :key="binding.kind"
                        class="template-icon-binding"
                        :class="`is-${binding.family}`"
                        :style="getTemplateIconBindingStyle(binding)"
                        :data-icon-family="binding.family"
                        :data-icon-kind="binding.kind"
                        :title="`${binding.label}图标`"
                      >
                        <CartographySymbolIcon :binding="binding" :size="13" />
                        <span>{{ binding.label }}</span>
                      </span>
                    </div>
                  </div>
                  <div v-if="selectedTemplate" class="preview-components">
                    <span v-for="component in getTemplateComponentLabels(selectedTemplate)" :key="component">{{ component }}</span>
                  </div>
                  <div class="preview-note">{{ draft.notes || "这里显示专题说明预览。" }}</div>
                </div>
              </div>

            </div>
            <div class="editor-actions">
              <mars-button size="small" @click="resetDraft">恢复上次草稿</mars-button>
              <mars-button size="small" type="primary" :disabled="!draft.templateId" @click="saveDraft">保存草稿</mars-button>
              <mars-button size="small" :disabled="!mainImageBlob" @click="openTemplateLayout">制图排版</mars-button>
            </div>
            <details class="template-standard-binding">
              <summary>规范校核</summary>
              <div>
                <span>分析辅助模板 · 未通过正式出图审核</span>
                <div class="standard-binding-field">
                  <label for="standard-target-select">应急响应专题类别</label>
                  <a-select
                    id="standard-target-select"
                    v-model:value="standardTarget"
                    size="large"
                    popup-class-name="thematic-standard-select-popup"
                    :list-height="240"
                    :virtual="false"
                  >
                    <a-select-option v-for="item in dbtTemplates" :key="item.id" :value="item.id">{{ item.name }}</a-select-option>
                  </a-select>
                </div>
                <div class="standard-binding-field">
                  <label for="standard-layer-role-select">现有数据图层类型</label>
                  <a-select
                    id="standard-layer-role-select"
                    v-model:value="standardLayerRole"
                    size="large"
                    popup-class-name="thematic-standard-select-popup"
                    :list-height="240"
                    :virtual="false"
                  >
                    <a-select-option v-for="(name, role) in dbtRoleNames" :key="role" :value="role">{{ name }}</a-select-option>
                  </a-select>
                </div>
                <mars-button size="small" @click="promoteTemplateToStandard">纳入规范制图</mars-button>
              </div>
            </details>
          </div>
          </template>
        </a-tab-pane>

        <a-tab-pane key="publish" tab="历史发布" disabled>
          <div class="publish-summary">
            <div class="summary-card">
              <div class="summary-title">发布摘要</div>
              <div class="summary-item"><span>数据集</span><strong>{{ effectiveDatasetName }}</strong></div>
              <div class="summary-item"><span>模板</span><strong>{{ draft.templateName || "未选择" }}</strong></div>
              <div class="summary-item"><span>标题</span><strong>{{ draft.title || "未填写" }}</strong></div>
              <div class="summary-item"><span>状态</span><strong>{{ isDirty ? "草稿未保存" : "草稿已保存" }}</strong></div>
            </div>
            <div class="summary-card">
              <div class="summary-title">发布说明</div>
              <a-form layout="vertical">
                <a-form-item label="发布名称">
                  <a-input v-model:value="draft.publishName" placeholder="请输入发布名称" />
                </a-form-item>
                <a-form-item label="发布描述" required>
                  <a-textarea v-model:value="draft.publishDesc" :rows="3" placeholder="至少 5 个有效字符，空白不计入" aria-label="专题发布描述" aria-describedby="workbench-publish-description-feedback" :aria-invalid="!!draft.publishDesc && !isPublishDescriptionValid(draft.publishDesc)" />
                  <div id="workbench-publish-description-feedback" class="publish-description-feedback" :class="{ 'is-ready': isPublishDescriptionValid(draft.publishDesc), 'is-short': !!draft.publishDesc && !isPublishDescriptionValid(draft.publishDesc) }" role="status">
                    <span>{{ isPublishDescriptionValid(draft.publishDesc) ? '已满足发布要求' : `还需 ${Math.max(0, MIN_PUBLISH_DESCRIPTION_LENGTH - publishDescriptionLength(draft.publishDesc))} 个有效字符` }}</span>
                    <strong>{{ publishDescriptionLength(draft.publishDesc) }} / {{ MIN_PUBLISH_DESCRIPTION_LENGTH }}</strong>
                  </div>
                </a-form-item>
                <a-form-item label="出图比例尺档位" required>
                  <a-select v-model:value="cartographySettings.scaleDenominator" placeholder="请选择比例尺" aria-label="发布出图比例尺"><a-select-option v-for="denominator in SCALE_PRESETS" :key="denominator" :value="denominator">1:{{ denominator / 10000 }} 万</a-select-option></a-select>
                </a-form-item>
                <div class="publish-actions">
                  <mars-button type="primary" @click="thematicJobsRef?.openPublishDialog(draft.templateId)">
                    <mars-icon icon="upload" :width="16" />
                    发布专题图
                  </mars-button>
                </div>
              </a-form>
            </div>
          </div>

          <div class="publish-body">
            <ThematicJobs ref="thematicJobsRef" :dataset-id="effectiveDatasetId || undefined" :publish-description="draft.publishDesc" :publish-name="draft.publishName" />
          </div>
        </a-tab-pane>
      </a-tabs>
      </div>
      </div>
    </div>
  </mars-dialog>

  <DisplaySettings ref="displaySettingsRef" v-model:open="displaySettingsOpen" :title="draft.title" :composing="syncingStyleComposition" @open-composer="openStyledComposition" />
  <CartographyComposer
    ref="composerRef"
    :anchor-selector="workbenchMode === 'standard' ? '.thematic-workbench-panel' : '.thematic-workbench-panel.is-chart-docked'"
    v-model:open="composerOpen" :scope-key="workbenchMode === 'standard' ? `standard:${selectedStandardTemplate}` : `${effectiveDatasetId || 'map'}:${lockedScopeKey}`" :main-image="workbenchMode === 'standard' ? standardScene?.items.find(item => item.kind === 'map')?.raster?.image || '' : mainImageUrl"
    :standard-scene="workbenchMode === 'standard' ? standardScene : null"
    :main-title="draft.title || mainImageTitle" :main-meta="workbenchMode === 'standard' ? `${standardScene?.title || '规范专题图'} · 校样` : mainImageMeta" :source="cartographySettings.source"
    :description="draft.notes" :agency="draft.agency"
    :time="cartographySettings.time" :metrics="composerMetrics" :legend="cartographyContext.legend"
    :charts="workbenchMode === 'standard' ? [] : chartList" :charts-ready="workbenchMode !== 'standard' && !!screenshotAnalysis && screenshotAnalysis.scopeKey === lockedScopeKey"
    :chart-option="getComposerChartOption" :chart-revision="screenshotAnalysis"
    @add-chart="type => addChart(type as ChartType)" @remove-chart="removeChartItem"
    @chart-layouts="updateComposerLayouts"
    @restore-charts="restoreCompositionCharts"
    @edit-copy="updateCompositionCopy"
    @standard-issues="standardLayoutIssues = $event"
    @preview="standardComposedPreview = $event"
    @inspect-standard="inspectStandardComposition"
  />

  <button
    v-if="dialogVisible && isFold"
    type="button"
    class="cartography-restore-dock"
    title="恢复专题制图工作台"
    aria-label="恢复专题制图工作台"
    data-tooltip="恢复专题制图"
    @click="restoreWorkbench"
  >
    <mars-icon icon="workbench" :width="20" />
    <span class="cartography-restore-status" aria-hidden="true"></span>
  </button>

  <mars-task-modal
    v-model:open="templatePreviewOpen"
    :title="templatePreviewTitle"
    :footer="false"
    :width="720"
    @cancel="closeTemplatePreview"
  >
    <div v-if="previewedTemplate" class="template-preview-modal">
      <div class="template-preview-hero">
        <EmergencyTemplatePreview
          v-if="getEmergencyCatalogEntry(previewedTemplate)"
          class="template-preview-image"
          :template-id="getEmergencyCatalogEntry(previewedTemplate)!.emergencyId"
          :alt="`${previewedTemplate.name}合成测试校样`"
        />
        <TemplateVisualPreview
          v-else
          class="template-preview-image"
          :kind="getTemplateVisualKind(previewedTemplate)"
          :palette="previewedTemplate.templateId === draft.templateId ? draft.palette : resolveStandardTemplateProfile(previewedTemplate)?.palette"
          :rendered-image="previewedTemplate.templateId === draft.templateId ? templateResultPreview : ''"
          :legend="previewedTemplate.templateId === draft.templateId && templateResultPreview ? cartographyContext.legend : undefined"
          :alt="`${previewedTemplate.name || previewedTemplate.templateId}模板预览`"
        />
        <div class="template-preview-overlay">
          <span class="template-preview-category">{{ getTemplateCategoryLabel(previewedTemplate) || "专题模板" }}</span>
          <span class="template-preview-complexity">{{ getTemplateComplexityLabel(previewedTemplate) }}</span>
          <span
            v-if="getTemplateEditionLabel(previewedTemplate)"
            class="template-preview-edition"
            :class="{ 'is-earthquake': getTemplateEdition(previewedTemplate) === 'earthquake' }"
          >
            <CartographySymbolIcon v-if="getTemplatePrimaryIconBinding(previewedTemplate)" :binding="getTemplatePrimaryIconBinding(previewedTemplate)" :size="13" />
            {{ getTemplateEditionLabel(previewedTemplate) }}
          </span>
        </div>
        <div v-if="getTemplateSymbolBindings(previewedTemplate).length" class="template-preview-symbols" aria-label="地震业务图标">
          <span
            v-for="binding in getTemplateSymbolBindings(previewedTemplate)"
            :key="binding.kind"
            class="template-preview-symbol"
            :class="`is-${binding.family}`"
            :style="getTemplateIconBindingStyle(binding)"
            :data-icon-family="binding.family"
            :data-icon-kind="binding.kind"
            :title="`${binding.label}图标`"
          >
            <CartographySymbolIcon :binding="binding" :size="14" />
            <span>{{ binding.label }}</span>
          </span>
        </div>
      </div>
      <div class="template-preview-summary">
        <div>
          <div class="template-preview-name">{{ previewedTemplate.name || previewedTemplate.templateId }}</div>
          <div class="template-preview-description">{{ previewedTemplate.description || "专题图模板" }}</div>
        </div>
        <span class="template-version">{{ getEmergencyCatalogEntry(previewedTemplate)?.emergencyId || `v${previewedTemplate.templateVersion || '1.0'}` }}</span>
      </div>
      <div class="template-review-status">{{ getEmergencyCatalogEntry(previewedTemplate) ? '合成测试校样 · DB/T 101-2024 · 制作要求报批稿 · 待数据与规范校核' : '分析表达预览 · 非正式图件' }}</div>
      <div class="template-preview-details">
        <div class="template-preview-detail">
          <span>适用数据</span>
          <strong>{{ getTemplateDataTypeLabels(previewedTemplate).join("、") || "通用数据" }}</strong>
        </div>
        <div class="template-preview-detail">
          <span>模板组件</span>
          <strong>{{ getTemplateComponentLabels(previewedTemplate).join("、") }}</strong>
        </div>
        <div class="template-preview-detail">
          <span>复杂度</span>
          <strong>{{ getTemplateComplexityLabel(previewedTemplate) }}</strong>
        </div>
        <div v-if="getTemplateDisplayIconBindings(previewedTemplate).length" class="template-preview-detail is-icon-binding">
          <span>专题图标</span>
          <strong class="template-icon-binding-list">
            <span
              v-for="binding in getTemplateDisplayIconBindings(previewedTemplate)"
              :key="binding.kind"
              class="template-icon-binding"
              :class="`is-${binding.family}`"
              :style="getTemplateIconBindingStyle(binding)"
              :data-icon-family="binding.family"
              :data-icon-kind="binding.kind"
              :title="`${binding.label}图标`"
            >
              <CartographySymbolIcon :binding="binding" :size="13" />
              <span>{{ binding.label }}</span>
            </span>
          </strong>
        </div>
      </div>
      <div class="template-preview-actions">
        <mars-button @click="usePreviewedTemplate">使用模板</mars-button>
      </div>
    </div>
  </mars-task-modal>

  <a-modal
    v-model:open="showCustomBoardSize"
    title="自定义画板尺寸"
    ok-text="应用"
    cancel-text="取消"
    :confirm-loading="false"
    @ok="applyCustomBoardSize"
  >
    <div class="board-size-form">
      <label class="board-size-field">
        <span>宽度</span>
        <a-input-number v-model:value="customBoardWidth" :min="640" :max="7680" :step="10" />
      </label>
      <label class="board-size-field">
        <span>高度</span>
        <a-input-number v-model:value="customBoardHeight" :min="480" :max="4320" :step="10" />
      </label>
    </div>
  </a-modal>

  <div
    v-if="showSelectionOverlay && selectionFrameBounds"
    class="selection-outline-frame"
    :style="selectionFrameStyle"
    aria-hidden="true"
  ></div>

  <div
    v-if="dialogVisible && selectionToolbarVisible"
    class="selection-confirm-toolbar"
    :style="selectionToolbarStyle"
  >
    <button
      type="button"
      class="selection-confirm-btn is-redraw"
      title="重新框选"
      aria-label="重新框选"
      @click="redrawRectangleSelection"
    >
      <mars-icon icon="redo" :width="15" />
      <span>重绘范围</span>
    </button>
    <button
      type="button"
      class="selection-confirm-btn is-confirm"
      title="锁定制图范围"
      aria-label="锁定制图范围"
      @click="confirmRectangleSelection"
    >
      <mars-icon icon="check-small" :width="16" />
      <span>锁定范围</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import * as echarts from "echarts"
import { $message } from "@mars/components/mars-ui/index"
import { useWidget, useWidgetStore } from "@mars/common/store/widget"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { POPUP_PANEL_RESIZE_HANDLES } from "@mars/common/constants/popup-resize-handles"
import { getCurrentDataset, onCurrentDatasetChange, type CurrentDataset } from "@/shell/currentDataset"
import { getTemplates } from "../dataset-repository/services/eoapi-thematics"
import type { ThematicTemplate } from "../dataset-repository/types/eoapi-types"
import ThematicJobs from "../dataset-repository/components/ThematicJobs.vue"
import { isPublishDescriptionValid, MIN_PUBLISH_DESCRIPTION_LENGTH, publishDescriptionLength } from "../dataset-repository/services/publish-description"
import { SAFE_MARGIN, SNAP_DISTANCE, SCALE_PRESETS, snapRect } from "./cartography-layout"
import { cartographySettings, cartographyContext } from "./cartography-state"
import CartographyComposer from "./CartographyComposer.vue"
import CartographySymbolIcon from "./CartographySymbolIcon.vue"
import TemplateMapEditor from "./TemplateMapEditor.vue"
import DbtStandardEditor from "./DbtStandardEditor.vue"
import EmergencyTemplatePreview from "./EmergencyTemplatePreview.vue"
import { getEmergencyCatalogEntry, getTemplatePurpose, mergeWorkbenchTemplateCatalog, type TemplatePurpose } from "./workbench-template-catalog"
import { dbtTemplates, type DbtTemplateId } from "./dbt116-standard"
import { dbtRoleNames } from "./dbt-cartography-rules"
import type { StandardComposition } from "./standard-composition"
import type { DbtMapPreview } from "./dbt-draft-preview"
import { workbenchDock } from "./composer-dock"
import CompositionNumberInput from "./CompositionNumberInput.vue"
import type { CompositionItem } from "./composition-model"
import { rasterResultLegend } from "./raster-analysis"
import TemplateVisualPreview, { type TemplateVisualKind } from "./TemplateVisualPreview.vue"
import {
  analyzeScreenshotPixels,
  type ScreenshotAnalysisResult,
  type ScreenshotMetric
} from "./screenshot-analysis"
import {
  processRasterPixels,
  type RasterAlgebraMode,
  type RasterAnalysisSummary,
  type RasterClassMethod,
  type RasterOperation
} from "./raster-analysis"
import {
  processTemporalFrames,
  type TemporalAnalysisSummary,
  type TemporalDifferenceMode,
  type TemporalFrameInput,
  type TemporalOperation,
  type TemporalStatisticMode
} from "./temporal-analysis"
import {
  processSignalPixels,
  type SignalEdgeMethod,
  type SignalFilter,
  type SignalOperation,
  type SignalSummary,
  type SignalWaveletBand
} from "./signal-analysis"
import {
  processStatisticsPixels,
  type StatisticsClassMethod,
  type StatisticsOperation,
  type StatisticsSummary
} from "./statistics-analysis"
import {
  processSpatialPixels,
  type SpatialNeighborhoodMetric,
  type SpatialOperation,
  type SpatialOverlayMode,
  type SpatialSummary
} from "./spatial-analysis"
import { processBackgroundPixels, type BackgroundOperation, type BackgroundSummary } from "./background-analysis"
import { processNumericPixels, type NumericChannel, type NumericIndex, type NumericOperation, type NumericSummary } from "./numeric-transform"
import { analyzeEarthquakeDataset, EARTHQUAKE_IMPORT_TEMPLATE, filterEarthquakePoints, loadEarthquakeParameters, parseEarthquakeGeoJson, type EarthquakeDataset, type EarthquakeOperation, type EarthquakeResult } from "./earthquake-analysis"
import {
  getBasicTemplateIconBinding,
  getEarthquakeTemplatePrimaryIcon,
  getEarthquakeTemplateSymbolBindings,
  isEarthquakeTemplateId,
  earthquakeSymbolDefinitions,
  cartographySymbolDefinitions,
  cartographySymbolSource,
  type CartographySymbolKind,
  type TemplateIconFamily,
  type EarthquakeTemplateId,
  type TemplateIconBinding
} from "./template-icon-registry"
import * as mapWork from "./map"
import DisplaySettings from "./DisplaySettings.vue"
import EarthquakePalette from "./EarthquakePalette.vue"

const displaySettingsOpen = ref(false)
const displaySettingsRef = ref<InstanceType<typeof DisplaySettings>>()
const syncingStyleComposition = ref(false)

useLifecycle(mapWork)

type WorkbenchTab = "template" | "editor" | "publish"
const thematicJobsRef = ref<InstanceType<typeof ThematicJobs> | null>(null)
type SelectionViewportBounds = { left: number; top: number; width: number; height: number }
type LockedSelection = mapWork.RectInfo
type TemplateCategoryId = "statistics" | "heat" | "flow" | "raster" | "compare"
type TemplateCategoryOption = {
  id: TemplateCategoryId
  label: string
  aliases: string[]
  preview: string
}
type TemplateDataType = "raster" | "vector" | "timeseries" | "tabular" | "trajectory"
type TemplateComplexity = "basic" | "standard" | "professional"
type TemplateComplexityFilter = "all" | TemplateComplexity
type TemplateEdition = "standard" | "earthquake"
type TemplateEditionFilter = "all" | TemplateEdition
type CatalogCategoryId = TemplateCategoryId | "emergency"
type TemplateDataTypeOption = {
  value: TemplateDataType
  label: string
  aliases: string[]
}
type TemplateFilterProfile = {
  category?: TemplateCategoryId
  dataTypes: TemplateDataType[]
  complexity: TemplateComplexity
  keywords: string[]
}
type StandardTemplateProfile = TemplateFilterProfile & {
  templateId: string
  name: string
  description: string
  category: TemplateCategoryId
  components: string[]
  visualKind: TemplateVisualKind
  subtitle: string
  legendTitle: string
  palette: string
  notes: string
  edition?: TemplateEdition
}
type ChartType = "heatmap" | "population-distribution" | "terrain-density" | "contour" | "deformation-bar" | "trend-line"
type ChartViewMode = "list" | "board"
type AnalysisWorkspaceMode = "raster" | "temporal" | "signal" | "statistics" | "spatial" | "background" | "numeric" | "earthquake"

type ChartListItem = {
  id: string
  type: ChartType
  name: string
  x: number
  y: number
  w: number
  h: number
  scopeKey: string
}

type ChartTypeMeta = {
  label: string
  value: ChartType
  scene: string
  summary: string
}

type ScopedScreenshotAnalysis = ScreenshotAnalysisResult & {
  scopeKey: string
  analyzedAt: number
}

type AnalysisMetricOption = {
  label: string
  value: ScreenshotMetric
  summary: string
}

type RasterOperatorOption = {
  label: string
  short: string
  value: RasterOperation
  icon: string
  description: string
}

type RasterResultView = {
  operation: RasterOperation
  label: string
  detail: string
  image: string
  elapsed: number
  scopeKey: string
  summary: RasterAnalysisSummary
}

type TemporalOperatorOption = {
  label: string
  short: string
  value: TemporalOperation
  icon: string
  description: string
}

type TemporalFrameSnapshot = TemporalFrameInput & {
  id: string
  image: string
}

type TemporalResultView = {
  operation: TemporalOperation
  label: string
  detail: string
  image: string
  elapsed: number
  scopeKey: string
  summary: TemporalAnalysisSummary
}

type SignalOperatorOption = {
  label: string
  short: string
  value: SignalOperation
  icon: string
  description: string
}

type SignalResultView = {
  operation: SignalOperation
  waveletLevel: number
  label: string
  detail: string
  sourceImage: string
  image: string
  elapsed: number
  scopeKey: string
  summary: SignalSummary
}

type StatisticsOperatorOption = {
  label: string
  short: string
  value: StatisticsOperation
  icon: string
  description: string
}

type StatisticsResultView = {
  operation: StatisticsOperation
  label: string
  detail: string
  sourceImage: string
  image: string
  elapsed: number
  scopeKey: string
  summary: StatisticsSummary
}

type SpatialOperatorOption = {
  label: string
  short: string
  value: SpatialOperation
  icon: string
  description: string
}

type SpatialResultView = {
  operation: SpatialOperation
  neighborhoodMetric: SpatialNeighborhoodMetric
  label: string
  detail: string
  sourceImage: string
  image: string
  elapsed: number
  scopeKey: string
  summary: SpatialSummary
}

type BackgroundBaseline = { pixels: Uint8ClampedArray; width: number; height: number; image: string; scopeKey: string }
type BackgroundResultView = {
  operation: BackgroundOperation
  label: string
  detail: string
  baselineImage: string
  sourceImage: string
  image: string
  width: number
  height: number
  elapsed: number
  scopeKey: string
  summary: BackgroundSummary
}
type NumericResultView = {
  operation: NumericOperation
  label: string
  detail: string
  sourceImage: string
  image: string
  width: number
  height: number
  svg: string | null
  elapsed: number
  scopeKey: string
  summary: NumericSummary
}

const SIDE_PANEL_WIDTH = 400
const SIDE_PANEL_HEIGHT = 600
const SIDE_PANEL_GAP = 14
const SIDE_PANEL_MARGIN = 12
const WORKBENCH_DEFAULT_WIDTH = 500
const WORKBENCH_MIN_WIDTH = 460
const BOARD_CARD_WIDTH = 340
const BOARD_CARD_HEIGHT = 280
const BOARD_GAP = 16
const BOARD_PAD = SAFE_MARGIN
const BOARD_SCALE_MIN = 0.5
const BOARD_SCALE_MAX = 1.8
const BOARD_SCALE_STEP = 0.1
const DEFAULT_BOARD_WIDTH = 1920
const DEFAULT_BOARD_HEIGHT = 1080
const BOARD_CARD_HEAD_HEIGHT = 40
const BOARD_CARD_PADDING = 10
const BOARD_CARD_GAP = 8
const BOARD_CARD_MIN_WIDTH = 240
const BOARD_CARD_MIN_HEIGHT = 200
const BOARD_CARD_MAX_WIDTH = 720
const BOARD_CARD_MAX_HEIGHT = 640
const BOARD_SNAP_THRESHOLD = SNAP_DISTANCE
const TEMPORAL_CAPTURE_WIDTH = 480
const TEMPORAL_CAPTURE_HEIGHT = 270
const MAX_TEMPORAL_FRAMES = 8
const SIGNAL_CAPTURE_WIDTH = 320
const SIGNAL_CAPTURE_HEIGHT = 180
const STATISTICS_CAPTURE_WIDTH = 320
const STATISTICS_CAPTURE_HEIGHT = 180
const SPATIAL_CAPTURE_WIDTH = 320
const SPATIAL_CAPTURE_HEIGHT = 180
const BACKGROUND_CAPTURE_WIDTH = 320
const NUMERIC_CAPTURE_WIDTH = 320
const PUBLIC_ASSET_BASE = String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")
const TEMPLATE_CATEGORY_ASSET_BASE = `${PUBLIC_ASSET_BASE}img/thematic-categories/`

type BoardResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
type BoardRect = { x: number; y: number; w: number; h: number }

const boardResizeHandles: BoardResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

const chartTypeOptions: ChartTypeMeta[] = [
  { label: "空间热度矩阵", value: "heatmap", scene: "空间格网分析", summary: "按截图空间网格展示像素指标强弱。" },
  { label: "色彩覆盖占比", value: "population-distribution", scene: "地表色彩分类", summary: "统计暗区、绿色、暖色、高亮与其他像素占比。" },
  { label: "网格强度散点", value: "terrain-density", scene: "局部异常定位", summary: "用点位大小和颜色表达各网格指标强度。" },
  { label: "横向剖面曲线", value: "contour", scene: "空间剖面分析", summary: "展示截图从西向东的指标变化剖面。" },
  { label: "指标等级统计", value: "deformation-bar", scene: "强度等级评估", summary: "统计低、中、较高、高四个指标等级的像素占比。" },
  { label: "RGB 通道对比", value: "trend-line", scene: "通道特征分析", summary: "对比截图红、绿、蓝三个颜色通道的平均强度。" }
]

const analysisMetricOptions: AnalysisMetricOption[] = [
  { label: "亮度分级", value: "luminance", summary: "统计截图明暗强度、空间梯度和等级占比。" },
  { label: "绿度指数", value: "greenness", summary: "基于 RGB 绿度代理值识别植被与绿色覆盖差异。" },
  { label: "暖色异常", value: "warmth", summary: "基于红蓝通道差值识别截图中的暖色异常区域。" },
  { label: "纹理强度", value: "texture", summary: "通过相邻像素亮度差评估边缘密集度与地表纹理变化。" }
]

const rasterOperatorOptions: RasterOperatorOption[] = [
  {
    label: "代数运算",
    short: "归一化 / 增强",
    value: "algebra",
    icon: "calculator-one",
    description: "对框选栅格执行归一化、反相、对数或 Gamma 代数变换。"
  },
  {
    label: "分级渲染",
    short: "等距 / 分位数",
    value: "classified",
    icon: "chart-histogram",
    description: "按像元值分级并应用专业冷暖色带。"
  },
  {
    label: "阈值提取",
    short: "双阈值筛选",
    value: "threshold",
    icon: "filter",
    description: "只保留阈值区间内的有效像元，框外及无效像元透明。"
  },
  {
    label: "镶嵌裁剪",
    short: "像元聚合 / 裁边",
    value: "mosaic",
    icon: "grid-four",
    description: "按块聚合像元并严格裁剪到当前制图范围。"
  }
]

const temporalOperatorOptions: TemporalOperatorOption[] = [
  {
    label: "差值计算",
    short: "差值 / 变化率",
    value: "difference",
    icon: "data-switching",
    description: "对首末两期逐像元计算差值或变化率，并以蓝红发散色带渲染。"
  },
  {
    label: "均值方差",
    short: "均值 / 稳定性",
    value: "statistics",
    icon: "chart-histogram",
    description: "统计多期像元均值或方差，识别稳定区与高波动区。"
  },
  {
    label: "趋势分析",
    short: "斜率 / 拟合度",
    value: "trend",
    icon: "trend-two",
    description: "执行逐像元线性回归，以斜率表达变化方向并按拟合优度过滤。"
  },
  {
    label: "异常检测",
    short: "Z-score / 偏离",
    value: "anomaly",
    icon: "radar-chart",
    description: "以历史期为背景计算最新期标准化偏离，仅突出显著异常像元。"
  }
]

const signalOperatorOptions: SignalOperatorOption[] = [
  { label: "傅里叶变换", short: "频谱 / 周期", value: "fourier", icon: "waves-left", description: "二维频域分析，显示径向能量谱与高频空间响应。" },
  { label: "小波变换", short: "轮廓 / 细节", value: "wavelet", icon: "layers", description: "多尺度 Haar 分解，提取低频轮廓或高频细节。" },
  { label: "滤波去噪", short: "高斯 / 中值 / 均值", value: "filter", icon: "filter", description: "对框选影像执行空间滤波，展示估计噪声下降。" },
  { label: "边缘检测", short: "Canny / 梯度", value: "edge", icon: "scan", description: "提取空间边缘与纹理，统计边缘像元密度。" }
]

const statisticsOperatorOptions: StatisticsOperatorOption[] = [
  { label: "区域统计", short: "格网均值 / 离散", value: "area", icon: "grid-four", description: "按框选范围的空间格网汇总亮度均值与差异。" },
  { label: "分类统计", short: "等级 / 占比", value: "category", icon: "chart-histogram", description: "按亮度等距或分位数分级，统计各等级像元。" },
  { label: "空间自相关", short: "Moran's I / 聚集", value: "autocorrelation", icon: "radar-chart", description: "基于格网邻接计算全局 Moran's I 并标示局部高低聚集。" },
  { label: "局部密度", short: "高亮 / 邻域", value: "density", icon: "layers", description: "计算高亮像元在局部邻域内的占比与热点覆盖。" }
]

const spatialOperatorOptions: SpatialOperatorOption[] = [
  { label: "等值线", short: "亮度阈值 / 线段", value: "contour", icon: "bezier-curve", description: "对框选影像的亮度场提取等值线。" },
  { label: "栅格缓冲", short: "源区 / 缓冲带", value: "buffer", icon: "halo", description: "以高亮像元为源区，按像元半径扩张缓冲带。" },
  { label: "掩膜叠加", short: "交 / 并 / 差", value: "overlay", icon: "layers", description: "亮度掩膜 A 与绿色像元掩膜 B 执行交、并、差运算。" },
  { label: "邻域分析", short: "均值 / 离散", value: "neighborhood", icon: "map-distance", description: "计算局部邻域的亮度均值或标准差。" }
]

const backgroundOperatorOptions: Array<{ label: string; short: string; value: BackgroundOperation; icon: string; description: string }> = [
  { label: "差值", short: "当前 - 基准", value: "difference", icon: "data-switching", description: "逐像元计算当前地图截图与基准截图的亮度差值。" },
  { label: "比值", short: "当前 / 基准", value: "ratio", icon: "calculator-one", description: "逐像元计算亮度比值；接近零的基准像元不参与。" },
  { label: "归一化", short: "差值 / 标准差", value: "normalization", icon: "chart-histogram", description: "以基准影像的空间亮度标准差归一化两次截图差值。" },
  { label: "剔除噪声", short: "中值滤波", value: "denoise", icon: "filter", description: "对两次截图的差值应用局部中值滤波，抑制孤立变化像元。" }
]
const numericOperatorOptions: Array<{ label: string; short: string; value: NumericOperation; icon: string; description: string }> = [
  { label: "像元提取", short: "通道 / 阈值", value: "extract", icon: "filter", description: "按 RGB 通道或亮度阈值提取截图像元。" },
  { label: "栅格转矢量", short: "网格面 / SVG", value: "vectorize", icon: "grid-four", description: "将阈值选中的截图网格转换为像素坐标 SVG 面。" },
  { label: "RGB 指数", short: "ExG / NGRDI", value: "index", icon: "chart-histogram", description: "计算可见光 RGB 绿度代理指数，不是 NDVI。" },
  { label: "范围投影", short: "WGS84 / 3857", value: "projection", icon: "map-distance", description: "将锁定地理范围的经纬度转换为 Web Mercator 米制坐标。" }
]
const earthquakeOperatorOptions: Array<{ label: string; short: string; value: EarthquakeOperation; icon: string; description: string }> = [
  { label: "热异常指数", short: "LST / 基准 Z", value: "thermal", icon: "radar-chart", description: "质量合格的亮温与同季节基准比较，输出标准化偏离；不直接推断地震前兆。" },
  { label: "形变特征", short: "LOS / 相干性", value: "deformation", icon: "data-switching", description: "筛除低相干点，显示有符号的 InSAR 视线向形变。" },
  { label: "风险叠加", short: "危险性 × 暴露 × 脆弱性", value: "risk", icon: "layers", description: "组合三类经校准的 0–1 指数，形成相对风险筛查排序。" },
  { label: "烈度反演", short: "PGA / PGV 初判", value: "intensity", icon: "chart-histogram", description: "仅在 PGA 与 PGV 对 VI–XI 等级一致时给出仪器初判，冲突点待复核。" }
]

const sampleStepOptions = [
  { label: "精细", value: 2 },
  { label: "均衡", value: 4 },
  { label: "快速", value: 8 }
]

const gridPresetOptions = [
  { label: "4 × 3", value: "4x3" },
  { label: "6 × 4", value: "6x4" },
  { label: "8 × 6", value: "8x6" }
]

const templateCategoryOptions: TemplateCategoryOption[] = [
  {
    id: "statistics",
    label: "统计图表型",
    aliases: ["统计图表型", "statistics", "statistical", "chart", "echarts", "统计图", "图表"],
    preview: `${TEMPLATE_CATEGORY_ASSET_BASE}statistics.jpg`
  },
  {
    id: "heat",
    label: "热力分布型",
    aliases: ["热力分布型", "heatmap", "heat-map", "density", "热力", "密度"],
    preview: `${TEMPLATE_CATEGORY_ASSET_BASE}heat.jpg`
  },
  {
    id: "flow",
    label: "轨迹流动型",
    aliases: ["轨迹流动型", "trajectory", "track", "flow", "migration", "轨迹", "流向", "迁徙"],
    preview: `${TEMPLATE_CATEGORY_ASSET_BASE}flow.jpg`
  },
  {
    id: "raster",
    label: "栅格色带型",
    aliases: ["栅格色带型", "raster", "cog", "colormap", "color-ramp", "栅格", "色带"],
    preview: `${TEMPLATE_CATEGORY_ASSET_BASE}raster.jpg`
  },
  {
    id: "compare",
    label: "对比分析型",
    aliases: ["对比预测型", "compare", "comparison", "forecast", "prediction", "timeline", "timeseries", "对比", "预测", "时序"],
    preview: `${TEMPLATE_CATEGORY_ASSET_BASE}compare.jpg`
  }
]

const templateDataTypeOptions: TemplateDataTypeOption[] = [
  { value: "raster", label: "栅格影像", aliases: ["raster", "cog", "tif", "tiff", "wms", "栅格", "影像", "遥感"] },
  { value: "vector", label: "矢量要素", aliases: ["vector", "geojson", "shp", "shape", "wfs", "矢量", "行政区", "边界"] },
  { value: "timeseries", label: "时序数据", aliases: ["timeseries", "time-series", "timeline", "时序", "多期", "时间序列"] },
  { value: "tabular", label: "统计表格", aliases: ["table", "csv", "statistics", "chart", "表格", "统计", "指标"] },
  { value: "trajectory", label: "轨迹数据", aliases: ["trajectory", "track", "flow", "migration", "轨迹", "流向", "迁徙"] }
]

const templateComplexityOptions: Array<{ value: TemplateComplexityFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "basic", label: "基础" },
  { value: "standard", label: "进阶" },
  { value: "professional", label: "专业" }
]

const templateEditionOptions: Array<{ value: TemplateEditionFilter; label: string }> = [
  { value: "all", label: "领域不限" },
  { value: "standard", label: "通用分析" },
  { value: "earthquake", label: "地震专业" }
]
const templatePurposeOptions: Array<{ value: TemplatePurpose; label: string }> = [
  { value: "all", label: "全部模板" },
  { value: "emergency", label: "应急响应专题" },
  { value: "analysis", label: "分析表达" }
]

const paletteOptions = [
  { value: "sequential-blue", label: "蓝青顺序色带" },
  { value: "categorical", label: "专业分类色组" },
  { value: "blue-red", label: "蓝红发散色带" },
  { value: "heat", label: "热力强度色带" },
  { value: "terrain", label: "地形连续色带" },
  { value: "threshold", label: "阈值风险色带" },
  { value: "contour", label: "等值线蓝阶" },
  { value: "velocity", label: "流速方向色带" },
  { value: "risk", label: "风险等级色带" },
  { value: "compare", label: "时序对比色带" },
  { value: "dashboard", label: "图表联动色组" },
  { value: "seismic-anomaly", label: "异常融合业务色组" },
  { value: "thermal-infrared", label: "热红外亮温色带" },
  { value: "post-quake-risk", label: "震后风险等级色带" },
  { value: "quake-swarm", label: "震群深度时间色组" },
  { value: "insar-cycle", label: "InSAR 形变循环色带" },
  { value: "intensity", label: "地震烈度业务色带" },
  { value: "multi-hazard", label: "次生灾害分类色组" },
  { value: "resilience", label: "房屋抗震能力色带" },
  { value: "exposure", label: "人口经济暴露色带" },
  { value: "emergency", label: "应急指挥态势色组" },
  { value: "green-yellow", label: "绿黄渐变" },
  { value: "purple-orange", label: "紫橙渐变" }
]

const categoryDefaultDataTypes: Record<TemplateCategoryId, TemplateDataType[]> = {
  statistics: ["tabular", "vector"],
  heat: ["raster", "vector"],
  flow: ["trajectory", "vector"],
  raster: ["raster"],
  compare: ["timeseries", "raster"]
}

const categoryDefaultComplexity: Record<TemplateCategoryId, TemplateComplexity> = {
  statistics: "standard",
  heat: "standard",
  flow: "professional",
  raster: "standard",
  compare: "professional"
}

const categoryDefaultComponents: Record<TemplateCategoryId, string[]> = {
  statistics: ["统计图表", "分级符号", "图例"],
  heat: ["热力图层", "热点聚合", "色阶图例"],
  flow: ["轨迹线", "方向动画", "节点标注"],
  raster: ["栅格渲染", "连续色带", "等值线"],
  compare: ["数值对比", "时间字段", "分析图例"]
}

const standardTemplateProfiles: StandardTemplateProfile[] = [
  {
    templateId: "standard_choropleth",
    name: "分级设色",
    description: "按连续数值字段分级填充行政区或业务分区，适合风险、强度和统计指标表达。",
    category: "statistics",
    dataTypes: ["vector", "tabular"],
    complexity: "standard",
    keywords: ["行政区", "自然断点", "分级", "choropleth", "专题统计"],
    components: ["分级字段", "自然断点", "顺序图例"],
    visualKind: "choropleth",
    subtitle: "行政区指标分级专题",
    legendTitle: "指标等级",
    palette: "sequential-blue",
    notes: "按数值字段执行自然断点分级，以连续色阶呈现区域差异。"
  },
  {
    templateId: "standard_unique_value",
    name: "唯一值分类",
    description: "按类别字段配置离散色组，清晰区分地类、灾害类型、设施类别等专题对象。",
    category: "statistics",
    dataTypes: ["vector", "tabular"],
    complexity: "basic",
    keywords: ["类别", "地类", "类型", "unique value", "离散色"],
    components: ["分类字段", "唯一值符号", "类别图例"],
    visualKind: "unique-value",
    subtitle: "专题对象类别分布",
    legendTitle: "对象类型",
    palette: "categorical",
    notes: "按唯一值字段生成互异色组，类别之间不表达数值高低。"
  },
  {
    templateId: "standard_graduated_symbol",
    name: "分级符号",
    description: "使用比例圆或分级点符号表示数量级差异，兼顾空间位置与指标规模。",
    category: "statistics",
    dataTypes: ["vector", "tabular"],
    complexity: "standard",
    keywords: ["比例圆", "气泡", "数量", "graduated symbol", "点符号"],
    components: ["大小符号", "数值字段", "分级图例"],
    visualKind: "graduated-symbol",
    subtitle: "监测点指标规模分布",
    legendTitle: "指标规模",
    palette: "blue-red",
    notes: "点径按数值平方根缩放并设最小可见尺寸，不表示地理影响半径。"
  },
  {
    templateId: "standard_point_heat",
    name: "点热力",
    description: "按点位权重生成热力分布，表达聚集强度；不将热点解释为灾害风险。",
    category: "heat",
    dataTypes: ["vector", "tabular"],
    complexity: "standard",
    keywords: ["核密度", "热点", "聚集", "point heat", "权重"],
    components: ["热力核", "权重字段", "强度色带"],
    visualKind: "point-heat",
    subtitle: "异常点位热力分布",
    legendTitle: "聚集强度",
    palette: "heat",
    notes: "按点位权重渲染热力，核半径为显示像素，不是物理影响距离或概率。"
  },
  {
    templateId: "standard_raster_ramp",
    name: "栅格色带",
    description: "对导入的规则采样网格连续着色；默认数据为底图 RGB 亮度，不是高程或温度反演。",
    category: "raster",
    dataTypes: ["raster"],
    complexity: "basic",
    keywords: ["连续栅格", "遥感指数", "高程", "color ramp", "色带"],
    components: ["栅格渲染", "连续色带", "数值图例"],
    visualKind: "raster-ramp",
    subtitle: "连续栅格数值专题",
    legendTitle: "栅格值",
    palette: "terrain",
    notes: "使用感知均匀的连续色带表达栅格值变化，避免产生虚假的等级边界。"
  },
  {
    templateId: "standard_raster_threshold",
    name: "栅格阈值",
    description: "对规则网格或底图 RGB 亮度分段着色，表达数值等级；不直接生成业务告警。",
    category: "raster",
    dataTypes: ["raster"],
    complexity: "standard",
    keywords: ["阈值", "掩膜", "异常区", "threshold", "告警"],
    components: ["数值分段", "等级填色", "分级图例"],
    visualKind: "raster-threshold",
    subtitle: "栅格阈值分区专题",
    legendTitle: "阈值等级",
    palette: "threshold",
    notes: "按数据分布与分级数量生成断点；颜色表示数值等级，不代表安全或告警结论。"
  },
  {
    templateId: "standard_contour",
    name: "等值线",
    description: "从完整规则 Point 网格提取等值线，值与单位来自导入字段；默认 RGB 场不是地形。",
    category: "raster",
    dataTypes: ["raster", "vector"],
    complexity: "professional",
    keywords: ["等高线", "等值面", "插值", "contour", "连续面"],
    components: ["规则采样网格", "等值线", "数值图例"],
    visualKind: "contour",
    subtitle: "连续场等值线分析",
    legendTitle: "等值间隔",
    palette: "contour",
    notes: "在数据极值间按固定间隔提取等值线；不对零散点自动进行地学插值。"
  },
  {
    templateId: "standard_trajectory_replay",
    name: "轨迹回放",
    description: "沿时间轴回放移动对象轨迹，显示关键节点、速度变化和历史路径。",
    category: "flow",
    dataTypes: ["trajectory", "timeseries"],
    complexity: "professional",
    keywords: ["轨迹", "回放", "时间轴", "track replay", "移动目标"],
    components: ["轨迹线", "时间轴", "节点标注"],
    visualKind: "trajectory",
    subtitle: "移动目标时序轨迹",
    legendTitle: "轨迹时间 / 方向",
    palette: "velocity",
    notes: "按时间字段排序轨迹点，保留历史路径并标记起点、关键节点与终点。"
  },
  {
    templateId: "standard_flow_direction",
    name: "流向",
    description: "显示有向线要素的方向与流量，箭头沿坐标顺序；不是风场模拟或路径预测。",
    category: "flow",
    dataTypes: ["trajectory", "vector"],
    complexity: "professional",
    keywords: ["流线", "箭头", "迁移", "flow direction", "风场"],
    components: ["有向线", "方向箭头", "流量图例"],
    visualKind: "flow-direction",
    subtitle: "空间流向与强度分析",
    legendTitle: "流量（数据声明单位）",
    palette: "velocity",
    notes: "线宽与颜色映射 flow_rate，箭头表达坐标顺序，单位采用数据源声明。"
  },
  {
    templateId: "standard_risk_overlay",
    name: "风险叠加",
    description: "对同一要素的危险性、暴露度、脆弱性归一化指标相乘，显示相对筛查指数。",
    category: "compare",
    dataTypes: ["raster", "vector", "tabular"],
    complexity: "professional",
    keywords: ["风险", "权重", "叠加分析", "overlay", "脆弱性"],
    components: ["归一化因子", "H×E×V", "相对筛查"],
    visualKind: "risk-overlay",
    subtitle: "多因子综合风险评估",
    legendTitle: "综合风险",
    palette: "risk",
    notes: "R=危险性×暴露×脆弱性；相对筛查指数不是概率，不替代专业风险模型。"
  },
  {
    templateId: "standard_time_compare",
    name: "时序对比",
    description: "比较同一要素的两期同单位数值，可切换前期、后期和差值；不是影像卷帘。",
    category: "compare",
    dataTypes: ["timeseries", "raster"],
    complexity: "professional",
    keywords: ["双期", "多期", "卷帘", "time compare", "变化检测"],
    components: ["两期数值", "时相切换", "差值图例"],
    visualKind: "time-compare",
    subtitle: "多时相变化对比专题",
    legendTitle: "变化幅度",
    palette: "compare",
    notes: "差值=后期−前期；两期须为相同指标与单位，不执行影像变化检测。"
  },
  {
    templateId: "standard_chart_linkage",
    name: "图表联动",
    description: "联动专题主图、统计图表和区域选择，支持空间对象与指标的双向筛选。",
    category: "statistics",
    dataTypes: ["vector", "tabular", "timeseries"],
    complexity: "professional",
    keywords: ["图表", "联动", "看板", "dashboard", "空间筛选"],
    components: ["专题主图", "统计图表", "区域联动"],
    visualKind: "chart-linkage",
    subtitle: "空间指标联动分析",
    legendTitle: "联动指标",
    palette: "dashboard",
    notes: "主图选择驱动统计图表更新，图表筛选同步高亮对应空间对象。"
  },
  {
    templateId: "earthquake_anomaly_composite",
    name: "异常综合",
    description: "将已归一化的热、形变、地震活动性三项指标按声明权重求均值，不计算预测概率。",
    category: "compare",
    dataTypes: ["raster", "vector", "timeseries"],
    complexity: "professional",
    keywords: ["地震", "异常综合", "多源融合", "前兆", "可信度", "综合判识"],
    components: ["三项指标", "加权均值", "指数分级"],
    visualKind: "anomaly-composite",
    subtitle: "多源地震异常综合判识",
    legendTitle: "综合异常指数",
    palette: "seismic-anomaly",
    notes: "输入须已归一化至0–1并声明权重和方法；综合指数不是可信度或地震发生概率。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_thermal_infrared",
    name: "热红外",
    description: "比较导入 LST 与基线均值、标准差，显示质量筛选后的 Z 分数，不执行亮温反演。",
    category: "heat",
    dataTypes: ["raster", "timeseries"],
    complexity: "professional",
    keywords: ["地震", "热红外", "亮温", "LST", "热异常", "背景场"],
    components: ["LST观测", "基线标准化", "质量筛选"],
    visualKind: "thermal-infrared",
    subtitle: "地表亮温异常监测",
    legendTitle: "热异常 Z 分数",
    palette: "thermal-infrared",
    notes: "Z=(LST−基线均值)/基线标准差；输入温度单位K，仅保留质量良好且基线样本≥10的点。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_post_quake_risk",
    name: "震后风险",
    description: "显示导入的震后风险指数成果，必须声明模型来源；模板自身不计算灾害损失。",
    category: "compare",
    dataTypes: ["raster", "vector", "tabular"],
    complexity: "professional",
    keywords: ["地震", "震后", "风险", "快速评估", "灾情", "救援优先级"],
    components: ["已评估指数", "模型来源", "分级显示"],
    visualKind: "post-quake-risk",
    subtitle: "震后快速风险评估",
    legendTitle: "震后风险等级",
    palette: "post-quake-risk",
    notes: "渲染0–1风险指数及其模型版本，显示分级仅供筛查，不自动判定救援优先级。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_swarm_trajectory",
    name: "震群轨迹",
    description: "按震群编号和发震时间连接事件，点径表示震级、颜色表示深度，不代表传播路径。",
    category: "flow",
    dataTypes: ["trajectory", "timeseries", "vector"],
    complexity: "professional",
    keywords: ["地震", "震群", "余震", "迁移", "震源深度", "发震时间"],
    components: ["震源点", "发震时间", "深度编码"],
    visualKind: "swarm-trajectory",
    subtitle: "震群时空迁移轨迹",
    legendTitle: "震源深度 / km",
    palette: "quake-swarm",
    notes: "连线仅表达时间顺序；深度色带0–100km，超范围取端点色，不预测震群迁移。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_insar_deformation",
    name: "InSAR 形变",
    description: "显示已处理的 LOS 毫米形变量，并剔除低相干点；不生成干涉条纹或进行相位解缠。",
    category: "raster",
    dataTypes: ["raster", "timeseries"],
    complexity: "professional",
    keywords: ["地震", "InSAR", "干涉图", "LOS", "形变", "相干性"],
    components: ["LOS 形变点", "正负方向", "相干性筛选"],
    visualKind: "insar-deformation",
    subtitle: "雷达干涉形变监测",
    legendTitle: "LOS 形变 / mm",
    palette: "blue-red",
    notes: "须声明毫米单位、LOS正方向和影像对；低于相干性阈值的点剔除，不代表零形变。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_intensity_distribution",
    name: "烈度分布",
    description: "显示已评定的VI–XI度烈度点或等震分区；需要烈度成果，不从底图估计地震衰减。",
    category: "heat",
    dataTypes: ["vector", "raster", "tabular"],
    complexity: "professional",
    keywords: ["地震", "烈度", "等震线", "宏观震中", "影响场", "衰减"],
    components: ["震中", "等震线", "烈度分区"],
    visualKind: "intensity-distribution",
    subtitle: "地震烈度影响分布",
    legendTitle: "地震烈度",
    palette: "intensity",
    notes: "显示输入烈度整数和成果来源；测试配色不是GB/T 38226正式配色认证，合成等震分区不可用于业务。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_secondary_hazard",
    name: "次生灾害",
    description: "显示滑坡、崩塌、泥石流、堰塞湖和火灾的调查点或影响面；不自动识别灾害。",
    category: "compare",
    dataTypes: ["vector", "raster"],
    complexity: "professional",
    keywords: ["地震", "次生灾害", "滑坡", "崩塌", "泥石流", "堰塞湖"],
    components: ["滑坡隐患", "堰塞湖", "灾害分类"],
    visualKind: "secondary-hazard",
    subtitle: "震后次生灾害综合态势",
    legendTitle: "灾害类型与等级",
    palette: "multi-hazard",
    notes: "分类色表达灾种，点径表达1–3级；面表示导入的影响范围，不能将普通分区当作灾害足迹。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_building_resilience",
    name: "房屋抗震",
    description: "按建筑外轮廓显示已有脆弱性指数，必须声明评估方法；不代替抗震鉴定或结构验算。",
    category: "statistics",
    dataTypes: ["vector", "tabular"],
    complexity: "professional",
    keywords: ["地震", "房屋", "建筑", "抗震", "设防", "脆弱性"],
    components: ["建筑轮廓", "已有评估", "脆弱性分级"],
    visualKind: "building-resilience",
    subtitle: "房屋抗震能力评估",
    legendTitle: "建筑脆弱性指数",
    palette: "resilience",
    notes: "显示导入的0–1脆弱性指数；不能由填色推断建筑设防充分或居住安全。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_population_exposure",
    name: "人口经济暴露",
    description: "按输入烈度筛选受影响分区，可分别显示其人口或资产总量；不是损失评估。",
    category: "statistics",
    dataTypes: ["vector", "tabular", "raster"],
    complexity: "professional",
    keywords: ["地震", "人口", "经济", "暴露度", "资产", "网格统计"],
    components: ["统计分区", "烈度筛选", "人口或资产"],
    visualKind: "population-exposure",
    subtitle: "人口与经济暴露评估",
    legendTitle: "人口 / 资产（分别统计）",
    palette: "exposure",
    notes: "保留分区完整人口数或资产值，不按裁切面积推算，不将暴露量解释为伤亡或经济损失。",
    edition: "earthquake"
  },
  {
    templateId: "earthquake_emergency_command",
    name: "应急指挥",
    description: "显示已登记的应急设施点和通道可用、阻断、未知状态，不执行自动路线规划。",
    category: "flow",
    dataTypes: ["vector", "trajectory", "tabular"],
    complexity: "professional",
    keywords: ["地震", "应急", "指挥", "救援", "避难场所", "通行路线"],
    components: ["指挥中心", "救援力量", "通行路线"],
    visualKind: "emergency-command",
    subtitle: "地震应急指挥态势",
    legendTitle: "应急资源状态",
    palette: "emergency",
    notes: "设施使用对应标准符号，状态由输入记录提供；蓝为可用、红为阻断、灰为未知。",
    edition: "earthquake"
  }
]

const standardTemplates: ThematicTemplate[] = standardTemplateProfiles.map((profile) => ({
  templateId: profile.templateId,
  templateVersion: "1.0",
  name: profile.name,
  description: profile.description,
  category: profile.category,
  previewImage: templateCategoryOptions.find((category) => category.id === profile.category)?.preview,
  parameters: profile.components.map((label, index) => ({
    name: `component_${index + 1}`,
    type: "string",
    label
  })),
  createdAt: Date.UTC(2026, 8, 20)
}))

const localTemplateFilterProfiles: Record<string, TemplateFilterProfile> = {
  local_mock_template: {
    category: "statistics",
    dataTypes: ["raster", "tabular"],
    complexity: "basic",
    keywords: ["本地", "模拟", "验收", "快速成图"]
  }
}

const DEFAULT_CHART_TYPE: ChartType = "heatmap"

type DraftState = {
  templateId: string
  templateName: string
  title: string
  subtitle: string
  legendTitle: string
  palette: string
  notes: string
  agency: string
  publishName: string
  publishDesc: string
}

const props = withDefaults(defineProps<{
  visible?: boolean
  datasetId?: string
  datasetName?: string
  source?: string
  targetName?: string
  initialTab?: WorkbenchTab
}>(), {
  visible: true,
  source: "toolbar",
  targetName: "",
  initialTab: "template"
})

const emit = defineEmits(["update:visible"])

const { disable } = useWidget()
const widgetStore = useWidgetStore()
const dialogRef = ref<any>(null)
const dialogVisible = ref(!!props.visible)
const isFold = ref(false)
const loadingTemplates = ref(false)
const templates = ref<ThematicTemplate[]>([])
const selectedTemplateCategories = ref<CatalogCategoryId[]>([])
const selectedTemplatePurpose = ref<TemplatePurpose>("all")
const templateCatalog = computed(() => mergeWorkbenchTemplateCatalog(templates.value))
const selectedTemplateEdition = ref<TemplateEditionFilter>("all")
const templateSearchKeyword = ref("")
const selectedTemplateDataTypes = ref<TemplateDataType[]>([])
const selectedTemplateComplexity = ref<TemplateComplexityFilter>("all")
const templatePreviewOpen = ref(false)
const previewedTemplate = ref<ThematicTemplate | null>(null)
const activeTab = ref<WorkbenchTab>(props.initialTab)
const workbenchMode = ref<"standard" | "analysis">("analysis")
const selectedStandardTemplate = ref<DbtTemplateId | null>(null)
const standardTarget = ref<DbtTemplateId>("T30101000")
const standardLayerRole = ref("boundary")
const templateMapEditorRef = ref<InstanceType<typeof TemplateMapEditor>>()
const standardEditorRef = ref<InstanceType<typeof DbtStandardEditor>>()
const standardScene = ref<StandardComposition | null>(null)
const standardLayoutIssues = ref<string[]>(["规范图件尚未生成"])
const standardComposedPreview = ref("")
const standardMapPreview = ref<DbtMapPreview | null>(null)
const standardMapBusy = ref(false); const standardMapError = ref("")
let standardCaptureVersion = 0
async function selectStandardTemplate(id: DbtTemplateId) {
  composerOpen.value = false; chartPanelVisible.value = false; displaySettingsOpen.value = false
  if (selectedStandardTemplate.value !== id) { standardScene.value = null; standardComposedPreview.value = ""; standardLayoutIssues.value = ["规范图件尚未生成"] }
  selectedStandardTemplate.value = id; workbenchMode.value = "standard"; activeTab.value = "editor"
  mapWork.endCartographySession(); resetSelectionScope(true); restoreWorkbench(); await resetEditorScroll()
}
async function promoteTemplateToStandard() {
  const copy = { description: draft.notes, agency: draft.agency }
  const source = templateMapEditorRef.value?.getDocument()
  const data = source ? JSON.parse(JSON.stringify(source)) : null
  try { standardMapPreview.value = await mapWork.captureStandardMapPreview(!!mapWork.getLockedSelection()) } catch { /* The data editor can still open when map capture is unavailable. */ }
  await selectStandardTemplate(standardTarget.value); await nextTick()
  standardEditorRef.value?.updateCopy("description", copy.description)
  standardEditorRef.value?.updateCopy("agency", copy.agency)
  if (data) { standardEditorRef.value?.importTemplateLayer(data, standardLayerRole.value, draft.templateName || "原模板数据") }
}
function handleStandardRendered(scene: StandardComposition) { standardComposedPreview.value = ""; standardScene.value = scene }
async function openStandardComposition() { if (!standardScene.value) { $message("图件正在生成，请稍后重试"); return }; restoreWorkbench(); composerOpen.value = true }
async function exportStandardProof(format: "jpg" | "pdf", dpi: number) { await openStandardComposition(); await nextTick(); await composerRef.value?.exportProof(format, dpi) }
async function inspectStandardComposition() {
  if (window.innerWidth < 900) { composerOpen.value = false }
  activeTab.value = "editor"; await nextTick()
  const check = document.querySelector<HTMLDetailsElement>(".dbt-quality"); if (check) { check.open = true; check.scrollIntoView({ block: "start", behavior: "smooth" }) }
}
const chartPanelVisible = ref(false)
const chartViewMode = ref<ChartViewMode>("list")
const composerOpen = ref(false)
const thematicPanelBody = ref<HTMLElement>()
async function resetEditorScroll() {
  await nextTick()
  if (activeTab.value === "editor" && thematicPanelBody.value) { thematicPanelBody.value.scrollTop = 0 }
}
const templateLayoutEditing = ref(false)
const composerRef = ref<InstanceType<typeof CartographyComposer> | null>(null)
const composerLayouts = ref<Record<string, CompositionItem>>({})
const compositionFields = [{ key: "x", label: "水平位置" }, { key: "y", label: "垂直位置" }, { key: "w", label: "宽度" }, { key: "h", label: "高度" }, { key: "rotation", label: "旋转角度" }] as const
function updateComposerLayouts(layouts: CompositionItem[]) {
  composerLayouts.value = Object.fromEntries(layouts.filter(item => item.linkedId).map(item => [item.linkedId!, item]))
}
async function focusCompositionChart(id: string) {
  if (!composerOpen.value) { toggleBoardMode() }
  await nextTick()
  composerRef.value?.selectChart(id)
}
function setCompositionField(id: string, key: "x" | "y" | "w" | "h" | "rotation", value: number) {
  if (Number.isFinite(value)) { composerRef.value?.updateChart(id, { [key]: value }) }
}
const composerMetrics = ref<ReturnType<typeof mapWork.getMapAdornmentMetrics>>(null)
const analysisWorkspaceMode = ref<AnalysisWorkspaceMode>("raster")
const selectedAnalysisMetric = ref<ScreenshotMetric>("luminance")
const selectedChartTemplateType = ref<ChartType>(DEFAULT_CHART_TYPE)
const selectedSampleStep = ref(4)
const selectedGridPreset = ref("6x4")
const analysisRunning = ref(false)
const screenshotAnalysis = ref<ScopedScreenshotAnalysis | null>(null)
const selectedRasterOperation = ref<RasterOperation>("algebra")
const rasterAlgebraMode = ref<RasterAlgebraMode>("normalize")
const rasterGamma = ref(1.2)
const rasterClassMethod = ref<RasterClassMethod>("quantile")
const rasterClassCount = ref(5)
const rasterThresholdRange = ref<[number, number]>([35, 78])
const rasterMosaicSize = ref(8)
const rasterOpacity = ref(88)
const rasterRunning = ref(false)
const rasterResult = ref<RasterResultView | null>(null)
const rasterUseRole = ref<"main" | "inset">("main")
const rasterUsing = ref(false)
async function useRasterResult() {
  const result = rasterResult.value
  if (rasterUsing.value || rasterRunning.value || !result || result.scopeKey !== lockedScopeKey.value) { return }
  rasterUsing.value = true
  const role = rasterUseRole.value
  try {
    if (!composerOpen.value) { toggleBoardMode() }
    await nextTick()
    if (!composerOpen.value || result.scopeKey !== lockedScopeKey.value || result !== rasterResult.value) { return }
    const applied = composerRef.value?.useRaster({ image: result.image, label: result.label, detail: result.detail, legend: rasterResultLegend(result.summary) }, role)
    if (applied) { $message(role === "main" ? "计算结果已设为排版主图" : "计算结果已添加为排版副图", "success") }
  } finally { rasterUsing.value = false }
}
const selectedTemporalOperation = ref<TemporalOperation>("difference")
const temporalDifferenceMode = ref<TemporalDifferenceMode>("delta")
const temporalStatisticMode = ref<TemporalStatisticMode>("variance")
const temporalMinimumR2 = ref(35)
const temporalAnomalyThreshold = ref(2)
const temporalOpacity = ref(88)
const temporalRunning = ref(false)
const temporalCapturing = ref(false)
const temporalFrames = ref<TemporalFrameSnapshot[]>([])
const temporalResult = ref<TemporalResultView | null>(null)
const timelineCurrentTime = ref("")
const selectedSignalOperation = ref<SignalOperation>("fourier")
const signalCutoff = ref(15)
const signalWaveletLevel = ref(2)
const signalWaveletBand = ref<SignalWaveletBand>("detail")
const signalFilter = ref<SignalFilter>("gaussian")
const signalFilterWindow = ref(3)
const signalEdgeMethod = ref<SignalEdgeMethod>("canny")
const signalEdgeThreshold = ref(25)
const signalOpacity = ref(88)
const signalRunning = ref(false)
const signalResult = ref<SignalResultView | null>(null)
const selectedStatisticsOperation = ref<StatisticsOperation>("area")
const statisticsGrid = ref("4x3")
const statisticsClassMethod = ref<StatisticsClassMethod>("equal")
const statisticsClassCount = ref(5)
const statisticsBrightnessThreshold = ref(150)
const statisticsDensityRadius = ref(12)
const statisticsOpacity = ref(88)
const statisticsRunning = ref(false)
const statisticsResult = ref<StatisticsResultView | null>(null)
const selectedSpatialOperation = ref<SpatialOperation>("contour")
const spatialThreshold = ref(140)
const spatialRadius = ref(8)
const spatialOverlayMode = ref<SpatialOverlayMode>("union")
const spatialNeighborhoodMetric = ref<SpatialNeighborhoodMetric>("mean")
const spatialOpacity = ref(88)
const spatialRunning = ref(false)
const spatialResult = ref<SpatialResultView | null>(null)
const selectedBackgroundOperation = ref<BackgroundOperation>("difference")
const backgroundDenoiseWindow = ref<3 | 5>(3)
const backgroundSensitivity = ref(8)
const backgroundOpacity = ref(88)
const backgroundCapturing = ref(false)
const backgroundRunning = ref(false)
const backgroundBaseline = ref<BackgroundBaseline | null>(null)
const backgroundResult = ref<BackgroundResultView | null>(null)
const selectedNumericOperation = ref<NumericOperation>("extract")
const numericChannel = ref<NumericChannel>("brightness")
const numericThreshold = ref(140)
const numericBlockSize = ref<4 | 8 | 16>(8)
const numericIndex = ref<NumericIndex>("exg")
const numericOpacity = ref(88)
const numericRunning = ref(false)
const numericResult = ref<NumericResultView | null>(null)
const selectedEarthquakeOperation = ref<EarthquakeOperation>("thermal")
const earthquakeFileInputRef = ref<HTMLInputElement | null>(null)
const earthquakeDataset = ref<EarthquakeDataset | null>(null)
const earthquakeFileName = ref("")
const earthquakeImportError = ref("")
const earthquakeThermalZ = ref(2)
const earthquakeCoherence = ref(0.4)
const earthquakeDeformationMm = ref(20)
const earthquakeRiskHigh = ref(0.25)
const earthquakeRunning = ref(false)
const earthquakeResult = ref<EarthquakeResult | null>(null)
const earthquakeOutputView = ref<"result" | "symbols">("result")
const earthquakeFilterMin = ref<number | null>(null)
const earthquakeFilterMax = ref<number | null>(null)
const earthquakeFilterBand = ref("all")
const earthquakeSpatialFilterMode = ref<"scope" | "custom">("scope")
const earthquakeFilterWest = ref<number | null>(null)
const earthquakeFilterSouth = ref<number | null>(null)
const earthquakeFilterEast = ref<number | null>(null)
const earthquakeFilterNorth = ref<number | null>(null)
const earthquakeSymbolRows = ref<Array<{ id: string; kind: CartographySymbolKind; label: string; lon: number; lat: number; style: mapWork.CartographySymbolStyle }>>([])
const selectedEarthquakeSymbolId = ref<string | null>(null)
const pendingEarthquakeSymbolKind = ref<CartographySymbolKind | null>(null)
const symbolFamily = ref<TemplateIconFamily>("basic")
const symbolSnapping = ref(true)
const earthquakeSymbolStyle = reactive<mapWork.CartographySymbolStyle>({ size: 34, rotation: 0, opacity: 1, color: earthquakeSymbolDefinitions.epicenter.accent })
const chartList = ref<ChartListItem[]>([])
const mainImageUrl = ref("")
const templateResultPreview = ref("")
function clearTemplatePreview() {
  if (templateResultPreview.value) { URL.revokeObjectURL(templateResultPreview.value) }
  templateResultPreview.value = ""
}
onUnmounted(clearTemplatePreview)
const mainImageTitle = ref("专题主图")
const mainImageMeta = ref("未生成主图")
const selectionToolbarVisible = ref(false)
const selectionToolbarLeft = ref(0)
const selectionToolbarTop = ref(0)
const selectionFrameBounds = ref<SelectionViewportBounds | null>(null)
const mapViewportBounds = ref<SelectionViewportBounds | null>(null)
const selectionScopeLocked = ref(false)
const selectionPurpose = ref<"chart" | "template" | "standard">("chart")
const lockedSelection = ref<LockedSelection | null>(null)
const selectionAreaText = ref("未框选区域")
const chartElMap = new Map<string, HTMLDivElement>()
const chartInstanceMap = new Map<string, echarts.ECharts>()
const boardScale = ref(1)
const boardWidth = ref(DEFAULT_BOARD_WIDTH)
const boardHeight = ref(DEFAULT_BOARD_HEIGHT)
const boardViewportRef = ref<HTMLDivElement | null>(null)
const isBoardPanning = ref(false)
const draggingChartId = ref<string | null>(null)
const showCustomBoardSize = ref(false)
const customBoardWidth = ref(DEFAULT_BOARD_WIDTH)
const customBoardHeight = ref(DEFAULT_BOARD_HEIGHT)
const currentDataset = ref<CurrentDataset | null>(getCurrentDataset())
const savedDraftJson = ref("")

const draft = reactive<DraftState>(createEmptyDraft())

let disposeDatasetWatch: null | (() => void) = null
let panelMouseDownHandler: null | ((evt: Event) => void) = null
let widgetVisibleHandler: null | ((evt: Event) => void) = null
let boardDragCleanup: null | (() => void) = null
let viewportResizeHandler: null | (() => void) = null
let themeChangeHandler: null | (() => void) = null
let timeExtentChangeHandler: null | ((evt: Event) => void) = null
let mainImageBlob: Blob | null = null

const effectiveDatasetId = computed(() => String(props.datasetId || currentDataset.value?.datasetId || ""))
const effectiveDatasetName = computed(() => String(props.datasetName || currentDataset.value?.name || effectiveDatasetId.value || "当前数据集"))
const DIALOG_RESIZE_HANDLES = [...POPUP_PANEL_RESIZE_HANDLES]
const dialogClass = computed(() => {
  if (workbenchMode.value === "standard") { return "thematic-workbench-panel thematic-workbench-layout-v2 is-standard-workbench" }
  return chartPanelVisible.value ? `thematic-workbench-panel is-chart-docked${composerOpen.value ? " has-composer" : ""}` : "thematic-workbench-panel thematic-workbench-layout-v2"
})
const dialogInitialWidth = computed(() => chartPanelVisible.value ? SIDE_PANEL_WIDTH : WORKBENCH_DEFAULT_WIDTH)
const dialogMinWidth = computed(() => chartPanelVisible.value ? SIDE_PANEL_WIDTH : WORKBENCH_MIN_WIDTH)
const dialogPosition = computed(() => {
  const bounds = selectionFrameBounds.value
  const viewport = mapViewportBounds.value
  if (!chartPanelVisible.value || !selectionScopeLocked.value || !bounds || !viewport) {
    return { top: SIDE_PANEL_MARGIN, right: SIDE_PANEL_MARGIN }
  }
  const frameWidth = mapWork.SELECTION_FRAME_WIDTH
  const frameOuterRight = bounds.left + bounds.width + frameWidth - viewport.left
  const preferredTop = bounds.top - frameWidth - viewport.top
  return workbenchDock({ left: frameOuterRight + SIDE_PANEL_GAP, top: preferredTop }, viewport, composerOpen.value)
})
const boardZoomLabel = computed(() => `${Math.round(boardScale.value * 100)}%`)
const selectedMetricDescription = computed(() => {
  return analysisMetricOptions.find((item) => item.value === selectedAnalysisMetric.value)?.summary || "选择截图像素分析算子"
})
const analysisStatusLabel = computed(() => {
  if (analysisRunning.value) {
    return "运算中"
  }
  return screenshotAnalysis.value ? "已完成" : "待运算"
})
const rasterStatusLabel = computed(() => {
  if (rasterRunning.value) {
    return "计算中"
  }
  return rasterResult.value ? "已渲染" : "待计算"
})
const temporalStatusLabel = computed(() => {
  if (temporalCapturing.value) {
    return "采集中"
  }
  if (temporalRunning.value) {
    return "计算中"
  }
  if (temporalResult.value) {
    return "已渲染"
  }
  if (temporalFrames.value.length >= 2) {
    return "可计算"
  }
  return `${temporalFrames.value.length} 期`
})
const signalStatusLabel = computed(() => {
  if (signalRunning.value) {
    return "处理中"
  }
  return signalResult.value ? "已渲染" : "待处理"
})
const statisticsStatusLabel = computed(() => {
  if (statisticsRunning.value) { return "统计中" }
  return statisticsResult.value ? "已渲染" : "待统计"
})
const spatialStatusLabel = computed(() => {
  if (spatialRunning.value) { return "分析中" }
  return spatialResult.value ? "已渲染" : "待分析"
})
const backgroundStatusLabel = computed(() => {
  if (backgroundCapturing.value) { return "采集中" }
  if (backgroundRunning.value) { return "计算中" }
  if (backgroundResult.value) { return "已渲染" }
  return backgroundBaseline.value ? "可计算" : "待采集"
})
const numericStatusLabel = computed(() => {
  if (numericRunning.value) { return "变换中" }
  return numericResult.value ? "已渲染" : "待变换"
})
const earthquakeStatusLabel = computed(() => {
  if (earthquakeRunning.value) { return "分析中" }
  if (earthquakeResult.value) { return "已落图" }
  return earthquakeDataset.value ? "数据就绪" : "待导入"
})
const earthquakeParameterProfile = computed(() => {
  const operation = selectedEarthquakeOperation.value
  const dataset = earthquakeDataset.value
  const losDirections: Record<string, string> = { away_positive: "远离卫星", toward_positive: "趋近卫星" }
  const definitions: Record<EarthquakeOperation, { fields: string[]; rule: string; constraint: string }> = {
    thermal: { fields: ["lst_k", "baseline_mean_k", "baseline_sd_k", "baseline_count", "quality_flag"], rule: "同季节亮温 Z 标准化", constraint: "质量 good · 基准样本 ≥10 · K" },
    deformation: { fields: ["los_mm", "coherence"], rule: "LOS 位移按相干性筛选", constraint: `正值 ${losDirections[String(dataset?.metadata.losConvention)] || "未声明"} · mm` },
    risk: { fields: ["hazard_index", "exposure_index", "vulnerability_index"], rule: "危险性 × 暴露 × 脆弱性", constraint: "三个校准指数均须在 0–1" },
    intensity: { fields: ["pga_ms2", "pgv_ms"], rule: "PGA / PGV 双指标同级初判", constraint: "仅 VI–XI · 冲突点待复核" }
  }
  const definition = definitions[operation]
  return {
    ...definition,
    fields: definition.fields.map((name) => ({ name, count: dataset?.features.filter((feature) => Object.prototype.hasOwnProperty.call(feature.properties, name)).length || 0 })),
    source: dataset ? `${dataset.source} · ${dataset.observedAt.slice(0, 10)}` : "等待导入观测数据"
  }
})
const earthquakeFilterBands = computed(() => earthquakeResult.value?.rows.map(row => row.label) || [])
const earthquakeSpatialFilterBounds = computed(() => {
  if (earthquakeSpatialFilterMode.value !== "custom") { return null }
  const { value: west } = earthquakeFilterWest
  const { value: south } = earthquakeFilterSouth
  const { value: east } = earthquakeFilterEast
  const { value: north } = earthquakeFilterNorth
  if (west === null || south === null || east === null || north === null || west > east || south > north || west < -180 || east > 180 || south < -90 || north > 90) { return null }
  return { west, south, east, north }
})
const earthquakeFilteredPoints = computed(() => {
  if (earthquakeSpatialFilterMode.value === "custom" && !earthquakeSpatialFilterBounds.value) { return [] }
  if (earthquakeFilterMin.value !== null && earthquakeFilterMax.value !== null && earthquakeFilterMin.value > earthquakeFilterMax.value) { return [] }
  return filterEarthquakePoints(earthquakeResult.value?.points || [], {
    min: earthquakeFilterMin.value,
    max: earthquakeFilterMax.value,
    band: earthquakeFilterBand.value,
    bounds: earthquakeSpatialFilterMode.value === "custom" ? earthquakeSpatialFilterBounds.value : null
  })
})
const earthquakeFilteredRows = computed(() => {
  const counts = new Map<string, { value: number; color: string }>()
  for (const point of earthquakeFilteredPoints.value) {
    const previous = counts.get(point.band)
    counts.set(point.band, { value: (previous?.value || 0) + 1, color: point.color })
  }
  return (earthquakeResult.value?.palette.entries || []).filter(entry => counts.has(entry.band)).map(entry => ({ label: entry.band, ...counts.get(entry.band)! }))
})
const earthquakeVisibleMetrics = computed(() => {
  const points = earthquakeFilteredPoints.value
  const values = points.map((point) => point.value)
  const operation = earthquakeResult.value?.operation
  if (operation === "thermal") { return [{ label: "显示点", value: String(points.length) }, { label: "最高 Z", value: values.length ? Math.max(...values).toFixed(2) : "-" }, { label: "热异常", value: String(points.filter((point) => point.band === "热异常").length) }] }
  if (operation === "deformation") { return [{ label: "显示点", value: String(points.length) }, { label: "最大 |LOS|", value: values.length ? `${Math.max(...values.map(Math.abs)).toFixed(1)} mm` : "-" }, { label: "均值 |LOS|", value: values.length ? `${(values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length).toFixed(1)} mm` : "-" }] }
  if (operation === "risk") { return [{ label: "显示点", value: String(points.length) }, { label: "最高指数", value: values.length ? Math.max(...values).toFixed(3) : "-" }, { label: "优先核查", value: String(points.filter((point) => point.band === "优先核查").length) }] }
  return [{ label: "显示点", value: String(points.length) }, { label: "最高初判", value: points.length ? points.reduce((highest, point) => point.value > highest.value ? point : highest).band : "-" }, { label: "待复核", value: String(earthquakeResult.value?.excludedCount || 0) }]
})
const selectedEarthquakeSymbol = computed(() => earthquakeSymbolRows.value.find((item) => item.id === selectedEarthquakeSymbolId.value) || null)
const earthquakeSymbolOptions = computed(() => Object.entries(cartographySymbolDefinitions).filter(([, binding]) => !binding.legacy && binding.family === symbolFamily.value).map(([kind, binding]) => ({ ...binding, kind: kind as CartographySymbolKind })))
const visibleSymbolRows = computed(() => earthquakeSymbolRows.value.filter(row => cartographySymbolDefinitions[row.kind].family === symbolFamily.value))
const earthquakeOperatorLabel = computed(() => earthquakeOperatorOptions.find((item) => item.value === selectedEarthquakeOperation.value)?.label || "地震专题")
const earthquakeOperatorIcon = computed(() => earthquakeOperatorOptions.find((item) => item.value === selectedEarthquakeOperation.value)?.icon || "radar-chart")
const analysisSourceBadge = computed(() => {
  if (analysisWorkspaceMode.value === "earthquake") { return "观测数据" }
  if (analysisWorkspaceMode.value !== "numeric") { return "影像亮度" }
  return selectedNumericOperation.value === "projection" ? "范围坐标" : "RGB 影像"
})
const statisticsChartTitle = computed(() => {
  if (statisticsResult.value?.operation === "area") { return "格网均值" }
  if (statisticsResult.value?.operation === "autocorrelation") { return "聚集类型" }
  return statisticsResult.value?.operation === "density" ? "局部密度分布" : "亮度等级分布"
})
const statisticsChartUnit = computed(() => {
  if (statisticsResult.value?.operation === "area") { return "亮度 0–255" }
  return statisticsResult.value?.operation === "autocorrelation" ? "格网数量" : "像元数量"
})
const activeAnalysisStatusLabel = computed(() => {
  if (analysisWorkspaceMode.value === "raster") { return rasterStatusLabel.value }
  if (analysisWorkspaceMode.value === "temporal") { return temporalStatusLabel.value }
  if (analysisWorkspaceMode.value === "signal") { return signalStatusLabel.value }
  if (analysisWorkspaceMode.value === "statistics") { return statisticsStatusLabel.value }
  if (analysisWorkspaceMode.value === "background") { return backgroundStatusLabel.value }
  if (analysisWorkspaceMode.value === "numeric") { return numericStatusLabel.value }
  if (analysisWorkspaceMode.value === "earthquake") { return earthquakeStatusLabel.value }
  return spatialStatusLabel.value
})
const activeAnalysisReady = computed(() => {
  if (analysisWorkspaceMode.value === "raster") { return !!rasterResult.value }
  if (analysisWorkspaceMode.value === "temporal") { return !!temporalResult.value }
  if (analysisWorkspaceMode.value === "signal") { return !!signalResult.value }
  if (analysisWorkspaceMode.value === "statistics") { return !!statisticsResult.value }
  if (analysisWorkspaceMode.value === "background") { return !!backgroundResult.value }
  if (analysisWorkspaceMode.value === "numeric") { return !!numericResult.value }
  if (analysisWorkspaceMode.value === "earthquake") { return !!earthquakeResult.value }
  return !!spatialResult.value
})
const signalSpectrumPoints = computed(() => {
  const values = signalResult.value?.summary.spectrum || []
  if (!values.length) { return "" }
  return values.map((value, index) => `${(8 + index / (values.length - 1) * 312).toFixed(1)},${(52 - value / 100 * 42).toFixed(1)}`).join(" ")
})
const temporalSparklinePoints = computed(() => {
  const values = temporalResult.value?.summary.frameMeans || []
  if (!values.length) {
    return ""
  }
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = Math.max(1, maximum - minimum)
  return values.map((value, index) => {
    const x = values.length === 1 ? 164 : 8 + index / (values.length - 1) * 312
    const y = 46 - (value - minimum) / span * 38
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
})
const selectionToolbarStyle = computed(() => ({
  left: `${selectionToolbarLeft.value}px`,
  top: `${selectionToolbarTop.value}px`
}))
const selectionFrameStyle = computed(() => {
  const bounds = selectionFrameBounds.value
  const frameWidth = mapWork.SELECTION_FRAME_WIDTH
  if (!bounds) {
    return {}
  }
  return {
    left: `${bounds.left - frameWidth}px`,
    top: `${bounds.top - frameWidth}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    borderWidth: `${frameWidth}px`
  }
})
let selectionSession = 0
const showSelectionOverlay = computed(() => dialogVisible.value && !!selectionFrameBounds.value && (selectionToolbarVisible.value || selectionScopeLocked.value))
const lockedScopeKey = computed(() => getSelectionScopeKey(lockedSelection.value))
const selectionScopeSummary = computed(() => {
  const rect = lockedSelection.value
  if (!rect) {
    return "尚未锁定范围"
  }
  const midLatitude = (rect.south + rect.north) / 2
  const widthKm = Math.abs(rect.east - rect.west) * 111.32 * Math.cos(midLatitude * Math.PI / 180)
  const heightKm = Math.abs(rect.north - rect.south) * 111.32
  const area = widthKm * heightKm
  const areaText = area >= 1000 ? `${Math.round(area).toLocaleString()} km²` : `${area.toFixed(1)} km²`
  return `西 ${rect.west.toFixed(4)}° · 南 ${rect.south.toFixed(4)}° · 东 ${rect.east.toFixed(4)}° · 北 ${rect.north.toFixed(4)}° · 约 ${areaText}`
})
const boardSurfaceStyle = computed(() => ({
  width: `${boardWidth.value}px`,
  height: `${boardHeight.value}px`,
  transform: `scale(${boardScale.value})`,
  transformOrigin: "0 0"
}))
const sourceLabel = computed(() => {
  if (props.source === "dataset-detail") {
    return "数据集详情入口"
  }
  if (props.source === "context-menu") {
    return "地图右键入口"
  }
  if (props.source === "sidebar") {
    return "左侧工具栏入口"
  }
  return "工具栏入口"
})
const contextDesc = computed(() => {
  const target = String(props.targetName || "").trim()
  if (target) {
    return `${sourceLabel.value}已进入制图台，当前目标：${target}`
  }
  return `${sourceLabel.value}已进入制图台，可在模板库、编辑、发布三个阶段持续操作`
})
const templatePurposeCounts = computed<Record<TemplatePurpose, number>>(() => ({
  all: templateCatalog.value.length,
  emergency: templateCatalog.value.filter(template => getTemplatePurpose(template) === "emergency").length,
  analysis: templateCatalog.value.filter(template => getTemplatePurpose(template) === "analysis").length
}))
const secondaryFilteredTemplates = computed(() => templateCatalog.value.filter(matchesTemplateSecondaryFilters))
const templateCategoryCounts = computed<Record<CatalogCategoryId, number>>(() => {
  const counts: Record<CatalogCategoryId, number> = {
    emergency: 0,
    statistics: 0,
    heat: 0,
    flow: 0,
    raster: 0,
    compare: 0
  }
  secondaryFilteredTemplates.value.forEach((template) => {
    const category = getCatalogCategoryId(template)
    if (category) {
      counts[category] += 1
    }
  })
  return counts
})
const catalogCategoryFilterOptions = computed(() => [
  { value: "emergency", label: `应急响应专题 (${templateCategoryCounts.value.emergency})` },
  ...templateCategoryOptions.map(item => ({ value: item.id, label: `${item.label} (${templateCategoryCounts.value[item.id]})` }))
])
const filteredTemplates = computed(() => {
  if (selectedTemplateCategories.value.length === 0) {
    return secondaryFilteredTemplates.value
  }
  return secondaryFilteredTemplates.value.filter((template) => {
    const category = getCatalogCategoryId(template)
    return !!category && selectedTemplateCategories.value.includes(category)
  })
})
const activeTemplateFilterTags = computed(() => {
  const tags: string[] = []
  const keyword = templateSearchKeyword.value.trim()
  if (keyword) {
    tags.push(`搜索：${keyword}`)
  }
  if (selectedTemplatePurpose.value !== "all") {
    tags.push(templatePurposeOptions.find(item => item.value === selectedTemplatePurpose.value)!.label)
  }
  if (selectedTemplateEdition.value !== "all") {
    const option = templateEditionOptions.find((item) => item.value === selectedTemplateEdition.value)
    if (option) {
      tags.push(option.label)
    }
  }
  selectedTemplateDataTypes.value.forEach((dataType) => {
    const option = templateDataTypeOptions.find((item) => item.value === dataType)
    if (option) {
      tags.push(option.label)
    }
  })
  if (selectedTemplateComplexity.value !== "all") {
    const option = templateComplexityOptions.find((item) => item.value === selectedTemplateComplexity.value)
    if (option) {
      tags.push(option.label)
    }
  }
  selectedTemplateCategories.value.forEach((categoryId) => {
    if (categoryId === "emergency") { tags.push("应急响应专题"); return }
    const option = templateCategoryOptions.find((item) => item.id === categoryId)
    if (option) {
      tags.push(option.label)
    }
  })
  return tags
})
const templatePreviewTitle = computed(() => `${previewedTemplate.value?.name || "模板"}预览`)
const selectedTemplate = computed(() => templates.value.find((template) => template.templateId === draft.templateId) || null)
const isDirty = computed(() => JSON.stringify(snapshotDraft()) !== savedDraftJson.value)

watch(
  () => props.visible,
  (value) => {
    dialogVisible.value = !!value
  }
)

watch([dialogVisible, isFold, chartPanelVisible], ([visible, folded, chart]) => {
  if (!visible || folded || (!chart && workbenchMode.value !== "standard")) { composerOpen.value = false }
})
watch(dialogVisible, (value) => {
  emit("update:visible", value)
  if (!value) {
    standardCaptureVersion++; standardMapBusy.value = false
    selectionSession++
    closeTemplatePreview()
    chartPanelVisible.value = false
    resetSelectionScope(true)
    mapWork.endCartographySession()
  }
})

watch(chartPanelVisible, (visible) => {
  if (visible) {
    nextTick(() => {
      renderAllCharts()
    })
  }
})

watch(rasterOpacity, (opacity) => {
  const result = rasterResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "raster" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) {
    return
  }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})

watch(temporalOpacity, (opacity) => {
  const result = temporalResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "temporal" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) {
    return
  }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})

watch(signalOpacity, (opacity) => {
  const result = signalResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "signal" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) { return }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})

watch(statisticsOpacity, (opacity) => {
  const result = statisticsResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "statistics" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) { return }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})

watch(spatialOpacity, (opacity) => {
  const result = spatialResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "spatial" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) { return }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})
watch(backgroundOpacity, (opacity) => {
  const result = backgroundResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "background" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) { return }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})
watch(numericOpacity, (opacity) => {
  const result = numericResult.value
  const rectangle = mapWork.getLockedSelection()
  if (analysisWorkspaceMode.value !== "numeric" || !result || !rectangle || result.scopeKey !== lockedScopeKey.value) { return }
  mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
})
watch(earthquakeFilteredPoints, (points) => {
  if (analysisWorkspaceMode.value !== "earthquake" || !earthquakeResult.value) { return }
  const rectangle = mapWork.getLockedSelection()
  if (rectangle) { mapWork.renderEarthquakePoints(points, rectangle) }
})
watch([analysisWorkspaceMode, earthquakeOutputView, chartPanelVisible, isFold, dialogVisible], () => {
  cancelEarthquakeSymbolPlacement()
})
watch(analysisWorkspaceMode, mode => { symbolFamily.value = mode === "earthquake" ? "earthquake" : "basic" })
watch(symbolFamily, cancelEarthquakeSymbolPlacement)

watch(
  () => [effectiveDatasetId.value, effectiveDatasetName.value],
  () => {
    loadDraft()
  },
  { immediate: true }
)

onMounted(() => {
  loadTemplates()
  mapWork.eventTarget.on("selectionCreated", handleSelectionCreated)
  mapWork.eventTarget.on("selectionBoundsChanged", handleSelectionBoundsChanged)
  mapWork.eventTarget.on("selectionConfirmed", handleSelectionConfirmed)
  mapWork.eventTarget.on("selectionCanceled", handleSelectionCanceled)
  mapWork.eventTarget.on("selectionHint", handleSelectionHint)
  mapWork.eventTarget.on("symbolPlaced", handleEarthquakeSymbolPlaced)
  mapWork.eventTarget.on("symbolSelected", handleEarthquakeSymbolSelected)
  mapWork.eventTarget.on("symbolMoved", handleEarthquakeSymbolMoved)
  mapWork.eventTarget.on("symbolRemoved", handleEarthquakeSymbolRemoved)
  mapWork.eventTarget.on("symbolsCleared", handleEarthquakeSymbolsCleared)
  mapWork.eventTarget.on("symbolPlacementRejected", handleEarthquakeSymbolPlacementRejected)
  disposeDatasetWatch = onCurrentDatasetChange((dataset) => {
    currentDataset.value = dataset
  })
  const panel = document.querySelector(".thematic-workbench-panel") as HTMLElement | null
  if (panel) {
    panelMouseDownHandler = () => notifyPanelFront()
    panel.addEventListener("mousedown", panelMouseDownHandler, true)
  }
  widgetVisibleHandler = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as any
    const name = String(detail?.name || "")
    const visible = !!detail?.visible
    if (!visible || name === "thematic-workbench" || !dialogVisible.value || isFold.value) {
      return
    }
    dialogRef.value?.fold?.()
  }
  window.addEventListener("mars3d:widget-visible", widgetVisibleHandler as EventListener)
  viewportResizeHandler = () => {
    const mapContainer = document.querySelector("#mars-main-view")
    updateMapViewportBounds(mapContainer?.getBoundingClientRect())
    requestAnimationFrame(() => {
      requestAnimationFrame(() => mapWork.refreshSelectionBounds())
    })
  }
  window.addEventListener("resize", viewportResizeHandler)
  viewportResizeHandler()
  themeChangeHandler = () => {
    nextTick(() => renderAllCharts())
  }
  window.addEventListener("themeChange", themeChangeHandler)
  timeExtentChangeHandler = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as { current?: string } | undefined
    if (detail?.current) {
      timelineCurrentTime.value = String(detail.current)
    }
  }
  window.addEventListener("mars3d:timeExtentChange", timeExtentChangeHandler as EventListener)
  notifyPanelFront()
})

onUnmounted(() => {
  mapWork.eventTarget.off("selectionCreated", handleSelectionCreated)
  mapWork.eventTarget.off("selectionBoundsChanged", handleSelectionBoundsChanged)
  mapWork.eventTarget.off("selectionConfirmed", handleSelectionConfirmed)
  mapWork.eventTarget.off("selectionCanceled", handleSelectionCanceled)
  mapWork.eventTarget.off("selectionHint", handleSelectionHint)
  mapWork.eventTarget.off("symbolPlaced", handleEarthquakeSymbolPlaced)
  mapWork.eventTarget.off("symbolSelected", handleEarthquakeSymbolSelected)
  mapWork.eventTarget.off("symbolMoved", handleEarthquakeSymbolMoved)
  mapWork.eventTarget.off("symbolRemoved", handleEarthquakeSymbolRemoved)
  mapWork.eventTarget.off("symbolsCleared", handleEarthquakeSymbolsCleared)
  mapWork.eventTarget.off("symbolPlacementRejected", handleEarthquakeSymbolPlacementRejected)
  disposeDatasetWatch?.()
  disposeDatasetWatch = null
  boardDragCleanup?.()
  boardDragCleanup = null
  clearChartPanelState()
  const panel = document.querySelector(".thematic-workbench-panel") as HTMLElement | null
  if (panel && panelMouseDownHandler) {
    panel.removeEventListener("mousedown", panelMouseDownHandler, true)
  }
  panelMouseDownHandler = null
  if (widgetVisibleHandler) {
    window.removeEventListener("mars3d:widget-visible", widgetVisibleHandler as EventListener)
  }
  widgetVisibleHandler = null
  if (viewportResizeHandler) {
    window.removeEventListener("resize", viewportResizeHandler)
  }
  viewportResizeHandler = null
  if (themeChangeHandler) {
    window.removeEventListener("themeChange", themeChangeHandler)
  }
  themeChangeHandler = null
  if (timeExtentChangeHandler) {
    window.removeEventListener("mars3d:timeExtentChange", timeExtentChangeHandler as EventListener)
  }
  timeExtentChangeHandler = null
})

function createEmptyDraft(): DraftState {
  return {
    templateId: "",
    templateName: "",
    title: "",
    subtitle: "",
    legendTitle: "形变强度",
    palette: "blue-red",
    notes: "",
    agency: "",
    publishName: "",
    publishDesc: ""
  }
}

function snapshotDraft(): DraftState {
  return {
    templateId: draft.templateId,
    templateName: draft.templateName,
    title: draft.title,
    subtitle: draft.subtitle,
    legendTitle: draft.legendTitle,
    palette: draft.palette,
    notes: draft.notes,
    agency: draft.agency,
    publishName: draft.publishName,
    publishDesc: draft.publishDesc
  }
}

function applyDraft(next: DraftState) {
  draft.templateId = next.templateId
  draft.templateName = next.templateName
  draft.title = next.title
  draft.subtitle = next.subtitle
  draft.legendTitle = next.legendTitle
  draft.palette = next.palette
  draft.notes = next.notes
  draft.agency = next.agency || ""
  draft.publishName = next.publishName
  draft.publishDesc = next.publishDesc
}

function getDraftStorageKey() {
  return `mars3d_thematic_workbench_draft_v1_${effectiveDatasetId.value || "global"}`
}

function buildDefaultDraft(): DraftState {
  const base = createEmptyDraft()
  base.title = effectiveDatasetName.value ? `${effectiveDatasetName.value}专题图` : ""
  base.publishName = effectiveDatasetName.value ? `${effectiveDatasetName.value}-专题成果` : ""
  return base
}

function loadDraft() {
  const fallback = buildDefaultDraft()
  try {
    const raw = localStorage.getItem(getDraftStorageKey()) || ""
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftState>
      applyDraft({
        ...fallback,
        ...parsed
      })
    } else {
      applyDraft(fallback)
    }
  } catch {
    applyDraft(fallback)
  }
  savedDraftJson.value = JSON.stringify(snapshotDraft())
}

async function loadTemplates() {
  loadingTemplates.value = true
  templates.value = mergeStandardTemplateCatalog([])
  try {
    const result = await getTemplates({ limit: 24 })
    const remoteTemplates = result.success && result.data ? result.data.templates || [] : []
    const mergedTemplates = mergeStandardTemplateCatalog(remoteTemplates)
    const activeStandardProfile = standardTemplateProfiles.find((profile) => profile.templateId === draft.templateId)
    if (activeStandardProfile) {
      const matchingTemplate = mergedTemplates.find((template) => resolveStandardTemplateProfile(template)?.templateId === activeStandardProfile.templateId)
      if (matchingTemplate) {
        draft.templateId = matchingTemplate.templateId
      }
    }
    templates.value = mergedTemplates
  } finally {
    loadingTemplates.value = false
  }
}

function mergeStandardTemplateCatalog(remoteTemplates: ThematicTemplate[]): ThematicTemplate[] {
  const availableRemoteTemplates = remoteTemplates.filter((template) => template.templateId !== "local_mock_template")
  const consumedTemplateIds = new Set<string>()
  const catalog = standardTemplates.map((standardTemplate) => {
    const matchingRemote = availableRemoteTemplates.find((template) => (
      template.templateId === standardTemplate.templateId || normalizeTemplateFilterText(template.name) === normalizeTemplateFilterText(standardTemplate.name)
    ))
    if (!matchingRemote) {
      return standardTemplate
    }
    consumedTemplateIds.add(matchingRemote.templateId)
    return {
      ...standardTemplate,
      ...matchingRemote,
      templateVersion: matchingRemote.templateVersion || standardTemplate.templateVersion,
      description: matchingRemote.description || standardTemplate.description,
      previewImage: matchingRemote.previewImage || standardTemplate.previewImage,
      parameters: matchingRemote.parameters?.length ? matchingRemote.parameters : standardTemplate.parameters
    }
  })
  return [
    ...catalog,
    ...availableRemoteTemplates.filter((template) => !consumedTemplateIds.has(template.templateId))
  ]
}

function normalizeTemplateFilterText(value: unknown): string {
  return String(value || "").trim().toLocaleLowerCase()
}

function getTemplateFilterSource(template: ThematicTemplate): string {
  return [template.templateId, template.category, template.name, template.description]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
}

function resolveStandardTemplateProfile(template: ThematicTemplate): StandardTemplateProfile | undefined {
  const normalizedName = normalizeTemplateFilterText(template.name)
  return standardTemplateProfiles.find((profile) => (
    profile.templateId === template.templateId || normalizeTemplateFilterText(profile.name) === normalizedName
  ))
}

function resolveTemplateFilterProfile(template: ThematicTemplate): TemplateFilterProfile | undefined {
  return resolveStandardTemplateProfile(template) || localTemplateFilterProfiles[template.templateId]
}

function resolveTemplateCategory(template: ThematicTemplate): TemplateCategoryOption | undefined {
  if (getEmergencyCatalogEntry(template)) { return undefined }
  const profile = resolveTemplateFilterProfile(template)
  if (profile?.category) {
    return templateCategoryOptions.find((category) => category.id === profile.category)
  }
  const source = getTemplateFilterSource(template)
  return templateCategoryOptions.find((category) => category.aliases.some((alias) => source.includes(alias)))
}

function getCatalogCategoryId(template: ThematicTemplate): CatalogCategoryId | undefined {
  return getEmergencyCatalogEntry(template) ? "emergency" : resolveTemplateCategory(template)?.id
}

function resolveTemplateDataTypes(template: ThematicTemplate): TemplateDataType[] {
  const emergency = getEmergencyCatalogEntry(template)
  if (emergency) { return emergency.dataTypes }
  const profile = resolveTemplateFilterProfile(template)
  if (profile) {
    return profile.dataTypes
  }
  const source = getTemplateFilterSource(template)
  const matchedTypes = templateDataTypeOptions
    .filter((option) => option.aliases.some((alias) => source.includes(alias)))
    .map((option) => option.value)
  if (matchedTypes.length > 0) {
    return matchedTypes
  }
  const category = resolveTemplateCategory(template)
  return category ? categoryDefaultDataTypes[category.id] : []
}

function resolveTemplateComplexity(template: ThematicTemplate): TemplateComplexity {
  if (getEmergencyCatalogEntry(template)) { return "professional" }
  const profile = resolveTemplateFilterProfile(template)
  if (profile) {
    return profile.complexity
  }
  const source = getTemplateFilterSource(template)
  if (["基础", "basic", "simple", "快速"].some((alias) => source.includes(alias))) {
    return "basic"
  }
  if (["专业", "advanced", "expert", "预测", "动态"].some((alias) => source.includes(alias))) {
    return "professional"
  }
  const category = resolveTemplateCategory(template)
  return category ? categoryDefaultComplexity[category.id] : "standard"
}

function getTemplateSearchText(template: ThematicTemplate): string {
  const profile = resolveTemplateFilterProfile(template)
  const category = resolveTemplateCategory(template)
  const dataTypeLabels = resolveTemplateDataTypes(template).map((dataType) => (
    templateDataTypeOptions.find((option) => option.value === dataType)?.label || dataType
  ))
  const complexityLabel = templateComplexityOptions.find((option) => option.value === resolveTemplateComplexity(template))?.label
  return [getTemplateFilterSource(template), category?.label, getTemplateEditionLabel(template), ...dataTypeLabels, complexityLabel, ...(profile?.keywords || []), ...(getEmergencyCatalogEntry(template)?.keywords || [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
}

function matchesTemplateSecondaryFilters(template: ThematicTemplate): boolean {
  if (selectedTemplatePurpose.value !== "all" && getTemplatePurpose(template) !== selectedTemplatePurpose.value) { return false }
  if (selectedTemplateEdition.value !== "all" && getTemplateEdition(template) !== selectedTemplateEdition.value) {
    return false
  }
  const keywordTokens = normalizeTemplateFilterText(templateSearchKeyword.value).split(/\s+/).filter(Boolean)
  if (keywordTokens.length > 0) {
    const searchText = getTemplateSearchText(template)
    if (!keywordTokens.every((token) => searchText.includes(token))) {
      return false
    }
  }
  if (selectedTemplateDataTypes.value.length > 0) {
    const templateDataTypes = resolveTemplateDataTypes(template)
    if (!selectedTemplateDataTypes.value.some((dataType) => templateDataTypes.includes(dataType))) {
      return false
    }
  }
  if (selectedTemplateComplexity.value !== "all" && resolveTemplateComplexity(template) !== selectedTemplateComplexity.value) {
    return false
  }
  return true
}

function getTemplateDataTypeTagPlaceholder(omittedValues: unknown[]): string {
  return `已选 ${omittedValues.length} 项`
}

function getTemplateDataTypeLabels(template: ThematicTemplate): string[] {
  const labels = resolveTemplateDataTypes(template).map((dataType) => (
    templateDataTypeOptions.find((option) => option.value === dataType)?.label || dataType
  ))
  return labels.length > 0 ? labels : ["通用数据"]
}

function getTemplateComplexityLabel(template: ThematicTemplate): string {
  const complexity = resolveTemplateComplexity(template)
  return templateComplexityOptions.find((option) => option.value === complexity)?.label || "标准"
}

function getTemplateComponentLabels(template: ThematicTemplate): string[] {
  const emergency = getEmergencyCatalogEntry(template)
  if (emergency) { return emergency.components }
  const standardProfile = resolveStandardTemplateProfile(template)
  if (standardProfile) {
    return standardProfile.components
  }
  const category = resolveTemplateCategory(template)
  if (category) {
    return categoryDefaultComponents[category.id]
  }
  const parameterLabels = (template.parameters || []).map((parameter) => parameter.label).filter(Boolean)
  return parameterLabels.length > 0 ? parameterLabels.slice(0, 3) : ["专题图层", "图例", "标题标注"]
}

function getTemplateCategoryLabel(template: ThematicTemplate): string {
  if (getEmergencyCatalogEntry(template)) { return "应急响应专题" }
  return resolveTemplateCategory(template)?.label || ""
}

function getTemplateVisualKind(template: ThematicTemplate): TemplateVisualKind {
  const standardProfile = resolveStandardTemplateProfile(template)
  if (standardProfile) {
    return standardProfile.visualKind
  }
  const fallbackByCategory: Record<TemplateCategoryId, TemplateVisualKind> = {
    statistics: "chart-linkage",
    heat: "point-heat",
    flow: "flow-direction",
    raster: "raster-ramp",
    compare: "time-compare"
  }
  const category = resolveTemplateCategory(template)
  return category ? fallbackByCategory[category.id] : "chart-linkage"
}

function getTemplateEdition(template: ThematicTemplate): TemplateEdition | "" {
  if (getEmergencyCatalogEntry(template)) { return "earthquake" }
  const profile = resolveStandardTemplateProfile(template)
  return profile ? profile.edition || "standard" : ""
}

function getTemplateEditionLabel(template: ThematicTemplate): string {
  if (getEmergencyCatalogEntry(template)) { return "应急响应专题" }
  const edition = getTemplateEdition(template)
  if (edition === "earthquake") {
    return "地震专业 · 分析表达"
  }
  return "分析表达"
}

function resolveEarthquakeTemplateId(template: ThematicTemplate): EarthquakeTemplateId | undefined {
  const profile = resolveStandardTemplateProfile(template)
  return profile?.edition === "earthquake" && isEarthquakeTemplateId(profile.templateId)
    ? profile.templateId
    : undefined
}

function getTemplatePrimaryIconBinding(template: ThematicTemplate): TemplateIconBinding | undefined {
  if (getEmergencyCatalogEntry(template)) { return undefined }
  const earthquakeTemplateId = resolveEarthquakeTemplateId(template)
  if (earthquakeTemplateId) {
    return getEarthquakeTemplatePrimaryIcon(earthquakeTemplateId)
  }
  const visualKind = getTemplateVisualKind(template)
  const category = resolveTemplateCategory(template)
  const binding = getBasicTemplateIconBinding(visualKind, category?.id)
  return binding?.family === "basic" ? binding : undefined
}

function getTemplateBusinessIconLabel(template: ThematicTemplate): string {
  return getTemplatePrimaryIconBinding(template)?.label || "专题"
}

function getTemplateSymbolBindings(template: ThematicTemplate): TemplateIconBinding[] {
  const earthquakeTemplateId = resolveEarthquakeTemplateId(template)
  return earthquakeTemplateId ? getEarthquakeTemplateSymbolBindings(earthquakeTemplateId) : []
}

function getTemplateDisplayIconBindings(template: ThematicTemplate): TemplateIconBinding[] {
  const symbols = getTemplateSymbolBindings(template)
  if (symbols.length > 0) {
    return symbols
  }
  const primary = getTemplatePrimaryIconBinding(template)
  return primary ? [primary] : []
}

function getTemplateAccentStyle(template: ThematicTemplate): Record<string, string> {
  const accent = getTemplatePrimaryIconBinding(template)?.accent || "#41a8ff"
  return {
    "--template-icon-accent": accent,
    color: accent,
    borderColor: `${accent}66`,
    backgroundColor: `${accent}18`
  }
}

function getTemplateIconBindingStyle(binding: TemplateIconBinding): Record<string, string> {
  return {
    "--template-icon-accent": binding.accent,
    color: binding.accent,
    borderColor: `${binding.accent}70`,
    backgroundColor: `${binding.accent}18`
  }
}

function openTemplatePreview(template: ThematicTemplate) {
  previewedTemplate.value = template
  templatePreviewOpen.value = true
}

function closeTemplatePreview() {
  templatePreviewOpen.value = false
}

function usePreviewedTemplate() {
  if (!previewedTemplate.value) {
    return
  }
  const template = previewedTemplate.value
  closeTemplatePreview()
  selectTemplate(template)
}

function collapsePanelsForCartography() {
  closeTemplatePreview()
  chartPanelVisible.value = false
  showCustomBoardSize.value = false
  selectionToolbarVisible.value = false
  if (!selectionScopeLocked.value) {
    selectionFrameBounds.value = null
  }

  const otherVisibleWidgets = widgetStore.state.widgets
    .filter((widget) => widget.visible && widget.name !== "thematic-workbench")
    .map((widget) => widget.name)
  if (otherVisibleWidgets.length > 0) {
    disable(otherVisibleWidgets)
  }

  window.dispatchEvent(new CustomEvent("sidebarToggle", {
    detail: { collapsed: true, source: "thematic-workbench" }
  }))
}

function enterCartographyFocusMode() {
  collapsePanelsForCartography()
  if (!isFold.value) {
    dialogRef.value?.fold?.()
  }
}

function restoreWorkbench() {
  dialogVisible.value = true
  if (isFold.value) {
    dialogRef.value?.expend?.()
  }
}

function selectTemplatePurpose(purpose: TemplatePurpose) {
  selectedTemplatePurpose.value = purpose
  selectedTemplateEdition.value = "all"
  clearTemplateCategoryFilters()
}

function clearTemplateCategoryFilters() {
  selectedTemplateCategories.value = []
}

function resetTemplateFilters() {
  selectedTemplatePurpose.value = "all"
  templateSearchKeyword.value = ""
  selectedTemplateEdition.value = "all"
  selectedTemplateDataTypes.value = []
  selectedTemplateComplexity.value = "all"
  clearTemplateCategoryFilters()
}

function selectTemplate(template: ThematicTemplate) {
  const emergency = getEmergencyCatalogEntry(template)
  if (emergency) { selectStandardTemplate(emergency.emergencyId); return }
  workbenchMode.value = "analysis"; composerOpen.value = false
  clearTemplatePreview()
  const previousTemplateName = draft.templateName
  const previousGeneratedTitle = previousTemplateName ? `${previousTemplateName} - ${effectiveDatasetName.value}` : ""
  const previousGeneratedPublishName = previousTemplateName ? `${effectiveDatasetName.value}-${previousTemplateName}` : ""
  const shouldRefreshTitle = !draft.title || draft.title === `${effectiveDatasetName.value}专题图` || draft.title === previousGeneratedTitle
  const shouldRefreshPublishName = !draft.publishName ||
    draft.publishName === `${effectiveDatasetName.value}-专题成果` ||
    draft.publishName === previousGeneratedPublishName
  draft.templateId = template.templateId
  draft.templateName = template.name || template.templateId
  const standardProfile = resolveStandardTemplateProfile(template)
  if (shouldRefreshTitle) {
    draft.title = `${draft.templateName} - ${effectiveDatasetName.value}`
  }
  if (standardProfile) {
    draft.subtitle = standardProfile.subtitle
    draft.legendTitle = standardProfile.legendTitle
    draft.palette = standardProfile.palette
    draft.notes = standardProfile.notes
  }
  if (shouldRefreshPublishName) {
    draft.publishName = `${effectiveDatasetName.value}-${draft.templateName}`
  }
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  activeTab.value = "editor"
  chartPanelVisible.value = false
  restoreWorkbench()
  resetEditorScroll()
  $message("已选择模板，请框选范围并应用到地图")
}

function isTemplateSelected(template: ThematicTemplate) {
  const emergency = getEmergencyCatalogEntry(template)
  return emergency ? workbenchMode.value === "standard" && selectedStandardTemplate.value === emergency.emergencyId : workbenchMode.value === "analysis" && draft.templateId === template.templateId
}

function startTemplateSelection() {
  startChartSelectionFlow()
  selectionPurpose.value = "template"
}

async function handleTemplateApplied(blob: Blob, openLayout = false, rendered = false) {
  clearTemplatePreview()
  if (rendered) { templateResultPreview.value = URL.createObjectURL(blob) }
  if (mainImageUrl.value) { URL.revokeObjectURL(mainImageUrl.value) }
  mainImageBlob = blob
  mainImageUrl.value = URL.createObjectURL(blob)
  mainImageTitle.value = draft.title
  mainImageMeta.value = `${selectionAreaText.value} · ${draft.templateName} · ${new Date().toLocaleString()}`
  if (rendered && !openLayout && composerOpen.value) {
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
    if (mainImageBlob === blob) { composerRef.value?.useRaster({ image, label: draft.templateName, detail: mainImageMeta.value, legend: cartographyContext.value.legend }, "main", true) }
  }
  if (openLayout) { await openTemplateLayout() } else { $message("模板已渲染到框选地图，实际预览已更新", "success") }
}

async function openTemplateLayout() {
  if (!mainImageBlob || !selectionScopeLocked.value) { return }
  try {
  const scope = lockedScopeKey.value
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(mainImageBlob!)
  })
  const bitmap = await createImageBitmap(mainImageBlob!)
  const dimensions = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  if (scope !== lockedScopeKey.value) { return }
  templateLayoutEditing.value = true
  chartPanelVisible.value = true
  restoreWorkbench()
  composerMetrics.value = mapWork.getMapAdornmentMetrics()
  await nextTick()
  composerOpen.value = true
  await nextTick()
  const applied = composerRef.value?.applyTemplate({ image, ...dimensions, label: "当前框选地图", detail: mainImageMeta.value, legend: cartographyContext.value.legend }, {
    title: draft.title,
    legendTitle: cartographySettings.legendTitle,
    time: cartographySettings.time,
    source: cartographySettings.source,
    description: draft.notes,
    agency: draft.agency,
    kind: selectedTemplate.value ? getTemplateVisualKind(selectedTemplate.value) : undefined
  })
  if (!applied) { $message("版式未能应用，请检查图片或版面元素数量"); return }
  $message(templateResultPreview.value ? "模板渲染完成，已同步到排版工作台" : "仅版式已套用，未执行模板渲染", "success")
  } catch { $message("版式生成失败，请重新套用") }
}

function updateCompositionCopy(kind: string, text: string) {
  if (workbenchMode.value === "standard") { standardEditorRef.value?.updateCopy(kind, text); return }
  if (kind === "title") { draft.title = text }
  if (kind === "description") { draft.notes = text }
  if (kind === "agency") { draft.agency = text }
  if (kind === "legend") { draft.legendTitle = text; cartographySettings.legendTitle = text }
  if (kind === "source") { cartographySettings.source = text }
  if (kind === "time") { cartographySettings.time = text }
}

async function openStyledComposition() {
  if (syncingStyleComposition.value) { return }
  if (!selectionScopeLocked.value) { $message("请先锁定制图范围"); return }
  const scope = lockedScopeKey.value
  syncingStyleComposition.value = true
  try {
    const started = performance.now()
    while (templateMapEditorRef.value?.isRendering()) {
      if (scope !== lockedScopeKey.value || !selectionScopeLocked.value) { return }
      if (performance.now() - started > 30000) { throw new Error("模板仍在渲染，请等待完成后重试") }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    await displaySettingsRef.value?.prepareCapture()
    if (scope !== lockedScopeKey.value || !selectionScopeLocked.value) { return }
    const blob = await mapWork.captureSelectionImage({ targetWidth: 1280, fitAspect: true, frameWidth: 0, mime: "image/png" })
    if (!blob) { throw new Error("无法截取当前制图范围") }
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob)
    })
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }; bitmap.close()
    if (scope !== lockedScopeKey.value || !selectionScopeLocked.value) { return }
    if (mainImageUrl.value) { URL.revokeObjectURL(mainImageUrl.value) }
    mainImageBlob = blob; mainImageUrl.value = URL.createObjectURL(blob)
    mainImageTitle.value = draft.title || mapWork.getDisplaySource()?.name || "专题主图"
    mainImageMeta.value = `${selectionAreaText.value} · ${new Date().toLocaleString()}`
    composerMetrics.value = mapWork.getMapAdornmentMetrics()
    if (!chartPanelVisible.value) { templateLayoutEditing.value = true; chartPanelVisible.value = true }
    displaySettingsOpen.value = false; restoreWorkbench()
    await nextTick(); composerOpen.value = true; await nextTick()
    // Refresh only the map image; reopening must preserve the user's layout and text.
    const applied = composerRef.value?.useRaster({ image, ...dimensions, label: "当前框选地图", detail: mainImageMeta.value, legend: cartographyContext.value.legend }, "main", true)
    if (!applied) { throw new Error("地图图片未能载入排版，已保留原有版面，请重试") }
  } catch (error) { $message(error instanceof Error ? error.message : "同步地图失败，请重试") } finally { syncingStyleComposition.value = false }
}

function startChartSelectionFlow() {
  selectionPurpose.value = "chart"
  resetSelectionScope(true)
  enterCartographyFocusMode()
  mainImageMeta.value = "请在地图上双击一次确定起点，再双击一次确定终点，完成矩形主图框选"
  mapWork.beginRectangleSelection({
    rightReserve: SIDE_PANEL_WIDTH + SIDE_PANEL_GAP + SIDE_PANEL_MARGIN + mapWork.SELECTION_FRAME_WIDTH
  })
}

async function captureStandardPreview(selection: boolean) {
  const revision = ++standardCaptureVersion
  standardMapBusy.value = true; standardMapError.value = ""
  try {
    const preview = await mapWork.captureStandardMapPreview(selection)
    if (revision === standardCaptureVersion && dialogVisible.value && workbenchMode.value === "standard") { standardMapPreview.value = preview }
  } catch (err) {
    if (revision === standardCaptureVersion) { standardMapError.value = err instanceof Error ? err.message : "底图采集失败，请重试" }
  } finally { if (revision === standardCaptureVersion) { standardMapBusy.value = false } }
}

function startStandardSelection() {
  composerOpen.value = false
  standardCaptureVersion++; standardMapBusy.value = false; standardMapError.value = ""
  selectionPurpose.value = "standard"
  resetSelectionScope(true)
  enterCartographyFocusMode()
  $message("双击确定框选起点，再双击确定终点；右键取消")
  mapWork.beginRectangleSelection()
}

function openChartPanel() {
  templateLayoutEditing.value = false
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  restoreWorkbench()
  chartPanelVisible.value = true
  dialogVisible.value = true
  nextTick(() => {
    ensureDemoContent()
      .then(() => renderAllCharts())
      .catch(() => $message("框选截图分析失败，请重新生成主图"))
  })
}

function showCartographyPanel() {
  chartPanelVisible.value = false
  restoreWorkbench()
  resetEditorScroll()
}

function handleSelectionCreated(event: any) {
  const anchor = event?.anchor || {}
  updateSelectionFrameBounds(event?.bounds)
  updateMapViewportBounds(event?.canvasBounds)
  const left = Number(anchor.left)
  const top = Number(anchor.top)
  selectionToolbarLeft.value = Number.isFinite(left) ? left : window.innerWidth / 2
  selectionToolbarTop.value = Number.isFinite(top) ? top : window.innerHeight - 80
  selectionToolbarVisible.value = true
  mainImageMeta.value = "已完成主图范围框选，待确认"
}

function updateSelectionFrameBounds(bounds: any) {
  const nextBounds = {
    left: Number(bounds?.left),
    top: Number(bounds?.top),
    width: Number(bounds?.width),
    height: Number(bounds?.height)
  }
  if (Object.values(nextBounds).every(Number.isFinite) && nextBounds.width > 0 && nextBounds.height > 0) {
    selectionFrameBounds.value = nextBounds
  } else {
    selectionFrameBounds.value = null
  }
}

function updateMapViewportBounds(bounds: any) {
  const nextBounds = {
    left: Number(bounds?.left),
    top: Number(bounds?.top),
    width: Number(bounds?.width),
    height: Number(bounds?.height)
  }
  if (Object.values(nextBounds).every(Number.isFinite) && nextBounds.width > 0 && nextBounds.height > 0) {
    mapViewportBounds.value = nextBounds
  }
}

function handleSelectionBoundsChanged(event: any) {
  updateSelectionFrameBounds(event?.bounds)
  updateMapViewportBounds(event?.canvasBounds)
  const anchor = event?.anchor || {}
  const left = Number(anchor.left)
  const top = Number(anchor.top)
  selectionToolbarLeft.value = Number.isFinite(left) ? left : selectionToolbarLeft.value
  selectionToolbarTop.value = Number.isFinite(top) ? top : selectionToolbarTop.value
}

function handleSelectionHint() {
  mainImageMeta.value = "已记录矩形起点，请再次双击确定终点"
}

async function handleSelectionConfirmed(event: any) {
  if (selectionPurpose.value === "standard") {
    selectionToolbarVisible.value = false
    const pending = captureStandardPreview(true); const revision = standardCaptureVersion
    await pending
    if (revision === standardCaptureVersion && dialogVisible.value && workbenchMode.value === "standard") {
      mapWork.endCartographySession(); resetSelectionScope(true); restoreWorkbench()
    }
    return
  }
  const session = selectionSession
  const rectangle = mapWork.getLockedSelection()
  if (!rectangle) {
    $message("制图范围锁定失败，请重新框选")
    startChartSelectionFlow()
    return
  }
  lockedSelection.value = rectangle
  selectionScopeLocked.value = true
  updateSelectionFrameBounds(event?.bounds)
  updateMapViewportBounds(event?.canvasBounds)
  const west = rectangle.west.toFixed(4)
  const south = rectangle.south.toFixed(4)
  const east = rectangle.east.toFixed(4)
  const north = rectangle.north.toFixed(4)
  selectionAreaText.value = `框选范围：西${west} / 南${south} / 东${east} / 北${north}`
  mainImageMeta.value = selectionAreaText.value
  selectionToolbarVisible.value = false
  try {
    await captureLockedMainImage()
  } catch {
    $message("框选区主图生成失败，请重新生成")
  } finally {
    if (session === selectionSession && dialogVisible.value) {
    if (selectionPurpose.value === "template") {
      chartPanelVisible.value = false
      activeTab.value = "editor"
      restoreWorkbench()
      resetEditorScroll()
    } else { openChartPanel() }
    }
  }
}

function handleSelectionCanceled() {
  resetSelectionScope(true)
  if (dialogVisible.value) { restoreWorkbench() }
}

function confirmRectangleSelection() {
  mapWork.confirmRectangleSelection()
}

function redrawRectangleSelection() {
  selectionToolbarVisible.value = false
  selectionScopeLocked.value = false
  lockedSelection.value = null
  selectionFrameBounds.value = null
  mainImageMeta.value = "已取消当前框选，请重新绘制主图范围"
  mapWork.redrawRectangleSelection()
}

async function ensureDemoContent() {
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    return
  }
  if (!mainImageBlob) {
    await captureLockedMainImage()
  }
  if (screenshotAnalysis.value && chartList.value.length === 0) {
    addChart(chartTypeOptions[0]?.value || DEFAULT_CHART_TYPE)
  }
}

function getSelectedGridSize() {
  const [columns, rows] = selectedGridPreset.value.split("x").map(Number)
  return {
    columns: Number.isFinite(columns) && columns > 0 ? columns : 6,
    rows: Number.isFinite(rows) && rows > 0 ? rows : 4
  }
}

async function readScreenshotPixels(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error("Screenshot canvas is unavailable")
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function imageDataToDataUrl(imageData: ImageData) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Temporal preview canvas is unavailable")
  }
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL("image/png")
}

function getSignalResultDetail(operation: SignalOperation, summary: SignalSummary) {
  if (operation === "fourier") { return `主周期约 ${summary.dominantPeriod} 像元 · 高频能量 ${(summary.highFrequencyRatio * 100).toFixed(1)}%` }
  if (operation === "wavelet") { return `${signalWaveletLevel.value} 级 Haar · 细节能量 ${(summary.detailEnergyRatio * 100).toFixed(1)}%` }
  if (operation === "filter") { return `估计噪声下降 ${(summary.noiseReduction * 100).toFixed(1)}% · 增益 ${summary.estimatedSnrGainDb} dB` }
  return `边缘 ${summary.edgePixelCount.toLocaleString()} 像元 · 密度 ${(summary.edgeDensity * 100).toFixed(1)}%`
}

function getSignalMetricItems() {
  const summary = signalResult.value?.summary
  if (!summary) { return [] }
  if (signalResult.value?.operation === "fourier") {
    return [
      { label: "主周期", value: `${summary.dominantPeriod} px` },
      { label: "高频能量", value: `${(summary.highFrequencyRatio * 100).toFixed(1)}%` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  if (signalResult.value?.operation === "wavelet") {
    return [
      { label: "细节能量", value: `${(summary.detailEnergyRatio * 100).toFixed(1)}%` },
      { label: "分解尺度", value: `${signalResult.value.waveletLevel} 级` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  if (signalResult.value?.operation === "filter") {
    return [
      { label: "噪声能量下降", value: `${(summary.noiseReduction * 100).toFixed(1)}%` },
      { label: "估计 SNR 增益", value: `${summary.estimatedSnrGainDb} dB` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  return [
    { label: "边缘密度", value: `${(summary.edgeDensity * 100).toFixed(1)}%` },
    { label: "边缘长度", value: `${summary.edgePixelCount.toLocaleString()} px` },
    { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
  ]
}

async function runSignalAnalysis(operation?: SignalOperation) {
  if (operation) { selectedSignalOperation.value = operation }
  if (signalRunning.value) { return }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!scopeKey || !rectangle) { return }
  signalRunning.value = true
  signalResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  const startedAt = performance.now()
  try {
    const blob = await mapWork.captureSelectionImage({
      targetWidth: SIGNAL_CAPTURE_WIDTH,
      targetHeight: SIGNAL_CAPTURE_HEIGHT,
      mime: "image/png",
      frameWidth: 0
    })
    if (!blob?.size) { throw new Error("Signal source capture is empty") }
    const source = await readScreenshotPixels(blob)
    const operationValue = selectedSignalOperation.value
    const result = processSignalPixels(source.data, source.width, source.height, {
      operation: operationValue,
      cutoff: signalCutoff.value,
      waveletLevel: signalWaveletLevel.value,
      waveletBand: signalWaveletBand.value,
      filter: signalFilter.value,
      filterWindow: signalFilterWindow.value,
      edgeMethod: signalEdgeMethod.value,
      edgeThreshold: signalEdgeThreshold.value
    })
    if (scopeKey !== lockedScopeKey.value || analysisWorkspaceMode.value !== "signal") { return }
    const output = new ImageData(result.pixels, source.width, source.height)
    const image = imageDataToDataUrl(output)
    if (!mapWork.renderRasterResult(image, rectangle, signalOpacity.value / 100)) { throw new Error("Signal result layer is unavailable") }
    const operator = signalOperatorOptions.find((item) => item.value === operationValue)
    signalResult.value = {
      operation: operationValue,
      waveletLevel: signalWaveletLevel.value,
      label: operator?.label || "信号处理",
      detail: getSignalResultDetail(operationValue, result.summary),
      sourceImage: imageDataToDataUrl(source),
      image,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${operator?.label || "信号处理"}完成，结果已渲染到框选范围`, "success")
  } catch {
    signalResult.value = null
    $message("信号处理失败，请确认框选区域地图已完整加载")
  } finally {
    signalRunning.value = false
  }
}

function clearSignalResult() {
  signalResult.value = null
  mapWork.clearRasterResult()
  $message("已清除信号处理结果", "success")
}

function getStatisticsResultDetail(operation: StatisticsOperation, summary: StatisticsSummary) {
  if (operation === "area") { return `${summary.rows.length} 格网 · 均值 ${summary.mean} · 标准差 ${summary.standardDeviation}` }
  if (operation === "category") { return `${summary.rows.length} 个等级 · ${summary.validPixelCount.toLocaleString()} 有效像元` }
  if (operation === "autocorrelation") { return `Moran's I ${summary.moranI.toFixed(3)} · 高高聚集 ${summary.highHighCount} 格` }
  return `平均局部密度 ${summary.meanDensity}% · 热点覆盖 ${summary.hotspotShare}%`
}

function getStatisticsMetricItems() {
  const result = statisticsResult.value
  if (!result) { return [] }
  const summary = result.summary
  if (result.operation === "area") {
    return [
      { label: "区域均值", value: summary.mean.toFixed(1) },
      { label: "标准差", value: summary.standardDeviation.toFixed(1) },
      { label: "有效格网", value: `${summary.rows.length}` }
    ]
  }
  if (result.operation === "category") {
    return [
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() },
      { label: "亮度范围", value: `${Math.round(summary.minimum)}–${Math.round(summary.maximum)}` },
      { label: "等级数量", value: `${summary.rows.length}` }
    ]
  }
  if (result.operation === "autocorrelation") {
    return [
      { label: "Moran's I", value: summary.moranI.toFixed(3) },
      { label: "高-高格网", value: `${summary.highHighCount}` },
      { label: "低-低格网", value: `${summary.lowLowCount}` }
    ]
  }
  return [
    { label: "平均密度", value: `${summary.meanDensity}%` },
    { label: "热点覆盖", value: `${summary.hotspotShare}%` },
    { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
  ]
}

function getStatisticsBarWidth(value: number) {
  const rows = statisticsResult.value?.summary.rows || []
  const maximum = Math.max(1, ...rows.map((row) => row.value))
  return Math.max(2, value / maximum * 100)
}

function formatStatisticsValue(value: number) {
  return statisticsResult.value?.operation === "area" ? value.toFixed(1) : value.toLocaleString()
}

async function runStatisticsAnalysis(operation?: StatisticsOperation) {
  if (operation) { selectedStatisticsOperation.value = operation }
  if (statisticsRunning.value) { return }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!scopeKey || !rectangle) { return }
  statisticsRunning.value = true
  statisticsResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  const startedAt = performance.now()
  try {
    const blob = await mapWork.captureSelectionImage({
      targetWidth: STATISTICS_CAPTURE_WIDTH,
      targetHeight: STATISTICS_CAPTURE_HEIGHT,
      mime: "image/png",
      frameWidth: 0
    })
    if (!blob?.size) { throw new Error("Statistics source capture is empty") }
    const source = await readScreenshotPixels(blob)
    const operationValue = selectedStatisticsOperation.value
    const [columns, rows] = statisticsGrid.value.split("x").map(Number)
    const result = processStatisticsPixels(source.data, source.width, source.height, {
      operation: operationValue,
      columns,
      rows,
      classCount: statisticsClassCount.value,
      classMethod: statisticsClassMethod.value,
      brightnessThreshold: statisticsBrightnessThreshold.value,
      densityRadius: statisticsDensityRadius.value
    })
    if (scopeKey !== lockedScopeKey.value || analysisWorkspaceMode.value !== "statistics") { return }
    const image = imageDataToDataUrl(new ImageData(result.pixels, source.width, source.height))
    if (!mapWork.renderRasterResult(image, rectangle, statisticsOpacity.value / 100)) { throw new Error("Statistics result layer is unavailable") }
    const operator = statisticsOperatorOptions.find((item) => item.value === operationValue)
    statisticsResult.value = {
      operation: operationValue,
      label: operator?.label || "统计分析",
      detail: getStatisticsResultDetail(operationValue, result.summary),
      sourceImage: imageDataToDataUrl(source),
      image,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${operator?.label || "统计分析"}完成，结果已渲染到框选范围`, "success")
  } catch {
    statisticsResult.value = null
    $message("统计分析失败，请确认框选区域地图已完整加载")
  } finally {
    statisticsRunning.value = false
  }
}

function clearStatisticsResult() {
  statisticsResult.value = null
  mapWork.clearRasterResult()
  $message("已清除统计分析结果", "success")
}

function getSpatialResultDetail(operation: SpatialOperation, summary: SpatialSummary, neighborhoodMetric: SpatialNeighborhoodMetric) {
  if (operation === "contour") { return `${summary.contourSegments.toLocaleString()} 条线段 · 总长约 ${summary.contourLength.toLocaleString()} 像元` }
  if (operation === "buffer") { return `覆盖 ${summary.coverage}% · ${summary.selectedPixelCount.toLocaleString()} 像元` }
  if (operation === "overlay") { return `结果 ${summary.selectedPixelCount.toLocaleString()} 像元 · 覆盖 ${summary.coverage}%` }
  return `${neighborhoodMetric === "mean" ? "局部亮度均值" : "局部标准差均值"} ${summary.mean} · 峰值 ${summary.maximum}`
}

function getSpatialMetricItems() {
  const result = spatialResult.value
  if (!result) { return [] }
  const summary = result.summary
  if (result.operation === "contour") {
    return [
      { label: "线段数", value: summary.contourSegments.toLocaleString() },
      { label: "总长度", value: `${summary.contourLength.toLocaleString()} px` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  if (result.operation === "neighborhood") {
    return [
      { label: result.neighborhoodMetric === "mean" ? "亮度均值" : "标准差均值", value: summary.mean.toFixed(1) },
      { label: "局部峰值", value: summary.maximum.toFixed(1) },
      { label: "高响应覆盖", value: `${summary.coverage}%` }
    ]
  }
  return [
    { label: "结果像元", value: summary.selectedPixelCount.toLocaleString() },
    { label: "范围覆盖", value: `${summary.coverage}%` },
    { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
  ]
}

function getSpatialBarWidth(value: number) {
  const rows = spatialResult.value?.summary.rows || []
  const maximum = Math.max(1, ...rows.map((row) => row.value))
  return Math.max(2, value / maximum * 100)
}

async function runSpatialAnalysis(operation?: SpatialOperation) {
  if (operation) { selectedSpatialOperation.value = operation }
  if (spatialRunning.value) { return }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!scopeKey || !rectangle) { return }
  spatialRunning.value = true
  spatialResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  const startedAt = performance.now()
  try {
    const blob = await mapWork.captureSelectionImage({
      targetWidth: SPATIAL_CAPTURE_WIDTH,
      targetHeight: SPATIAL_CAPTURE_HEIGHT,
      mime: "image/png",
      frameWidth: 0
    })
    if (!blob?.size) { throw new Error("Spatial source capture is empty") }
    const source = await readScreenshotPixels(blob)
    const operationValue = selectedSpatialOperation.value
    const neighborhoodMetric = spatialNeighborhoodMetric.value
    const result = processSpatialPixels(source.data, source.width, source.height, {
      operation: operationValue,
      threshold: spatialThreshold.value,
      radius: spatialRadius.value,
      overlayMode: spatialOverlayMode.value,
      neighborhoodMetric
    })
    if (scopeKey !== lockedScopeKey.value || analysisWorkspaceMode.value !== "spatial") { return }
    const image = imageDataToDataUrl(new ImageData(result.pixels, source.width, source.height))
    if (!mapWork.renderRasterResult(image, rectangle, spatialOpacity.value / 100)) { throw new Error("Spatial result layer is unavailable") }
    const operator = spatialOperatorOptions.find((item) => item.value === operationValue)
    spatialResult.value = {
      operation: operationValue,
      neighborhoodMetric,
      label: operator?.label || "空间分析",
      detail: getSpatialResultDetail(operationValue, result.summary, neighborhoodMetric),
      sourceImage: imageDataToDataUrl(source),
      image,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${operator?.label || "空间分析"}完成，结果已渲染到框选范围`, "success")
  } catch {
    spatialResult.value = null
    $message("空间分析失败，请确认框选区域地图已完整加载")
  } finally {
    spatialRunning.value = false
  }
}

function clearSpatialResult() {
  spatialResult.value = null
  mapWork.clearRasterResult()
  $message("已清除空间分析结果", "success")
}

function getBackgroundMetricItems() {
  const result = backgroundResult.value
  if (!result) { return [] }
  const summary = result.summary
  let primary = { label: "平均差值", value: summary.meanDifference.toFixed(2) }
  if (result.operation === "ratio") { primary = { label: "平均比值", value: summary.meanRatio.toFixed(3) } }
  if (result.operation === "normalization") { primary = { label: "平均标准化差", value: summary.meanZ.toFixed(2) } }
  if (result.operation === "denoise") { primary = { label: "抑制残差", value: summary.suppressedResidual.toFixed(2) } }
  return [primary, { label: "有效像元", value: summary.validPixelCount.toLocaleString() }, { label: "基准离散度", value: summary.baselineDeviation.toFixed(1) }]
}

function getBackgroundBarWidth(value: number) {
  const maximum = Math.max(1, ...(backgroundResult.value?.summary.rows || []).map((row) => row.value))
  return Math.max(2, value / maximum * 100)
}

async function captureBackgroundBaseline() {
  const scopeKey = lockedScopeKey.value
  if (!selectionScopeLocked.value || !scopeKey || !mapWork.getLockedSelection() || backgroundCapturing.value) {
    $message("请先框选并锁定制图范围")
    return
  }
  backgroundCapturing.value = true
  backgroundResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  try {
    const blob = await mapWork.captureSelectionImage({ targetWidth: BACKGROUND_CAPTURE_WIDTH, fitAspect: true, mime: "image/png", frameWidth: 0 })
    if (!blob?.size) { throw new Error("Empty baseline capture") }
    const source = await readScreenshotPixels(blob)
    if (scopeKey !== lockedScopeKey.value) { return }
    backgroundBaseline.value = { pixels: new Uint8ClampedArray(source.data), width: source.width, height: source.height, image: imageDataToDataUrl(source), scopeKey }
    $message("基准影像已采集；切换图层或时间后执行运算", "success")
  } catch {
    backgroundBaseline.value = null
    $message("基准采集失败，请确认地图影像已加载")
  } finally {
    backgroundCapturing.value = false
  }
}

async function runBackgroundAnalysis(operation?: BackgroundOperation) {
  if (operation) { selectedBackgroundOperation.value = operation }
  const scopeKey = lockedScopeKey.value
  const baseline = backgroundBaseline.value
  const rectangle = mapWork.getLockedSelection()
  if (!baseline || !rectangle || !scopeKey || baseline.scopeKey !== scopeKey) {
    $message("请先在当前锁定范围采集基准影像")
    return
  }
  if (backgroundRunning.value || backgroundCapturing.value) { return }
  backgroundRunning.value = true
  backgroundResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  const startedAt = performance.now()
  try {
    const blob = await mapWork.captureSelectionImage({ targetWidth: BACKGROUND_CAPTURE_WIDTH, fitAspect: true, mime: "image/png", frameWidth: 0 })
    if (!blob?.size) { throw new Error("Empty current capture") }
    const source = await readScreenshotPixels(blob)
    if (source.width !== baseline.width || source.height !== baseline.height) { throw new Error("Capture dimensions changed") }
    const operationValue = selectedBackgroundOperation.value
    const result = processBackgroundPixels(source.data, baseline.pixels, source.width, source.height, {
      operation: operationValue, denoiseWindow: backgroundDenoiseWindow.value, sensitivity: backgroundSensitivity.value / 100
    })
    if (scopeKey !== lockedScopeKey.value || analysisWorkspaceMode.value !== "background") { return }
    const image = imageDataToDataUrl(new ImageData(result.pixels, source.width, source.height))
    if (!mapWork.renderRasterResult(image, rectangle, backgroundOpacity.value / 100)) { throw new Error("Result layer unavailable") }
    const label = backgroundOperatorOptions.find((item) => item.value === operationValue)?.label || "背景场运算"
    backgroundResult.value = {
      operation: operationValue,
      label,
      detail: `${result.summary.validPixelCount.toLocaleString()} 有效像元 · 平均差 ${result.summary.meanDifference}`,
      baselineImage: baseline.image,
      sourceImage: imageDataToDataUrl(source),
      image,
      width: source.width,
      height: source.height,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${label}完成，结果已渲染到框选范围`, "success")
  } catch {
    backgroundResult.value = null
    $message("背景场运算失败，请确认两次影像完整且范围一致")
  } finally {
    backgroundRunning.value = false
  }
}

function clearBackgroundResult() {
  backgroundResult.value = null
  mapWork.clearRasterResult()
  $message("已清除背景场结果", "success")
}

function getNumericMetricItems() {
  const result = numericResult.value
  if (!result) { return [] }
  const summary = result.summary
  if (result.operation === "projection") {
    return [
      { label: "中心经度", value: `${summary.centerWgs84?.[0].toFixed(3) || "-"}°` },
      { label: "中心纬度", value: `${summary.centerWgs84?.[1].toFixed(3) || "-"}°` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  return [
    { label: result.operation === "vectorize" ? "矢量网格" : "选中像元", value: (result.operation === "vectorize" ? summary.featureCount : summary.selectedPixelCount).toLocaleString() },
    { label: "范围覆盖", value: `${summary.coverage}%` },
    { label: result.operation === "index" ? "指数均值" : "通道均值", value: summary.mean.toFixed(result.operation === "index" && numericIndex.value === "ngrdi" ? 3 : 1) }
  ]
}

function getNumericBarWidth(value: number) {
  const maximum = Math.max(1, ...(numericResult.value?.summary.rows || []).map((row) => row.value))
  return Math.max(2, value / maximum * 100)
}

async function runNumericTransform(operation?: NumericOperation) {
  if (operation) { selectedNumericOperation.value = operation }
  if (numericRunning.value) { return }
  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!selectionScopeLocked.value || !scopeKey || !rectangle) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  numericRunning.value = true
  numericResult.value = null
  mapWork.clearRasterResult()
  await nextTick()
  const startedAt = performance.now()
  try {
    const blob = await mapWork.captureSelectionImage({ targetWidth: NUMERIC_CAPTURE_WIDTH, fitAspect: true, mime: "image/png", frameWidth: 0 })
    if (!blob?.size) { throw new Error("Empty numeric source capture") }
    const source = await readScreenshotPixels(blob)
    const operationValue = selectedNumericOperation.value
    const result = processNumericPixels(source.data, source.width, source.height, {
      operation: operationValue,
      channel: numericChannel.value,
      threshold: numericThreshold.value,
      blockSize: numericBlockSize.value,
      index: numericIndex.value,
      bounds: rectangle
    })
    if (scopeKey !== lockedScopeKey.value || analysisWorkspaceMode.value !== "numeric") { return }
    const image = imageDataToDataUrl(new ImageData(result.pixels, source.width, source.height))
    if (!mapWork.renderRasterResult(image, rectangle, numericOpacity.value / 100)) { throw new Error("Result layer unavailable") }
    const label = numericOperatorOptions.find((item) => item.value === operationValue)?.label || "数值变换"
    let detail = `${result.summary.selectedPixelCount.toLocaleString()} 像元 · 覆盖 ${result.summary.coverage}%`
    if (operationValue === "projection") { detail = "WGS84 → EPSG:3857 · 范围坐标" }
    if (operationValue === "vectorize") { detail = `${result.summary.featureCount.toLocaleString()} 个网格面 · 像素坐标 SVG` }
    numericResult.value = {
      operation: operationValue,
      label,
      detail,
      sourceImage: imageDataToDataUrl(source),
      image,
      width: source.width,
      height: source.height,
      svg: result.svg,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${label}完成，结果已渲染到框选范围`, "success")
  } catch {
    numericResult.value = null
    $message("数值变换失败，请确认框选区域地图已完整加载")
  } finally {
    numericRunning.value = false
  }
}

function downloadNumericVector() {
  const svg = numericResult.value?.svg
  if (!svg) { return }
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
  downloadDataUrl("pixel-grid-vector.svg", url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function clearNumericResult() {
  numericResult.value = null
  mapWork.clearRasterResult()
  $message("已清除数值变换结果", "success")
}

function getEarthquakeBarWidth(value: number) {
  const maximum = Math.max(1, ...earthquakeFilteredRows.value.map((row) => row.value))
  return Math.max(2, value / maximum * 100)
}

function resetEarthquakeFilters() {
  earthquakeFilterMin.value = null
  earthquakeFilterMax.value = null
  earthquakeFilterBand.value = "all"
  earthquakeSpatialFilterMode.value = "scope"
  const rectangle = mapWork.getLockedSelection()
  earthquakeFilterWest.value = rectangle?.west ?? null
  earthquakeFilterSouth.value = rectangle?.south ?? null
  earthquakeFilterEast.value = rectangle?.east ?? null
  earthquakeFilterNorth.value = rectangle?.north ?? null
}

function handleEarthquakeSymbolPlaced(event: any) {
  const binding = event?.binding as TemplateIconBinding | undefined
  const point = event?.point
  const id = String(event?.id || "")
  if (!binding || !id || !point) { return }
  earthquakeSymbolRows.value.push({ id, kind: binding.kind as CartographySymbolKind, label: binding.label, lon: point.lng, lat: point.lat, style: { ...earthquakeSymbolStyle } })
  pendingEarthquakeSymbolKind.value = null
  selectedEarthquakeSymbolId.value = id
  $message(`${binding.label}已放置，可拖动位置或双击删除`, "success")
}

function handleEarthquakeSymbolSelected(event: any) {
  const row = earthquakeSymbolRows.value.find((item) => item.id === event?.id)
  if (!row) { return }
  cancelEarthquakeSymbolPlacement()
  selectedEarthquakeSymbolId.value = row.id
  symbolFamily.value = cartographySymbolDefinitions[row.kind].family
  Object.assign(earthquakeSymbolStyle, row.style)
  earthquakeOutputView.value = "symbols"
}

function handleEarthquakeSymbolMoved(event: any) {
  const row = earthquakeSymbolRows.value.find((item) => item.id === event?.id)
  if (row && event?.point) { row.lon = event.point.lng; row.lat = event.point.lat }
}

function handleEarthquakeSymbolRemoved(event: any) {
  earthquakeSymbolRows.value = earthquakeSymbolRows.value.filter((item) => item.id !== event?.id)
  if (selectedEarthquakeSymbolId.value === event?.id) { selectedEarthquakeSymbolId.value = null }
}

function handleEarthquakeSymbolsCleared() {
  earthquakeSymbolRows.value = []
  selectedEarthquakeSymbolId.value = null
  pendingEarthquakeSymbolKind.value = null
}

function handleEarthquakeSymbolPlacementRejected() {
  pendingEarthquakeSymbolKind.value = null
  $message("图标只能放在已锁定的框选范围内")
}

function beginEarthquakeSymbolPlacement(kind: CartographySymbolKind) {
  const binding = cartographySymbolDefinitions[kind]
  if (composerOpen.value && composerRef.value) {
    cancelEarthquakeSymbolPlacement()
    composerRef.value.addSymbol(kind, { ...earthquakeSymbolStyle, color: binding.accent })
    return
  }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) { $message("请先锁定制图范围"); return }
  if (selectedEarthquakeSymbolId.value) { selectedEarthquakeSymbolId.value = null }
  earthquakeSymbolStyle.color = binding.accent
  pendingEarthquakeSymbolKind.value = kind
  if (!mapWork.beginCartographySymbolPlacement(binding, earthquakeSymbolStyle)) {
    pendingEarthquakeSymbolKind.value = null
    $message("地图图标图层尚未就绪")
  }
}

function cancelEarthquakeSymbolPlacement() {
  mapWork.cancelCartographySymbolPlacement()
  pendingEarthquakeSymbolKind.value = null
}

function selectEarthquakeSymbol(id: string) {
  handleEarthquakeSymbolSelected({ id })
}

function updateEarthquakeSymbolStyle(changes: Partial<mapWork.CartographySymbolStyle>) {
  Object.assign(earthquakeSymbolStyle, changes)
  const row = selectedEarthquakeSymbol.value
  if (!row) { return }
  row.style = { ...earthquakeSymbolStyle }
  mapWork.updateCartographySymbolStyle(row.id, row.style)
}

async function onEarthquakeFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) { return }
  earthquakeImportError.value = ""
  earthquakeDataset.value = null
  earthquakeFileName.value = ""
  earthquakeResult.value = null
  mapWork.clearEarthquakeResult()
  resetEarthquakeFilters()
  if (file.size > 5 * 1024 * 1024) {
    earthquakeImportError.value = "文件超过 5 MB，请拆分观测点后导入"
    return
  }
  try {
    const dataset = parseEarthquakeGeoJson(JSON.parse(await file.text()))
    earthquakeDataset.value = dataset
    earthquakeFileName.value = file.name
    const defaults = loadEarthquakeParameters(dataset.metadata)
    earthquakeThermalZ.value = defaults.thermalZ
    earthquakeCoherence.value = defaults.coherenceMin
    earthquakeDeformationMm.value = defaults.deformationMm
    earthquakeRiskHigh.value = defaults.riskHigh
    $message(`已导入 ${dataset.features.length} 个有来源的观测点`, "success")
  } catch (error) {
    earthquakeImportError.value = error instanceof Error ? error.message : "观测文件无法解析"
    $message(earthquakeImportError.value)
  }
}

function downloadEarthquakeTemplate() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(EARTHQUAKE_IMPORT_TEMPLATE, null, 2)], { type: "application/geo+json;charset=utf-8" }))
  downloadDataUrl("earthquake-observations-template.geojson", url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadEarthquakeResult() {
  const result = earthquakeResult.value
  const dataset = earthquakeDataset.value
  if (!result || !dataset) { return }
  const collection = {
    type: "FeatureCollection",
    metadata: {
      source: dataset.source,
      observedAt: dataset.observedAt,
      operation: result.operation,
      method: result.method,
      caution: result.caution,
      palette: result.palette,
      unit: result.unit,
      originalValidCount: result.points.length,
      filteredCount: earthquakeFilteredPoints.value.length,
      filters: { min: earthquakeFilterMin.value, max: earthquakeFilterMax.value, band: earthquakeFilterBand.value, bounds: earthquakeSpatialFilterBounds.value }
    },
    features: earthquakeFilteredPoints.value.map((point) => ({ type: "Feature", geometry: { type: "Point", coordinates: [point.lon, point.lat] }, properties: { value: point.value, label: point.label, band: point.band } }))
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json;charset=utf-8" }))
  downloadDataUrl(`earthquake-${result.operation}-observations.geojson`, url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function runEarthquakeAnalysis(operation?: EarthquakeOperation) {
  if (operation) { selectedEarthquakeOperation.value = operation }
  if (earthquakeRunning.value) { return }
  const dataset = earthquakeDataset.value
  const rectangle = mapWork.getLockedSelection()
  const scopeKey = lockedScopeKey.value
  if (!selectionScopeLocked.value || !rectangle || !scopeKey) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  if (!dataset) {
    $message("请先导入带来源和单位的地震观测 GeoJSON")
    return
  }
  earthquakeRunning.value = true
  earthquakeResult.value = null
  resetEarthquakeFilters()
  earthquakeImportError.value = ""
  mapWork.clearRasterResult()
  mapWork.clearEarthquakeResult()
  try {
    const result = analyzeEarthquakeDataset(dataset, selectedEarthquakeOperation.value, rectangle, {
      thermalZ: earthquakeThermalZ.value,
      coherenceMin: earthquakeCoherence.value,
      deformationMm: earthquakeDeformationMm.value,
      riskHigh: earthquakeRiskHigh.value
    })
    if (scopeKey !== lockedScopeKey.value) { return }
    mapWork.setDisplayMetadata({ name: earthquakeOperatorLabel.value, source: dataset.source, time: dataset.observedAt, unit: result.unit, businessPalette: result.palette })
    if (!mapWork.renderEarthquakePoints(result.points, rectangle)) { throw new Error("地图观测点图层不可用") }
    earthquakeResult.value = result
    $message(`${earthquakeOperatorLabel.value}完成：${result.points.length} 个有效点已落图`, "success")
  } catch (error) {
    earthquakeImportError.value = error instanceof Error ? error.message : "地震专题分析失败"
    $message(earthquakeImportError.value)
  } finally {
    earthquakeRunning.value = false
  }
}

function clearEarthquakeResult() {
  earthquakeResult.value = null
  mapWork.clearEarthquakeResult()
  $message("已清除地震专题结果", "success")
}

function formatTemporalFrameLabel(timestamp: string, index: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return `T${index + 1}`
  }
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}

function setAnalysisWorkspaceMode(mode: AnalysisWorkspaceMode) {
  if (analysisWorkspaceMode.value === mode) {
    return
  }
  analysisWorkspaceMode.value = mode
  mapWork.clearRasterResult()
  mapWork.clearEarthquakeResult()
  const rectangle = mapWork.getLockedSelection()
  if (mode === "earthquake") {
    if (rectangle && earthquakeResult.value && lockedScopeKey.value) { mapWork.renderEarthquakePoints(earthquakeFilteredPoints.value, rectangle) }
    return
  }
  let result: RasterResultView | TemporalResultView | SignalResultView | StatisticsResultView | SpatialResultView | BackgroundResultView | NumericResultView | null
  let opacity: number
  if (mode === "raster") {
    result = rasterResult.value
    opacity = rasterOpacity.value
  } else if (mode === "temporal") {
    result = temporalResult.value
    opacity = temporalOpacity.value
  } else if (mode === "signal") {
    result = signalResult.value
    opacity = signalOpacity.value
  } else if (mode === "statistics") {
    result = statisticsResult.value
    opacity = statisticsOpacity.value
  } else if (mode === "background") {
    result = backgroundResult.value
    opacity = backgroundOpacity.value
  } else if (mode === "numeric") {
    result = numericResult.value
    opacity = numericOpacity.value
  } else {
    result = spatialResult.value
    opacity = spatialOpacity.value
  }
  if (rectangle && result?.scopeKey === lockedScopeKey.value) {
    mapWork.renderRasterResult(result.image, rectangle, opacity / 100)
  }
}

function onAnalysisModeChange(value: string) {
  setAnalysisWorkspaceMode(value as AnalysisWorkspaceMode)
}

async function captureTemporalFrame(showMessage = true) {
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  if (temporalFrames.value.length >= MAX_TEMPORAL_FRAMES) {
    $message(`最多采集 ${MAX_TEMPORAL_FRAMES} 期，请先移除不需要的帧`)
    return
  }

  temporalCapturing.value = true
  mapWork.clearRasterResult()
  try {
    const blob = await mapWork.captureSelectionImage({
      targetWidth: TEMPORAL_CAPTURE_WIDTH,
      targetHeight: TEMPORAL_CAPTURE_HEIGHT,
      mime: "image/png",
      frameWidth: 0
    })
    if (!blob || blob.size === 0) {
      throw new Error("Temporal frame capture is empty")
    }
    const imageData = await readScreenshotPixels(blob)
    const timestamp = timelineCurrentTime.value || new Date().toISOString()
    const existingIndex = timelineCurrentTime.value
      ? temporalFrames.value.findIndex((frame) => frame.timestamp === timestamp)
      : -1
    const frame: TemporalFrameSnapshot = {
      id: existingIndex >= 0 ? temporalFrames.value[existingIndex].id : `temporal_${Date.now()}_${temporalFrames.value.length}`,
      image: imageDataToDataUrl(imageData),
      pixels: new Uint8ClampedArray(imageData.data),
      width: imageData.width,
      height: imageData.height,
      label: formatTemporalFrameLabel(timestamp, existingIndex >= 0 ? existingIndex : temporalFrames.value.length),
      timestamp
    }
    if (existingIndex >= 0) {
      temporalFrames.value.splice(existingIndex, 1, frame)
    } else {
      temporalFrames.value.push(frame)
    }
    temporalResult.value = null
    if (showMessage) {
      $message(existingIndex >= 0 ? "已更新当前时相" : `已采集第 ${temporalFrames.value.length} 期`, "success")
    }
  } catch {
    $message("当前时相采集失败，请保持地图稳定后重试")
  } finally {
    temporalCapturing.value = false
  }
}

function removeTemporalFrame(id: string) {
  temporalFrames.value = temporalFrames.value.filter((frame) => frame.id !== id)
  temporalResult.value = null
  mapWork.clearRasterResult()
}

function clearTemporalFrames() {
  temporalFrames.value = []
  temporalResult.value = null
  mapWork.clearRasterResult()
  $message("已清空时序帧", "success")
}

function clearTemporalResult() {
  temporalResult.value = null
  mapWork.clearRasterResult()
  $message("已清除时序分析结果", "success")
}

function getTemporalResultDetail(operation: TemporalOperation, summary: TemporalAnalysisSummary) {
  if (operation === "difference") {
    return `均值变化 ${summary.meanDelta > 0 ? "+" : ""}${summary.meanDelta} · 变化区 ${(summary.changedRatio * 100).toFixed(1)}%`
  }
  if (operation === "statistics") {
    return `平均方差 ${summary.meanVariance} · 值域 ${summary.minimum}–${summary.maximum}`
  }
  if (operation === "trend") {
    return `平均斜率 ${summary.meanSlope > 0 ? "+" : ""}${summary.meanSlope} · R² ${summary.meanR2}`
  }
  return `异常区 ${(summary.anomalyRatio * 100).toFixed(1)}% · 阈值 |Z| ≥ ${temporalAnomalyThreshold.value.toFixed(1)}`
}

function getTemporalMetricItems() {
  const summary = temporalResult.value?.summary
  if (!summary) {
    return []
  }
  if (summary.operation === "difference") {
    return [
      { label: "区域均值变化", value: `${summary.meanDelta > 0 ? "+" : ""}${summary.meanDelta}` },
      { label: "显著变化区", value: `${(summary.changedRatio * 100).toFixed(1)}%` },
      { label: "有效像元", value: summary.validPixelCount.toLocaleString() }
    ]
  }
  if (summary.operation === "statistics") {
    return [
      { label: "平均方差", value: summary.meanVariance.toFixed(2) },
      { label: "序列值域", value: `${summary.minimum}–${summary.maximum}` },
      { label: "观测期数", value: `${summary.frameCount} 期` }
    ]
  }
  if (summary.operation === "trend") {
    return [
      { label: "平均斜率", value: `${summary.meanSlope > 0 ? "+" : ""}${summary.meanSlope}` },
      { label: "平均拟合度", value: summary.meanR2.toFixed(2) },
      { label: "观测期数", value: `${summary.frameCount} 期` }
    ]
  }
  return [
    { label: "异常区域", value: `${(summary.anomalyRatio * 100).toFixed(1)}%` },
    { label: "最新期偏离", value: `${summary.meanDelta > 0 ? "+" : ""}${summary.meanDelta}` },
    { label: "检测阈值", value: `|Z| ≥ ${temporalAnomalyThreshold.value.toFixed(1)}` }
  ]
}

async function runTemporalAnalysis(operation?: TemporalOperation) {
  if (operation) {
    selectedTemporalOperation.value = operation
  }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  if (temporalFrames.value.length < 2) {
    $message("至少采集两个时相后才能执行时序分析")
    return
  }

  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!scopeKey || !rectangle) {
    return
  }
  temporalRunning.value = true
  mapWork.clearRasterResult()
  const startedAt = performance.now()
  try {
    const operationValue = selectedTemporalOperation.value
    const result = processTemporalFrames(temporalFrames.value, {
      operation: operationValue,
      differenceMode: temporalDifferenceMode.value,
      statisticMode: temporalStatisticMode.value,
      minimumR2: temporalMinimumR2.value / 100,
      anomalyThreshold: temporalAnomalyThreshold.value,
      opacity: temporalOpacity.value
    })
    if (scopeKey !== lockedScopeKey.value) {
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = temporalFrames.value[0].width
    canvas.height = temporalFrames.value[0].height
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Temporal result canvas is unavailable")
    }
    const output = context.createImageData(canvas.width, canvas.height)
    output.data.set(result.pixels)
    context.putImageData(output, 0, 0)
    const image = canvas.toDataURL("image/png")
    const operator = temporalOperatorOptions.find((item) => item.value === operationValue)
    if (!mapWork.renderRasterResult(image, rectangle, temporalOpacity.value / 100)) {
      throw new Error("Temporal result layer is unavailable")
    }
    temporalResult.value = {
      operation: operationValue,
      label: operator?.label || "时序分析",
      detail: getTemporalResultDetail(operationValue, result.summary),
      image,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${operator?.label || "时序分析"}完成，结果已渲染到框选范围`, "success")
  } catch {
    temporalResult.value = null
    $message("时序分析失败，请检查各期地图是否完整加载")
  } finally {
    temporalRunning.value = false
  }
}

function getRasterResultDetail(operation: RasterOperation, summary: RasterAnalysisSummary) {
  if (operation === "classified") {
    return `${rasterClassCount.value} 级 · 断点 ${summary.breaks.join(" / ")}`
  }
  if (operation === "threshold") {
    return `有效像元 ${summary.validPixelCount.toLocaleString()} · 覆盖 ${(summary.validRatio * 100).toFixed(1)}%`
  }
  if (operation === "mosaic") {
    return `${rasterMosaicSize.value} × ${rasterMosaicSize.value} 像元 · 框内镶嵌`
  }
  return `值域 ${summary.minimum}–${summary.maximum} · 均值 ${summary.mean}`
}

async function runRasterCalculation(operation?: RasterOperation) {
  if (operation) {
    selectedRasterOperation.value = operation
  }
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }

  const scopeKey = lockedScopeKey.value
  const rectangle = mapWork.getLockedSelection()
  if (!rectangle || !scopeKey) {
    return
  }

  rasterRunning.value = true
  mapWork.clearRasterResult()
  const startedAt = performance.now()
  try {
    const sourceBlob = await mapWork.captureSelectionImage({
      mime: "image/png",
      frameWidth: 0
    })
    if (!sourceBlob || sourceBlob.size === 0) {
      throw new Error("Raster source capture is empty")
    }
    const source = await readScreenshotPixels(sourceBlob)
    const operationValue = selectedRasterOperation.value
    const result = processRasterPixels(source.data, source.width, source.height, {
      operation: operationValue,
      algebraMode: rasterAlgebraMode.value,
      gamma: rasterGamma.value,
      classCount: rasterClassCount.value,
      classMethod: rasterClassMethod.value,
      thresholdMin: rasterThresholdRange.value[0],
      thresholdMax: rasterThresholdRange.value[1],
      mosaicSize: rasterMosaicSize.value,
      opacity: rasterOpacity.value
    })

    if (scopeKey !== lockedScopeKey.value) {
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Raster result canvas is unavailable")
    }
    const output = context.createImageData(source.width, source.height)
    output.data.set(result.pixels)
    context.putImageData(output, 0, 0)
    const image = canvas.toDataURL("image/png")
    const operator = rasterOperatorOptions.find((item) => item.value === operationValue)
    const rendered = mapWork.renderRasterResult(image, rectangle, rasterOpacity.value / 100)
    if (!rendered) {
      throw new Error("Raster result layer is unavailable")
    }
    rasterResult.value = {
      operation: operationValue,
      label: operator?.label || "栅格计算",
      detail: getRasterResultDetail(operationValue, result.summary),
      image,
      elapsed: Math.max(1, Math.round(performance.now() - startedAt)),
      scopeKey,
      summary: result.summary
    }
    $message(`${operator?.label || "栅格计算"}完成，结果已渲染到地图`, "success")
  } catch {
    rasterResult.value = null
    $message("栅格计算失败，请重新框选后再试")
  } finally {
    rasterRunning.value = false
  }
}

function clearRasterCalculation() {
  mapWork.clearRasterResult()
  rasterResult.value = null
  $message("已清除栅格计算结果", "success")
}

async function analyzeCurrentScreenshot(showMessage = false) {
  if (!mainImageBlob || !lockedScopeKey.value) {
    throw new Error("Screenshot is unavailable")
  }
  const scopeKey = lockedScopeKey.value
  const { columns, rows } = getSelectedGridSize()
  analysisRunning.value = true
  try {
    const imageData = await readScreenshotPixels(mainImageBlob)
    const result = analyzeScreenshotPixels(imageData, {
      metric: selectedAnalysisMetric.value,
      sampleStep: selectedSampleStep.value,
      gridColumns: columns,
      gridRows: rows,
      inset: mapWork.SELECTION_FRAME_WIDTH,
      profileSegments: 8
    })
    if (scopeKey !== lockedScopeKey.value) {
      return
    }
    screenshotAnalysis.value = {
      ...result,
      scopeKey,
      analyzedAt: Date.now()
    }
    await nextTick()
    renderAllCharts()
    if (showMessage) {
      $message(`截图运算完成，共分析 ${result.sampledPixels.toLocaleString()} 个像素`, "success")
    }
  } finally {
    analysisRunning.value = false
  }
}

async function runScreenshotAnalysis() {
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  try {
    if (!mainImageBlob) {
      await captureLockedMainImage()
      $message("截图运算完成", "success")
      return
    }
    await analyzeCurrentScreenshot(true)
  } catch {
    $message("截图像素运算失败，请重新生成主图")
  }
}

function getChartTypeLabel(type: ChartType): string {
  return chartTypeOptions.find((item) => item.value === type)?.label || type
}

function buildChartName(type: ChartType, index = 1): string {
  const label = getChartTypeLabel(type)
  return index > 1 ? `${label} ${index}` : label
}

function getBoardSlot(index: number) {
  const cols = 2
  const col = index % cols
  const row = Math.floor(index / cols)
  const startY = mainImageUrl.value ? BOARD_PAD + BOARD_CARD_HEIGHT + BOARD_GAP + 84 : BOARD_PAD
  return {
    x: BOARD_PAD + col * (BOARD_CARD_WIDTH + BOARD_GAP),
    y: startY + row * (BOARD_CARD_HEIGHT + BOARD_GAP),
    w: BOARD_CARD_WIDTH,
    h: BOARD_CARD_HEIGHT
  }
}

function getChartItemMeta(item: ChartListItem) {
  const template = chartTypeOptions.find((option) => option.value === item.type)
  const metric = analysisMetricOptions.find((option) => option.value === screenshotAnalysis.value?.metric)
  const pixels = screenshotAnalysis.value?.sampledPixels.toLocaleString() || "0"
  return `${template?.scene || "截图分析"} · ${metric?.label || "待运算"} · ${pixels} 像素`
}

function getSelectionScopeKey(rectangle: LockedSelection | null): string {
  if (!rectangle) {
    return ""
  }
  return [rectangle.west, rectangle.south, rectangle.east, rectangle.north]
    .map((value) => Number(value).toFixed(6))
    .join(":")
}

function clearScopedOutputs() {
  clearChartPanelState()
  mapWork.clearCartographySymbols()
  mapWork.clearRasterResult()
  mapWork.clearEarthquakeResult()
  rasterResult.value = null
  rasterRunning.value = false
  signalResult.value = null
  signalRunning.value = false
  statisticsResult.value = null
  statisticsRunning.value = false
  spatialResult.value = null
  spatialRunning.value = false
  backgroundBaseline.value = null
  backgroundResult.value = null
  backgroundCapturing.value = false
  backgroundRunning.value = false
  numericResult.value = null
  numericRunning.value = false
  earthquakeResult.value = null
  earthquakeRunning.value = false
  temporalFrames.value = []
  temporalResult.value = null
  temporalRunning.value = false
  temporalCapturing.value = false
  timelineCurrentTime.value = ""
  if (mainImageUrl.value) {
    URL.revokeObjectURL(mainImageUrl.value)
  }
  mainImageBlob = null
  screenshotAnalysis.value = null
  analysisRunning.value = false
  mainImageUrl.value = ""
  mainImageMeta.value = "未生成主图"
}

function resetSelectionScope(clearOutputs = false) {
  selectionToolbarVisible.value = false
  selectionScopeLocked.value = false
  lockedSelection.value = null
  selectionFrameBounds.value = null
  selectionAreaText.value = "未框选区域"
  if (clearOutputs) {
    clearScopedOutputs()
  }
}

function layoutChartsOnBoard() {
  chartList.value.forEach((item, index) => {
    const slot = getBoardSlot(index)
    item.x = slot.x
    item.y = slot.y
    item.w = slot.w
    item.h = slot.h
  })
}

function getBoardCardStyle(item: ChartListItem) {
  return {
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${item.w}px`,
    height: `${item.h}px`
  }
}

function clampBoardScale(value: number) {
  return Math.min(BOARD_SCALE_MAX, Math.max(BOARD_SCALE_MIN, Number(value.toFixed(2))))
}

function setBoardScale(value: number) {
  boardScale.value = clampBoardScale(value)
  nextTick(() => {
    renderAllCharts()
  })
}

function zoomBoardIn() {
  setBoardScale(boardScale.value + BOARD_SCALE_STEP)
}

function zoomBoardOut() {
  setBoardScale(boardScale.value - BOARD_SCALE_STEP)
}

function resetBoardZoom() {
  setBoardScale(1)
}

function onBoardWheel(event: WheelEvent) {
  const delta = event.deltaY > 0 ? -BOARD_SCALE_STEP : BOARD_SCALE_STEP
  setBoardScale(boardScale.value + delta)
}

function toggleBoardMode() {
  if (!mainImageUrl.value || !selectionScopeLocked.value) {
    $message("请先锁定范围并生成主图")
    return
  }
  composerMetrics.value = mapWork.getMapAdornmentMetrics()
  composerOpen.value = true
}

function getComposerChartOption(type: string): echarts.EChartsOption {
  const analysis = screenshotAnalysis.value
  return analysis && analysis.scopeKey === lockedScopeKey.value
    ? getAnalysisChartOption(type as ChartType, analysis, true)
    : getBlankChartOption(type as ChartType)
}

function startBoardPan(event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest(".chart-board-card, .chart-list-item-remove, .chart-name-select, .ant-select, .chart-board-handle")) {
    return
  }

  const viewport = boardViewportRef.value
  if (!viewport) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const originLeft = viewport.scrollLeft
  const originTop = viewport.scrollTop
  isBoardPanning.value = true

  const onMove = (moveEvent: MouseEvent) => {
    viewport.scrollLeft = originLeft - (moveEvent.clientX - startX)
    viewport.scrollTop = originTop - (moveEvent.clientY - startY)
  }

  const onUp = () => {
    isBoardPanning.value = false
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function isCornerHandle(handle: BoardResizeHandle) {
  return handle === "nw" || handle === "ne" || handle === "se" || handle === "sw"
}

function clampBoardRect(rect: BoardRect): BoardRect {
  const w = Math.max(BOARD_CARD_MIN_WIDTH, Math.min(BOARD_CARD_MAX_WIDTH, boardWidth.value - BOARD_PAD * 2, rect.w))
  const h = Math.max(BOARD_CARD_MIN_HEIGHT, Math.min(BOARD_CARD_MAX_HEIGHT, boardHeight.value - BOARD_PAD * 2, rect.h))
  const x = Math.max(BOARD_PAD, Math.min(boardWidth.value - BOARD_PAD - w, rect.x))
  const y = Math.max(BOARD_PAD, Math.min(boardHeight.value - BOARD_PAD - h, rect.y))
  return { x, y, w, h }
}

function snapBoardValue(value: number, targets: number[], threshold = BOARD_SNAP_THRESHOLD / boardScale.value) {
  let bestAbs = threshold + 1
  let snapped = value
  targets.forEach((target) => {
    const delta = target - value
    const abs = Math.abs(delta)
    if (abs <= threshold && abs < bestAbs) {
      bestAbs = abs
      snapped = target
    }
  })
  return snapped
}

function collectEdgeTargets(excludeId: string) {
  const lefts: number[] = [BOARD_PAD]
  const rights: number[] = [boardWidth.value - BOARD_PAD]
  const tops: number[] = [BOARD_PAD]
  const bottoms: number[] = [boardHeight.value - BOARD_PAD]
  if (mainImageUrl.value) {
    const right = BOARD_PAD + Math.min(BOARD_CARD_WIDTH * 2 + BOARD_GAP, boardWidth.value - BOARD_PAD * 2)
    lefts.push(BOARD_PAD, right); rights.push(BOARD_PAD, right)
    tops.push(BOARD_PAD, BOARD_PAD + BOARD_CARD_HEIGHT + 68); bottoms.push(BOARD_PAD, BOARD_PAD + BOARD_CARD_HEIGHT + 68)
  }

  chartList.value.forEach((other) => {
    if (other.id === excludeId) {
      return
    }
    lefts.push(other.x, other.x + other.w)
    rights.push(other.x, other.x + other.w)
    tops.push(other.y, other.y + other.h)
    bottoms.push(other.y, other.y + other.h)
  })

  return { lefts, rights, tops, bottoms }
}

function snapBoardMoveRect(rect: BoardRect, excludeId: string): BoardRect {
  const targets = chartList.value.filter(item => item.id !== excludeId).map(item => ({ x: item.x, y: item.y, w: item.w, h: item.h }))
  if (mainImageUrl.value) { targets.push({ x: BOARD_PAD, y: BOARD_PAD, w: Math.min(BOARD_CARD_WIDTH * 2 + BOARD_GAP, boardWidth.value - BOARD_PAD * 2), h: BOARD_CARD_HEIGHT + 68 }) }
  return clampBoardRect(snapRect(rect, boardWidth.value, boardHeight.value, targets, BOARD_SNAP_THRESHOLD / boardScale.value, BOARD_PAD))
}

function snapBoardResizeRect(rect: BoardRect, handle: BoardResizeHandle, excludeId: string): BoardRect {
  const { lefts, rights, tops, bottoms } = collectEdgeTargets(excludeId)
  let { x, y, w, h } = rect

  if (handle.includes("w")) {
    const snappedLeft = snapBoardValue(x, lefts)
    w = Math.max(BOARD_CARD_MIN_WIDTH, w + (x - snappedLeft))
    x = snappedLeft
  }
  if (handle.includes("e")) {
    const snappedRight = snapBoardValue(x + w, rights)
    w = Math.max(BOARD_CARD_MIN_WIDTH, snappedRight - x)
  }
  if (handle.includes("n")) {
    const snappedTop = snapBoardValue(y, tops)
    h = Math.max(BOARD_CARD_MIN_HEIGHT, h + (y - snappedTop))
    y = snappedTop
  }
  if (handle.includes("s")) {
    const snappedBottom = snapBoardValue(y + h, bottoms)
    h = Math.max(BOARD_CARD_MIN_HEIGHT, snappedBottom - y)
  }

  return clampBoardRect({ x, y, w, h })
}

function applyBoardRect(item: ChartListItem, rect: BoardRect) {
  item.x = rect.x
  item.y = rect.y
  item.w = rect.w
  item.h = rect.h
}

function startBoardDrag(item: ChartListItem, event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target?.closest(".chart-list-item-remove, .chart-name-select, .ant-select, .chart-board-handle")) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const originX = item.x
  const originY = item.y
  draggingChartId.value = item.id
  isBoardPanning.value = false

  const onMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / boardScale.value
    const dy = (moveEvent.clientY - startY) / boardScale.value
    const next = snapBoardMoveRect(
      {
        x: originX + dx,
        y: originY + dy,
        w: item.w,
        h: item.h
      },
      item.id
    )
    applyBoardRect(item, next)
  }

  const onUp = () => {
    draggingChartId.value = null
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function startBoardResize(item: ChartListItem, handle: BoardResizeHandle, event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  boardDragCleanup?.()

  const startX = event.clientX
  const startY = event.clientY
  const origin: BoardRect = { x: item.x, y: item.y, w: item.w, h: item.h }
  const aspect = origin.w / Math.max(1, origin.h)
  draggingChartId.value = item.id
  isBoardPanning.value = false

  const onMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / boardScale.value
    const dy = (moveEvent.clientY - startY) / boardScale.value
    let next: BoardRect = { ...origin }

    if (isCornerHandle(handle)) {
      if (handle === "se") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w + dx
          next.h = next.w / aspect
        } else {
          next.h = origin.h + dy
          next.w = next.h * aspect
        }
      } else if (handle === "sw") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w - dx
          next.h = next.w / aspect
          next.x = origin.x + origin.w - next.w
        } else {
          next.h = origin.h + dy
          next.w = next.h * aspect
          next.x = origin.x + origin.w - next.w
        }
      } else if (handle === "ne") {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w + dx
          next.h = next.w / aspect
          next.y = origin.y + origin.h - next.h
        } else {
          next.h = origin.h - dy
          next.w = next.h * aspect
          next.y = origin.y + origin.h - next.h
        }
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          next.w = origin.w - dx
          next.h = next.w / aspect
          next.x = origin.x + origin.w - next.w
          next.y = origin.y + origin.h - next.h
        } else {
          next.h = origin.h - dy
          next.w = next.h * aspect
          next.x = origin.x + origin.w - next.w
          next.y = origin.y + origin.h - next.h
        }
      }
    } else if (handle === "e") {
      next.w = origin.w + dx
    } else if (handle === "w") {
      next.w = origin.w - dx
      next.x = origin.x + dx
    } else if (handle === "s") {
      next.h = origin.h + dy
    } else if (handle === "n") {
      next.h = origin.h - dy
      next.y = origin.y + dy
    }

    next = snapBoardResizeRect(clampBoardRect(next), handle, item.id)
    applyBoardRect(item, next)
    nextTick(() => {
      renderChartItem(item.id)
    })
  }

  const onUp = () => {
    draggingChartId.value = null
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
    boardDragCleanup = null
    nextTick(() => {
      renderChartItem(item.id)
    })
  }

  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  boardDragCleanup = onUp
}

function setBoardSize(width: number, height: number) {
  boardWidth.value = Math.max(640, Math.round(width))
  boardHeight.value = Math.max(480, Math.round(height))
  chartList.value.forEach((item) => {
    applyBoardRect(item, clampBoardRect(item))
  })
  nextTick(() => {
    renderAllCharts()
  })
}

function handleBoardSizeMenu(info: { key: string | number }) {
  const key = String(info.key)
  if (key === "1920x1080") {
    setBoardSize(1920, 1080)
    return
  }
  if (key === "1080x1080") {
    setBoardSize(1080, 1080)
    return
  }
  if (key === "custom") {
    customBoardWidth.value = boardWidth.value
    customBoardHeight.value = boardHeight.value
    showCustomBoardSize.value = true
  }
}

function applyCustomBoardSize() {
  setBoardSize(Number(customBoardWidth.value) || DEFAULT_BOARD_WIDTH, Number(customBoardHeight.value) || DEFAULT_BOARD_HEIGHT)
  showCustomBoardSize.value = false
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  link.click()
}

async function paintBoardToCanvas(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  canvas.width = boardWidth.value
  canvas.height = boardHeight.value
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return canvas
  }

  ctx.fillStyle = "#1a2330"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, BOARD_PAD)
  ctx.fillRect(0, canvas.height - BOARD_PAD, canvas.width, BOARD_PAD)
  ctx.fillRect(0, 0, BOARD_PAD, canvas.height)
  ctx.fillRect(canvas.width - BOARD_PAD, 0, BOARD_PAD, canvas.height)
  ctx.strokeStyle = "rgba(255,255,255,0.06)"
  ctx.lineWidth = 1
  for (let x = BOARD_PAD; x <= canvas.width - BOARD_PAD; x += 24) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, BOARD_PAD)
    ctx.lineTo(x + 0.5, canvas.height - BOARD_PAD)
    ctx.stroke()
  }
  for (let y = BOARD_PAD; y <= canvas.height - BOARD_PAD; y += 24) {
    ctx.beginPath()
    ctx.moveTo(BOARD_PAD, y + 0.5)
    ctx.lineTo(canvas.width - BOARD_PAD, y + 0.5)
    ctx.stroke()
  }

  const mainImage = boardViewportRef.value?.querySelector<HTMLImageElement>(".chart-board-main-image-tag")
  if (mainImage) {
    await mainImage.decode()
    const width = Math.min(BOARD_CARD_WIDTH * 2 + BOARD_GAP, boardWidth.value - BOARD_PAD * 2) - 20
    const height = BOARD_CARD_HEIGHT + 68 - 50
    const factor = Math.min(width / mainImage.naturalWidth, height / mainImage.naturalHeight)
    ctx.drawImage(mainImage, BOARD_PAD + 10 + (width - mainImage.naturalWidth * factor) / 2, BOARD_PAD + 40 + (height - mainImage.naturalHeight * factor) / 2, mainImage.naturalWidth * factor, mainImage.naturalHeight * factor)
  }

  chartList.value.forEach((item) => {
    ctx.fillStyle = "rgba(17, 22, 28, 0.92)"
    ctx.strokeStyle = "rgba(255,255,255,0.14)"
    ctx.lineWidth = 1
    ctx.beginPath()
    if (typeof (ctx as any).roundRect === "function") {
      ;(ctx as any).roundRect(item.x, item.y, item.w, item.h, 12)
    } else {
      ctx.rect(item.x, item.y, item.w, item.h)
    }
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = "rgba(255,255,255,0.78)"
    ctx.font = "12px Microsoft YaHei, sans-serif"
    ctx.fillText(item.name || getChartTypeLabel(item.type), item.x + 12, item.y + 22)

    const chartCanvasWidth = Math.max(1, item.w - BOARD_CARD_PADDING * 2)
    const chartCanvasHeight = Math.max(1, item.h - BOARD_CARD_PADDING * 2 - BOARD_CARD_HEAD_HEIGHT - BOARD_CARD_GAP)
    const chartLeft = item.x + BOARD_CARD_PADDING
    const chartTop = item.y + BOARD_CARD_PADDING + BOARD_CARD_HEAD_HEIGHT + BOARD_CARD_GAP

    const instance = chartInstanceMap.get(item.id)
    const chartCanvas = instance?.getDom()?.querySelector("canvas") as HTMLCanvasElement | null
    if (chartCanvas) {
      ctx.drawImage(chartCanvas, chartLeft, chartTop, chartCanvasWidth, chartCanvasHeight)
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.04)"
      ctx.fillRect(chartLeft, chartTop, chartCanvasWidth, chartCanvasHeight)
    }
  })

  return canvas
}

async function handleBoardDownloadMenu(info: { key: string | number }) {
  const key = String(info.key)
  let source: HTMLCanvasElement
  try { source = await paintBoardToCanvas() } catch { $message("主图尚未加载，暂不能导出"); return }

  if (key === "board") {
    downloadDataUrl(`画板_${boardWidth.value}x${boardHeight.value}_${Date.now()}.png`, source.toDataURL("image/png"))
    $message("已下载画板", "success")
    return
  }

  if (key === "view") {
    const viewport = boardViewportRef.value
    if (!viewport) {
      $message("当前视图不可用")
      return
    }

    const scale = boardScale.value || 1
    const sx = Math.max(0, Math.floor(viewport.scrollLeft / scale))
    const sy = Math.max(0, Math.floor(viewport.scrollTop / scale))
    const sw = Math.max(1, Math.min(boardWidth.value - sx, Math.ceil(viewport.clientWidth / scale)))
    const sh = Math.max(1, Math.min(boardHeight.value - sy, Math.ceil(viewport.clientHeight / scale)))

    const viewCanvas = document.createElement("canvas")
    viewCanvas.width = sw
    viewCanvas.height = sh
    const ctx = viewCanvas.getContext("2d")
    if (!ctx) {
      $message("导出失败")
      return
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
    downloadDataUrl(`当前视图_${sw}x${sh}_${Date.now()}.png`, viewCanvas.toDataURL("image/png"))
    $message("已下载当前视图", "success")
  }
}

function addChart(type?: ChartType) {
  if (!selectionScopeLocked.value || !lockedScopeKey.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    return
  }
  if (!screenshotAnalysis.value || screenshotAnalysis.value.scopeKey !== lockedScopeKey.value) {
    $message("请先运行截图算子")
    return
  }
  if (chartList.value.length >= chartTypeOptions.length) {
    $message(`最多可添加 ${chartTypeOptions.length} 个图表`)
    return
  }
  const nextType = type || chartTypeOptions.find((item) => !chartList.value.some((chart) => chart.type === item.value))?.value || DEFAULT_CHART_TYPE
  const chartType = chartTypeOptions.some((item) => item.value === nextType) ? nextType : DEFAULT_CHART_TYPE
  const sameTypeCount = chartList.value.filter((item) => item.type === chartType).length + 1
  const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const slot = clampBoardRect(getBoardSlot(chartList.value.length))
  chartList.value.push({
    id,
    type: chartType,
    name: buildChartName(chartType, sameTypeCount),
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h,
    scopeKey: lockedScopeKey.value
  })
  nextTick(() => {
    renderChartItem(id)
  })
}

async function addChartTemplate(type: ChartType) {
  const count = chartList.value.length
  addChart(type)
  if (chartList.value.length > count) { await focusCompositionChart(chartList.value[chartList.value.length - 1].id) }
}

async function captureLockedMainImage() {
  const session = selectionSession
  const scope = lockedScopeKey.value
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    throw new Error("Selection scope is not locked")
  }
  const blob = await mapWork.captureSelectionImage({
    targetWidth: 1280,
    fitAspect: true,
    mime: "image/png",
    frameWidth: 0
  })
  if (session !== selectionSession || scope !== lockedScopeKey.value || !dialogVisible.value) { return }
  if (!blob || blob.size <= 0) {
    throw new Error("Selection capture is empty")
  }
  if (mainImageUrl.value) {
    URL.revokeObjectURL(mainImageUrl.value)
  }
  mainImageBlob = blob
  mainImageUrl.value = URL.createObjectURL(blob)
  mainImageMeta.value = `${selectionAreaText.value} · 仅框选区 · ${new Date().toLocaleString()}`
  await analyzeCurrentScreenshot(false)
  await nextTick()
}

async function generateMainImageDemo() {
  if (!selectionScopeLocked.value || !mapWork.getLockedSelection()) {
    $message("请先框选并锁定制图范围")
    startChartSelectionFlow()
    return
  }
  try {
    await captureLockedMainImage()
    $message("已按锁定范围生成主图", "success")
  } catch {
    $message("框选区主图生成失败")
  }
}

function handleChartTypeChange(id: string, type: ChartType) {
  const item = chartList.value.find((entry) => entry.id === id)
  if (!item || !selectionScopeLocked.value || item.scopeKey !== lockedScopeKey.value) {
    return
  }
  item.type = type
  item.name = getChartTypeLabel(type)
  nextTick(() => {
    renderChartItem(id)
  })
}

function removeChartItem(id: string) {
  disposeChartItem(id)
  chartList.value = chartList.value.filter((item) => item.id !== id)
}

function bindChartEl(id: string, el: HTMLDivElement | null) {
  if (el) {
    chartElMap.set(id, el)
    nextTick(() => {
      renderChartItem(id)
    })
    return
  }
  disposeChartItem(id)
}

function disposeChartItem(id: string) {
  chartElMap.delete(id)
  const instance = chartInstanceMap.get(id)
  if (instance) {
    instance.dispose()
    chartInstanceMap.delete(id)
  }
}

function clearChartPanelState() {
  if (workbenchMode.value !== "standard") { composerOpen.value = false }
  boardDragCleanup?.()
  boardDragCleanup = null
  chartList.value.forEach((item) => {
    disposeChartItem(item.id)
  })
  chartList.value = []
  chartElMap.clear()
  chartInstanceMap.clear()
  chartViewMode.value = "list"
  boardScale.value = 1
  boardWidth.value = DEFAULT_BOARD_WIDTH
  boardHeight.value = DEFAULT_BOARD_HEIGHT
  isBoardPanning.value = false
  draggingChartId.value = null
  showCustomBoardSize.value = false
}

function restoreCompositionCharts(charts: Array<{ id: string; type: string; name: string }>) {
  if (!selectionScopeLocked.value || !lockedScopeKey.value) { return }
  const valid = charts.filter(chart => chartTypeOptions.some(option => option.value === chart.type)).slice(0, chartTypeOptions.length)
  for (const item of chartList.value) {
    if (!valid.some(chart => chart.id === item.id)) { disposeChartItem(item.id) }
  }
  chartList.value = valid.map((chart, index) => ({
    ...clampBoardRect(getBoardSlot(index)),
    ...chartList.value.find(item => item.id === chart.id),
    ...chart,
    type: chart.type as ChartType,
    scopeKey: lockedScopeKey.value
  }))
  nextTick(() => chartList.value.forEach(item => renderChartItem(item.id)))
}

function renderAllCharts() {
  chartList.value.forEach((item) => {
    renderChartItem(item.id)
  })
}

function getBlankChartOption(type: ChartType): echarts.EChartsOption {
  const axisStyle = {
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }
  }
  const placeholder = getChartTypeLabel(type)

  if (type === "heatmap") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: ["A", "B", "C", "D"], ...axisStyle },
      yAxis: { type: "category", data: ["1", "2", "3"], ...axisStyle },
      visualMap: {
        min: 0,
        max: 10,
        show: false,
        inRange: { color: ["#1d39c4", "#69c0ff", "#ff7875"] }
      },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "heatmap", data: [] }]
    }
  }

  if (type === "population-distribution") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: ["城区", "郊区", "农村"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "bar", data: [] }]
    }
  }

  if (type === "terrain-density") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "value", ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "scatter", symbolSize: 10, data: [] }]
    }
  }

  if (type === "contour") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: [], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "line", smooth: true, data: [] }]
    }
  }

  if (type === "trend-line") {
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: "category", data: [], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      graphic: blankGraphic(`${placeholder}（空白）`),
      series: [{ type: "line", smooth: true, data: [] }]
    }
  }

  return {
    animation: false,
    grid: { left: 48, right: 16, top: 24, bottom: 36 },
    xAxis: { type: "category", data: [], ...axisStyle },
    yAxis: { type: "value", ...axisStyle },
    graphic: blankGraphic(`${placeholder}（空白）`),
    series: [{ type: "bar", data: [] }]
  }
}

function blankGraphic(text: string): echarts.EChartsOption["graphic"] {
  return [
    {
      type: "text",
      left: "center",
      top: "middle",
      style: {
        text,
        fill: "rgba(255,255,255,0.35)",
        fontSize: 12
      }
    }
  ]
}

/*
function getDemoChartOption(type: ChartType): echarts.EChartsOption {
  const axisStyle = {
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }
  }

  if (type === "heatmap") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "地域热点强度", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 30, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["A", "B", "C", "D"], ...axisStyle },
      yAxis: { type: "category", data: ["1", "2", "3"], ...axisStyle },
      visualMap: {
        min: 0,
        max: 10,
        right: 0,
        top: "middle",
        itemWidth: 8,
        itemHeight: 70,
        textStyle: { color: "rgba(255,255,255,0.48)" },
        inRange: { color: ["#1d39c4", "#69c0ff", "#ff7875"] }
      },
      series: [{ type: "heatmap", data: [[0, 0, 3], [1, 0, 6], [2, 0, 8], [3, 0, 4], [0, 1, 5], [1, 1, 9], [2, 1, 7], [3, 1, 6], [0, 2, 2], [1, 2, 4], [2, 2, 8], [3, 2, 5]], label: { show: true, color: "#fff", fontSize: 10 } }]
    }
  }

  if (type === "population-distribution") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "区域等级对比", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["核心区", "扩展区", "外围区", "缓冲区"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "bar", data: [86, 64, 48, 31], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#7ad3ff" }, { offset: 1, color: "#2f7df6" }]) } }]
    }
  }

  if (type === "terrain-density") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "点位密度散点", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "value", ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "scatter", symbolSize: (val: number[]) => Math.max(10, val[2] / 2), itemStyle: { color: "#4dd8ff", opacity: 0.8 }, data: [[12, 28, 18], [18, 34, 26], [24, 16, 22], [30, 40, 34], [36, 26, 28], [44, 18, 20], [50, 33, 30], [58, 24, 16]] }]
    }
  }

  if (type === "contour") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "剖面等值变化", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["P1", "P2", "P3", "P4", "P5", "P6"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      series: [{ type: "line", smooth: true, areaStyle: { color: "rgba(101, 191, 255, 0.16)" }, lineStyle: { color: "#65bfff", width: 2 }, data: [18, 26, 34, 29, 42, 31] }]
    }
  }

  if (type === "trend-line") {
    return {
      animation: false,
      backgroundColor: "transparent",
      title: { text: "多期趋势追踪", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      xAxis: { type: "category", data: ["T1", "T2", "T3", "T4", "T5", "T6"], ...axisStyle },
      yAxis: { type: "value", ...axisStyle },
      legend: { top: 4, right: 8, textStyle: { color: "rgba(255,255,255,0.55)", fontSize: 10 } },
      series: [
        { type: "line", smooth: true, name: "当前", lineStyle: { color: "#49c1ff", width: 2 }, data: [32, 41, 38, 46, 58, 61] },
        { type: "line", smooth: true, name: "基线", lineStyle: { color: "#ffc857", width: 2 }, data: [26, 29, 31, 35, 39, 44] }
      ]
    }
  }

  return {
    animation: false,
    backgroundColor: "transparent",
    title: { text: "等级统计", left: 8, top: 4, textStyle: { color: "rgba(255,255,255,0.82)", fontSize: 12 } },
    grid: { left: 48, right: 16, top: 28, bottom: 36 },
    xAxis: { type: "category", data: ["I级", "II级", "III级", "IV级"], ...axisStyle },
    yAxis: { type: "value", ...axisStyle },
    series: [{ type: "bar", data: [14, 26, 18, 9], barWidth: 18, itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#ffb56b" }, { offset: 1, color: "#ff7b54" }]) } }]
  }
}
*/

function getAnalysisChartOption(type: ChartType, analysis: ScopedScreenshotAnalysis, print = false): echarts.EChartsOption {
  const isDark = !print && document.documentElement.dataset.theme === "dark"
  const textColor = isDark ? "rgba(255,255,255,0.86)" : "#25364d"
  const secondaryText = isDark ? "rgba(255,255,255,0.56)" : "#66758a"
  const axisColor = isDark ? "rgba(255,255,255,0.18)" : "#c9d3df"
  const splitColor = isDark ? "rgba(255,255,255,0.08)" : "#edf1f5"
  const metricLabel = analysisMetricOptions.find((item) => item.value === analysis.metric)?.label || "截图指标"
  const axisStyle = {
    axisLabel: { color: secondaryText, fontSize: 10 },
    axisLine: { lineStyle: { color: axisColor } },
    splitLine: { lineStyle: { color: splitColor } }
  }
  const baseOption: echarts.EChartsOption = {
    animationDuration: 280,
    backgroundColor: "transparent",
    title: { text: `${getChartTypeLabel(type)} · ${metricLabel}`, left: 8, top: 4, textStyle: { color: textColor, fontSize: 12, fontWeight: 600 } },
    tooltip: {
      trigger: "item",
      backgroundColor: isDark ? "rgba(12,24,38,0.94)" : "rgba(255,255,255,0.96)",
      borderColor: axisColor,
      textStyle: { color: textColor, fontSize: 11 }
    }
  }

  if (type === "heatmap") {
    const data = analysis.gridValues.map((value, index) => [index % analysis.gridColumns, Math.floor(index / analysis.gridColumns), value])
    return {
      ...baseOption,
      grid: { left: 42, right: 30, top: 34, bottom: 30 },
      xAxis: { type: "category", data: Array.from({ length: analysis.gridColumns }, (_, index) => `${index + 1}`), ...axisStyle },
      yAxis: { type: "category", data: Array.from({ length: analysis.gridRows }, (_, index) => `${index + 1}`), ...axisStyle },
      visualMap: {
        min: 0,
        max: 100,
        right: 0,
        top: "middle",
        itemWidth: 7,
        itemHeight: 66,
        textStyle: { color: secondaryText, fontSize: 9 },
        inRange: { color: ["#173f5f", "#2f9ed1", "#f4d35e", "#ee6352"] }
      },
      series: [{ type: "heatmap", data, label: { show: true, color: "#fff", fontSize: 9, formatter: "{@[2]}" } }]
    }
  }

  if (type === "population-distribution") {
    return {
      ...baseOption,
      color: ["#31445b", "#2f9e74", "#e8793e", "#9ac8e2", "#8d79c6"],
      legend: { bottom: 0, textStyle: { color: secondaryText, fontSize: 9 }, itemWidth: 8, itemHeight: 8 },
      series: [{
        type: "pie",
        radius: [34, 62],
        center: ["50%", "48%"],
        label: { color: textColor, fontSize: 9, formatter: "{b} {d}%" },
        data: ["暗区", "绿色", "暖色", "高亮", "其他"].map((name, index) => ({ name, value: analysis.colorDistribution[index] }))
      }]
    }
  }

  if (type === "terrain-density") {
    const scatterData = analysis.gridValues.map((value, index) => [
      index % analysis.gridColumns + 1,
      analysis.gridRows - Math.floor(index / analysis.gridColumns),
      value
    ])
    return {
      ...baseOption,
      grid: { left: 40, right: 18, top: 34, bottom: 30 },
      xAxis: { type: "value", min: 0, max: analysis.gridColumns + 1, ...axisStyle },
      yAxis: { type: "value", min: 0, max: analysis.gridRows + 1, ...axisStyle },
      visualMap: { min: 0, max: 100, show: false, inRange: { color: ["#3a86ff", "#4cc9a7", "#ffb703", "#e63946"] } },
      series: [{
        type: "scatter",
        data: scatterData,
        symbolSize: (value: number[]) => 7 + value[2] * 0.18,
        itemStyle: { opacity: 0.82 }
      }]
    }
  }

  if (type === "contour") {
    return {
      ...baseOption,
      grid: { left: 42, right: 16, top: 34, bottom: 30 },
      xAxis: { type: "category", boundaryGap: false, data: analysis.profileValues.map((_, index) => `P${index + 1}`), ...axisStyle },
      yAxis: { type: "value", min: 0, max: 100, ...axisStyle },
      series: [{
        type: "line",
        smooth: 0.35,
        data: analysis.profileValues,
        symbolSize: 5,
        lineStyle: { color: "#2389da", width: 2 },
        itemStyle: { color: "#2389da" },
        areaStyle: { color: "rgba(35,137,218,0.16)" }
      }]
    }
  }

  if (type === "trend-line") {
    return {
      ...baseOption,
      color: ["#d95d39", "#2f9e74", "#2878b5"],
      grid: { left: 42, right: 16, top: 34, bottom: 30 },
      xAxis: { type: "category", data: ["红", "绿", "蓝"], ...axisStyle },
      yAxis: { type: "value", min: 0, max: 100, ...axisStyle },
      series: [{
        type: "bar",
        data: analysis.channelMeans.map((value, index) => ({ value, itemStyle: { color: ["#d95d39", "#2f9e74", "#2878b5"][index] } })),
        barWidth: 24,
        label: { show: true, position: "top", color: textColor, fontSize: 10 }
      }]
    }
  }

  return {
    ...baseOption,
    grid: { left: 42, right: 16, top: 34, bottom: 30 },
    xAxis: { type: "category", data: ["低", "中", "较高", "高"], ...axisStyle },
    yAxis: { type: "value", min: 0, max: 100, ...axisStyle },
    series: [{
      type: "bar",
      data: analysis.levelDistribution,
      barWidth: 22,
      itemStyle: { color: (params: any) => ["#3a86ff", "#4cc9a7", "#ffb703", "#e63946"][params.dataIndex], borderRadius: [3, 3, 0, 0] },
      label: { show: true, position: "top", color: textColor, fontSize: 9, formatter: "{c}%" }
    }]
  }
}

function renderChartItem(id: string) {
  const el = chartElMap.get(id)
  const item = chartList.value.find((entry) => entry.id === id)
  if (
    !el ||
    !item ||
    !chartPanelVisible.value ||
    !selectionScopeLocked.value ||
    !mapWork.getLockedSelection() ||
    item.scopeKey !== lockedScopeKey.value
  ) {
    return
  }

  let instance = chartInstanceMap.get(id)
  if (!instance) {
    instance = echarts.init(el)
    chartInstanceMap.set(id, instance)
  }

  const analysis = screenshotAnalysis.value
  instance.setOption(analysis && analysis.scopeKey === item.scopeKey ? getAnalysisChartOption(item.type, analysis) : getBlankChartOption(item.type), true)
  instance.resize()
}

function saveDraft() {
  if (!draft.templateId) {
    $message("请先选择模板")
    return
  }
  localStorage.setItem(getDraftStorageKey(), JSON.stringify(snapshotDraft()))
  savedDraftJson.value = JSON.stringify(snapshotDraft())
  $message("专题草稿已保存", "success")
}

function resetDraft() {
  if (isDirty.value && !window.confirm("当前存在未保存修改，确认恢复到上次保存的草稿吗？")) {
    return
  }
  loadDraft()
}

function switchToPublish() {
  if (!draft.templateId) {
    $message("请先选择模板并完成编辑")
    return
  }
  activeTab.value = "publish"
}

function handleTabChange(nextKey: string) {
  const next = (nextKey || "template") as WorkbenchTab
  if (workbenchMode.value === "analysis" && activeTab.value === "editor" && next !== "editor" && isDirty.value) {
    const ok = window.confirm("编辑内容尚未保存，确认切换页签吗？")
    if (!ok) {
      return
    }
  }
  activeTab.value = next
  if (next !== "editor") { composerOpen.value = false }
  resetEditorScroll()
}

function handleFold(status: boolean) {
  isFold.value = status
}

function toggleWorkbenchFold() {
  dialogRef.value?.toggle?.()
}

function notifyPanelFront() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new CustomEvent("mars3d:widget-visible", { detail: { name: "thematic-workbench", visible: true } }))
}

function handleBeforeClose() {
  if (!isDirty.value) {
    return true
  }
  return window.confirm("当前专题制图草稿尚未保存，确认关闭并放弃修改吗？")
}

function handleClose() {
  disable("thematic-workbench")
}
</script>

<style lang="less" scoped>
.linked-chart-properties { margin-top: 6px; border-top: 1px solid #405767; padding-top: 8px; }
.linked-chart-properties summary { cursor: pointer; color: #8ed6ee; font-size: 12px; }
.linked-chart-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-top: 10px; }
.linked-chart-fields label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.linked-chart-fields input[type=number] { width: 100%; min-width: 0; padding: 4px 6px; border: 1px solid #496174; border-radius: 3px; background: #233747; color: #edf5fa; }
.linked-chart-fields .linked-chart-transparent { flex-direction: row; align-items: center; }
@media (max-width: 900px) {
  :global(.thematic-workbench-panel:not(.is-chart-docked)) {
    position: fixed !important;
    top: 86px !important;
    left: 12px !important;
    right: auto !important;
    transform: none !important;
    width: calc(100vw - 24px) !important;
    height: calc(100dvh - 108px) !important;
    min-height: 0 !important;
    min-width: 0 !important;
  }
  :global(.thematic-workbench-panel .mars-dialog__header .title) {
    min-width: 0;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.thematic-workbench-panel.is-chart-docked.has-composer) {
    position: fixed !important;
    top: 132px !important;
    left: 12px !important;
    right: auto !important;
    width: calc(100vw - 24px) !important;
    height: calc((100dvh - 168px) / 2) !important;
    min-height: 0 !important;
    min-width: 0 !important;
  }
}
:global(body:has(.thematic-workbench-panel) .cui-fab),
:global(body:has(.thematic-workbench-panel) .map-float-ball) {
  z-index: 900 !important;
}

:global(.mars-dialog-thumb:has(+ .thematic-workbench-panel)) {
  display: none !important;
}

:global(.thematic-workbench-panel.is-chart-docked) {
  width: 400px !important;
  height: 600px !important;
  --mars-text-color: #edf5fa;
  --mars-text-color-secondary: #adc2d0;
  --mars-control-text: #edf5fa;
  --mars-control-bg: #233747;
  --mars-control-border: #496174;
  --mars-control-icon: #a9c0d0;
  --text-primary: #edf5fa;
  --popup-surface: #172936;
  --dropdown-surface: #172936;
  --popup-header-bg: #1d3140;
  --popup-border: #405767;
  --panel-header-shadow: none;
  --popup-header-shadow: none;
}

:global(.thematic-workbench-panel.is-chart-docked .mars-dialog__header) {
  background: #1d3140 !important;
  color: #edf5fa !important;
}

:global(.thematic-workbench-panel.is-chart-docked .workbench-tabs .ant-tabs-tab-btn) {
  color: #d7e7ee !important;
}
:global(.thematic-workbench-panel.is-chart-docked .workbench-tabs .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #76d6ee !important;
}

:global(.thematic-workbench-panel.is-chart-docked .mars-dialog__header .title),
:global(.thematic-workbench-panel.is-chart-docked .mars-dialog__header .close-btn) {
  color: #edf5fa !important;
}

:global(.thematic-workbench-panel.is-chart-docked .mars-dialog__content) {
  background: #172936 !important;
  color: #edf5fa !important;
}

:global(.mars-dialog.mars-popup-shell.thematic-workbench-panel.is-chart-docked .ant-select:not(.ant-select-customize-input) .ant-select-selector) {
  color: #edf5fa !important;
  background: #233747 !important;
  border-color: #496174 !important;
}

:global(.mars-dialog.mars-popup-shell.thematic-workbench-panel.is-chart-docked .ant-select-selection-item) {
  color: #edf5fa !important;
}

:global(.mars-dialog.mars-popup-shell.thematic-workbench-panel.is-chart-docked .ant-slider-rail) {
  background: #496174 !important;
}

:global(.mars-dialog.mars-popup-shell.thematic-workbench-panel.is-chart-docked .ant-slider-track) {
  background: #56b5d8 !important;
}

.cartography-restore-dock {
  position: fixed;
  top: 72px;
  right: 14px;
  width: 42px;
  height: 42px;
  z-index: 1500;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(103, 190, 255, 0.68);
  border-radius: 6px;
  background: rgba(8, 31, 52, 0.94);
  box-shadow: 0 8px 22px rgba(1, 12, 24, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  display: grid;
  place-items: center;
  color: #7dc9ff;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.cartography-restore-dock::before {
  content: attr(data-tooltip);
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  padding: 5px 8px;
  border: 1px solid rgba(103, 190, 255, 0.42);
  border-radius: 4px;
  background: rgba(5, 22, 38, 0.96);
  color: #eaf6ff;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(4px, -50%);
  transition: opacity 140ms ease, transform 140ms ease;
}

.cartography-restore-status {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 6px;
  height: 6px;
  border: 1px solid rgba(5, 22, 38, 0.9);
  border-radius: 50%;
  background: #38d7a4;
  box-shadow: 0 0 0 2px rgba(56, 215, 164, 0.16);
}

.cartography-restore-dock:hover,
.cartography-restore-dock:focus-visible {
  border-color: #7dc9ff;
  background: rgba(10, 43, 72, 0.98);
  transform: translateY(-1px);
  outline: none;
}

.cartography-restore-dock:hover::before,
.cartography-restore-dock:focus-visible::before {
  opacity: 1;
  transform: translate(0, -50%);
}

.cartography-restore-dock :deep(.mars-icon) {
  color: #7dc9ff;
  line-height: 1;
}

.workbench-shell {
  display: flex;
  align-items: stretch;
  gap: 0;
  height: 100%;
  min-height: 0;
}

.workbench-shell.has-chart-panel .thematic-panel {
  display: none;
}

.panel-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.panel-section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.side-layout-section {
  box-sizing: border-box;
  padding: 8px 12px;
  border-bottom: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
}

.side-layout-section:last-child {
  border-bottom: 0;
}

.operator-section {
  flex: 0 0 148px;
  overflow: hidden;
}

.parameter-section {
  flex: 0 0 196px;
  overflow: hidden;
}

.panel-section-kicker {
  margin-top: 1px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
  font-size: 9px;
  line-height: 1.2;
}

.analysis-mode-control {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--mars-text-color-secondary, #adc2d0);
  font-size: 10px;
}

.analysis-mode-control > span {
  flex: none;
}

.analysis-mode-control :deep(.ant-select) {
  width: 138px;
  min-width: 0;
}

.background-preview-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.numeric-projection-note,
.numeric-coordinate-readout {
  color: var(--mars-text-color-secondary, #a9c0cc);
  font-size: 11px;
  line-height: 1.5;
}

.numeric-coordinate-readout {
  display: grid;
  gap: 2px;
  margin: 5px 0;
  overflow-wrap: anywhere;
}

.numeric-download {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 5px 0;
}

.earthquake-file-input {
  display: none;
}
.publish-description-feedback { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 7px; color: var(--mars-text-color-secondary, #aebccc); font-size: 11px; line-height: 1.4; }
.publish-description-feedback strong { color: inherit; font-variant-numeric: tabular-nums; white-space: nowrap; }
.publish-description-feedback.is-short { color: #f3b76a; }
.publish-description-feedback.is-ready { color: #6bd4b0; }

.chart-showcase-panel.is-earthquake-mode .parameter-section {
  flex: 0 0 184px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chart-showcase-panel.is-earthquake-mode .operator-section { flex-basis: 132px; }

.chart-showcase-panel .earthquake-parameter-panel {
  flex: 1;
  height: auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  align-content: start;
  gap: 5px;
  padding: 6px 4px 8px 0;
}
.earthquake-parameter-details summary { font-size: 10px; color: #b8cbd6; cursor: pointer; padding: 2px 0; }
.earthquake-parameter-details summary span { float: right; color: #8cdfc3; }
.earthquake-parameter-details > div { margin-top: 7px; }

.earthquake-parameter-line {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: start;
  gap: 7px;
  font-size: 11px;
  line-height: 1.5;
  color: #a7c0cc;
}

.earthquake-parameter-line strong {
  font-weight: 500;
  color: #e3edf2;
  overflow-wrap: anywhere;
}

.earthquake-parameter-line small { color: #8cdfc3; font-size: 10px; }
.earthquake-field-list { display: flex; flex-wrap: wrap; gap: 5px; }
.earthquake-field-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #405664;
  padding: 2px 5px;
  border-radius: 3px;
  color: #9baeb9;
  font: 10px/1.4 Consolas, monospace;
  overflow-wrap: anywhere;
}
.earthquake-field-chip.is-available { border-color: #387966; color: #ace1d1; }
.earthquake-field-chip i { font-style: normal; opacity: 0.7; }
.earthquake-view-switch { display: flex; align-items: center; gap: 16px; }
.earthquake-view-switch button {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  padding: 4px 0;
  color: #a9bfca;
  font-size: 12px;
  cursor: pointer;
}
.earthquake-view-switch button.is-active { color: #eaf5fa; border-color: #66bded; }
.earthquake-filter-panel { display: grid; gap: 8px; padding: 0 0 10px; border-bottom: 1px solid #3a5361; }
.earthquake-filter-head { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #dbeaf0; }
.earthquake-filter-head span { margin-left: auto; color: #8be0c3; font-variant-numeric: tabular-nums; }
.earthquake-filter-head button, .earthquake-symbol-status button {
  border: 0; background: transparent; color: #8bd4f7; cursor: pointer; font-size: 11px; padding: 2px;
}
.earthquake-filter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.earthquake-filter-grid label { display: grid; gap: 4px; min-width: 0; color: #aec4cf; font-size: 10px; }
.earthquake-filter-grid :deep(.ant-input-number), .earthquake-filter-grid :deep(.ant-select) { width: 100%; min-width: 0; }
.earthquake-filter-warning { color: #ebba83; font-size: 11px; }
.earthquake-symbol-pane { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 7px; padding-right: 3px; }
.earthquake-symbol-pane > * { flex: none; }
.symbol-snap-control { display: flex; align-items: center; gap: 7px; padding: 6px 0; font-size: 11px; color: var(--mars-text-color-secondary); }
.symbol-snap-control input { accent-color: #28a8ca; }
.symbol-snap-control span { margin-left: auto; font-variant-numeric: tabular-nums; }
.earthquake-symbol-status { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #a9c3d0; }
.symbol-source { color: #a9cad9; font-size: 11px; align-self: flex-end; }
.earthquake-symbol-palette { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.earthquake-symbol-palette button {
  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; height: 62px; padding: 4px; white-space: nowrap;
  border: 1px solid #415c6b; border-radius: 4px; background: #203642; color: #e5edf2; font-size: 11px; cursor: pointer;
}
.earthquake-symbol-palette button.is-pending, .earthquake-symbol-palette button:hover { border-color: #77caed; background: #284753; }
.earthquake-symbol-style-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #e0edf2; font-size: 11px; }
.earthquake-symbol-style-head span { font-size: 10px; color: #a3b9c5; }
.earthquake-symbol-controls { display: grid; gap: 6px; }
.earthquake-symbol-controls label { display: grid; grid-template-columns: 118px minmax(0, 1fr); align-items: center; gap: 9px; font-size: 11px; color: #bdd0da; }
.earthquake-symbol-controls strong { font-weight: 500; color: #85d1f5; font-variant-numeric: tabular-nums; }
.earthquake-symbol-controls input[type="range"] { width: 100%; min-width: 0; accent-color: #4bbbe8; margin: 0; }
.earthquake-symbol-controls input[type="color"] { width: 38px; height: 26px; padding: 2px; border: 1px solid #506d7c; background: transparent; cursor: pointer; }
.earthquake-symbol-list { display: grid; gap: 3px; border-top: 1px solid #3d5360; padding-top: 8px; }
.earthquake-symbol-list button { display: flex; align-items: center; gap: 7px; width: 100%; border: 0; border-radius: 3px; padding: 5px; color: #d8e5eb; background: transparent; cursor: pointer; font-size: 11px; }
.earthquake-symbol-list button.is-selected { background: #2c4654; }
.earthquake-symbol-list small { margin-left: auto; color: #a4bcc8; font-size: 10px; }
.earthquake-view-switch button:focus-visible, .earthquake-symbol-palette button:focus-visible, .earthquake-symbol-list button:focus-visible { outline: 2px solid #88d4f6; outline-offset: 2px; }

:global(.thematic-map-symbol) {
  display: grid; place-items: center; box-sizing: border-box;
  width: var(--symbol-size); height: var(--symbol-size);
  cursor: grab; touch-action: none; user-select: none;
  opacity: var(--symbol-opacity); transform: rotate(var(--symbol-rotation));
}
:global(.thematic-map-symbol-core) {
  display: grid; place-items: center; box-sizing: border-box;
  width: 100%; height: 100%;
}
:global(.thematic-map-symbol:active) { cursor: grabbing; }
:global(.thematic-map-symbol:focus-visible) { outline: 2px solid #54c7f5; outline-offset: 4px; }
:global(.thematic-map-symbol svg) { display: block; width: 100%; height: 100%; pointer-events: none; }

.earthquake-operator-grid .raster-operator-card.is-active {
  border-color: #ca9b70;
  background: color-mix(in srgb, #ca9b70 13%, transparent);
}

.raster-operator-icon.is-earthquake {
  color: #efbb83;
}

.earthquake-source-line {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  color: #dce8ee;
  font-size: 10px;
}

.earthquake-source-line strong,
.earthquake-source-line span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.earthquake-source-line span {
  color: #93afbf;
  font-size: 9px;
}

.earthquake-source-line.is-empty {
  color: #bdcdd5;
}

.earthquake-required-fields,
.earthquake-model-note {
  color: #a7bfca;
  font-size: 9px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.earthquake-import-error {
  padding-left: 7px;
  border-left: 2px solid #e77d65;
  color: #f0a795;
  font-size: 9px;
  line-height: 1.4;
}

.earthquake-result-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 0 9px;
  border-bottom: 1px solid #3b5664;
}

.earthquake-result-summary > div {
  display: grid;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.earthquake-result-summary strong {
  color: #edf5fa;
  font-size: 11px;
}

.earthquake-result-summary span:not(.earthquake-result-mark) {
  color: #9eb8c5;
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.earthquake-result-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: none;
  border: 1px solid #5e8290;
  color: #82d3db;
}

.earthquake-result-mark.is-thermal { color: #e99770; border-color: #a76955; }
.earthquake-result-mark.is-risk { color: #e5bb72; border-color: #92744e; }
.earthquake-result-mark.is-intensity { color: #d99abb; border-color: #8c6380; }

.earthquake-export {
  flex: none;
}

.earthquake-quality-line {
  color: #a8c2cd;
  font-size: 10px;
}

.earthquake-quality-line strong { color: #71d8b4; }
.earthquake-quality-line span { color: #5a7582; }

.earthquake-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.earthquake-metric {
  min-width: 0;
  padding: 5px 0;
  border-top: 1px solid #385160;
  display: grid;
  gap: 2px;
}

.earthquake-metric span {
  color: #95adba;
  font-size: 9px;
}

.earthquake-metric strong {
  color: #e6f0f4;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.earthquake-observation-head {
  display: flex;
  justify-content: space-between;
  color: #e0eaf0;
  font-size: 10px;
}

.earthquake-observation-head span { color: #88a2b1; }

.earthquake-observation-list {
  display: grid;
  gap: 0;
}

.earthquake-observation-row {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  border-bottom: 1px solid #2e4857;
  color: #b8cdd6;
  font-size: 9px;
}

.earthquake-observation-row i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.earthquake-observation-row strong { color: #ecf3f6; font-size: 9px; }

.earthquake-empty-state {
  min-height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #95b5c3;
  text-align: center;
  font-size: 10px;
}

.earthquake-empty-state strong { color: #e6eef2; font-size: 12px; }
.earthquake-empty-state span { max-width: 260px; line-height: 1.45; }

.raster-operator-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.raster-operator-card {
  min-width: 0;
  height: 48px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--mars-text-color-secondary, #91a5ba) 26%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--mars-text-color, #fff) 3%, transparent);
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.68));
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.raster-operator-card:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-primary, #2d8cf0) 64%, transparent);
  background: color-mix(in srgb, var(--color-primary, #2d8cf0) 8%, transparent);
  color: var(--mars-text-color, #fff);
}

.raster-operator-card.is-active {
  border-color: color-mix(in srgb, #41a8ff 76%, transparent);
  background: color-mix(in srgb, #2388d9 16%, transparent);
  color: var(--mars-text-color, #fff);
  box-shadow: inset 2px 0 0 #54c5ff;
}

.raster-operator-card:focus-visible {
  outline: 2px solid #54c5ff;
  outline-offset: 1px;
}

.raster-operator-card:disabled {
  cursor: wait;
  opacity: 0.62;
}

.raster-operator-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, currentColor 26%, transparent);
  border-radius: 4px;
  color: #70caff;
}

.raster-operator-icon.is-temporal {
  color: #65d6bd;
}

.raster-operator-icon.is-signal {
  color: #e5ba78;
}

.raster-operator-icon.is-statistics {
  color: #7ad7d1;
}

.raster-operator-icon.is-spatial {
  color: #8db7e5;
}

.raster-operator-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.raster-operator-copy strong,
.raster-operator-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raster-operator-copy strong {
  font-size: 11px;
  font-weight: 650;
  line-height: 1.2;
}

.raster-operator-copy small {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.52));
  font-size: 9px;
  line-height: 1.2;
}

.operator-control-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.operator-select {
  width: 100%;
  min-width: 0;
}

.section-state {
  min-width: 32px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 10px;
  line-height: 1;
  text-align: right;
}

.section-state.is-ready {
  color: #4ed5aa;
  font-weight: 600;
}

.scope-compact-bar {
  height: 25px;
  margin-top: 6px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, #8ca0b5 30%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, #8ca0b5 7%, transparent);
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 9px;
  line-height: 1;
}

.scope-compact-bar.is-locked {
  border-color: color-mix(in srgb, #35c996 44%, transparent);
  background: color-mix(in srgb, #35c996 9%, transparent);
  color: #65ddb5;
}

.scope-compact-bar span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raster-parameter-panel {
  height: 76px;
  margin-top: 5px;
  display: grid;
  align-content: center;
  gap: 5px;
}

.raster-parameter-field {
  min-width: 0;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.66));
  font-size: 10px;
}

.raster-parameter-field > span {
  min-width: 0;
  white-space: nowrap;
}

.raster-parameter-field > span strong {
  margin-left: 4px;
  color: #84d7ff;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.raster-parameter-field :deep(.ant-select),
.raster-parameter-field :deep(.ant-slider) {
  min-width: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.raster-parameter-field.is-slider {
  grid-template-columns: 126px minmax(0, 1fr);
}

.earthquake-parameter-panel .raster-parameter-field.is-slider {
  grid-template-columns: minmax(0, 44%) minmax(0, 1fr);
  gap: 12px;
}

.earthquake-parameter-panel .raster-parameter-field.is-slider > span {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 5px;
  white-space: normal;
}

.earthquake-parameter-panel .raster-parameter-field.is-slider > span strong { margin-left: 0; }

.raster-run-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  margin-top: 5px;
}

.raster-run-row :deep(.mars-button) {
  width: 100%;
}

.raster-clear-button,
.chart-refresh-button {
  height: 24px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.14));
  border-radius: 4px;
  background: transparent;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.66));
  font-size: 10px;
  cursor: pointer;
}

.raster-clear-button {
  padding: 0 8px;
}

.raster-clear-button:hover:not(:disabled),
.chart-refresh-button:hover:not(:disabled) {
  border-color: #54bfff;
  color: #8bd5ff;
}

.raster-clear-button:disabled,
.chart-refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.scope-lock-bar {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 5px 7px;
  border: 1px solid color-mix(in srgb, #35c996 42%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, #35c996 9%, var(--popup-surface, #11161c));
}

.scope-lock-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, #35c996 52%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, #35c996 14%, transparent);
  color: #63ddb3;
}

.scope-lock-copy {
  min-width: 0;
}

.scope-lock-title {
  color: var(--mars-text-color, #fff);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
}

.scope-lock-detail {
  margin-top: 1px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 9px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scope-lock-reset {
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 7px;
  border: 1px solid rgba(91, 217, 174, 0.52);
  border-radius: 4px;
  background: transparent;
  color: #74e4bb;
  font-size: 11px;
  cursor: pointer;
}

.parameter-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scope-lock-reset:hover {
  border-color: #89ebc7;
  background: color-mix(in srgb, #35c996 12%, transparent);
  color: #b2f5d9;
}

.scope-lock-reset.is-capture {
  border-color: color-mix(in srgb, #45a9ff 54%, transparent);
  color: #6fc3ff;
}

.scope-lock-reset:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.temporal-parameter-panel {
  position: relative;
}

.analysis-parameter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.analysis-parameter-field {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 10px;
}

.analysis-parameter-field :deep(.ant-select) {
  min-width: 0;
}

.raster-result-strip {
  min-height: 42px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  padding: 4px;
  border: 1px solid color-mix(in srgb, #36cfa0 34%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, #36cfa0 7%, transparent);
}

.raster-result-strip img {
  width: 58px;
  height: 34px;
  display: block;
  border-radius: 3px;
  object-fit: cover;
  background: #071520;
}

.raster-use-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px solid #3d5360; }
.raster-use-actions select { flex: 1; min-width: 0; height: 30px; border: 1px solid #506d7c; border-radius: 4px; color: #e3edf2; background: #223b4b; padding: 0 8px; font-size: 12px; color-scheme: dark; }
.raster-use-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 30px; padding: 4px 14px; border: 1px solid #409eff; border-radius: 4px; color: white; background: #237ce5; cursor: pointer; white-space: nowrap; }
.raster-use-actions button:disabled { opacity: .45; cursor: not-allowed; }
.raster-use-actions :focus-visible { outline: 2px solid #85d1f5; outline-offset: 2px; }

.raster-result-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.raster-result-copy strong,
.raster-result-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.raster-result-copy strong {
  color: var(--mars-text-color, #fff);
  font-size: 10px;
  line-height: 1.25;
}

.raster-result-copy span,
.raster-result-time {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
  font-size: 9px;
  line-height: 1.25;
}

.temporal-period-badge {
  color: #64d7bc;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.temporal-result-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.temporal-result-strip {
  flex: 0 0 auto;
}

.temporal-series-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 1px;
}

.temporal-series-head > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.temporal-series-head strong {
  color: var(--mars-text-color, #fff);
  font-size: 11px;
}

.temporal-series-head span {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.56));
  font-size: 9px;
}

.temporal-clear-series {
  padding: 2px 3px;
  border: 0;
  background: transparent;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
  font-size: 10px;
  cursor: pointer;
}

.temporal-clear-series:hover:not(:disabled) {
  color: #ff8585;
}

.temporal-clear-series:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.temporal-frame-rail {
  flex: 0 0 76px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 84px;
  gap: 6px;
  min-height: 76px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 0 4px;
  scrollbar-width: thin;
}

.temporal-frame-item,
.temporal-frame-add {
  position: relative;
  width: 84px;
  height: 70px;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--mars-text-color-secondary, #91a5ba) 26%, transparent);
  border-radius: 4px;
  overflow: hidden;
  background: color-mix(in srgb, #07131f 54%, transparent);
}

.temporal-frame-item img {
  width: 100%;
  height: 48px;
  display: block;
  object-fit: cover;
}

.temporal-frame-index {
  position: absolute;
  top: 3px;
  left: 3px;
  min-width: 20px;
  height: 16px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(4, 17, 29, 0.78);
  color: #7ddfc7;
  font-size: 9px;
  line-height: 16px;
  text-align: center;
}

.temporal-frame-label {
  height: 21px;
  display: block;
  padding: 0 5px;
  overflow: hidden;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.66));
  font-size: 8px;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.temporal-frame-item > button {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 17px;
  height: 17px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: rgba(4, 17, 29, 0.78);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.76);
  cursor: pointer;
}

.temporal-frame-item > button:hover {
  background: #bf4050;
  color: #fff;
}

.temporal-frame-add {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-style: dashed;
  color: #71c9ff;
  font-size: 9px;
  cursor: pointer;
}

.temporal-frame-add:hover:not(:disabled) {
  border-color: #64c5ff;
  background: color-mix(in srgb, #2589df 10%, transparent);
}

.temporal-frame-add:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.temporal-analysis-empty,
.temporal-analysis-ready {
  flex: 0 0 auto;
  min-height: 112px;
  border-top: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
}

.temporal-analysis-empty {
  flex-direction: column;
  gap: 5px;
  text-align: center;
}

.temporal-analysis-empty strong,
.temporal-analysis-ready strong {
  color: var(--mars-text-color, #fff);
  font-size: 11px;
}

.temporal-analysis-empty span,
.temporal-analysis-ready span {
  max-width: 284px;
  font-size: 9px;
  line-height: 1.5;
}

.temporal-analysis-ready {
  gap: 8px;
  color: #62d8b9;
}

.temporal-analysis-ready > div {
  display: grid;
  gap: 3px;
}

.temporal-sparkline-section {
  flex: 0 0 auto;
  padding: 8px 7px 5px;
  border-top: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-bottom: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  background: color-mix(in srgb, #07131f 24%, transparent);
}

.temporal-sparkline-head,
.temporal-sparkline-axis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.temporal-sparkline-head strong {
  color: var(--mars-text-color, #fff);
  font-size: 10px;
}

.temporal-sparkline-head span,
.temporal-sparkline-axis {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.52));
  font-size: 8px;
}

.temporal-sparkline-section svg {
  width: 100%;
  height: 54px;
  display: block;
  margin-top: 3px;
}

.temporal-sparkline-section line {
  stroke: color-mix(in srgb, var(--mars-text-color-secondary, #91a5ba) 24%, transparent);
  stroke-width: 1;
}

.temporal-sparkline-section polyline {
  fill: none;
  stroke: #55d0b2;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.temporal-metric-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: var(--popup-border, rgba(255 255 255 / 0.12));
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: 4px;
  overflow: hidden;
}

.temporal-metric-item {
  min-width: 0;
  padding: 7px 5px;
  background: var(--popup-surface, #162238);
  display: grid;
  gap: 4px;
  text-align: center;
}

.temporal-metric-item span {
  overflow: hidden;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.56));
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.temporal-metric-item strong {
  overflow: hidden;
  color: #77dbc4;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.temporal-method-note {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  color: #62d8b9;
  font-size: 9px;
}

.signal-source-badge {
  color: #e2bc85;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.signal-result-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.signal-result-body > * {
  flex: 0 0 auto;
}

.statistics-chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--mars-text-color, #fff);
  font-size: 10px;
}

.statistics-chart-head span {
  color: var(--mars-text-color-secondary, #adc2d0);
  font-size: 9px;
}

.statistics-chart {
  display: grid;
  gap: 5px;
  padding: 7px 8px;
  border: 1px solid var(--popup-border, #405767);
  border-radius: 4px;
  background: #1b2f3d;
}

.statistics-chart-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 7px;
  color: var(--mars-text-color-secondary, #adc2d0);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.statistics-chart-row > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statistics-chart-row strong {
  color: var(--mars-text-color, #edf5fa);
  font-size: 9px;
  font-weight: 600;
  text-align: right;
}

.statistics-chart-track {
  height: 7px;
  overflow: hidden;
  border-radius: 2px;
  background: #304757;
}

.statistics-chart-track i {
  height: 100%;
  display: block;
  border-radius: inherit;
}

.signal-result-strip {
  border-color: color-mix(in srgb, #d8a962 42%, transparent);
  background: color-mix(in srgb, #d8a962 7%, transparent);
}

.signal-result-strip .raster-result-time {
  color: #e6be82;
}

.signal-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.signal-preview-head strong {
  color: var(--mars-text-color, #fff);
  font-size: 10px;
}

.signal-preview-head span {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.signal-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.signal-preview-item {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.14));
  border-radius: 4px;
  background: color-mix(in srgb, #07131f 18%, transparent);
}

.signal-preview-item span {
  height: 20px;
  display: block;
  padding: 0 6px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.65));
  font-size: 9px;
  line-height: 20px;
}

.signal-preview-item img {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: cover;
  background: #10212b;
}

.signal-spectrum-section {
  padding: 6px 7px 2px;
  border-top: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-bottom: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  background: color-mix(in srgb, #07131f 20%, transparent);
}

.signal-spectrum-section svg {
  width: 100%;
  height: 58px;
  display: block;
  margin-top: 3px;
}

.signal-spectrum-section line {
  stroke: color-mix(in srgb, var(--mars-text-color-secondary, #91a5ba) 30%, transparent);
  stroke-width: 1;
}

.signal-spectrum-section polyline {
  fill: none;
  stroke: #e1b572;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.signal-legend {
  min-height: 24px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 9px;
}

.signal-legend i {
  height: 7px;
  border-radius: 2px;
  background: linear-gradient(90deg, #393e50, #d79351, #ffe4a0);
}

.signal-legend.is-edge i {
  background: linear-gradient(90deg, transparent 0 44%, #ffbe4d 44% 56%, transparent 56%);
}

.signal-legend.is-filter i {
  background: linear-gradient(90deg, #526d77, #71a4a2, #abd2c7);
}

.signal-metric-grid .temporal-metric-item strong {
  color: #e3b876;
}

.signal-provenance {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.6));
  font-size: 9px;
  line-height: 1.5;
}

.signal-provenance span {
  min-width: 0;
}

.signal-empty-state {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-top: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  color: #d9b47e;
  text-align: center;
}

.signal-empty-state strong {
  color: var(--mars-text-color, #fff);
  font-size: 11px;
}

.signal-empty-state span {
  max-width: 290px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.62));
  font-size: 9px;
  line-height: 1.5;
}

.raster-result-time {
  padding-right: 3px;
  color: #5ddbb2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chart-analysis-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26px;
  gap: 6px;
}

.chart-refresh-button {
  width: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chart-template-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.chart-template-select {
  width: 100%;
  min-width: 0;
}

.analysis-summary-strip {
  min-height: 22px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--color-primary, #2684ff) 22%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-primary, #2684ff) 6%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.68));
  font-size: 9px;
  line-height: 1.25;
  text-align: center;
}

.analysis-summary-strip span + span {
  border-left: 1px solid color-mix(in srgb, var(--color-primary, #2684ff) 20%, transparent);
}

.board-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: auto;
  height: 28px;
  padding: 0 6px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.board-mode-btn:hover {
  color: var(--mars-primary-color, #2d8cf0);
}

.board-mode-btn.is-active {
  color: var(--color-primary, #41a8ff);
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
}

.panel-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color);
}

.chart-showcase-panel {
  width: 100%;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-sizing: border-box;
  min-height: 0;
  overflow: hidden;
}

.chart-showcase-panel.is-board-mode {
  background: transparent;
}

.template-live-panel > * { flex: 0 0 auto; }
.template-live-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; color: var(--mars-text-color); }
.template-live-palette { display: grid; gap: 8px; margin-bottom: 12px; color: var(--mars-text-color); }
.template-live-palette select { width: 100%; min-width: 0; height: 36px; padding: 0 10px; color: #e6f2fa; background: #213544; border: 1px solid #4b697b; border-radius: 4px; }

.chart-output-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.chart-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.chart-showcase-panel:not(.is-board-mode) {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}

.chart-showcase-panel:not(.is-board-mode) .operator-section,
.chart-showcase-panel:not(.is-board-mode) .parameter-section,
.chart-showcase-panel:not(.is-board-mode) .chart-output-section,
.chart-showcase-panel:not(.is-board-mode) .chart-list,
.chart-showcase-panel:not(.is-board-mode) .temporal-result-body,
.chart-showcase-panel:not(.is-board-mode) .signal-result-body,
.chart-showcase-panel:not(.is-board-mode) .earthquake-parameter-panel,
.chart-showcase-panel:not(.is-board-mode) .earthquake-symbol-pane {
  flex: 0 0 auto;
  overflow: visible;
}

.chart-showcase-panel:not(.is-board-mode) .operator-section { min-height: 148px; }
.chart-showcase-panel:not(.is-board-mode) .parameter-section { min-height: 196px; }
.chart-showcase-panel.is-earthquake-mode:not(.is-board-mode) .operator-section { min-height: 132px; }
.chart-showcase-panel.is-earthquake-mode:not(.is-board-mode) .parameter-section { min-height: 184px; }

.chart-demo-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 7px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.chart-demo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.chart-demo-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.chart-demo-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
}

.main-image-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.main-image-preview {
  position: relative;
  width: 100%;
  min-height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 10%, transparent);
  border-radius: 4px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(53, 77, 110, 0.9), rgba(17, 22, 28, 0.92));
}

.main-image-tag {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 96px;
  max-height: 150px;
  object-fit: contain;
}

.main-image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 108px;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
}

.main-image-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.main-image-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.main-image-meta {
  font-size: 12px;
  line-height: 1.5;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
}

.chart-list-empty {
  flex: 1;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px dashed color-mix(in srgb, var(--text-primary, #fff) 14%, transparent);
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.chart-list-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 3%, transparent);
}

.selection-outline-frame {
  position: fixed;
  z-index: 880;
  box-sizing: content-box;
  border-style: solid;
  border-color: #fff;
  background: transparent;
  pointer-events: none;
}

.selection-confirm-toolbar {
  position: fixed;
  z-index: 5000;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transform: translate(-50%, 0);
  padding: 0;
  border: 0;
  background: transparent;
}

.selection-confirm-btn {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 4px !important;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(4, 16, 30, 0.24);
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.selection-confirm-btn:hover {
  box-shadow: 0 4px 12px rgba(4, 16, 30, 0.3);
}

.selection-confirm-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.selection-confirm-btn.is-confirm {
  border-color: #1677ff;
  background: #1677ff;
  color: #fff;
}

.selection-confirm-btn.is-confirm:hover {
  border-color: #4096ff;
  background: #4096ff;
}

.selection-confirm-btn.is-redraw {
  border-color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.96);
  color: #23364d;
}

.selection-confirm-btn.is-redraw:hover {
  border-color: #b8d6f5;
  background: #fff;
}

.chart-list-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chart-name-select {
  flex: 1;
  min-width: 0;
}

.chart-list-item-remove {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: var(--color-error, #ff7875);
  }
}

.chart-list-item-canvas {
  width: 100%;
  height: 140px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.1));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background: color-mix(in srgb, var(--text-primary, #fff) 2%, transparent);
}

.chart-board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.chart-board-hint {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-board-right-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.chart-board-dropdowns {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.chart-board-dropdown-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, transparent);
  }

  :deep(.mars-icon) {
    display: inline-flex;
    opacity: 0.75;
  }
}

.chart-board-text-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
  }
}

.chart-board-zoom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chart-board-zoom-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 13px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
  }
}

.chart-board-zoom-reset {
  font-size: 12px;
}

.chart-board-zoom-label {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.chart-board-viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: calc(var(--popup-item-radius, 8px) - 2px);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    color-mix(in srgb, var(--popup-surface, #11161c) 88%, #243044 12%);
  background-size: 24px 24px, 24px 24px, auto;
  cursor: grab;

  &.is-panning {
    cursor: grabbing;
  }
}

.chart-board-surface {
  position: relative;
  box-sizing: border-box;
}

.chart-board-empty {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  padding: 16px 20px;
  border: 1px dashed color-mix(in srgb, var(--text-primary, #fff) 14%, transparent);
  border-radius: 10px;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 70%, transparent);
  pointer-events: none;
}

.chart-board-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.14));
  border-radius: 12px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 92%, #fff 8%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  box-sizing: border-box;
  cursor: grab;
  user-select: none;

  &.is-dragging {
    cursor: grabbing;
    z-index: 5;
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.36);
  }
}

.chart-board-card-canvas {
  flex: 1;
  min-height: 0;
  height: auto;
  pointer-events: none;
}
.chart-board-safe-area { position: absolute; border: 1px dashed rgba(112, 204, 215, 0.55); pointer-events: none; }

.chart-board-main-image-card {
  cursor: default;
  z-index: 2;
}

.chart-board-main-image-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color, #fff);
}

.chart-board-main-image-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(53, 77, 110, 0.9), rgba(17, 22, 28, 0.92));
}

.chart-board-main-image-tag {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.chart-board-handle {
  position: absolute;
  z-index: 3;
  background: transparent;
}

.chart-board-handle.is-n,
.chart-board-handle.is-s {
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}

.chart-board-handle.is-n {
  top: -4px;
}

.chart-board-handle.is-s {
  bottom: -4px;
}

.chart-board-handle.is-e,
.chart-board-handle.is-w {
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

.chart-board-handle.is-e {
  right: -4px;
}

.chart-board-handle.is-w {
  left: -4px;
}

.chart-board-handle.is-nw,
.chart-board-handle.is-ne,
.chart-board-handle.is-se,
.chart-board-handle.is-sw {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--color-primary, #41a8ff) 70%, #fff 30%);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
  opacity: 0;
}

.chart-board-card:hover .chart-board-handle.is-nw,
.chart-board-card:hover .chart-board-handle.is-ne,
.chart-board-card:hover .chart-board-handle.is-se,
.chart-board-card:hover .chart-board-handle.is-sw,
.chart-board-card.is-dragging .chart-board-handle.is-nw,
.chart-board-card.is-dragging .chart-board-handle.is-ne,
.chart-board-card.is-dragging .chart-board-handle.is-se,
.chart-board-card.is-dragging .chart-board-handle.is-sw {
  opacity: 1;
}

.chart-board-handle.is-nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}

.chart-board-handle.is-ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}

.chart-board-handle.is-se {
  right: -5px;
  bottom: -5px;
  cursor: nwse-resize;
}

.chart-board-handle.is-sw {
  left: -5px;
  bottom: -5px;
  cursor: nesw-resize;
}

.board-size-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.board-size-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--mars-text-color);
  font-size: 13px;
}

.header-text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 72%, #fff 8%);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  box-sizing: border-box;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled):not(.is-static) {
    color: var(--mars-text-color, #fff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 40%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 12%, transparent);
  }

  &.is-active {
    color: #8bd5ff;
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
    font-weight: 600;
  }

  &.is-static {
    cursor: default;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-color: transparent;
    background: transparent;
    padding: 0;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.thematic-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.thematic-panel-head {
  padding: 0 2px;
}

.thematic-panel-body {
  overflow-anchor: none;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--mars-border-color);
  background: rgba(65, 168, 255, 0.06);
}

.context-main {
  min-width: 0;
}

.context-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.context-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.dataset-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--mars-border-color);
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--popup-surface, #11161c) 92%, #fff 8%);
}

.dataset-bar-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--mars-text-color-secondary);
}

.dataset-bar-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary, #41a8ff);
  line-height: 1.4;
  word-break: break-word;
}

.dataset-binding-alert {
  background: color-mix(in srgb, var(--warning, #ff9d2b) 12%, var(--popup-surface, #ffffff));
  border: 1px solid color-mix(in srgb, var(--warning, #ff9d2b) 42%, transparent);
  border-radius: var(--popup-item-radius, 8px);

  :deep(.ant-alert-message) {
    color: var(--mars-text-color, #17233d) !important;
    font-weight: 600;
  }

  :deep(.ant-alert-description) {
    color: var(--mars-text-color-secondary, #62708a) !important;
  }

  :deep(.ant-alert-icon) {
    color: var(--warning, #ff9d2b);
  }
}

/* 参照分屏对比 tip 面板：蓝透底 + 高对比文字，适配深色主题 */
.workbench-tip-section {
  :deep(.ant-alert) {
    background: rgba(52, 152, 219, 0.15);
    border: 1px solid rgba(52, 152, 219, 0.3);
    border-radius: var(--popup-item-radius, 8px);
  }

  :deep(.ant-alert-message) {
    color: var(--mars-text-color, #ffffff) !important;
    font-weight: 600;
  }

  :deep(.ant-alert-description) {
    color: var(--text-secondary, rgba(255, 255, 255, 0.78)) !important;
  }

  :deep(.ant-alert-icon) {
    color: #5cadff;
  }
}

.context-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.workbench-tabs {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 参照弹窗标题「专题制图工作台」：16px / 600 */
.workbench-tabs :deep(.ant-tabs-tab) {
  font-size: var(--popup-title-font-size, 16px);
  font-weight: var(--popup-title-font-weight, 600);
  line-height: 24px;
  padding: 8px 0;
}

.workbench-tabs :deep(.ant-tabs-tab-btn) {
  font-size: inherit;
  font-weight: inherit;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
}

.workbench-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: var(--mars-text-color, #ffffff);
  font-weight: var(--popup-title-font-weight, 600);
}

.workbench-tabs :deep(.ant-tabs-nav) {
  flex-shrink: 0;
}

.workbench-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
  flex: 1;
  overflow: visible;
}

.workbench-tabs :deep(.ant-tabs-content),
.workbench-tabs :deep(.ant-tabs-tabpane) {
  height: auto;
  min-height: 100%;
}

.template-toolbar {
  margin-bottom: 12px;
  display: grid;
  gap: 10px;
}

.template-toolbar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.template-toolbar-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.template-filter-summary {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.template-edition-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--mars-border-color);
  border-radius: 6px;
  background: color-mix(in srgb, var(--mars-bg-color, var(--popup-surface, #ffffff)) 90%, var(--mars-text-color) 10%);
}

.template-edition-option {
  min-width: 0;
  min-height: 32px;
  padding: 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--mars-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  cursor: pointer;
  transition: color var(--transition-fast, 150ms ease), background var(--transition-fast, 150ms ease), box-shadow var(--transition-fast, 150ms ease);
}

.template-edition-option strong {
  min-width: 17px;
  padding: 1px 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--mars-text-color) 8%, transparent);
  font-size: 10px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.template-edition-option:hover {
  color: var(--mars-text-color);
  background: color-mix(in srgb, var(--mars-text-color) 7%, transparent);
}

.template-edition-option.is-active {
  background: var(--color-primary, #2d8cf0);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(4, 18, 34, 0.2);
}

.template-edition-option.is-active strong {
  background: rgba(255, 255, 255, 0.2);
}

.template-edition-option:focus-visible {
  outline: 2px solid var(--color-primary, #2d8cf0);
  outline-offset: 2px;
}

.template-filter-controls {
  display: grid;
  gap: 8px;
}

.chart-result-meta {
  overflow: hidden;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.58));
  font-size: 9px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-search-input {
  width: 100%;
}

.template-search-input :deep(.ant-input-prefix) {
  color: var(--mars-text-color-secondary);
}

.template-filter-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
}

.template-filter-row :deep(.ant-select) {
  width: 100%;
  min-width: 0;
}

.template-complexity-filter {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--mars-border-color);
  border-radius: 6px;
  background: color-mix(in srgb, var(--mars-bg-color, var(--popup-surface, #ffffff)) 88%, var(--mars-text-color) 12%);
}

.template-complexity-option {
  min-width: 0;
  height: 26px;
  padding: 0 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--mars-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 26px;
  text-align: center;
  cursor: pointer;
  transition: color var(--transition-fast, 150ms ease), background var(--transition-fast, 150ms ease), box-shadow var(--transition-fast, 150ms ease);
}

.template-complexity-option:hover {
  color: var(--mars-text-color);
  background: color-mix(in srgb, var(--mars-text-color) 7%, transparent);
}

.template-complexity-option.is-active {
  background: var(--color-primary, #2d8cf0);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(4, 18, 34, 0.2);
}

.template-complexity-option:focus-visible {
  outline: 2px solid var(--color-primary, #2d8cf0);
  outline-offset: 2px;
}

.template-active-filters {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.template-active-filter-label {
  color: var(--mars-text-color-secondary);
  font-size: 12px;
}

.template-active-filter-tag {
  max-width: 148px;
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, var(--color-primary, #2d8cf0) 36%, var(--mars-border-color));
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-primary, #2d8cf0) 10%, transparent);
  color: var(--mars-text-color);
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-filter-reset {
  min-height: 28px;
  margin-left: auto;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--color-primary, #2d8cf0);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
}

.template-filter-reset:hover {
  color: color-mix(in srgb, var(--color-primary, #2d8cf0) 78%, #ffffff);
}

.template-filter-reset:focus-visible {
  outline: 2px solid var(--color-primary, #2d8cf0);
  outline-offset: 2px;
}

.template-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;
}

.template-category-option {
  min-width: 0;
  min-height: 96px;
  padding: 0;
  border: 1px solid var(--mars-border-color);
  border-radius: 6px;
  background: color-mix(in srgb, var(--mars-bg-color, var(--popup-surface, #ffffff)) 92%, var(--mars-text-color) 8%);
  color: var(--mars-text-color-secondary);
  display: grid;
  grid-template-rows: 60px 36px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: color var(--transition-fast, 150ms ease), border-color var(--transition-fast, 150ms ease), background var(--transition-fast, 150ms ease), box-shadow var(--transition-fast, 150ms ease);
}

.template-category-option:hover {
  border-color: color-mix(in srgb, var(--color-primary, #2d8cf0) 68%, var(--mars-border-color));
  color: var(--mars-text-color);
}

.template-category-option:hover .template-category-preview {
  transform: scale(1.045);
}

.template-category-option.is-active {
  border-color: var(--color-primary, #2d8cf0);
  background: color-mix(in srgb, var(--color-primary, #2d8cf0) 16%, var(--mars-bg-color, var(--popup-surface, #ffffff)));
  color: var(--mars-text-color);
  box-shadow: inset 0 -3px 0 var(--color-primary, #2d8cf0);
}

.template-category-option:focus-visible,
.template-card:focus-visible {
  outline: 2px solid var(--color-primary, #2d8cf0);
  outline-offset: 2px;
}

.template-category-media {
  position: relative;
  display: block;
  min-width: 0;
  overflow: hidden;
  background: #0b1e2f;
}

.template-category-preview {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transform: scale(1.01);
  transition: transform var(--transition-fast, 150ms ease), filter var(--transition-fast, 150ms ease);
}

.template-category-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 42%, rgba(3, 13, 24, 0.34) 100%);
  pointer-events: none;
}

.template-category-status {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 50%;
  background: var(--color-primary, #2d8cf0);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  transform: scale(0.82);
  transition: opacity var(--transition-fast, 150ms ease), transform var(--transition-fast, 150ms ease);
}

.template-category-option.is-active .template-category-status {
  opacity: 1;
  transform: scale(1);
}

.template-category-option.is-active .template-category-preview {
  filter: saturate(1.08) contrast(1.04);
}

.template-category-copy {
  min-width: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.template-category-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-category-count {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--mars-text-color) 10%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.template-empty-action {
  margin-top: 8px;
}

.section-tip {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.template-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.template-card {
  min-width: 0;
  min-height: 176px;
  border: 1px solid var(--mars-border-color);
  border-radius: var(--popup-item-radius, 8px);
  background: var(--mars-bg-color);
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.template-card:hover,
.template-card.active {
  border-color: #41a8ff;
  transform: translateY(-1px);
}

.template-card.active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary, #2d8cf0) 54%, transparent);
}

.template-card-cover {
  position: relative;
  min-width: 0;
  min-height: 100%;
  overflow: hidden;
  background: #e5eaed;
  display: flex;
  align-items: center;
  padding: 42px 8px;
}

.template-card-cover-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
  transition: transform var(--transition-fast, 150ms ease), filter var(--transition-fast, 150ms ease);
}

.template-card:hover .template-card-cover-image {
  transform: none;
  filter: none;
}

.template-card-cover-shade {
  display: none;
}

.template-card-complexity {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 4px;
  background: rgba(5, 20, 34, 0.7);
  color: #ffffff;
  font-size: 11px;
  line-height: 1.3;
  backdrop-filter: blur(4px);
}

.template-card-edition {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 7px;
  border: 1px solid rgba(106, 231, 213, 0.72);
  border-radius: 4px;
  background: rgba(5, 39, 48, 0.78);
  color: #b9fff2;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
  backdrop-filter: blur(4px);
}

.template-card-edition.is-earthquake {
  border-color: rgba(255, 198, 90, 0.78);
  background: rgba(91, 47, 9, 0.82);
  color: #ffe1a6;
}

.template-card-symbols {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-map-symbol {
  width: 24px;
  height: 24px;
  border: 1px solid;
  border-radius: 5px;
  background: rgba(5, 20, 34, 0.86) !important;
  box-shadow: 0 2px 7px rgba(2, 12, 22, 0.32), inset 0 0 0 1px color-mix(in srgb, var(--template-icon-accent) 16%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
}

.template-map-symbol.is-earthquake {
  outline: 1px solid color-mix(in srgb, var(--template-icon-accent) 24%, transparent);
  outline-offset: 1px;
}

.template-map-symbol :deep(svg),
.template-business-icon :deep(svg),
.template-preview-symbol :deep(svg),
.template-icon-binding :deep(svg) {
  display: block;
  stroke-width: 3.2;
}

.template-card-body {
  min-width: 0;
  padding: 10px;
  display: grid;
  align-content: start;
  gap: 7px;
}

.template-card-heading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.template-card-title-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.template-business-icon {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border: 1px solid;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--template-icon-accent, currentColor) 8%, transparent);
}

.template-business-icon[data-icon-family="basic"] {
  background-color: color-mix(in srgb, var(--template-icon-accent) 10%, transparent) !important;
}

.template-business-icon[data-icon-family="earthquake"] {
  background-color: color-mix(in srgb, var(--template-icon-accent) 16%, transparent) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--template-icon-accent) 18%, transparent), 0 0 0 1px color-mix(in srgb, var(--template-icon-accent) 8%, transparent);
}

.template-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--mars-text-color);
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.template-card[data-purpose="emergency"] .template-card-heading { flex-direction: column; gap: 4px; }
.template-review-status { color: var(--mars-text-color-secondary); font-size: 11px; line-height: 1.5; }

.template-category-tag {
  max-width: 110px;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--color-primary, #2d8cf0) 42%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-primary, #2d8cf0) 12%, transparent);
  color: var(--color-primary, #2d8cf0);
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-version {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--mars-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.template-desc {
  min-height: 32px;
  color: var(--mars-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.template-card-detail-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: start;
  gap: 6px;
}

.template-card-detail-label {
  padding-top: 2px;
  color: var(--mars-text-color-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.template-card-tags {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.template-card-tag,
.template-component-tag {
  max-width: 100px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card-tag {
  border: 1px solid color-mix(in srgb, var(--mars-text-color-secondary) 28%, transparent);
  background: color-mix(in srgb, var(--mars-text-color) 6%, transparent);
  color: var(--mars-text-color-secondary);
}

.template-component-tag {
  border: 1px solid color-mix(in srgb, #2db7a3 34%, transparent);
  background: color-mix(in srgb, #2db7a3 10%, transparent);
  color: color-mix(in srgb, #2db7a3 76%, var(--mars-text-color));
}

.template-card-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 7px;
  padding-top: 2px;
}

.template-card-action {
  min-width: 0;
  min-height: 32px;
  border: 1px solid var(--mars-border-color);
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition-fast, 150ms ease), border-color var(--transition-fast, 150ms ease), background var(--transition-fast, 150ms ease);
}

.template-card-action.is-preview {
  background: transparent;
  color: var(--mars-text-color-secondary);
}

.template-card-action.is-preview:hover {
  border-color: var(--color-primary, #2d8cf0);
  color: var(--mars-text-color);
}

.template-card-action.is-use {
  border-color: var(--color-primary, #2d8cf0);
  background: var(--color-primary, #2d8cf0);
  color: #ffffff;
}

.template-card-action.is-use:hover {
  background: color-mix(in srgb, var(--color-primary, #2d8cf0) 84%, #ffffff);
}

.template-card-action:focus-visible {
  outline: 2px solid var(--color-primary, #2d8cf0);
  outline-offset: 2px;
}

.template-preview-modal {
  display: grid;
  gap: 16px;
}

.template-preview-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--mars-border-color);
  border-radius: 6px;
  background: #0b1e2f;
}

.template-preview-image {
  width: 100%;
  height: auto;
  aspect-ratio: 420 / 297;
  display: block;
  object-fit: contain;
}

.template-preview-overlay {
  position: static;
  order: -1;
  padding: 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: transparent;
}

.template-preview-category,
.template-preview-complexity,
.template-preview-edition {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 4px;
  background: rgba(5, 20, 34, 0.72);
  color: #ffffff;
  font-size: 12px;
  backdrop-filter: blur(4px);
}

.template-preview-edition {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-color: rgba(106, 231, 213, 0.72);
  color: #b9fff2;
}

.template-preview-edition.is-earthquake {
  border-color: rgba(255, 198, 90, 0.8);
  background: rgba(91, 47, 9, 0.82);
  color: #ffe1a6;
}

.template-preview-symbols {
  position: static;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: calc(100% - 28px);
}

.template-preview-symbol {
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 5px;
  background: rgba(5, 20, 34, 0.86) !important;
  box-shadow: 0 2px 8px rgba(2, 12, 22, 0.28), inset 0 0 0 1px color-mix(in srgb, var(--template-icon-accent) 14%, transparent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--template-icon-accent);
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(6px);
}

.template-preview-symbol.is-earthquake {
  outline: 1px solid color-mix(in srgb, var(--template-icon-accent) 18%, transparent);
  outline-offset: 1px;
}

.template-preview-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.template-preview-name {
  color: var(--mars-text-color);
  font-size: 16px;
  font-weight: 650;
}

.template-preview-description {
  margin-top: 5px;
  color: var(--mars-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.template-preview-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--mars-border-color);
  border-bottom: 1px solid var(--mars-border-color);
}

.template-preview-detail {
  min-width: 0;
  padding: 12px;
  display: grid;
  gap: 5px;
}

.template-preview-detail + .template-preview-detail {
  border-left: 1px solid var(--mars-border-color);
}

.template-preview-detail span {
  color: var(--mars-text-color-secondary);
  font-size: 11px;
}

.template-preview-detail strong {
  color: var(--mars-text-color);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
}

.template-preview-detail.is-icon-binding {
  grid-column: 1 / -1;
  border-top: 1px solid var(--mars-border-color);
  border-left: 0;
}

.template-icon-binding-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.template-icon-binding {
  min-height: 26px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.template-icon-binding.is-basic {
  background-color: color-mix(in srgb, var(--template-icon-accent) 9%, transparent) !important;
}

.template-icon-binding.is-earthquake {
  background-color: color-mix(in srgb, var(--template-icon-accent) 15%, transparent) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--template-icon-accent) 12%, transparent);
}

.template-icon-binding > span {
  color: inherit;
  font-size: inherit;
}

.template-preview-actions {
  display: flex;
  justify-content: flex-end;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 16px;
  align-items: start;
}
.template-standard-binding { grid-column: 1 / -1; padding: 12px 0; color: var(--mars-text-color, #edf5fa); border-top: 1px solid var(--mars-border-color); }
.template-standard-binding summary { cursor: pointer; font-weight: 600; }
.template-standard-binding > div { display: grid; gap: 10px; padding-top: 10px; }
.template-standard-binding > div > span { font-size: 12px; color: #d7b276; }
.standard-binding-field { display: grid; gap: 6px; min-width: 0; }
.standard-binding-field :deep(.ant-select) { width: 100%; min-width: 0; }
:global(.thematic-standard-select-popup) { max-width: calc(100vw - 24px); }
:global(.thematic-standard-select-popup .ant-select-item-option-content) { white-space: normal; overflow-wrap: anywhere; }

.editor-form,
.editor-side,
.publish-body {
  min-height: 0;
}

.editor-side {
  display: grid;
  align-content: start;
  gap: 12px;
}

.preview-card,
.summary-card {
  border: 1px solid var(--mars-border-color);
  background: var(--mars-bg-color);
}

.preview-card {
  overflow: hidden;
  border-radius: 6px;
}

.summary-card {
  padding: 12px;
  display: grid;
  gap: 10px;
}

.editor-template-result { display: block; width: 100%; max-height: 280px; object-fit: contain; }
.editor-template-visual {
  border-bottom: 1px solid var(--mars-border-color);
}

.preview-card-content {
  padding: 12px;
  display: grid;
  gap: 10px;
}

.preview-title,
.summary-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--mars-text-color);
}

.preview-subtitle,
.preview-note,
.summary-item span {
  font-size: 12px;
  color: var(--mars-text-color-secondary);
}

.preview-palette {
  display: grid;
  gap: 8px;
}

.preview-icon-bindings {
  display: grid;
  gap: 6px;
}

.preview-icon-bindings-label {
  color: var(--mars-text-color-secondary);
  font-size: 11px;
}

.palette-title {
  font-size: 12px;
  color: var(--mars-text-color);
}

.palette-strip {
  height: 12px;
  border-radius: 999px;
}

.palette-blue-red {
  background: linear-gradient(90deg, #2166ac 0%, #f7f7f7 50%, #b2182b 100%);
}

.palette-green-yellow {
  background: linear-gradient(90deg, #389e0d 0%, #73d13d 50%, #fadb14 100%);
}

.palette-purple-orange {
  background: linear-gradient(90deg, #722ed1 0%, #b37feb 50%, #fa8c16 100%);
}

.palette-sequential-blue {
  background: linear-gradient(90deg, #d8f3ff, #8ed8f8, #3aa9d8, #1678a8, #0b3f6b);
}

.palette-categorical {
  background: linear-gradient(90deg, #46c2cb 0 20%, #ffd166 20% 40%, #ef476f 40% 60%, #8f7ee7 60% 80%, #65c18c 80%);
}

.palette-heat {
  background: linear-gradient(90deg, #3b0f70, #8c2981, #de4968, #fe9f6d, #fcfdbf);
}

.palette-terrain {
  background: linear-gradient(90deg, #173f5f, #2a9d8f, #90be6d, #f9c74f, #f9844a);
}

.palette-threshold {
  background: linear-gradient(90deg, #2f80ed 0 20%, #85c7f2 20% 40%, #f4d35e 40% 60%, #ee964b 60% 80%, #d1495b 80%);
}

.palette-contour {
  background: linear-gradient(90deg, #cfe8ff, #77bdf2, #2b8dcc, #12639a, #083f6e);
}

.palette-velocity {
  background: linear-gradient(90deg, #0b3954, #087e8b, #5ee6d0, #f5d547, #ff6b35);
}

.palette-risk {
  background: linear-gradient(90deg, #27925d 0 33.33%, #f2c94c 33.33% 66.66%, #d83b36 66.66%);
}

.palette-compare {
  background: linear-gradient(90deg, #1f9d8a, #76d7c4, #f4f4f5, #c084fc, #7e22ce);
}

.palette-dashboard {
  background: linear-gradient(90deg, #41c7d9, #7dd3fc, #f7c948, #ff8a4c, #e64980);
}

.palette-seismic-anomaly {
  background: linear-gradient(90deg, #22d3c5, #47a7ff, #f4d35e, #ff7b54, #d9469f);
}

.palette-thermal-infrared {
  background: linear-gradient(90deg, #fee08b, #fdae61, #f46d43, #d73027, #a50026);
}

.palette-post-quake-risk {
  background: linear-gradient(90deg, #27925d 0 33.33%, #f2c94c 33.33% 66.66%, #d83b36 66.66%);
}

.palette-quake-swarm {
  background: linear-gradient(90deg, #193b73, #277da1, #43aa8b, #f9c74f, #f94144);
}

.palette-insar-cycle {
  background: linear-gradient(90deg, #3a0ca3, #4361ee, #4cc9f0, #f9c74f, #f72585, #3a0ca3);
}

.palette-intensity {
  background: linear-gradient(90deg, #3a86a8, #52b788, #f9c74f, #f9844a, #a4133c);
}

.palette-multi-hazard {
  background: linear-gradient(90deg, #3288bd 0 20%, #66c2a5 20% 40%, #e6b566 40% 60%, #e76f51 60% 80%, #9b2226 80%);
}

.palette-resilience {
  background: linear-gradient(90deg, #c1121f, #f3722c, #f9c74f, #52b788, #168aad);
}

.palette-exposure {
  background: linear-gradient(90deg, #fff3b0, #f9c74f, #f8961e, #e85d4a, #7b2cbf);
}

.palette-emergency {
  background: linear-gradient(90deg, #2ec4d6, #3498ff, #7dd3fc, #ffb703, #e63946);
}

.preview-components {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.preview-components span {
  padding: 3px 6px;
  border: 1px solid color-mix(in srgb, #2db7a3 34%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, #2db7a3 9%, transparent);
  color: color-mix(in srgb, #2db7a3 72%, var(--mars-text-color));
  font-size: 10px;
}

.editor-actions {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.publish-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.summary-item strong {
  color: var(--mars-text-color);
  text-align: right;
}

.publish-body {
  min-height: 300px;
  height: auto;
}

.publish-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.publish-summary > .summary-card {
  align-content: start;
}

@media (max-width: 1100px) {
  .workbench-shell.has-chart-panel {
    flex-direction: column;
  }

  .chart-showcase-panel {
    width: 100%;
  }

  .editor-layout,
  .publish-summary {
    grid-template-columns: 1fr;
  }

  .context-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .context-actions,
  .editor-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .publish-body {
    height: auto;
  }

}

@media (max-width: 620px) {
  .template-filter-row {
    grid-template-columns: 1fr;
  }

  .template-card {
    grid-template-columns: 1fr;
  }

  .template-card-cover {
    min-height: 0;
    aspect-ratio: 16 / 9;
  }

  .template-preview-details {
    grid-template-columns: 1fr;
  }

  .template-preview-detail + .template-preview-detail {
    border-top: 1px solid var(--mars-border-color);
    border-left: 0;
  }
}
</style>
