<template>
  <aside class="gdp-density-legend" data-testid="gdp-density-legend" aria-label="GDP分布密度图例，单位万元每平方公里">
    <header class="gdp-density-legend__header">
      <strong>GDP分布密度</strong>
      <span>万元/平方公里</span>
    </header>
    <div class="gdp-density-legend__scale">
      <div v-for="item in legendItems" :key="item.label" class="gdp-density-legend__item">
        <span class="gdp-density-legend__swatch" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
const legendItems = [
  { label: "0", color: "#ffffff" },
  { label: "1 – 100", color: "#fff3c4" },
  { label: "101 – 500", color: "#ffd678" },
  { label: "501 – 1 000", color: "#ffb048" },
  { label: "1 001 – 2 500", color: "#f58230" },
  { label: "2 501 – 5 000", color: "#e65a28" },
  { label: "5 001 – 10 000", color: "#c83230" },
  { label: "10 001 – 25 000", color: "#aa2048" },
  { label: "25 001 – 50 000", color: "#821860" },
  { label: "50 001 – 100 000", color: "#60146e" },
  { label: "≥ 100 001", color: "#3a0c52" }
]
</script>

<style scoped lang="less">
.gdp-density-legend {
  position: absolute;
  z-index: 998;
  top: 14px;
  right: 14px;
  width: 172px;
  padding: 10px 11px 11px;
  color: #172033;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(23, 32, 51, 0.14);
  border-radius: 7px;
  box-shadow: 0 5px 18px rgba(19, 31, 55, 0.17);
  font: 13px/1.25 "Microsoft YaHei", "PingFang SC", sans-serif;
  pointer-events: none;
  backdrop-filter: blur(6px);
}

.gdp-density-legend__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 7px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(23, 32, 51, 0.11);

  strong {
    font-size: 13px;
    font-weight: 650;
  }

  span {
    color: #667085;
    font-size: 10px;
    white-space: nowrap;
  }
}

.gdp-density-legend__scale {
  display: grid;
  gap: 3px;
}

.gdp-density-legend__item {
  display: grid;
  grid-template-columns: 14px 1fr;
  align-items: center;
  gap: 7px;
  min-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.gdp-density-legend__swatch {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(23, 32, 51, 0.16);
  box-sizing: border-box;
}

@media (max-height: 620px), (max-width: 640px) {
  .gdp-density-legend {
    top: 8px;
    right: 8px;
    width: 158px;
    padding: 8px 9px;
    font-size: 12px;
  }

  .gdp-density-legend__header {
    margin-bottom: 4px;
    padding-bottom: 5px;
  }

  .gdp-density-legend__scale {
    gap: 1px;
  }
}
</style>
