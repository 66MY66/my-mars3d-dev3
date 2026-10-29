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
      catalogTree: [
        {
          title: "根目录",
          key: "root",
          level: 0,
          count: 450,
          children: [
            {
              title: "GF-1",
              key: "cat-gf1",
              level: 1,
              count: 150,
              children: [
                { title: "PMS传感器", key: "cat-gf1-pms", level: 2, count: 90 },
                { title: "WFV传感器", key: "cat-gf1-wfv", level: 2, count: 60 }
              ]
            },
            {
              title: "GF-6",
              key: "cat-gf6",
              level: 1,
              count: 120,
              children: [
                { title: "WFV传感器", key: "cat-gf6-wfv", level: 2, count: 120 }
              ]
            },
            {
              title: "Sentinel",
              key: "cat-sentinel",
              level: 1,
              count: 180,
              children: [
                { title: "Sentinel-1 (SAR)", key: "cat-sentinel-1", level: 2, count: 100 },
                { title: "Sentinel-2 (MSI)", key: "cat-sentinel-2", level: 2, count: 80 }
              ]
            }
          ]
        }
      ],
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
    // 默认选中第一个目录
    if (this.catalogTree[0] && this.catalogTree[0].children && this.catalogTree[0].children[0]) {
      const firstChild = this.catalogTree[0].children[0]
      this.selectedKeys = [firstChild.key]
      this.currentCatalog = firstChild
      this.loadAssociatedMetadata(firstChild.key)
    }
  },
  methods: {
    refreshData() {
      this.loading = true
      setTimeout(() => {
        message.success("数据已刷新")
        this.loading = false
      }, 500)
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
      this.loading = true
      setTimeout(() => {
        // 模拟数据
        this.associatedMetadata = [
          {
            metadataId: "META-GF1-20241118-001",
            satellite: "GF-1",
            sensor: "PMS",
            dataType: "光学",
            associateTime: "2024-11-18 10:30:25"
          },
          {
            metadataId: "META-GF1-20241118-002",
            satellite: "GF-1",
            sensor: "PMS",
            dataType: "光学",
            associateTime: "2024-11-18 11:15:40"
          }
        ]
        this.paginationConfig.total = this.associatedMetadata.length
        this.loading = false
      }, 500)
    },

    showCreateDialog() {
      this.dialogVisible = true
    },

    handleSaveCatalog() {
      this.$refs.catalogFormRef.validate().then(() => {
        this.confirmLoading = true
        setTimeout(() => {
          message.success("目录创建成功")
          this.statistics.totalCatalogs++
          this.dialogVisible = false
          this.confirmLoading = false
          this.$refs.catalogFormRef.resetFields()
        }, 500)
      }).catch(() => {})
    },

    showAssociateDialog() {
      if (!this.currentCatalog) {
        message.warning("请先选择一个目录")
        return
      }
      this.loadAvailableMetadata()
      this.associateDialogVisible = true
    },

    loadAvailableMetadata() {
      this.availableMetadata = [
        {
          metadataId: "META-GF1-20241118-003",
          satellite: "GF-1",
          sensor: "PMS",
          dataType: "光学",
          acquisitionTime: "2024-11-18 12:30:25",
          associated: false
        },
        {
          metadataId: "META-GF1-20241118-004",
          satellite: "GF-1",
          sensor: "PMS",
          dataType: "光学",
          acquisitionTime: "2024-11-18 13:15:40",
          associated: false
        }
      ]
    },

    onSelectChange(selectedRowKeys) {
      this.selectedMetadataKeys = selectedRowKeys
    },

    handleAssociateMetadata() {
      if (this.selectedMetadataKeys.length === 0) {
        message.warning("请选择要关联的元数据")
        return
      }
      this.confirmLoading = true
      setTimeout(() => {
        const count = this.selectedMetadataKeys.length
        message.success(`成功关联${count}条元数据`)
        this.associateDialogVisible = false
        this.confirmLoading = false
        this.selectedMetadataKeys = []
        this.loadAssociatedMetadata(this.currentCatalog.key)
        this.statistics.totalMetadata += count
      }, 500)
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
        onOk: () => {
          const index = this.associatedMetadata.findIndex(
            (item) => item.metadataId === record.metadataId
          )
          if (index !== -1) {
            this.associatedMetadata.splice(index, 1)
            this.paginationConfig.total--
            this.statistics.totalMetadata--
            message.success("解除关联成功")
          }
        }
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
