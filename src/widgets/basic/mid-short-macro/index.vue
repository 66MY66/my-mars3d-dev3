<template>
  <mars-dialog customClass="mid-short-macro-pannel" width="400" top="80" right="10">
    <template #title>
      <span>风险区域监测</span>
    </template>
    <div class="mid-short-macro-content">
      <div class="content-item">
        <h3>风险区域监测</h3>
        <p>该模块用于识别和分析地震前出现的中短期宏观异常现象，包括：</p>
        <ul>
          <li>地下水异常变化</li>
          <li>地气相互作用异常</li>
          <li>动物异常行为</li>
          <li>地热异常变化</li>
          <li>其他宏观异常现象</li>
        </ul>
        <p>根据这些异常信息，进行综合分析和评估，提供早期预警信息。</p>
      </div>
    </div>
  </mars-dialog>
</template>

<script lang="ts" setup>
/**
 * 中短期宏观异常
 */
</script>

<style scoped lang="less">
.mid-short-macro-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;

  .content-item {
    h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #333;
    }

    p {
      margin: 8px 0;
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }

    ul {
      margin: 12px 0 12px 20px;
      padding: 0;

      li {
        margin: 6px 0;
        font-size: 14px;
        color: #666;
      }
    }
  }
}
</style>
