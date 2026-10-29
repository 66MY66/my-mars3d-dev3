<template>
  <div class="satellite-metadata-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 元数据管理</div>
        <div class="page-subtitle">地震监测分析系统 / 数据管理子系统 / WXYG-SJGL-002</div>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="showCreateDialog">
          <PlusOutlined />
          创建元数据
        </a-button>
        <a-button @click="showBatchImportDialog">
          <ImportOutlined />
          批量导入
        </a-button>
        <a-button @click="exportMetadata">
          <ExportOutlined />
          导出
        </a-button>
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 搜索过滤 -->
    <a-card :bordered="false" class="filter-card">
      <a-form layout="inline">
        <a-form-item label="卫星型号">
          <a-select
            v-model:value="filters.satellite"
            placeholder="全部"
            style="width: 150px"
            allow-clear
          >
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据类型">
          <a-select
            v-model:value="filters.dataType"
            placeholder="全部"
            style="width: 120px"
            allow-clear
          >
            <a-select-option value="光学">光学</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="获取时间">
          <a-range-picker v-model:value="filters.dateRange" format="YYYY-MM-DD" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="handleSearch">
            <SearchOutlined />
            查询
          </a-button>
          <a-button style="margin-left: 8px" @click="resetFilters">重置</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 元数据列表 -->
    <a-card :bordered="false" class="table-card">
      <template #title>
        <FileTextOutlined /> 元数据列表
      </template>

      <a-table
        :columns="columns"
        :data-source="metadataList"
        :pagination="paginationConfig"
        :loading="loading"
        row-key="metadataId"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'satellite'">
            <a-tag color="blue">{{ record.satellite }}</a-tag>
          </template>
          <template v-else-if="column.key === 'dataType'">
            <a-tag :color="record.dataType === '光学' ? 'green' : 'orange'">
              {{ record.dataType }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'resolution'">
            {{ record.resolution }}m
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="record.status === '已验证' ? 'success' : 'processing'"
              :text="record.status"
            />
          </template>
          <template v-else-if="column.key === 'operation'">
            <a @click="viewDetail(record)">详情</a>
            <a-divider type="vertical" />
            <a @click="editMetadata(record)">编辑</a>
            <a-divider type="vertical" />
            <a @click="validateMetadata(record)">验证</a>
            <a-divider type="vertical" />
            <a style="color: #f5222d" @click="deleteMetadata(record)">删除</a>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑元数据对话框 -->
    <a-modal
      :title="editMode ? '编辑元数据' : '创建元数据'"
      :open="dialogVisible"
      :confirm-loading="confirmLoading"
      width="800px"
      @ok="handleSaveMetadata"
      @cancel="dialogVisible = false"
    >
      <a-form
        ref="metadataFormRef"
        :model="metadataForm"
        :rules="metadataRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item v-if="editMode" label="元数据ID" name="metadataId">
          <a-input v-model:value="metadataForm.metadataId" disabled />
        </a-form-item>
        <a-form-item label="卫星型号" name="satellite">
          <a-select v-model:value="metadataForm.satellite" placeholder="请选择卫星型号">
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="传感器" name="sensor">
          <a-select v-model:value="metadataForm.sensor" placeholder="请选择传感器">
            <a-select-option value="PMS">PMS</a-select-option>
            <a-select-option value="WFV">WFV</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
            <a-select-option value="MSI">MSI</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据类型" name="dataType">
          <a-select v-model:value="metadataForm.dataType" placeholder="请选择数据类型">
            <a-select-option value="光学">光学</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="分辨率(m)" name="resolution">
          <a-input-number
            v-model:value="metadataForm.resolution"
            :min="0.1"
            :max="1000"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="获取时间" name="acquisitionTime">
          <a-date-picker
            v-model:value="metadataForm.acquisitionTime"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="覆盖区域" name="region">
          <a-input v-model:value="metadataForm.region" placeholder="请输入覆盖区域" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { h } from "vue"
import { message, Modal, Badge } from "ant-design-vue"
import {
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined
} from "@ant-design/icons-vue"
import { fromMetadata, toMetadataPayload } from "../api/adapters"
import { downloadBlob, metadataApi } from "../api/services"

export default {
  name: "SatelliteMetadataLayout",
  components: {
    PlusOutlined,
    ImportOutlined,
    ExportOutlined,
    ReloadOutlined,
    SearchOutlined,
    FileTextOutlined,
    ABadge: Badge
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,
      editMode: false,

      // 过滤条件
      filters: {
        satellite: undefined,
        dataType: undefined,
        dateRange: []
      },

      // 元数据列表
      metadataList: [],

      // 表格列
      columns: [
        { title: "元数据ID", dataIndex: "metadataId", key: "metadataId", width: 200 },
        { title: "卫星型号", dataIndex: "satellite", key: "satellite", width: 120 },
        { title: "传感器", dataIndex: "sensor", key: "sensor", width: 100 },
        { title: "数据类型", dataIndex: "dataType", key: "dataType", width: 100 },
        { title: "分辨率", dataIndex: "resolution", key: "resolution", width: 100 },
        { title: "获取时间", dataIndex: "acquisitionTime", key: "acquisitionTime", width: 180 },
        { title: "覆盖区域", dataIndex: "region", key: "region", width: 120 },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
        { title: "操作", key: "operation", fixed: "right", width: 240 }
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

      // 表单
      dialogVisible: false,
      metadataForm: {
        metadataId: "",
        satellite: "",
        sensor: "",
        dataType: "",
        resolution: null,
        acquisitionTime: null,
        region: ""
      },
      metadataRules: {
        satellite: [{ required: true, message: "请选择卫星型号", trigger: "change" }],
        sensor: [{ required: true, message: "请选择传感器", trigger: "change" }],
        dataType: [{ required: true, message: "请选择数据类型", trigger: "change" }],
        resolution: [{ required: true, message: "请输入分辨率", trigger: "blur" }],
        acquisitionTime: [{ required: true, message: "请选择获取时间", trigger: "change" }],
        region: [{ required: true, message: "请输入覆盖区域", trigger: "blur" }]
      }
    }
  },
  mounted() {
    this.loadMetadata()
  },
  methods: {
    async loadMetadata(showSuccess = false) {
      this.loading = true
      try {
        const page = await metadataApi.list({
          pageNo: this.paginationConfig.current,
          pageSize: this.paginationConfig.pageSize,
          satellite: this.filters.satellite,
          dataType: this.filters.dataType
        })
        this.metadataList = page.records.map(fromMetadata)
        this.paginationConfig.total = page.total
        if (showSuccess) { message.success("数据已刷新") }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "元数据加载失败")
      } finally {
        this.loading = false
      }
    },
    refreshData() {
      this.loadMetadata(true)
    },

    handleSearch() {
      this.paginationConfig.current = 1
      this.loadMetadata(true)
    },

    resetFilters() {
      this.filters = {
        satellite: undefined,
        dataType: undefined,
        dateRange: []
      }
      this.paginationConfig.current = 1
      this.loadMetadata()
    },

    handleTableChange(pagination) {
      this.paginationConfig.current = pagination.current
      this.paginationConfig.pageSize = pagination.pageSize
      this.loadMetadata()
    },

    showCreateDialog() {
      this.editMode = false
      this.dialogVisible = true
    },

    showBatchImportDialog() {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".xls,.xlsx"
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { return }
        try {
          await metadataApi.importExcel(file)
          message.success("批量导入成功")
          await this.loadMetadata()
        } catch (error) {
          message.error(error instanceof Error ? error.message : "批量导入失败")
        }
      }
      input.click()
    },

    async exportMetadata() {
      try {
        const blob = await metadataApi.exportExcel()
        downloadBlob(blob, "metadata_export.xlsx")
        message.success("导出成功！文件保存为 metadata_export.xlsx")
      } catch (error) {
        message.error(error instanceof Error ? error.message : "导出失败")
      }
    },

    async handleSaveMetadata() {
      try {
        await this.$refs.metadataFormRef.validate()
        this.confirmLoading = true
        const payload = toMetadataPayload({ ...this.metadataForm, status: this.metadataForm.status || "未验证" })
        if (this.editMode) { await metadataApi.edit(payload) } else { await metadataApi.add(payload) }
        message.success(this.editMode ? "元数据更新成功" : "元数据创建成功")
        this.dialogVisible = false
        this.$refs.metadataFormRef.resetFields()
        await this.loadMetadata()
      } catch (error) {
        if (error instanceof Error) { message.error(error.message) }
      } finally {
        this.confirmLoading = false
      }
    },

    viewDetail(record) {
      Modal.info({
        title: "元数据详情",
        content: () =>
          h("div", [
            h("p", [h("strong", "元数据ID："), record.metadataId]),
            h("p", [h("strong", "卫星型号："), record.satellite]),
            h("p", [h("strong", "传感器："), record.sensor]),
            h("p", [h("strong", "数据类型："), record.dataType]),
            h("p", [h("strong", "分辨率："), `${record.resolution}m`]),
            h("p", [h("strong", "获取时间："), record.acquisitionTime]),
            h("p", [h("strong", "覆盖区域："), record.region]),
            h("p", [h("strong", "状态："), record.status])
          ]),
        okText: "关闭"
      })
    },

    editMetadata(record) {
      this.editMode = true
      this.metadataForm = { ...record }
      this.dialogVisible = true
    },

    validateMetadata(record) {
      Modal.confirm({
        title: "确定要验证该元数据吗？",
        content: "验证将检查数据完整性和格式正确性",
        okText: "确定",
        cancelText: "取消",
        onOk: async () => {
          try {
            await metadataApi.edit(toMetadataPayload({ ...record, status: "已验证" }))
            message.success("元数据验证成功")
            await this.loadMetadata()
          } catch (error) {
            message.error(error instanceof Error ? error.message : "元数据验证失败")
          }
        }
      })
    },

    deleteMetadata(record) {
      Modal.confirm({
        title: "确定要删除该元数据吗？",
        content: "此操作不可恢复",
        okText: "确定",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          try {
            await metadataApi.remove(record.metadataId)
            message.success("删除成功")
            await this.loadMetadata()
          } catch (error) {
            message.error(error instanceof Error ? error.message : "删除失败")
          }
        }
      })
    }
  }
}
</script>

<style scoped lang="less">
.satellite-metadata-page {
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

  .filter-card {
    margin-bottom: 16px;
  }

  .table-card {
    margin-top: 16px;
  }
}
</style>
