<template>
  <div class="satellite-query-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据查询检索</div>
        <div class="page-subtitle">地震监测分析系统 / 数据管理子系统 / WXYG-SJGL-004</div>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="handleSearch">
          <SearchOutlined />
          查询
        </a-button>
        <a-button @click="exportResults">
          <DownloadOutlined />
          导出结果
        </a-button>
        <a-button @click="resetSearchForm">
          <ReloadOutlined />
          重置
        </a-button>
      </div>
    </div>

    <!-- 查询条件区 -->
    <a-card :bordered="false" title="🔍 查询条件" class="search-card">
      <a-form layout="inline">
        <a-form-item label="卫星类型">
          <a-select
            v-model:value="searchForm.satellite"
            mode="multiple"
            placeholder="请选择"
            style="width: 200px"
            allow-clear
          >
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
            <a-select-option value="Landsat-8">Landsat-8</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="传感器">
          <a-select
            v-model:value="searchForm.sensor"
            mode="multiple"
            placeholder="请选择"
            style="width: 180px"
            allow-clear
          >
            <a-select-option value="PMS">PMS</a-select-option>
            <a-select-option value="WFV">WFV</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
            <a-select-option value="MSI">MSI</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="时间范围">
          <a-range-picker v-model:value="searchForm.dateRange" format="YYYY-MM-DD" style="width: 260px" />
        </a-form-item>
        <a-form-item label="空间区域">
          <a-input
            v-model:value="searchForm.region"
            placeholder="输入区域名称或坐标"
            style="width: 200px"
            allow-clear
          >
            <template #suffix>
              <EnvironmentOutlined style="cursor: pointer" @click="showMapSelector" />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item label="分辨率(m)">
          <a-input-number
            v-model:value="searchForm.resolutionMin"
            placeholder="最小"
            :min="0"
            :max="1000"
            style="width: 90px"
          />
          <span style="margin: 0 8px">-</span>
          <a-input-number
            v-model:value="searchForm.resolutionMax"
            placeholder="最大"
            :min="0"
            :max="1000"
            style="width: 90px"
          />
        </a-form-item>
        <a-form-item label="云量">
          <a-slider
            v-model:value="searchForm.cloudCover"
            range
            :max="100"
            :marks="{ 0: '0%', 50: '50%', 100: '100%' }"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item label="数据类型">
          <a-checkbox-group v-model:value="searchForm.dataTypes">
            <a-checkbox value="光学">光学</a-checkbox>
            <a-checkbox value="SAR">SAR</a-checkbox>
            <a-checkbox value="红外">红外</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 检索统计 -->
    <a-row :gutter="16" style="margin: 16px 0">
      <a-col :span="6">
        <a-card>
          <a-statistic title="匹配结果数" :value="searchStatistics.matchCount">
            <template #prefix>📄</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="检索耗时" :value="searchStatistics.responseTime" suffix="s">
            <template #prefix>⏱️</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="结果准确率" :value="searchStatistics.accuracy" suffix="%">
            <template #prefix>✅</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="今日查询次数" :value="searchStatistics.todayQueries">
            <template #prefix>🔎</template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 查询结果 -->
    <a-card :bordered="false" class="results-card">
      <template #title>
        <UnorderedListOutlined /> 查询结果
        <span style="margin-left: 20px; color: #8c8c8c; font-size: 14px">
          共找到 {{ paginationConfig.total }} 条结果
        </span>
      </template>
      <template #extra>
        <a-radio-group v-model:value="viewMode" size="small">
          <a-radio-button value="list">
            <UnorderedListOutlined /> 列表
          </a-radio-button>
          <a-radio-button value="grid">
            <AppstoreOutlined /> 网格
          </a-radio-button>
        </a-radio-group>
      </template>

      <!-- 列表视图 -->
      <div v-show="viewMode === 'list'">
        <a-table
          :columns="columns"
          :data-source="searchResults"
          :pagination="paginationConfig"
          :loading="loading"
          row-key="metadataId"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'satellite'">
              <a-tag size="small">{{ record.satellite }}</a-tag>
            </template>
            <template v-else-if="column.key === 'dataType'">
              <a-tag :color="record.dataType === '光学' ? 'green' : 'orange'" size="small">
                {{ record.dataType }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'resolution'">
              {{ record.resolution }}m
            </template>
            <template v-else-if="column.key === 'cloudCover'">
              {{ record.cloudCover }}%
            </template>
            <template v-else-if="column.key === 'operation'">
              <a @click="viewDetail(record)">详情</a>
              <a-divider type="vertical" />
              <a @click="previewData(record)">预览</a>
              <a-divider type="vertical" />
              <a @click="downloadData(record)">下载</a>
              <a-divider type="vertical" />
              <a @click="shareData(record)">分享</a>
            </template>
          </template>
        </a-table>
      </div>

      <!-- 网格视图 -->
      <div v-show="viewMode === 'grid'">
        <a-row :gutter="16">
          <a-col v-for="item in searchResults" :key="item.metadataId" :span="6" style="margin-bottom: 16px">
            <a-card :body-style="{ padding: 0 }">
              <div style="padding: 14px">
                <div style="font-weight: bold; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ item.metadataId }}
                </div>
                <div style="margin-bottom: 8px">
                  <a-tag size="small">{{ item.satellite }}</a-tag>
                  <a-tag size="small" color="green" style="margin-left: 5px">
                    {{ item.resolution }}m
                  </a-tag>
                </div>
                <div style="font-size: 12px; color: #8c8c8c; margin-bottom: 10px">
                  <CalendarOutlined /> {{ item.acquisitionTime }}
                </div>
                <a-button type="link" style="width: 100%; padding: 0" @click="viewDetail(item)">
                  查看详情
                </a-button>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </a-card>

    <!-- 详情对话框 -->
    <a-modal
      title="数据详情"
      :open="detailDialogVisible"
      width="900px"
      :footer="null"
      @cancel="detailDialogVisible = false"
    >
      <div v-if="currentData">
        <a-tabs v-model:activeKey="detailActiveTab">
          <a-tab-pane key="basic" tab="基本信息">
            <a-descriptions :column="2" bordered>
              <a-descriptions-item label="元数据ID">{{ currentData.metadataId }}</a-descriptions-item>
              <a-descriptions-item label="卫星型号">{{ currentData.satellite }}</a-descriptions-item>
              <a-descriptions-item label="传感器">{{ currentData.sensor }}</a-descriptions-item>
              <a-descriptions-item label="分辨率">{{ currentData.resolution }}m</a-descriptions-item>
              <a-descriptions-item label="数据类型">{{ currentData.dataType }}</a-descriptions-item>
              <a-descriptions-item label="获取时间">{{ currentData.acquisitionTime }}</a-descriptions-item>
              <a-descriptions-item label="云量">{{ currentData.cloudCover }}%</a-descriptions-item>
              <a-descriptions-item label="区域">{{ currentData.region }}</a-descriptions-item>
              <a-descriptions-item label="目录路径" :span="2">{{ currentData.catalogPath }}</a-descriptions-item>
            </a-descriptions>
          </a-tab-pane>
          <a-tab-pane key="spatial" tab="空间信息">
            <a-descriptions :column="2" bordered>
              <a-descriptions-item label="中心经度">{{ currentData.centerLon || "N/A" }}°</a-descriptions-item>
              <a-descriptions-item label="中心纬度">{{ currentData.centerLat || "N/A" }}°</a-descriptions-item>
              <a-descriptions-item label="投影坐标系" :span="2">{{ currentData.projection || "WGS84" }}</a-descriptions-item>
            </a-descriptions>
          </a-tab-pane>
        </a-tabs>
        <div style="margin-top: 16px; text-align: right">
          <a-button @click="detailDialogVisible = false">关闭</a-button>
          <a-button type="primary" style="margin-left: 8px" @click="downloadData(currentData)">
            <DownloadOutlined /> 下载数据
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- 分享对话框（原实现使用的 $prompt 在 ant-design-vue 中并不存在，此处改为独立弹窗） -->
    <a-modal
      v-model:open="shareDialogVisible"
      title="分享数据"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleShareConfirm"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="接收人">
          <a-input v-model:value="shareTarget" placeholder="请输入接收人邮箱或用户ID" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { message, Modal, Statistic, Descriptions } from "ant-design-vue"
import {
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  EnvironmentOutlined
} from "@ant-design/icons-vue"
import { filterMetadata, fromMetadata, toSharePayload } from "../api/adapters"
import { downloadBlob, metadataApi, shareApi } from "../api/services"

export default {
  name: "SatelliteDataQueryLayout",
  components: {
    SearchOutlined,
    DownloadOutlined,
    ReloadOutlined,
    UnorderedListOutlined,
    AppstoreOutlined,
    CalendarOutlined,
    EnvironmentOutlined,
    AStatistic: Statistic,
    ADescriptions: Descriptions,
    ADescriptionsItem: Descriptions.Item
  },
  data() {
    return {
      loading: false,
      viewMode: "list",
      detailActiveTab: "basic",

      // 搜索表单
      searchForm: {
        satellite: [],
        sensor: [],
        dateRange: [],
        region: "",
        resolutionMin: null,
        resolutionMax: null,
        cloudCover: [0, 30],
        dataTypes: []
      },

      // 检索统计
      searchStatistics: {
        matchCount: 0,
        responseTime: 0,
        accuracy: 98.5,
        todayQueries: 156
      },

      // 查询结果
      searchResults: [],

      // 表格列
      columns: [
        { title: "元数据ID", dataIndex: "metadataId", key: "metadataId", width: 180 },
        { title: "卫星", dataIndex: "satellite", key: "satellite", width: 100 },
        { title: "传感器", dataIndex: "sensor", key: "sensor", width: 100 },
        { title: "分辨率", dataIndex: "resolution", key: "resolution", width: 100 },
        { title: "数据类型", dataIndex: "dataType", key: "dataType", width: 100 },
        { title: "获取时间", dataIndex: "acquisitionTime", key: "acquisitionTime", width: 160 },
        { title: "云量", dataIndex: "cloudCover", key: "cloudCover", width: 80 },
        { title: "区域", dataIndex: "region", key: "region", width: 120 },
        { title: "操作", key: "operation", fixed: "right", width: 220 }
      ],

      // 分页配置
      paginationConfig: {
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条数据`,
        pageSizeOptions: ["10", "20", "50", "100"]
      },

      // 详情
      detailDialogVisible: false,
      currentData: null,

      // 分享
      shareDialogVisible: false,
      shareTarget: "",
      shareRecord: null
    }
  },
  methods: {
    async handleSearch() {
      this.loading = true
      const startTime = Date.now()
      try {
        const page = await metadataApi.list({ pageNo: 1, pageSize: 1000 })
        this.searchResults = filterMetadata(page.records.map(fromMetadata), this.searchForm)
        const endTime = Date.now()
        const responseTime = ((endTime - startTime) / 1000).toFixed(2)

        this.paginationConfig.total = this.searchResults.length
        this.searchStatistics.matchCount = this.searchResults.length
        this.searchStatistics.responseTime = responseTime

        if (parseFloat(responseTime) <= 3) {
          message.success(`查询完成！找到 ${this.searchResults.length} 条结果，耗时 ${responseTime}秒`)
        } else {
          message.warning(`查询完成！找到 ${this.searchResults.length} 条结果，耗时 ${responseTime}秒（超过3秒要求）`)
        }

      } catch (error) {
        message.error(error instanceof Error ? error.message : "查询失败")
      } finally {
        this.loading = false
      }
    },

    resetSearchForm() {
      this.searchForm = {
        satellite: [],
        sensor: [],
        dateRange: [],
        region: "",
        resolutionMin: null,
        resolutionMax: null,
        cloudCover: [0, 30],
        dataTypes: []
      }
      this.searchResults = []
      this.paginationConfig.total = 0
      this.searchStatistics.matchCount = 0
      this.searchStatistics.responseTime = 0
    },

    async exportResults() {
      if (this.searchResults.length === 0) {
        message.warning("没有可导出的结果")
        return
      }
      try {
        const blob = await metadataApi.exportExcel()
        downloadBlob(blob, "query_results.xlsx")
        message.success("导出成功！文件保存为 query_results.xlsx")
      } catch (error) {
        message.error(error instanceof Error ? error.message : "导出失败")
      }
    },

    showMapSelector() {
      message.info("地图选择器功能开发中...")
    },

    handleTableChange(pagination) {
      this.paginationConfig.current = pagination.current
      this.paginationConfig.pageSize = pagination.pageSize
    },

    viewDetail(record) {
      this.currentData = record
      this.detailDialogVisible = true
      this.detailActiveTab = "basic"
    },

    previewData() {
      message.info("数据预览功能开发中...")
    },

    downloadData(record) {
      Modal.confirm({
        title: "确定要下载该数据吗？",
        okText: "确定",
        cancelText: "取消",
        onOk: () => {
          message.info(`项目一当前后端未提供数据文件下载接口：${record.metadataId}`)
        }
      })
    },

    shareData(record) {
      this.shareRecord = record
      this.shareTarget = ""
      this.shareDialogVisible = true
    },

    async handleShareConfirm() {
      if (!this.shareTarget) {
        message.warning("请输入接收人邮箱或用户ID")
        return
      }
      const id = this.shareRecord ? this.shareRecord.metadataId : ""
      try {
        await shareApi.add(toSharePayload({
          dataIds: [id],
          authType: "用户",
          authTarget: [this.shareTarget],
          permissions: ["查看"],
          status: "已启用"
        }))
        message.success(`数据 ${id} 已分享给 ${this.shareTarget}`)
        this.shareDialogVisible = false
        this.shareTarget = ""
        this.shareRecord = null
      } catch (error) {
        message.error(error instanceof Error ? error.message : "分享失败")
      }
    }
  }
}
</script>

<style scoped lang="less">
.satellite-query-page {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 100px);

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 20px;
    background: white;
    border-radius: 4px;

    .header-text {
      .page-label {
        font-size: 20px;
        font-weight: 600;
        color: #1890ff;
        margin-bottom: 8px;
      }

      .page-subtitle {
        font-size: 14px;
        color: #8c8c8c;
      }
    }

    .header-actions {
      button {
        margin-left: 8px;
      }
    }
  }

  .search-card {
    margin-bottom: 16px;
  }

  .results-card {
    margin-top: 16px;
  }
}
</style>
