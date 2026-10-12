<template>
  <div v-show="visible !== false" class="thermal-evolution-panel">
    <div class="panel-header">
      <span class="title">热异常时空演化演示</span>
    </div>
    <div class="panel-content">
      <div class="control-item">
        <span class="label">开始日期:</span>
        <mars-date-picker v-model:value="startTime" format="YYYY-MM-DD" :allowClear="false" />
      </div>
      <div class="control-item">
        <span class="label">结束日期:</span>
        <mars-date-picker v-model:value="endTime" format="YYYY-MM-DD" :allowClear="false" />
      </div>
      <div class="control-item">
        <span class="label">演化进度:</span>
        <div class="timeline-wrapper">
          <mars-icon
            :icon="isPlaying ? 'pause-one' : 'play'"
            class="play-btn"
            width="20"
            color="#fff"
            @click="togglePlay"
          />
          <mars-slider
            v-model:value="progress"
            :min="0"
            :max="totalDays"
            :step="0.1"
            class="timeline-slider"
          />
          <span class="progress-text">{{ currentDate }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onUnmounted, watch } from "vue"
import dayjs from "dayjs"
import * as mapWork from "./thermal-map"
import useLifecycle from "@mars/common/uses/use-lifecycle"

defineProps<{
  visible?: boolean
}>()

// 启用mapWork生命周期管理
useLifecycle(mapWork)

// 默认一个月前
const startTime = ref(dayjs().subtract(1, "month"))
const endTime = ref(dayjs())
const progress = ref(0)
const isPlaying = ref(false)
let timer: any = null

const totalDays = computed(() => {
  return dayjs(endTime.value).diff(dayjs(startTime.value), "day")
})

watch([startTime, endTime], () => {
  if (totalDays.value > 0) {
    mapWork.generateMockData(totalDays.value)
    progress.value = 0
    mapWork.updateThermalLayer(0)
  }
}, { immediate: true })

// 计算当前显示的日期
const currentDate = computed(() => {
  if (!startTime.value) {
    return ""
  }
  // 根据进度计算当前日期
  return dayjs(startTime.value).add(Math.floor(progress.value), "day").format("YYYY-MM-DD")
})

watch(progress, (val) => {
  mapWork.updateThermalLayer(Math.floor(val))
})

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    startAnimation()
  } else {
    stopAnimation()
  }
}

const startAnimation = () => {
  stopAnimation()
  
  const step = () => {
    if (!isPlaying.value) {
      return
    }
    
    // 如果已经在最后一天，重置为0
    if (progress.value >= totalDays.value) {
      progress.value = 0
    } else {
      progress.value = Number((progress.value + 0.1).toFixed(1))
    }
    
    timer = setTimeout(step, 50) // 50ms 更新一次
  }
  
  // 延迟启动第一次更新，避免立即跳转
  timer = setTimeout(step, 50)
}

const stopAnimation = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

onUnmounted(() => {
  stopAnimation()
})
</script>

<style lang="less" scoped>
.thermal-evolution-panel {
  position: absolute;
  bottom: 50px;
  left: 20%;
  right: 20%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 10px 20px;
  color: #fff;
  z-index: 999;
}

.panel-header {
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 5px;
  .title {
    font-size: 16px;
    font-weight: bold;
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .label {
    min-width: 70px;
  }
}

.timeline-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
  
  .play-btn {
    cursor: pointer;
    &:hover {
      opacity: 0.8;
    }
  }
  
  .timeline-slider {
    flex: 1;
  }
  
  .progress-text {
    min-width: 90px;
    text-align: right;
    font-family: monospace;
  }
}
</style>
