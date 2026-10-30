<template>
  <div class="satellite-share-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据共享访问</div>
      </div>
    </div>

    <!-- 选项卡 -->
    <a-tabs v-model:activeKey="activeTab" type="card">
      <!-- 我的共享 -->
      <a-tab-pane key="myshare" tab="我的共享">
        <div class="operation-area">
          <a-button type="primary" @click="showShareDataDialog">
            <ShareAltOutlined />
            分享数据
          </a-button>
        </div>

        <a-card :bordered="false" style="margin-top: 16px">
          <template #title>
            <FolderOpenOutlined /> 我分享的数据
          </template>

          <a-table
            :columns="myShareColumns"
            :data-source="mySharedData"
            :loading="loading"
            row-key="shareId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'shareType'">
                <a-tag :color="record.shareType === '公开' ? 'green' : 'orange'" size="small">
                  {{ record.shareType }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'operation'">
                <a @click="viewShareLink(record)">查看链接</a>
                <a-divider type="vertical" />
                <a @click="viewShareStats(record)">统计</a>
                <a-divider type="vertical" />
                <a style="color: #f5222d" @click="cancelShare(record)">取消分享</a>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <!-- 共享给我的 -->
      <a-tab-pane key="sharedtome" tab="共享给我的">
        <a-card :bordered="false">
          <template #title>
            <InboxOutlined /> 共享给我的数据
          </template>

          <a-table
            :columns="sharedToMeColumns"
            :data-source="sharedToMeData"
            :loading="loading"
            row-key="dataId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'permissions'">
                <a-tag
                  v-for="perm in record.permissions"
                  :key="perm"
                  size="small"
                  style="margin-right: 5px"
                >
                  {{ perm }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-badge
                  :status="record.status === '有效' ? 'success' : 'error'"
                  :text="record.status"
                />
              </template>
              <template v-else-if="column.key === 'operation'">
                <a @click="accessSharedData(record)">访问</a>
                <template v-if="record.permissions.includes('下载')">
                  <a-divider type="vertical" />
                  <a @click="downloadSharedData(record)">下载</a>
                </template>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <!-- 访问监控 -->
      <a-tab-pane key="monitor" tab="访问监控">
        <!-- 统计信息 -->
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-card>
              <a-statistic title="总访问次数" :value="accessStatistics.totalAccess">
                <template #prefix>👁️</template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic title="成功访问" :value="accessStatistics.successAccess">
                <template #prefix>✅</template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic
                title="拒绝访问"
                :value="accessStatistics.failedAccess"
                :value-style="{ color: '#f5222d' }"
              >
                <template #prefix>❌</template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic title="平均响应时间" :value="accessStatistics.avgResponseTime" suffix="s">
                <template #prefix>⏱️</template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>

        <!-- 访问日志 -->
        <a-card :bordered="false">
          <template #title>
            <FileTextOutlined /> 访问日志
          </template>
          <template #extra>
            <a-button type="link" @click="exportAccessLogs">导出日志</a-button>
          </template>

          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item label="用户">
              <a-input v-model:value="logFilter.userId" placeholder="用户ID" style="width: 150px" allow-clear />
            </a-form-item>
            <a-form-item label="数据ID">
              <a-input v-model:value="logFilter.dataId" placeholder="数据ID" style="width: 180px" allow-clear />
            </a-form-item>
            <a-form-item label="访问结果">
              <a-select v-model:value="logFilter.result" placeholder="请选择" style="width: 120px" allow-clear>
                <a-select-option value="success">成功</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="filterAccessLogs">查询</a-button>
              <a-button style="margin-left: 8px" @click="resetLogFilter">重置</a-button>
            </a-form-item>
          </a-form>

          <a-table
            :columns="logColumns"
            :data-source="accessLogs"
            :pagination="logPaginationConfig"
            :loading="loading"
            row-key="time"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'role'">
                <a-tag size="small">{{ record.role }}</a-tag>
              </template>
              <template v-else-if="column.key === 'result'">
                <a-tag :color="record.result === '成功' ? 'green' : 'red'" size="small">
                  {{ record.result }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'responseTime'">
                {{ record.responseTime }}ms
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- 分享数据对话框 -->
    <a-modal
      title="分享数据"
      :open="shareDialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleShareData"
      @cancel="shareDialogVisible = false"
    >
      <a-form :model="shareForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="选择数据">
          <a-select v-model:value="shareForm.dataId" placeholder="请选择数据">
            <a-select-option v-for="data in availableData" :key="data.id" :value="data.id">
              {{ data.name }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="分享类型">
          <a-radio-group v-model:value="shareForm.shareType">
            <a-radio value="public">公开分享</a-radio>
            <a-radio value="private">私密分享</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="shareForm.shareType === 'private'" label="接收人">
          <a-input v-model:value="shareForm.recipients" placeholder="输入用户ID或邮箱，多个用逗号分隔" />
        </a-form-item>

        <a-form-item label="有效期">
          <a-select v-model:value="shareForm.expireDays">
            <a-select-option :value="1">1天</a-select-option>
            <a-select-option :value="7">7天</a-select-option>
            <a-select-option :value="30">30天</a-select-option>
            <a-select-option :value="-1">永久</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { message, Modal, Statistic, Badge } from "ant-design-vue"
import {
  FileTextOutlined,
  ShareAltOutlined,
  FolderOpenOutlined,
  InboxOutlined
} from "@ant-design/icons-vue"
import { fromMetadata, toSharePayload } from "../api/adapters"
import { metadataApi, shareApi } from "../api/services"

export default {
  name: "SatelliteDataShareLayout",
  components: {
    FileTextOutlined,
    ShareAltOutlined,
    FolderOpenOutlined,
    InboxOutlined,
    AStatistic: Statistic,
    ABadge: Badge
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,
      activeTab: "myshare",

      // 访问监控
      accessStatistics: {
        totalAccess: 1245,
        successAccess: 1198,
        failedAccess: 47,
        avgResponseTime: 1.8
      },
      logFilter: {
        userId: "",
        dataId: "",
        result: undefined
      },
      accessLogs: [],
      logColumns: [
        { title: "访问时间", dataIndex: "time", key: "time", width: 180 },
        { title: "用户ID", dataIndex: "userId", key: "userId", width: 120 },
        { title: "用户名", dataIndex: "userName", key: "userName", width: 100 },
        { title: "角色", dataIndex: "role", key: "role", width: 100 },
        { title: "数据ID", dataIndex: "dataId", key: "dataId", width: 180 },
        { title: "操作", dataIndex: "action", key: "action", width: 80 },
        { title: "访问结果", dataIndex: "result", key: "result", width: 100 },
        { title: "响应时间", dataIndex: "responseTime", key: "responseTime", width: 100 },
        { title: "IP地址", dataIndex: "ip", key: "ip", width: 140 }
      ],
      logPaginationConfig: {
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条数据`
      },

      // 我的共享
      mySharedData: [],
      myShareColumns: [
        { title: "分享ID", dataIndex: "shareId", key: "shareId", width: 180 },
        { title: "数据名称", dataIndex: "dataName", key: "dataName" },
        { title: "分享类型", dataIndex: "shareType", key: "shareType", width: 100 },
        { title: "访问次数", dataIndex: "accessCount", key: "accessCount", width: 100 },
        { title: "下载次数", dataIndex: "downloadCount", key: "downloadCount", width: 100 },
        { title: "操作", key: "operation", fixed: "right", width: 200 }
      ],

      // 共享给我的
      sharedToMeData: [],
      sharedToMeColumns: [
        { title: "数据名称", dataIndex: "dataName", key: "dataName" },
        { title: "分享人", dataIndex: "shareFrom", key: "shareFrom", width: 100 },
        { title: "权限", dataIndex: "permissions", key: "permissions", width: 150 },
        { title: "接收时间", dataIndex: "receiveTime", key: "receiveTime", width: 180 },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
        { title: "操作", key: "operation", width: 150 }
      ],

      availableData: [],

      // 分享表单
      shareDialogVisible: false,
      shareForm: {
        dataId: "",
        shareType: "public",
        recipients: "",
        expireDays: 7
      }
    }
  },
  mounted() {
    this.loadAvailableData()
  },
  methods: {
    async loadAvailableData() {
      try {
        const page = await metadataApi.list({ pageNo: 1, pageSize: 1000 })
        this.availableData = page.records.map(fromMetadata).map((record) => ({
          id: record.metadataId,
          name: [record.satellite, record.sensor, record.region, record.acquisitionTime].filter(Boolean).join(" ")
        }))
      } catch (error) {
        message.error(error instanceof Error ? error.message : "可授权数据加载失败")
      }
    },
    filterAccessLogs() {
      message.info("操作审计按当前接入范围暂缓")
    },

    resetLogFilter() {
      this.logFilter = {
        userId: "",
        dataId: "",
        result: undefined
      }
    },

    exportAccessLogs() {
      message.info("操作审计按当前接入范围暂缓")
    },

    showShareDataDialog() {
      this.shareDialogVisible = true
    },

    async handleShareData() {
      if (!this.shareForm.dataId) {
        message.warning("请选择要分享的数据")
        return
      }
      try {
        this.confirmLoading = true
        const recipients = this.shareForm.recipients
          ? this.shareForm.recipients.split(",").map((item) => item.trim()).filter(Boolean)
          : ["公开"]
        await shareApi.add(toSharePayload({
          dataIds: [this.shareForm.dataId],
          authType: this.shareForm.shareType === "public" ? "公开" : "用户",
          authTarget: recipients,
          permissions: ["查看"],
          status: "已启用"
        }))
        message.success("数据分享成功")
        this.shareDialogVisible = false
      } catch (error) {
        message.error(error instanceof Error ? error.message : "数据分享失败")
      } finally {
        this.confirmLoading = false
      }
    },

    viewShareLink(record) {
      message.info(`项目一当前后端未提供分享链接接口：${record.shareId}`)
    },

    viewShareStats() {
      message.info("分享统计功能开发中...")
    },

    cancelShare(record) {
      Modal.confirm({
        title: "确定要取消分享吗？",
        okText: "确定",
        cancelText: "取消",
        onOk: () => {
          const index = this.mySharedData.findIndex((item) => item.shareId === record.shareId)
          if (index !== -1) {
            this.mySharedData.splice(index, 1)
            message.success("已取消分享")
          }
        }
      })
    },

    accessSharedData() {
      message.info("共享给我的功能按当前接入范围暂缓")
    },

    downloadSharedData(record) {
      message.info(`项目一当前后端未提供数据文件下载接口：${record.dataName}`)
    }
  }
}
</script>

<style scoped lang="less">
.satellite-share-page {
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
      }
    }
  }

  .operation-area {
    margin-bottom: 16px;
    padding: 15px 20px;
    background: white;
    border-radius: 4px;

    button {
      margin-right: 8px;
    }
  }
}
</style>
