<template>
  <mars-dialog
    title="告警确认"
    icon="tips-one"
    custom-class="alert-confirm-panel-dialog"
    :draggable="true"
    :width="380"
    top="80"
    right="10"
    :nopadding="true"
  >
    <div class="alert-panel">
      <div class="alert-scroll">
        <div class="alert-top">
          <div class="alert-title-line">
            <mars-checkbox v-model:checked="alertChecked" />
            <span class="alert-title-text">{{ formattedAlertTime }} 触发预告警通知</span>
          </div>

          <div class="alert-details">
            <div class="detail-item">告警地点：{{ alertInfo.location }}</div>
            <div class="detail-item">热异常程度：{{ alertInfo.degree }}</div>
            <div class="detail-item">持续时间：{{ alertInfo.duration }}</div>
            <div class="detail-item">影响范围：{{ alertInfo.scope }}</div>
          </div>

          <mars-button class="locate-btn" block @click="locate">定位</mars-button>
        </div>

        <div class="alert-bottom">
          <div class="section-label">添加算子</div>

          <div class="op-text-buttons" role="tablist" aria-label="添加算子">
            <button
              type="button"
              class="op-text-btn"
              :class="{ 'is-active': opSelected === 'spatio-temporal' }"
              role="tab"
              :aria-selected="opSelected === 'spatio-temporal'"
              @click="selectOperation('spatio-temporal')"
            >
              时间演化
            </button>
            <button
              type="button"
              class="op-text-btn"
              :class="{ 'is-active': opSelected === 'analysis' }"
              role="tab"
              :aria-selected="opSelected === 'analysis'"
              @click="selectOperation('analysis')"
            >
              空间分析
            </button>
          </div>

          <div class="ops-hint">请选择操作以配置参数</div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="alert-footer-actions">
        <mars-button class="action-btn" type="primary" @click="runOperation">计算</mars-button>
        <mars-button class="action-btn" @click="saveOperation">保存</mars-button>
        <mars-button class="action-btn" type="primary" @click="confirmAlert">确认</mars-button>
      </div>
    </template>
  </mars-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import * as mapWork from "./map"
import { $message } from "@mars/components/mars-ui/index"
import type { AlertInfo } from "@/shell/alerts"
import { createMockAlerts } from "@/shell/alerts"
import { useNotificationStore } from "@/shell/notificationStore"

useLifecycle(mapWork)

const { currentWidget, disable } = useWidget()

const alertChecked = ref(true)
const initialAlert = (currentWidget?.data?.alertInfo as AlertInfo | undefined) || createMockAlerts()[0]
const alertInfo = ref<AlertInfo>({ ...initialAlert })

const formattedAlertTime = computed(() => {
  const d = new Date(alertInfo.value.time)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${y}年${m}月${day}日 ${hh}:${mm}:${ss}`
})

function locate() {
  const [lng, lat] = alertInfo.value.location.split(",").map((v) => Number(v.trim()))
  if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
    mapWork.locateTo(lng, lat)
  } else {
    $message("无法定位：坐标格式错误")
  }
}

const opSelected = ref("spatio-temporal")
const opStartTime = ref<any>(null)
const opOverlay = ref<boolean>(false)

function selectOperation(value: string) {
  opSelected.value = value
}

function runOperation() {
  const sel = opSelected.value
  if (sel === "spatio-temporal") {
    $message(`启用时间演化：起始时间=${opStartTime.value ?? "未设"}, 叠加分析=${opOverlay.value ? "是" : "否"}`)
  } else {
    $message("启用空间分析")
  }
}

function saveOperation() {
  try {
    const payload = {
      operator: opSelected.value,
      startTime: opStartTime.value,
      overlay: opOverlay.value,
      alertLocation: alertInfo.value.location
    }
    localStorage.setItem("mars3d_alert_operation", JSON.stringify(payload))
    $message("已保存操作参数")
  } catch {
    $message("保存失败")
  }
}

function confirmAlert() {
  if (!alertChecked.value) {
    $message("请勾选确认告警")
    return
  }
  try {
    const { markRead, upsertAlert } = useNotificationStore()
    upsertAlert(alertInfo.value)
    const createdAt = new Date(alertInfo.value.time).getTime()
    const id = `alert_${createdAt}_${alertInfo.value.location.replace(/\s+/g, "")}`
    markRead(id)
  } catch {}
  $message("已确认告警", "success")
  window.dispatchEvent(new CustomEvent("mars3d_alertConfirmed", {
    detail: { alertInfo: alertInfo.value }
  }))
  disable("alert-confirm")
}

onMounted(() => {
  const { upsertAlert } = useNotificationStore()
  upsertAlert(alertInfo.value)
})
</script>

<style lang="less" scoped>
.alert-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.alert-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  --alert-inner-inset: calc(var(--popup-body-padding, 14px) + 12px);
  padding: var(--popup-body-padding, 14px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-top,
.alert-bottom {
  padding: 12px;
  background: color-mix(in srgb, var(--popup-surface, #11161c) 88%, #fff 12%);
  border: 1px solid var(--popup-border, rgba(255 255 255 / 0.12));
  border-radius: var(--popup-item-radius, 8px);
  box-sizing: border-box;
}

.alert-top {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-title-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  text-align: left;
}

.alert-title-text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--mars-text-color, var(--text-primary, #fff));
}

.alert-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding-left: calc(16px + 8px);
  box-sizing: border-box;
  text-align: left;
}

.detail-item {
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.78));
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
}

.locate-btn {
  width: 100%;
}

.alert-bottom {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--mars-text-color, var(--text-primary, #fff));
  text-align: left;
}

.op-text-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.op-text-btn {
  height: 32px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--text-primary, #fff) 16%, transparent);
  border-radius: var(--popup-item-radius, 8px);
  background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent);
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.72));
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: var(--mars-text-color, var(--text-primary, #fff));
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 35%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 10%, transparent);
  }

  &.is-active {
    color: var(--color-primary, #41a8ff);
    border-color: color-mix(in srgb, var(--color-primary, #41a8ff) 55%, transparent);
    background: color-mix(in srgb, var(--color-primary, #41a8ff) 16%, transparent);
    font-weight: 600;
  }
}

.ops-hint {
  text-align: left;
  color: var(--mars-text-color-secondary, rgba(255 255 255 / 0.55));
  font-size: 12px;
  line-height: 1.5;
}

.alert-footer-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  padding: 10px var(--alert-inner-inset, calc(var(--popup-body-padding, 14px) + 12px));
  box-sizing: border-box;
  border-top: 1px solid var(--layout-border, var(--popup-border, rgba(255 255 255 / 0.12)));
  background: color-mix(in srgb, var(--popup-surface, #11161c) 96%, #fff 4%);
}

.action-btn {
  width: 100%;
  min-width: 0;
}
</style>

<style lang="less">
.alert-confirm-panel-dialog.mars-dialog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;

  .mars-dialog__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .mars-dialog__footer {
    flex-shrink: 0;
    padding: 0 !important;
  }
}
</style>
