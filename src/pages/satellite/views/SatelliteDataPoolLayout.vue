<template>
  <div class="satellite-data-pool-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据资源池管理</div>
        <div class="page-subtitle">地震监测分析系统 / 数据管理子系统 / WXYG-SJGL-001</div>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="showCreateDialog">
          <PlusOutlined />
          创建资源池
        </a-button>
        <a-button @click="showImportDialog">
          <UploadOutlined />
          数据接入
        </a-button>
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card>
          <a-statistic title="资源池总数" :value="statistics.totalPools">
            <template #prefix>📦</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="接入数据源" :value="statistics.totalDataSources">
            <template #prefix>📡</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="平均占用率" :value="statistics.avgUsageRate" suffix="%">
            <template #prefix>💾</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="预警数量"
            :value="statistics.alertCount"
            :value-style="{ color: '#f5222d' }"
          >
            <template #prefix>⚠️</template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 资源池列表 -->
    <a-card :bordered="false" class="table-card">
      <template #title>
        <DatabaseOutlined /> 资源池列表
      </template>
      <template #extra>
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索资源池名称或ID"
          style="width: 250px"
          @search="handleSearch"
        />
      </template>

      <a-table
        :columns="columns"
        :data-source="filteredPoolList"
        :pagination="paginationConfig"
        :loading="loading"
        row-key="poolId"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'poolName'">
            <a-tag color="blue">{{ record.poolName }}</a-tag>
          </template>
          <template v-else-if="column.key === 'dataType'">
            <a-tag :color="dataTypeColor(record.dataType)">{{ record.dataType }}</a-tag>
          </template>
          <template v-else-if="column.key === 'usageRate'">
            <a-progress
              :percent="record.usageRate"
              :status="usageStatus(record.usageRate)"
              :stroke-width="10"
            />
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="record.status === '正常' ? 'success' : 'error'"
              :text="record.status"
            />
          </template>
          <template v-else-if="column.key === 'operation'">
            <a @click="viewPoolDetail(record)">详情</a>
            <a-divider type="vertical" />
            <a @click="viewMonitoring(record)">监控</a>
            <a-divider type="vertical" />
            <a @click="viewScheduling(record)">调度</a>
            <a-divider type="vertical" />
            <a style="color: #f5222d" @click="deletePool(record)">删除</a>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建资源池对话框 -->
    <a-modal
      title="创建资源池"
      :open="createDialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleCreatePool"
      @cancel="createDialogVisible = false"
    >
      <a-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="资源池名称" name="poolName">
          <a-input v-model:value="createForm.poolName" placeholder="请输入资源池名称" />
        </a-form-item>
        <a-form-item label="存储容量(TB)" name="totalCapacity">
          <a-input-number
            v-model:value="createForm.totalCapacity"
            :min="1"
            :max="10000"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="数据类型" name="dataType">
          <a-select v-model:value="createForm.dataType" placeholder="请选择数据类型">
            <a-select-option value="光学">光学</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
            <a-select-option value="混合">混合</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="支持卫星" name="satellites">
          <a-select
            v-model:value="createForm.satellites"
            mode="multiple"
            placeholder="请选择支持的卫星"
          >
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
            <a-select-option value="Landsat-8">Landsat-8</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="存储路径" name="storagePath">
          <a-input v-model:value="createForm.storagePath" placeholder="请输入存储路径" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="createForm.description" :rows="3" placeholder="请输入资源池描述" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 数据接入对话框 -->
    <a-modal
      title="数据接入"
      :open="importDialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleDataImport"
      @cancel="importDialogVisible = false"
    >
      <a-form
        ref="importFormRef"
        :model="importForm"
        :rules="importRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="目标资源池" name="targetPoolId">
          <a-select v-model:value="importForm.targetPoolId" placeholder="请选择目标资源池">
            <a-select-option v-for="pool in poolList" :key="pool.poolId" :value="pool.poolId">
              {{ pool.poolName }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据源" name="dataSource">
          <a-select v-model:value="importForm.dataSource" placeholder="请选择数据源">
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
            <a-select-option value="local">本地上传</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据验证">
          <a-checkbox v-model:checked="importForm.validateFormat">格式校验</a-checkbox>
          <a-checkbox v-model:checked="importForm.validateIntegrity">完整性校验</a-checkbox>
        </a-form-item>
        <a-form-item label="优先级">
          <a-radio-group v-model:value="importForm.priority">
            <a-radio :value="1">低</a-radio>
            <a-radio :value="2">中</a-radio>
            <a-radio :value="3">高</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { h } from "vue"
import { message, Modal, Statistic, Badge } from "ant-design-vue"
import {
  PlusOutlined,
  UploadOutlined,
  ReloadOutlined,
  DatabaseOutlined
} from "@ant-design/icons-vue"

export default {
  name: "SatelliteDataPoolLayout",
  components: {
    PlusOutlined,
    UploadOutlined,
    ReloadOutlined,
    DatabaseOutlined,
    AStatistic: Statistic,
    ABadge: Badge
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,
      searchKeyword: "",

      // 统计数据
      statistics: {
        totalPools: 3,
        totalDataSources: 5,
        avgUsageRate: 68,
        alertCount: 1
      },

      // 资源池列表
      poolList: [
        {
          poolId: "POOL-20240101-001",
          poolName: "GF-1光学数据池",
          dataType: "光学",
          totalCapacity: 500,
          usedCapacity: 380,
          usageRate: 76,
          status: "正常"
        },
        {
          poolId: "POOL-20240101-002",
          poolName: "Sentinel-SAR数据池",
          dataType: "SAR",
          totalCapacity: 800,
          usedCapacity: 680,
          usageRate: 85,
          status: "预警"
        },
        {
          poolId: "POOL-20240101-003",
          poolName: "混合遥感数据池",
          dataType: "混合",
          totalCapacity: 1000,
          usedCapacity: 450,
          usageRate: 45,
          status: "正常"
        }
      ],

      // 表格列
      columns: [
        { title: "资源池名称", dataIndex: "poolName", key: "poolName" },
        { title: "资源池ID", dataIndex: "poolId", key: "poolId", width: 200 },
        { title: "数据类型", dataIndex: "dataType", key: "dataType", width: 120 },
        { title: "总容量(TB)", dataIndex: "totalCapacity", key: "totalCapacity", width: 120 },
        { title: "已使用(TB)", dataIndex: "usedCapacity", key: "usedCapacity", width: 120 },
        { title: "存储占用率", dataIndex: "usageRate", key: "usageRate", width: 200 },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
        { title: "操作", key: "operation", fixed: "right", width: 240 }
      ],

      // 分页配置
      paginationConfig: {
        current: 1,
        pageSize: 10,
        total: 3,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条数据`,
        pageSizeOptions: ["10", "20", "50", "100"]
      },

      // 创建资源池
      createDialogVisible: false,
      createForm: {
        poolName: "",
        totalCapacity: 100,
        dataType: "",
        satellites: [],
        storagePath: "",
        description: ""
      },
      createRules: {
        poolName: [{ required: true, message: "请输入资源池名称", trigger: "blur" }],
        totalCapacity: [{ required: true, message: "请输入存储容量", trigger: "blur" }],
        dataType: [{ required: true, message: "请选择数据类型", trigger: "change" }],
        satellites: [{ required: true, message: "请选择支持的卫星", trigger: "change" }],
        storagePath: [{ required: true, message: "请输入存储路径", trigger: "blur" }]
      },

      // 数据接入
      importDialogVisible: false,
      importForm: {
        targetPoolId: "",
        dataSource: "",
        validateFormat: true,
        validateIntegrity: true,
        priority: 2
      },
      importRules: {
        targetPoolId: [{ required: true, message: "请选择目标资源池", trigger: "change" }],
        dataSource: [{ required: true, message: "请选择数据源", trigger: "change" }]
      }
    }
  },
  computed: {
    filteredPoolList() {
      if (!this.searchKeyword) {
        return this.poolList
      }
      return this.poolList.filter(
        (pool) =>
          pool.poolName.includes(this.searchKeyword) ||
          pool.poolId.includes(this.searchKeyword)
      )
    }
  },
  methods: {
    dataTypeColor(text) {
      if (text === "光学") {
        return "green"
      }
      if (text === "SAR") {
        return "orange"
      }
      return "purple"
    },

    usageStatus(rate) {
      if (rate >= 80) {
        return "exception"
      }
      if (rate >= 60) {
        return "normal"
      }
      return "success"
    },

    refreshData() {
      this.loading = true
      setTimeout(() => {
        message.success("数据已刷新")
        this.loading = false
      }, 500)
    },

    handleSearch() {
      // 搜索逻辑由 computed 处理
    },

    handleTableChange(pagination) {
      this.paginationConfig.current = pagination.current
      this.paginationConfig.pageSize = pagination.pageSize
    },

    showCreateDialog() {
      this.createDialogVisible = true
    },

    handleCreatePool() {
      this.$refs.createFormRef.validate().then(() => {
        this.confirmLoading = true
        setTimeout(() => {
          const newPool = {
            poolId: `POOL-${new Date().getTime()}`,
            poolName: this.createForm.poolName,
            dataType: this.createForm.dataType,
            totalCapacity: this.createForm.totalCapacity,
            usedCapacity: 0,
            usageRate: 0,
            status: "正常"
          }
          this.poolList.unshift(newPool)
          this.paginationConfig.total++
          this.statistics.totalPools++
          message.success("资源池创建成功")
          this.createDialogVisible = false
          this.confirmLoading = false
          this.$refs.createFormRef.resetFields()
        }, 500)
      }).catch(() => {})
    },

    showImportDialog() {
      if (this.poolList.length === 0) {
        message.warning("请先创建资源池")
        return
      }
      this.importDialogVisible = true
    },

    handleDataImport() {
      this.$refs.importFormRef.validate().then(() => {
        this.confirmLoading = true
        setTimeout(() => {
          message.success("数据接入任务已启动，正在后台处理")
          this.importDialogVisible = false
          this.confirmLoading = false
          this.$refs.importFormRef.resetFields()
        }, 1000)
      }).catch(() => {})
    },

    viewPoolDetail(record) {
      Modal.info({
        title: "资源池详情",
        content: () =>
          h("div", [
            h("p", [h("strong", "资源池ID："), record.poolId]),
            h("p", [h("strong", "资源池名称："), record.poolName]),
            h("p", [h("strong", "数据类型："), record.dataType]),
            h("p", [h("strong", "总容量："), `${record.totalCapacity} TB`]),
            h("p", [h("strong", "已使用："), `${record.usedCapacity} TB`]),
            h("p", [h("strong", "占用率："), `${record.usageRate}%`]),
            h("p", [h("strong", "状态："), record.status])
          ]),
        okText: "关闭"
      })
    },

    viewMonitoring() {
      message.info("资源监控功能开发中...")
    },

    viewScheduling() {
      message.info("资源调度功能开发中...")
    },

    deletePool(record) {
      Modal.confirm({
        title: "确定要删除该资源池吗？",
        content: "此操作不可恢复",
        okText: "确定",
        okType: "danger",
        cancelText: "取消",
        onOk: () => {
          const index = this.poolList.findIndex((item) => item.poolId === record.poolId)
          if (index !== -1) {
            this.poolList.splice(index, 1)
            this.paginationConfig.total--
            this.statistics.totalPools--
            message.success("删除成功")
          }
        }
      })
    }
  }
}
</script>

<style scoped lang="less">
.satellite-data-pool-page {
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

  .table-card {
    margin-top: 16px;
  }
}
</style>
