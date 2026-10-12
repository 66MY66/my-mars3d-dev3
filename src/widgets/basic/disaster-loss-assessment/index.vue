<template>
  <mars-dialog customClass="disaster-loss-assessment-pannel" width="400" top="80" right="420">
    <template #title>
      <span>地面站数据预处理</span>
    </template>
    <div class="disaster-loss-assessment-content">
      <div class="content-item">
        <h3>地面站数据预处理</h3>
        <p>该模块用于对地震灾害造成的人员伤亡、经济损失等进行综合评估，包括：</p>
        <ul>
          <li>人员伤亡评估</li>
          <li>建筑物损毁评估</li>
          <li>基础设施损失评估</li>
          <li>经济损失评估</li>
          <li>社会影响评估</li>
        </ul>
        <p>通过多维度数据分析，为灾害应对和灾后重建提供科学依据。</p>
      </div>
    </div>
  </mars-dialog>
</template>

<script lang="ts" setup>
/**
 * 灾害损失评估
 */
</script>

<style scoped lang="less">
.disaster-loss-assessment-content {
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
