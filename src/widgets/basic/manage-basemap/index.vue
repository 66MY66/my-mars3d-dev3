<template>
  <mars-dialog
    ref="basemapDialogRef"
    v-model:visible="dialogVisible"
    title="底图"
    icon="international"
    customClass="manage-basemap-pannel"
    :draggable="false"
    :handles="DIALOG_HANDLES"
    :width="DIALOG_WIDTH"
    :min-width="DIALOG_MIN_WIDTH"
    :min-height="DIALOG_MIN_HEIGHT"
    :position="dialogPosition"
    @closed="handleClose"
  >
    <template #headerRight>
      <div class="basemap-header-actions" @mousedown.stop>
        <div class="terrain-toggle">
          <span class="terrain-text">地形</span>
          <mars-switch v-model:checked="chkHasTerrain" @change="changeTerrain" />
        </div>
        <button
          type="button"
          class="mars-popup-header-btn basemap-header-refresh"
          aria-label="刷新"
          title="刷新"
          @click="handleRefreshBasemap"
        >
          <mars-icon icon="refresh" :width="18" />
        </button>
      </div>
    </template>
    <ul class="basemap">
      <li v-for="(item, i) in baseMaps" :key="i" class="basemap-card" :class="{ 'active-card': active === item.id }" @click="changeBaseMaps(item)">
        <img class="icon" :src="`${item.options.icon || '//data.mars3d.cn/img/thumbnail/basemap/bingAerial.png'}`" />
        <a-tooltip :title="item.name" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
          <div class="name">{{ item.name }}</div>
        </a-tooltip>
      </li>
    </ul>
  </mars-dialog>
</template>

<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted, watch } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import { useWidget } from "@mars/common/store/widget"
import { $message } from "@mars/components/mars-ui/index"
import * as mapWork from "./map"
import { POPUP_PANEL_RESIZE_HANDLES } from "@mars/common/constants/popup-resize-handles"

const DIALOG_WIDTH = 340
const DIALOG_MIN_WIDTH = 340
/** 最小高度：标题栏(44) + 内边距(14+14) + 一行卡片(119) = 191 */
const DIALOG_MIN_HEIGHT = 191
/** 上/右/下边 + 左下/右下角缩放，保持左上贴边 */
const DIALOG_HANDLES = [...POPUP_PANEL_RESIZE_HANDLES]
const dialogPosition = { top: 0, left: 0, bottom: 0 }
const basemapDialogRef = ref<{ resetSizeToDefault?:() => void } | null>(null)

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: true
  }
)

const emit = defineEmits(["update:visible"])

useLifecycle(mapWork)

const { updateWidget, disable } = useWidget()

const dialogVisible = ref(!!props.visible)
const baseMaps = ref<any[]>([])
const active = ref("")
const chkHasTerrain = ref(false)

watch(
  () => props.visible,
  (value) => {
    dialogVisible.value = !!value
  }
)

watch(dialogVisible, (value) => {
  emit("update:visible", value)
})

onMounted(() => {
  const layers = mapWork.getLayers()
  initData(layers)
})

onUnmounted(() => {
  updateWidget("toolbar", "manage-basemap")
})

function handleClose() {
  disable("manage-basemap")
}

function initData(e: any) {
  baseMaps.value = e.baseMaps.map((m: any) => {
    if (m.isAdded && m.show) {
      active.value = m.id
    }
    return {
      name: m.name,
      id: m.id,
      options: markRaw(m.options)
    }
  })

  chkHasTerrain.value = e.hasTerrain || false
}

async function changeBaseMaps(item: any) {
  const prev = active.value
  const ok = await mapWork.changeBaseMaps(item)
  if (ok) {
    active.value = item.id
  } else {
    active.value = prev
  }
}

function changeTerrain() {
  mapWork.changeTerrain(chkHasTerrain.value)
}

function handleRefreshBasemap() {
  basemapDialogRef.value?.resetSizeToDefault?.()
  const layers = mapWork.getLayers()
  initData(layers)
  mapWork.refreshBasemap()
  $message("底图已刷新")
}
</script>

<style lang="less">
.manage-basemap-pannel {
  .mars-dialog__header {
    display: flex;
    align-items: center;
    line-height: normal;
    overflow: visible;

    .icon {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: var(--popup-header-height);
    }

    .mars-dialog__header-right {
      float: none;
      margin-top: 0;
      margin-right: 8px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
    }

    .basemap-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .basemap-header-refresh {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      border-radius: calc(var(--popup-radius, 8px) - 2px);
      color: var(--mars-text-color);
      cursor: pointer;
      opacity: 0.85;
      transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);

      &:hover {
        opacity: 1;
        color: var(--color-primary, #2d8cf0);
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .close-btn {
      float: none;
      margin-top: 0;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      border-radius: calc(var(--popup-radius, 8px) - 2px);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }

  .mars-dialog__content {
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
    padding: 14px !important;
  }

  .terrain-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0;
    box-sizing: border-box;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: default;
    user-select: none;
  }

  .terrain-toggle :deep(.mars-switch) {
    flex-shrink: 0;
    margin: 0;
    vertical-align: middle;
    width: 34px;
    min-width: 34px;
    height: 18px;
    border-radius: 999px;
    line-height: 18px;
  }

  .terrain-toggle :deep(.mars-switch.ant-switch-checked .ant-switch-handle) {
    inset-inline-start: calc(100% - 16px);
  }

  .terrain-toggle :deep(.mars-switch .ant-switch-handle) {
    width: 14px;
    height: 14px;
    top: 1px;
    inset-inline-start: 2px;
  }

  .terrain-toggle :deep(.mars-switch .ant-switch-handle::before) {
    border-radius: 50%;
  }

  .terrain-text {
    font-size: 12px;
    line-height: 1;
    color: var(--mars-text-color);
    white-space: nowrap;
  }
}
</style>
<style lang="less" scoped>
.basemap {
  flex: 1;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: hidden;
  overflow-y: auto;
  display: grid;
  justify-content: stretch;
  align-content: start;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(94px, 1fr));
}

.basemap-card {
  width: 100%;
  min-width: 0;
  min-height: 119px;
  box-sizing: border-box;
  flex: none;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  list-style-type: none;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  color: var(--mars-text-color);
  border: 1.5px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 3px 3px 0;
  background: var(--panel-header-bg);
  overflow: visible;

  &:hover {
    .active-card();
  }

  .icon {
    width: 100%;
    aspect-ratio: 1;
    min-width: 0;
    min-height: 0;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
    display: block;
  }

  .name {
    width: 100%;
    min-width: 0;
    flex-shrink: 0;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    margin: 7px 0;
    box-sizing: border-box;
  }
}

.active-card {
  color: #337fe5 !important;
  border-color: #337fe5;
}
</style>
