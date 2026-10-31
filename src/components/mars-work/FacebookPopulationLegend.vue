<template>
  <aside
    class="facebook-population-legend"
    data-testid="facebook-population-legend"
    aria-label="Facebook人口密度图例，单位人每平方公里"
  >
    <header class="facebook-population-legend__header">
      <strong>Facebook 人口密度</strong>
      <span>人/平方公里</span>
    </header>
    <div class="facebook-population-legend__scale">
      <div v-for="item in legendItems" :key="item.label" class="facebook-population-legend__item">
        <span class="facebook-population-legend__swatch" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
const legendItems = [
  { label: "0", color: "#ffffff" },
  { label: "1 – 20", color: "#e8f5cb" },
  { label: "21 – 50", color: "#c6e08c" },
  { label: "51 – 100", color: "#8dc95c" },
  { label: "101 – 200", color: "#56b044" },
  { label: "201 – 500", color: "#2e943a" },
  { label: "501 – 1 000", color: "#187a3e" },
  { label: "1 001 – 2 000", color: "#106e60" },
  { label: "2 001 – 5 000", color: "#166096" },
  { label: "5 001 – 10 000", color: "#1846a8" },
  { label: "≥ 10 001", color: "#102a78" }
]
</script>

<style scoped lang="less">
.facebook-population-legend {
  position: absolute;
  z-index: 998;
  top: 14px;
  right: 14px;
  width: 184px;
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

.facebook-population-legend__header {
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
    white-space: nowrap;
  }

  span {
    color: #667085;
    font-size: 10px;
    white-space: nowrap;
  }
}

.facebook-population-legend__scale {
  display: grid;
  gap: 3px;
}

.facebook-population-legend__item {
  display: grid;
  grid-template-columns: 14px 1fr;
  align-items: center;
  gap: 7px;
  min-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.facebook-population-legend__swatch {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(23, 32, 51, 0.16);
  box-sizing: border-box;
}

@media (max-height: 620px), (max-width: 640px) {
  .facebook-population-legend {
    top: 8px;
    right: 8px;
    width: 170px;
    padding: 8px 9px;
    font-size: 12px;
  }

  .facebook-population-legend__header {
    margin-bottom: 4px;
    padding-bottom: 5px;
  }

  .facebook-population-legend__scale {
    gap: 1px;
  }
}
</style>
