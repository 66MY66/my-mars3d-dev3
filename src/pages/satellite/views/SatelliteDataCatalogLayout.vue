<template>
  <div class="satellite-catalog-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据目录管理</div>
        <div class="page-subtitle">地震监测分析系统 / 数据管理子系统 / WXYG-SJGL-003</div>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="showCreateDialog">
          <FolderAddOutlined />
          创建目录
        </a-button>
        <a-button @click="showAssociateDialog">
          <LinkOutlined />
          关联元数据
        </a-button>
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-card>
          <a-statistic title="目录总数" :value="statistics.totalCatalogs">
            <template #prefix>📁</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="关联元数据" :value="statistics.totalMetadata">
            <template #prefix>📄</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="关联率" :value="statistics.associationRate" suffix="%">
            <template #prefix>✅</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="未关联数据"
            :value="statistics.unassociatedCount"
            :value-style="{ color: '#faad14' }"
          >
            <template #prefix>⚠️</template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 主内容区 -->
    <a-row :gutter="16">
      <!-- 左侧：目录树 -->
      <a-col :span="8">
        <a-card title="📂 目录结构" :bordered="false">
          <a-tree
            :tree-data="catalogTree"
            :expanded-keys="expandedKeys"
            :selected-keys="selectedKeys"
            @select="handleNodeSelect"
          >
            <template #title="node">
              <span>{{ node.title }} <a-tag>{{ node.count || 0 }}</a-tag></span>
            </template>
          </a-tree>
        </a-card>
      </a-col>

      <!-- 右侧：目录详情与关联数据 -->
      <a-col :span="16">
        <a-card v-if="currentCatalog" :bordered="false">
          <template #title>
            <InfoCircleOutlined /> 目录详情
          </template>

          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="目录ID">{{ currentCatalog.key }}</a-descriptions-item>
            <a-descriptions-item label="目录名称">{{ currentCatalog.title }}</a-descriptions-item>
            <a-descriptions-item label="层级">{{ getLevelName(currentCatalog.level) }}</a-descriptions-item>
            <a-descriptions-item label="关联元数据数">{{ currentCatalog.count || 0 }}</a-descriptions-item>
          </a-descriptions>

          <!-- 关联的元数据列表 -->
          <div style="margin-top: 20px">
            <div style="margin-bottom: 16px; display: flex; justify-content: space-between">
              <h3>📄 关联元数据列表</h3>
              <a-button size="small" type="primary" @click="showAssociateDialog">添加关联</a-button>
            </div>

            <a-table
              :columns="metadataColumns"
              :data-source="associatedMetadata"
              :pagination="paginationConfig"
              :loading="loading"
              row-key="metadataId"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'satellite'">
                  <a-tag>{{ record.satellite }}</a-tag>
                </template>
                <template v-else-if="column.key === 'dataType'">
                  <a-tag :color="record.dataType === '光学' ? 'green' : 'orange'">
                    {{ record.dataType }}
                  </a-tag>
                </template>
                <template v-else-if="column.key === 'operation'">
                  <a @click="viewMetadataDetail(record)">查看</a>
                  <a-divider type="vertical" />
                  <a style="color: #f5222d" @click="removeAssociation(record)">解除关联</a>
                </template>
              </template>
            </a-table>
          </div>
        </a-card>

        <a-empty v-else description="请从左侧选择一个目录查看详情" />
      </a-col>
    </a-row>

    <!-- 创建目录对话框 -->
    <a-modal
      title="创建目录"
      :open="dialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleSaveCatalog"
      @cancel="dialogVisible = false"
    >
      <a-form
        ref="catalogFormRef"
        :model="catalogForm"
        :rules="catalogRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="目录名称" name="name">
          <a-input v-model:value="catalogForm.name" placeholder="请输入目录名称" />
        </a-form-item>
        <a-form-item label="分类维度" name="dimension">
          <a-select v-model:value="catalogForm.dimension" placeholder="请选择分类维度">
            <a-select-option value="satellite">按卫星</a-select-option>
            <a-select-option value="sensor">按传感器</a-select-option>
            <a-select-option value="time">按时间</a-select-option>
            <a-select-option value="region">按区域</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="catalogForm.description" :rows="3" placeholder="请输入目录描述" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 关联元数据对话框 -->
    <a-modal
      title="关联元数据"
      :open="associateDialogVisible"
      :confirm-loading="confirmLoading"
      width="900px"
      @ok="handleAssociateMetadata"
      @cancel="associateDialogVisible = false"
    >
      <a-table
        :columns="availableMetadataColumns"
        :data-source="availableMetadata"
        :row-selection="rowSelection"
        row-key="metadataId"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'satellite'">
            <a-tag>{{ record.satellite }}</a-tag>
          </template>
          <template v-else-if="column.key === 'dataType'">
            <a-tag :color="record.dataType === '光学' ? 'green' : 'orange'">
              {{ record.dataType }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'associated'">
            <a-tag :color="record.associated ? 'default' : 'success'">
              {{ record.associated ? "已关联" : "未关联" }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script>
import { h } from "vue"
import { message, Modal, Statistic, Descriptions } from "ant-design-vue"
import {
  FolderAddOutlined,
  LinkOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from "@ant-design/icons-vue"
import { buildCatalogTree, fromCatalog, fromMetadata, toCatalogPayload } from "../api/adapters"
import { catalogApi, metadataApi } from "../api/services"

export default {
  name: "SatelliteDataCatalogLayout",
  components: {
    FolderAddOutlined,
    LinkOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
    AStatistic: Statistic,
    ADescriptions: Descriptions,
    ADescriptionsItem: Descriptions.Item
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,

      // 统计信息
      statistics: {
        totalCatalogs: 15,
        totalMetadata: 450,
        associationRate: 100,
        unassociatedCount: 0
      },

      // 目录树
      catalogTree: [],
      expandedKeys: ["root"],
      selectedKeys: [],
      currentCatalog: null,

      // 关联的元数据
      associatedMetadata: [],
      metadataColumns: [
        { title: "元数据ID", dataIndex: "metadataId", key: "metadataId", width: 180 },
        { title: "卫星型号", dataIndex: "satellite", key: "satellite", width: 100 },
        { title: "传感器", dataIndex: "sensor", key: "sensor", width: 100 },
        { title: "数据类型", dataIndex: "dataType", key: "dataType", width: 100 },
        { title: "关联时间", dataIndex: "associateTime", key: "associateTime", width: 160 },
        { title: "操作", key: "operation", width: 150 }
      ],

      // 分页配置
      paginationConfig: {
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条数据`,
        pageSizeOptions: ["10", "20", "50"]
      },

      // 创建目录
      dialogVisible: false,
      catalogForm: {
        name: "",
        dimension: "",
        description: ""
      },
      catalogRules: {
        name: [{ required: true, message: "请输入目录名称", trigger: "blur" }],
        dimension: [{ required: true, message: "请选择分类维度", trigger: "change" }]
      },

      // 关联元数据
      associateDialogVisible: false,
      availableMetadata: [],
      selectedMetadataKeys: [],
      availableMetadataColumns: [
        { title: "元数据ID", dataIndex: "metadataId", key: "metadataId", width: 180 },
        { title: "卫星型号", dataIndex: "satellite", key: "satellite", width: 100 },
        { title: "传感器", dataIndex: "sensor", key: "sensor", width: 100 },
        { title: "数据类型", dataIndex: "dataType", key: "dataType", width: 100 },
        { title: "获取时间", dataIndex: "acquisitionTime", key: "acquisitionTime", width: 180 },
        { title: "关联状态", dataIndex: "associated", key: "associated", width: 100 }
      ]
    }
  },
  computed: {
    rowSelection() {
      return {
        selectedRowKeys: this.selectedMetadataKeys,
        onChange: this.onSelectChange
      }
    }
  },
  mounted() {
    this.loadCatalogs()
  },
  methods: {
    async loadCatalogs(showSuccess = false) {
      this.loading = true
      try {
        const page = await catalogApi.list({ pageNo: 1, pageSize: 1000 })
        const nodes = page.records.map(fromCatalog)
        this.catalogTree = buildCatalogTree(nodes)
        this.statistics.totalCatalogs = page.total
        this.statistics.totalMetadata = nodes.reduce((sum, node) => sum + Number(node.count || 0), 0)
        if (!this.currentCatalog && this.catalogTree[0]) {
          this.currentCatalog = this.catalogTree[0]
          this.selectedKeys = [this.currentCatalog.key]
        }
        this.loadAssociatedMetadata()
        if (showSuccess) { message.success("数据已刷新") }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "目录数据加载失败")
      } finally {
        this.loading = false
      }
    },
    refreshData() {
      this.loadCatalogs(true)
    },

    getLevelName(level) {
      const levelMap = {
        0: "根目录",
        1: "一级目录",
        2: "二级目录",
        3: "三级目录"
      }
      return levelMap[level] || "未知"
    },

    findNodeByKey(nodes, key) {
      for (const node of nodes) {
        if (node.key === key) {
          return node
        }
        if (node.children) {
          const found = this.findNodeByKey(node.children, key)
          if (found) {
            return found
          }
        }
      }
      return null
    },

    handleNodeSelect(selectedKeys) {
      if (selectedKeys.length > 0 && selectedKeys[0] !== "root") {
        const key = selectedKeys[0]
        this.selectedKeys = selectedKeys
        this.currentCatalog = this.findNodeByKey(this.catalogTree, key)
        this.loadAssociatedMetadata(key)
      }
    },

    loadAssociatedMetadata() {
      this.associatedMetadata = []
      this.paginationConfig.total = 0
    },

    showCreateDialog() {
      this.dialogVisible = true
    },

    async handleSaveCatalog() {
      try {
        await this.$refs.catalogFormRef.validate()
        this.confirmLoading = true
        const parent = this.currentCatalog
        await catalogApi.add(toCatalogPayload({
          ...this.catalogForm,
          parentId: parent?.id || "",
          level: Number(parent?.level ?? -1) + 1,
          dataCount: 0,
          status: "正常",
          isLeaf: true
        }))
        message.success("目录创建成功")
        this.dialogVisible = false
        this.$refs.catalogFormRef.resetFields()
        await this.loadCatalogs()
      } catch (error) {
        if (error instanceof Error) { message.error(error.message) }
      } finally {
        this.confirmLoading = false
      }
    },

    showAssociateDialog() {
      if (!this.currentCatalog) {
        message.warning("请先选择一个目录")
        return
      }
      this.loadAvailableMetadata()
      this.associateDialogVisible = true
    },

    async loadAvailableMetadata() {
      try {
        const page = await metadataApi.list({ pageNo: 1, pageSize: 1000 })
        this.availableMetadata = page.records.map((record) => ({ ...fromMetadata(record), associated: false }))
      } catch (error) {
        message.error(error instanceof Error ? error.message : "元数据加载失败")
      }
    },

    onSelectChange(selectedRowKeys) {
      this.selectedMetadataKeys = selectedRowKeys
    },

    handleAssociateMetadata() {
      if (this.selectedMetadataKeys.length === 0) {
        message.warning("请选择要关联的元数据")
        return
      }
      message.info("项目一当前后端未提供目录与元数据关联接口")
    },

    viewMetadataDetail(record) {
      Modal.info({
        title: "元数据详情",
        content: () =>
          h("div", [
            h("p", [h("strong", "元数据ID："), record.metadataId]),
            h("p", [h("strong", "卫星型号："), record.satellite]),
            h("p", [h("strong", "传感器："), record.sensor]),
            h("p", [h("strong", "数据类型："), record.dataType]),
            h("p", [h("strong", "关联时间："), record.associateTime])
          ]),
        okText: "关闭"
      })
    },

    removeAssociation(record) {
      Modal.confirm({
        title: "确定要解除该元数据的关联吗？",
        okText: "确定",
        okType: "danger",
        cancelText: "取消",
        onOk: () => message.info("项目一当前后端未提供解除关联接口")
      })
    }
  }
}
</script>

<style scoped lang="less">
.satellite-catalog-page {
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
}
</style>
