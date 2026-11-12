<template>
  <div class="stats-chart-frame">
    <div v-if="loading" data-testid="stats-loading" class="card-status">加载中...</div>
    <div v-else-if="error" data-testid="stats-error" class="card-status error">{{ error }}</div>
    <div v-else-if="empty" data-testid="stats-empty" class="card-status">暂无数据</div>
    <div
      :ref="chartRef"
      data-testid="stats-chart"
      class="chart"
      :class="{ 'is-status-visible': loading || !!error || empty }"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  empty: boolean
  error: string | null
  chartRef?(el: Element | null): void
}>()
</script>

<style scoped>
.stats-chart-frame {
  position: relative;
  width: 100%;
  height: 220px;
}

.chart {
  width: 100%;
  height: 220px;
}

.chart.is-status-visible {
  visibility: hidden;
}

.card-status {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.card-status.error {
  color: #ff7875;
}
</style>
