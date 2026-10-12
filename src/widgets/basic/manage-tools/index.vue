<template>
  <mars-dialog
    title="算子管理平台"
    icon="tool"
    customClass="manage-tools-pannel"
    :draggable="true"
    :width="540"
    :height="500"
    :position="{ top: 60, right: 10 }"
  >
    <div class="tools-container">
      <div class="platform-entry">
        <div class="platform-text">算子管理与启用请前往算子管理平台，本页面用于页面内调用与结果查看。</div>
        <mars-button type="primary" @click="openOperatorPlatform">打开算子管理平台</mars-button>
      </div>
      <!-- 工具网格 -->
      <div class="tools-grid">
        <div
          v-for="(tool, i) in toolsList"
          :key="tool.widget"
          class="tool-item"
          :class="{ 'active-tool': selectedTool?.widget === tool.widget }"
          @click="selectTool(tool)"
        >
          <div class="tool-preview">
             <span v-if="!tool.icon">{{ tool.name }}</span>
             <mars-icon v-else :icon="tool.icon" width="20"></mars-icon>
          </div>
          <span class="tool-name">{{ tool.name }}</span>
          <span class="edit-btn" @click.stop="openEditForm(tool, i)">编辑</span>
        </div>
        <div class="tool-item add-tool" @click="openAddForm">
          <div class="tool-preview">
            <mars-icon icon="plus" width="20"></mars-icon>
          </div>
          <span class="tool-name">新增算子</span>
        </div>
      </div>

      <!-- 动态参数设置面板 (已移除，改为弹窗) -->
      <!-- <div v-if="selectedTool && currentParamDefs.length" class="params-section">...</div> -->


      <div class="duration-section">
        <div class="duration-title">参数设置（热异常持续时间）</div>
        <div class="duration-fields">
          <div class="field">
            <span class="label">Max：</span>
            <div class="field-input-wrap">
              <mars-input-number v-model:value="hotDurationMax" :min="1" :step="1" />
              <span class="unit">小时</span>
            </div>
          </div>
          <div class="field">
            <span class="label">Min：</span>
            <div class="field-input-wrap">
              <mars-input-number v-model:value="hotDurationMin" :min="1" :step="1" />
              <span class="unit">小时</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增算子表单 -->
      <div v-if="showAddForm" class="add-section">
        <div class="add-fields">
          <mars-input v-model:value="addName" placeholder="算子名称" :allowClear="true" />
          <mars-input v-model:value="addWidget" placeholder="组件键名（widget）" :allowClear="true" />
          <mars-input v-model:value="addIcon" placeholder="图标名（可选）" :allowClear="true" />
        </div>
        <div class="add-actions">
          <mars-button type="primary" @click="confirmAdd">添加</mars-button>
          <mars-button @click="cancelAdd">取消</mars-button>
        </div>
      </div>

      <!-- 操作日志区域 -->
      <div class="logs-section">
        <div class="logs-header">操作日志</div>
        <div class="logs-content-box">
          <div v-if="operationLogs.length > 0" class="logs-text-area">
            <div v-for="(log, index) in operationLogs" :key="index" class="log-line">
              {{ log.text }}
            </div>
          </div>
          <div v-else class="log-empty">等待操作...</div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="footer-actions">
        <KeyMapAction :selectedTool="selectedTool" :params="currentParams" />
        <mars-dropdown-menu trigger="click" placement="topRight">
          <mars-button>查看暂存</mars-button>
          <template #overlay>
            <a-menu @click="onClickDraft">
              <a-menu-item v-for="(item, index) in drafts" :key="index">
                {{ formatDraftTime(item.time) }} - {{ getDraftLabel(item) }}
              </a-menu-item>
              <a-menu-divider v-if="drafts.length" />
              <a-menu-item key="__clear__">清空暂存</a-menu-item>
              <a-menu-item v-if="!drafts.length" disabled>无暂存记录</a-menu-item>
            </a-menu>
          </template>
        </mars-dropdown-menu>
        <mars-button type="primary" @click="setDefault">设为默认</mars-button>
        <mars-button type="primary" @click="saveDraft">暂存</mars-button>
        <mars-button type="primary" @click="runQuery">查询</mars-button>
      </div>
    </div>
  </mars-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import { $alert } from "@mars/components/mars-ui/index"
import * as mapWork from "./map"
import { toolParamDefs, defaultAlgorithms, AlgorithmModel } from "./config"
import KeyMapAction from "./KeyMapAction.vue"
import { openOperatorPlatform } from "@/utils/operator-platform"

// 启用map.ts生命周期
useLifecycle(mapWork)

const { activate, updateWidget, getWidget, currentWidget } = useWidget()

// 工具列表
const toolsList = ref<AlgorithmModel[]>([])

const currentParamDefs = ref<any[]>([])
const currentParams = ref<Record<string, any>>({})

const hotDurationMax = ref<number>(24)
const hotDurationMin = ref<number>(1)
const hotStorage = "mars3d_hotDuration"
const defaultStorage = "mars3d_tools_default"
const draftsStorage = "mars3d_tools_drafts"

// 新增算子表单
const showAddForm = ref(false)
const addName = ref("")
const addWidget = ref("")
const addIcon = ref("")
const storageName = "mars3d_customTools"
const userToolsStorage = "mars3d_tools_userlist"
const editIndex = ref<number | null>(null)

// 选中的工具
const selectedTool = ref<any>(null)
// 工具参数
const toolParams = ref("")
// 操作日志
const operationLogs = ref<Array<{ time: string; text: string }>>([])
// 暂存列表
const drafts = ref<Array<{ time: number; selected: string | null; params: string; hot: { max: number; min: number } }>>([])

onMounted(() => {
  // 载入默认列表
  toolsList.value = [...defaultAlgorithms]
  
  // 载入用户自定义算子 (兼容旧逻辑或扩展)
  try {
    const custom = JSON.parse(localStorage.getItem(storageName) || "[]")
    if (Array.isArray(custom)) {
      custom.forEach((t: any) => {
        // 简单去重
        if (t?.name && t?.widget && !toolsList.value.find((x) => x.widget === t.widget)) {
          toolsList.value.push(t)
        }
      })
    }
  } catch {}
  
  try {
    const saved = JSON.parse(localStorage.getItem(hotStorage) || "{}")
    if (typeof saved?.max === "number") {
      hotDurationMax.value = saved.max
    }
    if (typeof saved?.min === "number") {
      hotDurationMin.value = saved.min
    }
  } catch {}
  // 载入默认配置（选中工具与参数）
  try {
    const def = JSON.parse(localStorage.getItem(defaultStorage) || "null")
    if (def && def.selected) {
      const tool = toolsList.value.find((t) => t.widget === def.selected)
      if (tool) {
        selectedTool.value = tool
        
        // 加载参数定义
        const defs = tool.inputParams || toolParamDefs[tool.widget] || []
        currentParamDefs.value = defs
        
        // 解析参数
        try {
          const params = JSON.parse(def.params || "{}")
          const merged: Record<string, any> = {}
          defs.forEach((d) => {
            merged[d.key] = params[d.key] !== undefined ? params[d.key] : d.value
          })
          currentParams.value = merged
          toolParams.value = JSON.stringify(merged)
        } catch {
          currentParams.value = {}
          toolParams.value = ""
        }
        
        addLog(`已应用默认：${tool.name}${def.params ? ` (参数: ${def.params})` : ""}`)
      }
    }
  } catch {}
  // 载入暂存列表
  refreshDrafts()

  // 检查激活数据
  if (currentWidget && currentWidget.data) {
    if (currentWidget.data.selectToolId) {
      const tool = toolsList.value.find((t: any) => t.id === currentWidget.data.selectToolId)
      if (tool) {
        selectTool(tool)
      }
    } else if (currentWidget.data.selectTool) {
      const tool = toolsList.value.find((t) => t.widget === currentWidget.data.selectTool)
      if (tool) {
        selectTool(tool)
      }
    }
  }
})

onUnmounted(() => {
  updateWidget("toolbar", "manage-tools")
})

// 选择工具
function selectTool(tool: any) {
  selectedTool.value = tool
  
  // 加载参数定义 (用于本地暂存等功能)
  const defs = tool.inputParams || toolParamDefs[tool.widget] || []
  currentParamDefs.value = defs
  
  // 解析默认参数
  const params: Record<string, any> = {}
  defs.forEach((d: any) => {
    params[d.key] = d.value
  })
  currentParams.value = params
  toolParams.value = JSON.stringify(params)
  
  // 激活独立参数窗口
  activate({
    name: "tool-params",
    data: { 
      type: tool.widget, 
      name: tool.name,
      inputParams: tool.inputParams // 传递参数定义到子窗口
    }
  })
}

watch(currentParams, () => {
  toolParams.value = JSON.stringify(currentParams.value)
}, { deep: true })

function openAddForm() {
  showAddForm.value = true
  editIndex.value = null
  addName.value = ""
  addWidget.value = ""
  addIcon.value = ""
}

function cancelAdd() {
  showAddForm.value = false
  addName.value = ""
  addWidget.value = ""
  addIcon.value = ""
  editIndex.value = null
}

function confirmAdd() {
  const name = addName.value.trim()
  const widget = addWidget.value.trim()
  const icon = addIcon.value.trim()

  if (!name || !widget) {
    addLog("新增算子失败：名称或组件键名为空")
    return
  }
  if (editIndex.value === null) {
    if (toolsList.value.find((t) => t.widget === widget)) {
      addLog(`新增算子失败：组件键名重复 (${widget})`)
      return
    }
    const newTool = { name, widget, icon: icon || undefined }
    toolsList.value.push(newTool as any)
    addLog(`新增算子：${name} (${widget})`)
    try {
      const custom = JSON.parse(localStorage.getItem(storageName) || "[]")
      custom.unshift(newTool)
      localStorage.setItem(storageName, JSON.stringify(custom.slice(0, 20)))
    } catch {}
  } else {
    const i = editIndex.value
    const prev = toolsList.value[i]
    if (toolsList.value.some((t, idx) => idx !== i && t.widget === widget)) {
      addLog(`修改算子失败：组件键名重复 (${widget})`)
      return
    }
    toolsList.value[i] = { name, widget, icon: icon || undefined } as any
    addLog(`已修改算子：${prev.name} → ${name}`)
  }
  try {
    localStorage.setItem(userToolsStorage, JSON.stringify(toolsList.value))
  } catch {}
  cancelAdd()
}

watch([hotDurationMax, hotDurationMin], ([mx, mn]) => {
  if (mn > mx) {
    hotDurationMin.value = mx
  }
  try {
    localStorage.setItem(hotStorage, JSON.stringify({ max: hotDurationMax.value, min: hotDurationMin.value }))
  } catch {}
  addLog(`设置热异常持续时间: Max=${hotDurationMax.value}h, Min=${hotDurationMin.value}h`)
})

// 取消选择
function cancelSelection() {
  selectedTool.value = null
  toolParams.value = ""
  addLog("取消工具选择")
}

// 启用工具
function activateTool() {
  if (selectedTool.value) {
    const params = toolParams.value
    addLog(`启用工具: ${selectedTool.value.name}${params ? ` (参数: ${params})` : ""}`)
    
    const widget = selectedTool.value.widget
    if (!getWidget(widget)) {
      $alert("该功能尚未实现", selectedTool.value.name)
      return
    }
    
    // 激活对应的widget
    activate({
      name: widget,
      data: { ...currentParams.value }
    })
    
    // 清空选择
    selectedTool.value = null
    toolParams.value = ""
  }
}

// 添加日志
function addLog(text: string) {
  const now = new Date()
  const time = now.toLocaleTimeString("zh-CN", { hour12: false })
  
  operationLogs.value.unshift({
    time,
    text
  })
  
  // 保持最多显示10条日志
  if (operationLogs.value.length > 10) {
    operationLogs.value.pop()
  }
}

// 设为默认
function setDefault() {
  try {
    const payload = {
      selected: selectedTool.value ? selectedTool.value.widget : null,
      params: toolParams.value || "",
      hot: { max: hotDurationMax.value, min: hotDurationMin.value }
    }
    localStorage.setItem(defaultStorage, JSON.stringify(payload))
    const toolName = selectedTool.value ? selectedTool.value.name : "未选工具"
    const paramStr = toolParams.value ? ` (参数: ${toolParams.value})` : ""
    addLog(`已设为默认：${toolName}${paramStr} (Max=${hotDurationMax.value}h, Min=${hotDurationMin.value}h)`)
  } catch {
    addLog("设为默认失败：存储异常")
  }
}

// 暂存
function saveDraft() {
  try {
    const draft = {
      time: Date.now(),
      selected: selectedTool.value ? selectedTool.value.widget : null,
      params: toolParams.value || "",
      hot: { max: hotDurationMax.value, min: hotDurationMin.value }
    }
    const raw = localStorage.getItem(draftsStorage)
    const list = raw ? JSON.parse(raw) : []
    if (Array.isArray(list)) {
      list.unshift(draft)
      localStorage.setItem(draftsStorage, JSON.stringify(list.slice(0, 20)))
    } else {
      localStorage.setItem(draftsStorage, JSON.stringify([draft]))
    }
    const toolName = selectedTool.value ? selectedTool.value.name : "未选工具"
    const paramStr = toolParams.value ? ` (参数: ${toolParams.value})` : ""
    addLog(`已暂存：${toolName}${paramStr} (Max=${hotDurationMax.value}h, Min=${hotDurationMin.value}h)`)
  } catch {
    addLog("暂存失败：存储异常")
  }
}

// 查询
function runQuery() {
  if (!selectedTool.value) {
    addLog("查询失败：未选择工具")
    return
  }
  const params = toolParams.value
  addLog(`查询：${selectedTool.value.name}${params ? ` (参数: ${params})` : ""}`)
  
  const widget = selectedTool.value.widget
  if (!getWidget(widget)) {
    $alert("该功能尚未实现", selectedTool.value.name)
    return
  }
  
  // 激活组件并传递参数
  activate({
    name: widget,
    data: { ...currentParams.value }
  })
}

// 暂存辅助
function refreshDrafts() {
  try {
    const raw = localStorage.getItem(draftsStorage)
    drafts.value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(drafts.value)) {
      drafts.value = []
    }
  } catch {
    drafts.value = []
  }
}
function onClickDraft({ key }: any) {
  if (key === "__clear__") {
    try {
      localStorage.removeItem(draftsStorage)
      drafts.value = []
      addLog("已清空暂存")
    } catch {
      addLog("清空暂存失败")
    }
    return
  }
  const idx = Number(key)
  if (!Number.isNaN(idx) && drafts.value[idx]) {
    applyDraft(drafts.value[idx])
  }
}
function applyDraft(draft: { time: number; selected: string | null; params: string; hot: { max: number; min: number } }) {
  if (draft.hot) {
    hotDurationMax.value = draft.hot.max
    hotDurationMin.value = draft.hot.min
  }
  if (draft.selected) {
    const tool = toolsList.value.find((t) => t.widget === draft.selected)
    if (tool) {
      selectedTool.value = tool
      
      // 加载参数定义
      const defs = tool.inputParams || toolParamDefs[tool.widget] || []
      currentParamDefs.value = defs
      
      // 解析参数
      try {
        const savedParams = JSON.parse(draft.params || "{}")
        // 合并默认值
        const merged: Record<string, any> = {}
        defs.forEach((d) => {
          merged[d.key] = savedParams[d.key] !== undefined ? savedParams[d.key] : d.value
        })
        currentParams.value = merged
        toolParams.value = JSON.stringify(merged)
      } catch {
        currentParams.value = {}
        toolParams.value = ""
      }
    } else {
      selectedTool.value = null as any
      currentParamDefs.value = []
      currentParams.value = {}
      toolParams.value = ""
    }
  } else {
    selectedTool.value = null as any
    currentParamDefs.value = []
    currentParams.value = {}
    toolParams.value = ""
  }
  addLog(`已应用暂存：${getDraftLabel(draft)}`)
}
function formatDraftTime(t: number) {
  const d = new Date(t)
  return d.toLocaleTimeString("zh-CN", { hour12: false })
}
function getDraftLabel(draft: { selected: string | null; params: string }) {
  let name = "未选工具"
  if (draft.selected) {
    const t = toolsList.value.find((x) => x.widget === draft.selected)
    name = t ? t.name : draft.selected
  }
  return `${name}${draft.params ? ` · ${draft.params}` : ""}`
}

function openEditForm(tool: any, i: number) {
  showAddForm.value = true
  editIndex.value = i
  addName.value = tool.name || ""
  addWidget.value = tool.widget || ""
  addIcon.value = tool.icon || ""
}
</script>

<style lang="less">
.manage-tools-pannel {
  --mt-text: var(--mars-text-color);
  --mt-muted: var(--mars-tree-text);
  --mt-empty: var(--mars-extra-text-color);
  --mt-accent: var(--mars-primary-color);
  --mt-card-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  --mt-card-border: rgba(255, 255, 255, 0.12);
  --mt-hover-bg: rgba(64, 150, 255, 0.1);
  --mt-active-bg: rgba(64, 150, 255, 0.15);
  --mt-field-bg: rgba(0, 0, 0, 0.2);
  --mt-field-border: rgba(255, 255, 255, 0.12);
  --mt-section-bg: var(--mars-control-bg);
  --mt-log-bg: rgba(30, 40, 60, 0.6);
  --mt-log-border: rgba(255, 255, 255, 0.12);
  --mt-edit-bg: rgba(0, 0, 0, 0.4);
  --mt-edit-text: rgba(255, 255, 255, 0.92);

  color: var(--mt-text);

  .mars-dialog__content {
    display: flex;
    flex-direction: column;
  }
}

:root[data-theme="light"] .manage-tools-pannel {
  --mt-text: rgba(0, 0, 0, 0.88);
  --mt-muted: rgba(0, 0, 0, 0.65);
  --mt-empty: rgba(0, 0, 0, 0.45);
  --mt-accent: rgba(64, 150, 255, 1);
  --mt-card-bg: rgba(0, 0, 0, 0.03);
  --mt-card-border: rgba(0, 0, 0, 0.12);
  --mt-hover-bg: rgba(64, 150, 255, 0.08);
  --mt-active-bg: rgba(64, 150, 255, 0.12);
  --mt-field-bg: rgba(0, 0, 0, 0.03);
  --mt-field-border: rgba(0, 0, 0, 0.12);
  --mt-section-bg: rgba(255, 255, 255, 0.28);
  --mt-log-bg: rgba(0, 0, 0, 0.04);
  --mt-log-border: rgba(0, 0, 0, 0.12);
  --mt-edit-bg: rgba(0, 0, 0, 0.08);
  --mt-edit-text: rgba(0, 0, 0, 0.88);
}
</style>

<style lang="less" scoped>
.tools-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 15px;
  font-size: 14px;
}

.platform-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--mt-card-border);
  background: var(--mt-section-bg);
}

.platform-text {
  color: var(--mt-muted);
  font-size: 12px;
  line-height: 1.4;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 10px;
  background-color: transparent;
  max-height: 280px;
  overflow-y: auto;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0;
  height: 96px;
  position: relative;
  background-color: transparent;
  border: none;
  cursor: pointer;
  
  .tool-preview {
    width: 100%;
    height: 56px;
    background: var(--mt-card-bg);
    border-radius: 0;
    border: 1px solid var(--mt-card-border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .tool-name {
    font-size: 12px;
    color: var(--mt-muted);
    text-align: center;
    white-space: nowrap;
  }

  &:hover .tool-preview {
    border-color: var(--mt-accent);
    background: var(--mt-hover-bg);
  }
  
  &:hover .tool-name {
    color: var(--mt-accent);
  }
  
  &.active-tool .tool-preview {
    border-color: var(--mt-accent);
    background: var(--mt-active-bg);
    box-shadow: 0 0 10px rgba(64, 169, 255, 0.2);
  }
  
  &.active-tool .tool-name {
    color: var(--mt-accent);
    font-weight: 500;
  }

  .mars-icon {
    color: var(--mt-text);
  }

  .edit-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 12px;
    color: var(--mt-edit-text);
    padding: 2px 6px;
    border-radius: 0;
    background: var(--mt-edit-bg);
    display: none;
    z-index: 10;
  }
  
  &:hover .edit-btn {
    display: inline-block;
  }
}

.add-tool .tool-preview {
  background: var(--mt-card-bg);
}

.duration-section {
  margin: 0 10px;
  padding: 0;
  border: none;
  background-color: transparent;
}

.duration-title {
  font-size: 14px;
  color: var(--mt-muted);
  margin-bottom: 10px;
}

.duration-fields {
  display: flex;
  gap: 20px;
}

.field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--mt-field-bg);
  border-radius: 0;
  padding-right: 8px;
  border: 1px solid var(--mt-field-border);
}

.field-input-wrap :deep(.ant-input-number) {
  flex: 1;
  background: transparent;
  border: none;
  box-shadow: none;
  width: 100%;
}

.label {
  color: var(--mt-muted);
  font-size: 14px;
}
.unit {
  color: var(--mt-muted);
  font-size: 14px;
  white-space: nowrap;
}

.add-section {
  margin: 0 10px;
  padding: 10px;
  border: 1px solid var(--mt-card-border);
  border-radius: 0;
  background-color: var(--mt-section-bg);
}

.add-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.add-actions {
  display: flex;
  gap: 8px;
}

.logs-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 120px;
  padding: 0 10px;
}

.logs-header {
  font-weight: 500;
  color: var(--mt-muted);
  margin-bottom: 8px;
  font-size: 14px;
}

.logs-content-box {
  flex: 1;
  background-color: var(--mt-log-bg);
  border: 1px solid var(--mt-log-border);
  border-radius: 0;
  padding: 10px;
  overflow-y: auto;
}

.logs-text-area {
  font-family: monospace;
  font-size: 13px;
  color: var(--mt-text);
  line-height: 1.5;
}

.log-line {
  margin-bottom: 4px;
}

.log-empty {
  color: var(--mt-empty);
  font-size: 13px;
}

.footer-actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 10px;
  background-color: transparent;
}

.params-section {
  margin: 0 10px;
  padding: 10px;
  border: 1px solid var(--mt-log-border);
  border-radius: 0;
  background-color: var(--mt-log-bg);
}

.params-title {
  font-size: 14px;
  color: var(--mt-muted);
  margin-bottom: 10px;
  font-weight: 500;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.param-label {
  width: 80px;
  color: var(--mt-muted);
  font-size: 14px;
  text-align: right;
}

.param-content {
  flex: 1;
  display: flex;
  align-items: center;
}

.input-unit-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  
  .unit {
    color: var(--mt-muted);
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>
