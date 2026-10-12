<template>
  <mars-dialog
    :visible="panelVisible"
    title="当前任务"
    icon="data-switching"
    custom-class="current-task_panel"
    :draggable="false"
    :position="dialogPosition"
    :width="PANEL_INITIAL_WIDTH"
    :min-width="PANEL_MIN_WIDTH"
    :min-height="PANEL_MIN_HEIGHT"
    :handles="true"
    :persist-layout="false"
    :animation="false"
    @update:visible="handlePanelVisibleChange"
  >
    <template #headerRight>
      <div class="task-header-actions" @mousedown.stop @click.stop>
        <a-tooltip title="上一步">
          <button
            type="button"
            class="task-header-icon-btn"
            :disabled="!canUndoStep"
            aria-label="上一步"
            @click="undoStep"
          >
            <mars-icon icon="left" :width="16" />
          </button>
        </a-tooltip>
        <a-tooltip title="下一步">
          <button
            type="button"
            class="task-header-icon-btn"
            :disabled="!canRedoStep"
            aria-label="下一步"
            @click="redoStep"
          >
            <mars-icon icon="right" :width="16" />
          </button>
        </a-tooltip>
        <div class="readonly-toggle">
          <span class="readonly-label">只读</span>
          <a-tooltip :title="taskLocked ? (taskLockReason || '已锁定') : '切换只读锁'">
            <mars-switch :checked="taskLocked" @change="handleReadonlyChange" />
          </a-tooltip>
        </div>
        <a-tooltip title="默认恢复">
          <button type="button" class="task-header-icon-btn" aria-label="默认恢复" @click="resetLayout">
            <mars-icon icon="refresh" :width="16" />
          </button>
        </a-tooltip>
      </div>
    </template>

    <div class="task-panel-body">
            <div class="task-tree">
              <button class="tree-row root" type="button" @click="toggleRoot">
                <span class="tree-icon"><mars-icon icon="bookmark-one" width="16" /></span>
                <span class="tree-text">{{ currentDatasetTitle }}</span>
                <span class="tree-spacer"></span>
                <span class="tree-caret" :class="{ open: rootOpen }"><mars-icon icon="right" width="16" /></span>
              </button>

              <div v-if="rootOpen" class="tree-children">
                <div class="task-section-tabs" role="tablist">
                  <button
                    v-for="tab in sectionTabs"
                    :key="tab.key"
                    type="button"
                    role="tab"
                    class="task-section-tab"
                    :class="{ active: activeSection === tab.key }"
                    :aria-selected="activeSection === tab.key"
                    @click="switchSection(tab.key)"
                  >
                    <span class="task-section-tab-label">{{ tab.label }}</span>
                    <span v-if="tab.count !== null" class="task-section-tab-count">({{ tab.count }})</span>
                  </button>
                </div>

                <div class="task-section-content">
                <div v-show="activeSection === 'layers'" class="tree-panel section-panel">
                  <div v-if="!selectedGroupId" class="empty">
                    <a-empty description="暂无可用的任务批次，请先导入到地图" :image-style="{ height: '60px' }" />
                  </div>
                  <div v-else class="layers-panel">
                    <div class="layers-toolbar">
                      <a-input
                        v-model:value="layerSearch"
                        size="small"
                        allow-clear
                        placeholder="搜索名称/标签"
                        class="layers-search"
                      />
                      <mars-button size="small" :disabled="taskLocked || !selectedGroupId" @click="openFileImport">
                        导入文件
                      </mars-button>
                      <mars-button size="small" :disabled="taskLocked || !selectedGroupId" @click="batchShowAllLayers">
                        批量显示
                      </mars-button>
                      <mars-button size="small" :disabled="taskLocked || !selectedGroupId" @click="batchHideAllLayers">
                        批量隐藏
                      </mars-button>
                      <mars-button size="small" type="primary" :disabled="taskLocked || !canSyncNow" @click="syncCurrentSession">
                        一键同步
                      </mars-button>
                      <mars-button size="small" type="primary" :disabled="!canOpenSaveDialog" @click="openSaveDialog('save')">
                        保存到我的仓库
                      </mars-button>
                      <mars-button size="small" :disabled="!canOpenSaveDialog" @click="openSaveDialog('publish')">提交发布</mars-button>
                      <mars-button size="small" :disabled="taskLocked || !selectedGroupId" @click="startQuickCreate('rectangle')">
                        框选矩形
                      </mars-button>
                      <mars-button size="small" :disabled="taskLocked || !selectedGroupId" @click="startQuickCreate('polygon')">
                        框选多边形
                      </mars-button>
                      <a-tooltip v-if="taskLocked" :title="taskLockReason || '已锁定'">
                        <span class="layers-lock">只读中</span>
                      </a-tooltip>
                    </div>
                    <div v-if="sessionRefreshLoading || sessionRefreshText" class="session-refresh-banner">
                      <a-spin v-if="sessionRefreshLoading" size="small" />
                      <span>{{ sessionRefreshText }}</span>
                    </div>
                    <mars-tree
                      class="layers-tree"
                      checkable
                      blockNode
                      :draggable="!taskLocked"
                      :tree-data="displayTreeData"
                      v-model:expandedKeys="expandedKeys"
                      v-model:checkedKeys="checkedKeys"
                      v-model:selectedKeys="selectedKeys"
                      @check="checkedChange"
                      @select="handleSelect"
                      @drop="handleDrop"
                      @dragstart="onDragStart"
                      @dragend="onDragEnd"
                    >
                      <template #title="node">
                        <mars-dropdown-menu :trigger="['contextmenu']">
                          <span class="node-title" @click.stop="focusNode(node)" @dblclick.stop="focusNode(node)">
                            <template v-for="(seg, idx) in getHighlightedText(String(node.title || ''), layerSearch)" :key="idx">
                              <span v-if="seg.matched" class="node-highlight">{{ seg.text }}</span>
                              <span v-else>{{ seg.text }}</span>
                            </template>
                            <span v-if="Array.isArray((node as any)._tags) && (node as any)._tags.length" class="node-tags">
                              <a-tag
                                v-for="t in (node as any)._tags"
                                :key="t"
                                size="small"
                                class="node-tag"
                              >
                                <template v-for="(seg, idx2) in getHighlightedText(String(t), layerSearch)" :key="idx2">
                                  <span v-if="seg.matched" class="node-highlight">{{ seg.text }}</span>
                                  <span v-else>{{ seg.text }}</span>
                                </template>
                              </a-tag>
                            </span>
                            <span v-if="!taskLocked && !node.disabled && !node.group" class="node-hover-actions" @click.stop>
                              <a-button type="text" size="small" class="node-hover-action" @click="toggleNodeShow(node)">
                                {{ node.checked ? "隐藏" : "显示" }}
                              </a-button>
                              <a-button type="text" size="small" class="node-hover-action" @click="focusNode(node)">定位</a-button>
                              <a-button type="text" size="small" class="node-hover-action" @click="moveNode(node, 'up')">上移</a-button>
                              <a-button type="text" size="small" class="node-hover-action" @click="moveNode(node, 'down')">下移</a-button>
                            </span>
                          </span>
                          <template #overlay v-if="!taskLocked && !node.disabled">
                            <a-menu @click="(menu: any) => onContextMenuClick(node, menu.key)">
                              <a-menu-item v-if="node.hasZIndex" key="top">置为顶层</a-menu-item>
                              <a-menu-item v-if="node.hasZIndex" key="up">上移一层</a-menu-item>
                              <a-menu-item v-if="node.hasZIndex" key="down">下移一层</a-menu-item>
                              <a-menu-item v-if="node.hasZIndex" key="bottom">置为底层</a-menu-item>
                              <a-menu-divider v-if="node.hasZIndex" />
                              <a-menu-item v-if="node.group" key="expand-all">全部展开</a-menu-item>
                              <a-menu-item v-if="node.group" key="collapse-all">全部折叠</a-menu-item>
                              <a-menu-divider v-if="node.group" />
                              <a-menu-item v-if="node.group" key="show-only">仅显示此目录</a-menu-item>
                              <a-menu-item v-if="node.group" key="hide-others">关闭其他图层</a-menu-item>
                              <a-menu-divider v-if="node.group" />
                              <a-menu-item v-if="canCreateGroupUnder(node)" key="create-group">新建子分组</a-menu-item>
                              <a-menu-item v-if="canRename(node)" key="rename">重命名</a-menu-item>
                              <a-menu-item v-if="canMove(node)" key="move">移动</a-menu-item>
                              <a-menu-item v-if="canRemoveFromDir(node)" key="remove-from-dir">从目录移除</a-menu-item>
                              <a-menu-item v-if="canDelete(node)" key="delete">删除</a-menu-item>
                              <a-menu-divider v-if="nodeIsSessionRoot(node)" />
                              <a-menu-item v-if="nodeIsSessionRoot(node)" key="clear-session">清空本次导入</a-menu-item>
                            </a-menu>
                          </template>
                        </mars-dropdown-menu>
                        <span v-if="node.hasOpacity && node.checked" class="tree-slider" @click.stop>
                          <mars-slider
                            v-model:value="opacityValue[node.key]"
                            :min="0"
                            :step="0.1"
                            :max="1"
                            @change="(value: number) => opcityChange(node, value)"
                          />
                        </span>
                      </template>
                    </mars-tree>
                  </div>
                </div>

                <div v-show="activeSection === 'thematics'" class="tree-panel section-panel">
                  <div v-if="!currentDataset?.datasetId" class="empty">
                    <a-empty description="请先选择/导入数据集" :image-style="{ height: '60px' }" />
                  </div>
                  <div v-else class="thematics-panel">
                    <div class="thematics-jobs">
                      <div class="thematics-header">
                        <mars-button class="task-round-btn" size="small" @click="loadThematicsJobs" :disabled="thematicsLoading">
                          刷新
                        </mars-button>
                      </div>

                      <div v-if="thematicsLoading" class="loading-container">
                        <a-spin tip="加载中..." />
                      </div>

                      <a-empty v-else-if="thematicsJobs.length === 0" description="暂无专题图任务" />

                      <template v-else>
                        <div class="thematics-list">
                          <div
                            v-for="job in thematicsJobs"
                            :key="job.jobId"
                            class="thematic-job-block"
                            :class="{ active: selectedThematicJobId === job.jobId }"
                          >
                            <div class="thematic-job-header" @click="selectThematicJob(job)">
                              <div class="job-title">{{ getThematicJobLabel(job) }}</div>
                              <div
                                v-if="selectedThematicJobId === job.jobId && selectedThematicResult"
                                class="thematic-job-toggle"
                                @click.stop
                              >
                                <button
                                  type="button"
                                  class="thematic-toggle-btn"
                                  :disabled="!thematicResultExpanded"
                                  aria-label="收起生成结果"
                                  @click="collapseThematicResult"
                                >
                                  <mars-icon icon="up" :width="14" />
                                </button>
                                <button
                                  type="button"
                                  class="thematic-toggle-btn"
                                  :disabled="thematicResultExpanded"
                                  aria-label="展开生成结果"
                                  @click="expandThematicResult"
                                >
                                  <mars-icon icon="down" :width="14" />
                                </button>
                              </div>
                              <div v-else class="job-meta">状态：{{ job.status }}</div>
                            </div>

                            <div
                              v-if="selectedThematicJobId === job.jobId && selectedThematicResult && thematicResultExpanded"
                              class="job-detail-panel"
                            >
                              <div class="detail-header">
                                <div class="detail-title">生成结果</div>
                              </div>

                              <div
                                v-if="Array.isArray(selectedThematicResult.artifacts) && selectedThematicResult.artifacts.length"
                                class="thematic-result-children"
                              >
                                <div v-for="a in selectedThematicResult.artifacts" :key="a.artifactId" class="thematic-artifact">
                                  <span class="artifact-name">{{ a.name }}</span>
                                  <div class="thematic-artifact-actions">
                                    <template v-if="isThematicPreviewArtifact(a)">
                                      <mars-button
                                        v-if="canAddArtifactToMap(a)"
                                        size="small"
                                        class="thematic-outline-btn"
                                        @click="addArtifactToMap(a)"
                                      >
                                        上图
                                      </mars-button>
                                      <mars-button size="small" class="thematic-outline-btn" @click="previewThematicArtifact(a)">
                                        预览
                                      </mars-button>
                                    </template>
                                    <template v-else>
                                      <mars-button size="small" class="thematic-outline-btn" @click="previewThematicArtifact(a)">
                                        预览
                                      </mars-button>
                                      <mars-button
                                        v-if="canAddArtifactToMap(a)"
                                        size="small"
                                        class="thematic-outline-btn"
                                        @click="addArtifactToMap(a)"
                                      >
                                        上图
                                      </mars-button>
                                    </template>
                                    <mars-button size="small" class="thematic-outline-btn" @click="downloadThematicArtifact(a)">
                                      下载
                                    </mars-button>
                                  </div>
                                </div>
                              </div>

                              <div v-if="selectedThematicResult.serviceRef" class="service-ref">
                                <div class="service-actions">
                                  <mars-button size="small" type="primary" class="thematic-service-btn" @click="addThematicServiceLayer(selectedThematicResult.serviceRef)">
                                    上图
                                  </mars-button>
                                  <mars-button size="small" class="thematic-service-btn" @click="locateThematicService(selectedThematicResult.serviceRef)">
                                    定位
                                  </mars-button>
                                  <mars-button size="small" class="thematic-service-btn" @click="exportThematicResult">
                                    导出
                                  </mars-button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <div v-show="activeSection === 'artifacts'" class="tree-panel section-panel">
                  <div v-if="!currentDataset?.datasetId" class="empty">
                    <a-empty description="请先选择/导入数据集" :image-style="{ height: '60px' }" />
                  </div>
                  <div v-else class="artifacts">
                    <div class="artifacts-header">
                      <mars-button class="artifacts-tool task-round-btn" size="small" @click="loadArtifacts" :disabled="artifactsLoading">刷新</mars-button>
                      <a-upload class="artifacts-tool artifacts-tool-upload" :showUploadList="false" :beforeUpload="beforeUploadArtifact">
                        <mars-button size="small" type="primary" class="task-round-btn">上传附件</mars-button>
                      </a-upload>
                      <a-select v-model:value="artifactUploadType" size="small" class="artifacts-tool" aria-label="其他">
                        <a-select-option value="thumbnail">封面</a-select-option>
                        <a-select-option value="report">报告</a-select-option>
                        <a-select-option value="export">导出</a-select-option>
                        <a-select-option value="log">日志</a-select-option>
                        <a-select-option value="data">数据</a-select-option>
                        <a-select-option value="other">其他</a-select-option>
                      </a-select>
                      <a-select v-model:value="artifactFilterType" size="small" class="artifacts-tool" allowClear placeholder="全部" aria-label="全部">
                        <a-select-option value="">全部</a-select-option>
                        <a-select-option value="thumbnail">封面</a-select-option>
                        <a-select-option value="report">报告</a-select-option>
                        <a-select-option value="export">导出</a-select-option>
                        <a-select-option value="log">日志</a-select-option>
                        <a-select-option value="data">数据</a-select-option>
                        <a-select-option value="other">其他</a-select-option>
                      </a-select>
                    </div>

                    <div v-if="artifactsLoading" class="loading-container">
                      <a-spin tip="加载中..." />
                    </div>

                    <a-empty v-else-if="displayArtifacts.length === 0" description="暂无附件" />

                    <a-list v-else size="small" :data-source="displayArtifacts" class="artifacts-list">
                      <template #renderItem="{ item }">
                        <a-list-item>
                          <a-list-item-meta :title="item.name" :description="formatArtifactDesc(item)" />
                          <template #actions>
                            <a @click.prevent="previewArtifact(item)">预览</a>
                            <a v-if="canAddArtifactToMap(item)" @click.prevent="addArtifactToMap(item)">上图</a>
                            <a @click.prevent="downloadArtifact(item)">下载</a>
                            <a @click.prevent="openLinkArtifact(item)">关联至版本</a>
                            <a @click.prevent="removeArtifact(item)">删除</a>
                          </template>
                        </a-list-item>
                      </template>
                    </a-list>
                  </div>
                </div>

                <div v-show="activeSection === 'versions'" class="tree-panel section-panel versions-panel">
                  <div v-if="!currentDataset?.datasetId" class="empty">
                    <a-empty description="请先选择/导入数据集" :image-style="{ height: '60px' }" />
                  </div>
                  <div v-else class="versions">
                    <div class="versions-header">
                      <mars-button class="task-round-btn" size="small" @click="loadRevisions" :disabled="revisionsLoading">刷新</mars-button>
                    </div>
                    <div v-if="revisionsLoading" class="loading-container">
                      <a-spin tip="加载中..." />
                    </div>
                    <a-empty v-else-if="revisions.length === 0" description="暂无版本" />
                    <div v-else class="versions-list">
                      <div v-for="item in revisions" :key="item.revisionId" class="version-item">
                        <div class="version-item-info">
                          <a-tooltip :title="item.title" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
                            <div class="version-meta-title">{{ item.title }}</div>
                          </a-tooltip>
                          <a-tooltip v-if="item.desc" :title="item.desc" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
                            <div class="version-meta-desc">{{ item.desc }}</div>
                          </a-tooltip>
                        </div>
                        <div class="version-actions">
                          <a-button class="version-action-btn version-action-view" type="text" size="small" @click="openManifestView(item.revisionId)">查看</a-button>
                          <a-button class="version-action-btn version-action-restore" type="text" size="small" @click="restoreRevision(item.revisionId)">恢复</a-button>
                          <a-dropdown placement="bottomRight" :trigger="['click']">
                            <a-button class="version-action-btn version-action-more" type="text" size="small">更多</a-button>
                            <template #overlay>
                              <a-menu>
                                <a-menu-item key="copy" @click="openForkDialog(item.revisionId)">复制为新数据集</a-menu-item>
                                <a-menu-item key="save" @click="saveAsNewRevision(item.revisionId)">保存为新版本</a-menu-item>
                              </a-menu>
                            </template>
                          </a-dropdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <div class="recent-divider"></div>

            <div class="recent">
              <div class="recent-title">最近导入</div>
              <div v-if="recentImports.length === 0" class="recent-empty">暂无记录</div>
              <button
                v-for="it in recentImports"
                :key="it.groupId"
                class="recent-item"
                type="button"
                :class="{ active: String(it.groupId) === String(selectedGroupId) }"
                @click="selectSession(it.groupId)"
              >
                <span class="recent-icon">
                  <mars-icon :icon="it.icon" width="16" />
                </span>
                <span class="recent-name" :title="it.name">{{ it.name }}</span>
                <span class="recent-time">{{ it.time }}</span>
              </button>
            </div>
    </div>
  </mars-dialog>

  <a-modal v-model:open="createGroupDialogOpen" title="新建分组" @ok="confirmCreateGroup" @cancel="cancelCreateGroup">
    <a-form layout="vertical">
      <a-form-item label="分组名称">
        <a-input v-model:value="createGroupName" placeholder="请输入分组名称" />
      </a-form-item>
      <a-form-item label="父分组">
        <a-select v-model:value="createGroupPid" :options="groupOptions" placeholder="请选择父分组" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal v-model:open="renameDialogOpen" title="重命名" @ok="confirmRename" @cancel="cancelRename">
    <a-input v-model:value="renameName" placeholder="请输入名称" />
  </a-modal>

  <a-modal v-model:open="moveDialogOpen" title="移动" @ok="confirmMove" @cancel="cancelMove">
    <a-form layout="vertical">
      <a-form-item label="目标分组">
        <a-select v-model:value="moveTargetPid" :options="moveTargetOptions" placeholder="请选择目标分组" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal v-model:open="deleteDialogOpen" title="删除" ok-type="danger" @ok="confirmDelete" @cancel="cancelDelete">
    <div>确认删除“{{ deleteTargetTitle }}”？</div>
  </a-modal>

  <a-modal v-model:open="clearDialogOpen" title="清空本次导入" ok-type="danger" @ok="confirmClearSession" @cancel="cancelClearSession">
    <div>将删除该批次分组下的所有图层/分组，此操作不可撤销。</div>
  </a-modal>

  <a-modal v-model:open="artifactPreviewOpen" title="附件预览" :footer="null" width="760" @cancel="closeArtifactPreview">
    <div class="artifact-preview">
      <ArtifactPreview v-if="artifactPreviewUrl" :url="artifactPreviewUrl" :mime="artifactPreviewMime" />
      <a-empty v-else description="暂无可预览内容" />
    </div>
  </a-modal>

  <a-modal v-model:open="manifestViewOpen" title="Manifest" :footer="null" width="760" @cancel="closeManifestView">
    <pre class="manifest-view">{{ manifestViewText }}</pre>
  </a-modal>

  <a-modal v-model:open="forkDialogOpen" title="复制为新数据集" @ok="confirmFork" @cancel="cancelFork">
    <a-form layout="vertical">
      <a-form-item label="新数据集名称">
        <a-input v-model:value="forkName" placeholder="请输入新数据集名称" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal v-model:open="quickCreateOpen" title="保存框选内容" @cancel="cancelQuickCreate">
    <a-form layout="vertical">
      <a-form-item label="名称" required>
        <a-input v-model:value="quickCreateName" placeholder="请输入名称" />
      </a-form-item>
      <a-form-item label="保存到目录">
        <a-select v-model:value="quickCreatePid" :options="groupOptions" placeholder="请选择父分组" />
      </a-form-item>
    </a-form>
    <template #footer>
      <a-button @click="cancelQuickCreate">取消</a-button>
      <a-button type="primary" @click="confirmQuickCreate(true)">保存并上图</a-button>
      <a-button @click="confirmQuickCreate(false)">仅保存</a-button>
    </template>
  </a-modal>

  <a-modal v-model:open="artifactLinkOpen" title="关联附件到版本" @ok="confirmLinkArtifact" @cancel="cancelLinkArtifact">
    <a-form layout="vertical">
      <a-form-item label="版本">
        <a-select v-model:value="artifactLinkRevisionId" :options="revisionOptions" placeholder="请选择版本（可选）" allow-clear />
      </a-form-item>
    </a-form>
  </a-modal>

  <SaveManifestDialog
    v-model:open="saveDialogOpen"
    :layerFilter="selectedLayerFilter"
    :initialVisibility="saveDialogMode === 'publish' ? 'shared' : 'private'"
    :initialSubmitForReview="saveDialogMode === 'publish'"
  />

  <DatasetImportModal
    v-model:open="fileImportOpen"
    :datasetId="currentDataset?.datasetId"
    :sessionRootId="selectedGroupId"
    @imported="handleFileImported"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, provide, ref, watch } from "vue"
import useLifecycle from "@mars/common/uses/use-lifecycle"
import * as mapWork from "./map"
import { $message } from "@mars/components/mars-ui/index"
import {
  getCurrentDataset,
  onCurrentDatasetChange,
  getCurrentTaskLock,
  onCurrentTaskLockChange,
  setCurrentTaskLock,
  clearCurrentTaskLock,
  type CurrentDataset,
  type CurrentTaskLock
} from "@/shell/currentDataset"
import { isSuperAdmin } from "@/shell/permission"
import * as mars3d from "mars3d"
import SaveManifestDialog from "../dataset-repository/components/SaveManifestDialog.vue"
import ArtifactPreview from "../dataset-repository/components/ArtifactPreview.vue"
import DatasetImportModal from "@/components/Dataset/DatasetImportModal.vue"
import { getArtifacts, getArtifactDownloadUrl, smartUploadArtifact, deleteArtifact, linkArtifactToDataset, formatArtifactSize, getArtifactTypeName } from "../dataset-repository/services/eoapi-artifacts"
import type { Artifact, ArtifactType, Manifest, ServiceRef, ThematicJob, ThematicJobResult } from "../dataset-repository/types/eoapi-types"
import { getItems, getLatestDatasetManifest, getRevisionManifest, forkDataset, saveDatasetRevision } from "../dataset-repository/services/eoapi-datasets"
import { eoApiConfig } from "../dataset-repository/services/eoapi-config"
import { connectDatasetSync, disconnectDatasetSync, onDatasetSync, type DatasetSyncDetail } from "../dataset-repository/services/dataset-sync"
import { getDirectoryLocks, upsertDirectoryLock, type DirectoryLockRecord } from "../dataset-repository/services/eoapi-directory-locks"
import { diffManifests } from "../dataset-repository/services/manifest-diff"
import { buildScopedGroupId, buildScopedLayerId, buildScopedLayerPrefix, ensureUniqueMapLayerId, normalizeLayerIdToken } from "../dataset-repository/services/layer-id"
import { restoreWorkspace } from "../dataset-repository/workspace/restore"
import { serializeWorkspace } from "../dataset-repository/workspace/serialize"
import { getJobs, getJobResult } from "../dataset-repository/services/eoapi-thematics"
import { setWidgetProtected } from "@mars/common/store/widget-rules"

const props = withDefaults(
  defineProps<{
    visible?: boolean
  }>(),
  {
    visible: false
  }
)

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const panelVisible = computed(() => !!props.visible)
let prevBodyOverflow = ""

function handlePanelVisibleChange(value: boolean) {
  emit("update:visible", value)
}

watch(
  () => props.visible,
  (value) => {
    if (value) {
      nextTick(() => {
        updateAnchorRect()
      })
    }
  }
)

useLifecycle(mapWork)

// 为 SaveManifestDialog 提供地图实例获取函数
provide("getMapInstance", () => mapWork.getMap())

const currentDataset = ref<CurrentDataset | null>(getCurrentDataset())
let disposeDatasetWatch: null | (() => void) = null

const taskLock = ref<CurrentTaskLock>(getCurrentTaskLock())
const directoryLockMap = ref<Record<string, DirectoryLockRecord>>({})
const superAdminUser = computed(() => isSuperAdmin())

const saveDialogOpen = ref(false)
const saveDialogMode = ref<"save" | "publish">("save")
const fileImportOpen = ref(false)
const syncingNow = ref(false)
const sessionRefreshLoading = ref(false)
const sessionRefreshText = ref("")
let sessionRefreshTimer: number | null = null
let sessionRefreshMessageTimer: number | null = null
let pendingSessionSyncDetail: DatasetSyncDetail | null = null

watch(fileImportOpen, (open) => {
  setWidgetProtected("current-task", open)
})

type HighlightSeg = { text: string; matched: boolean }
const layerSearch = ref("")
function getHighlightedText(text: string, keyword: string): HighlightSeg[] {
  const raw = String(text || "")
  const kw = String(keyword || "").trim()
  if (!kw) {
    return [{ text: raw, matched: false }]
  }
  const lower = raw.toLowerCase()
  const target = kw.toLowerCase()
  const parts: HighlightSeg[] = []
  let start = 0
  while (start < raw.length) {
    const idx = lower.indexOf(target, start)
    if (idx < 0) {
      parts.push({ text: raw.slice(start), matched: false })
      break
    }
    if (idx > start) {
      parts.push({ text: raw.slice(start, idx), matched: false })
    }
    parts.push({ text: raw.slice(idx, idx + kw.length), matched: true })
    start = idx + kw.length
  }
  return parts.length ? parts : [{ text: raw, matched: false }]
}

const selectedLayerFilter = computed(() => {
  const groupId = selectedGroupId.value
  if (!groupId) {
    return []
  }
  const ids = new Set<string>()
  const layers = mapWork.getAllLayers()
  for (const layer of layers) {
    if (mapWork.isLayerUnderGroup(layer, groupId)) {
      ids.add(String(layer?.id))
    }
  }
  return Array.from(ids)
})

const canOpenSaveDialog = computed(() => !!selectedGroupId.value && selectedLayerFilter.value.length > 0)
const canSyncNow = computed(() => {
  const dsId = String(currentDataset.value?.datasetId || "")
  return !!dsId && !!selectedGroupId.value && selectedLayerFilter.value.length > 0 && !syncingNow.value
})

function openFileImport() {
  if (!ensureUnlocked("导入文件")) {
    return
  }
  if (!selectedGroupId.value) {
    const dsId = String(currentDataset.value?.datasetId || "local")
    const openedAt = Date.now()
    const groupId = buildScopedGroupId("eoapi", dsId, openedAt)
    mapWork.ensureGroupLayer(groupId, "本次导入")
    refreshSessions()
    selectSession(groupId)
  }
  fileImportOpen.value = true
}

async function handleFileImported(payload: { file: File; geojson: any; artifact?: any }) {
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    return
  }
  const file = payload.file
  const baseName = String(file?.name || "import")
  const datasetId = String(currentDataset.value?.datasetId || "local")
  const openedAt = Date.now()
  const desiredId = buildScopedLayerId("import", datasetId, openedAt, baseName)
  const id = ensureUniqueMapLayerId(map, desiredId)
  const layer = mapWork.addGeoJsonLayer(id, payload.geojson, { name: baseName, pid: groupId })
  if (!layer) {
    $message("导入失败：创建图层失败")
    return
  }
  try {
    mapWork.flyToLayer(id)
    await mapWork.flashLayer(id, { times: 3, intervalMs: 500 })
  } catch {
  }
  try {
    const dsId = String(currentDataset.value?.datasetId || "local")
    const manifest = serializeWorkspace(map, { includeViewState: true, includeLayers: true, includeDrawFeatures: true, layerFilter: selectedLayerFilter.value })
    mapWork.persistSession({
      datasetId: dsId,
      groupId,
      openedAt: Date.now(),
      source: "unknown",
      groupName: typeof mapWork.getLayerById(groupId)?.name === "string" ? mapWork.getLayerById(groupId)!.name : undefined,
      layerIdPrefix: "",
      manifest
    } as any)
  } catch {
  }
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
}

function batchShowAllLayers() {
  if (!ensureUnlocked("批量显示")) {
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    return
  }
  const ids: Array<string | number> = []
  for (const layer of mapWork.getAllLayers()) {
    if (!layer) {
      continue
    }
    if (String(layer?.id) === String(groupId)) {
      continue
    }
    if (String(layer?.type) === "group") {
      continue
    }
    if (mapWork.isLayerUnderGroup(layer, groupId)) {
      ids.push(layer.id)
    }
  }
  mapWork.batchSetLayerShow(ids, true)
  refreshTree()
}

function batchHideAllLayers() {
  if (!ensureUnlocked("批量隐藏")) {
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    return
  }
  const ids: Array<string | number> = []
  for (const layer of mapWork.getAllLayers()) {
    if (!layer) {
      continue
    }
    if (String(layer?.id) === String(groupId)) {
      continue
    }
    if (String(layer?.type) === "group") {
      continue
    }
    if (mapWork.isLayerUnderGroup(layer, groupId)) {
      ids.push(layer.id)
    }
  }
  mapWork.batchSetLayerShow(ids, false)
  refreshTree()
}

async function syncCurrentSession() {
  if (!ensureUnlocked("一键同步")) {
    return
  }
  const dsId = String(currentDataset.value?.datasetId || "")
  const groupId = selectedGroupId.value
  if (!dsId || !groupId) {
    return
  }
  if (!canSyncNow.value) {
    return
  }
  if (!window.confirm("确认将当前目录内容同步为数据集新版本？")) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  syncingNow.value = true
  try {
    const manifest = serializeWorkspace(map, { includeViewState: true, includeLayers: true, includeDrawFeatures: true, layerFilter: selectedLayerFilter.value })
    const res = await saveDatasetRevision(dsId, { message: `同步 ${formatDateTime(Date.now())}`, manifest })
    if (!res.success) {
      $message(res.message || "同步失败")
      return
    }
    mapWork.persistSession({
      datasetId: dsId,
      groupId,
      openedAt: Date.now(),
      source: "repository",
      groupName: typeof mapWork.getLayerById(groupId)?.name === "string" ? mapWork.getLayerById(groupId)!.name : undefined,
      layerIdPrefix: "",
      manifest
    } as any)
    $message("同步成功：已生成新版本")
  } finally {
    syncingNow.value = false
  }
}

function openSaveDialog(mode: "save" | "publish") {
  if (!canOpenSaveDialog.value) {
    return
  }
  saveDialogMode.value = mode
  saveDialogOpen.value = true
}

async function toggleTaskLock() {
  const datasetId = String(currentDataset.value?.datasetId || "")
  const directoryId = String(selectedGroupId.value || "")
  if (datasetId && directoryId && superAdminUser.value) {
    const nextLocked = !(selectedDirectoryLock.value?.locked === true)
    const res = await upsertDirectoryLock(directoryId, {
      datasetId,
      directoryType: "task",
      locked: nextLocked,
      reason: nextLocked ? "任务目录已锁定" : "任务目录已解锁"
    })
    if (!res.success) {
      $message(res.message || "目录锁定状态更新失败")
      return
    }
    await loadDirectoryLocks()
    setCurrentTaskLock({ locked: false })
    $message(nextLocked ? "已锁定当前目录" : "已解锁当前目录")
    return
  }
  if (selectedDirectoryLock.value?.locked && !superAdminUser.value) {
    $message(String(selectedDirectoryLock.value.reason || "目录已锁定"))
    return
  }
  if (taskLock.value.locked) {
    setCurrentTaskLock({ locked: false })
    return
  }
  setCurrentTaskLock({ locked: true, reason: "本地锁定" })
}

async function handleReadonlyChange(checked: boolean) {
  if (checked === taskLocked.value) {
    return
  }
  await toggleTaskLock()
}

type DirOrderState = Record<string, Record<string, string[]>>

type TaskStepSnapshot = {
  dirOrder: DirOrderState
  manifest: Manifest | null
}

const undoStack = ref<TaskStepSnapshot[]>([])
const redoStack = ref<TaskStepSnapshot[]>([])
const stepApplying = ref(false)
const canUndoStep = computed(() => undoStack.value.length > 0)
const canRedoStep = computed(() => redoStack.value.length > 0)

function captureTaskStep(): TaskStepSnapshot | null {
  const map = mapWork.getMap()
  if (!map) {
    return null
  }
  const filter = selectedLayerFilter.value
  try {
    const manifest = serializeWorkspace(map, {
      includeViewState: false,
      includeDrawFeatures: true,
      layerFilter: filter.length > 0 ? filter : undefined
    })
    return {
      dirOrder: JSON.parse(JSON.stringify(readDirOrderState())),
      manifest
    }
  } catch {
    return null
  }
}

async function applyTaskStep(snap: TaskStepSnapshot) {
  if (!snap?.manifest) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  stepApplying.value = true
  try {
    writeDirOrderState(snap.dirOrder)
    await restoreWorkspace(map, snap.manifest as any, { strategy: "overlay" })
    refreshSessions()
    refreshTree()
  } finally {
    stepApplying.value = false
  }
}

function pushUndoStep() {
  if (stepApplying.value) {
    return
  }
  const snap = captureTaskStep()
  if (!snap) {
    return
  }
  undoStack.value.push(snap)
  if (undoStack.value.length > 30) {
    undoStack.value.shift()
  }
  redoStack.value = []
}

function clearStepHistory() {
  undoStack.value = []
  redoStack.value = []
}

async function undoStep() {
  if (!canUndoStep.value || stepApplying.value) {
    return
  }
  const current = captureTaskStep()
  if (current) {
    redoStack.value.push(current)
  }
  const prev = undoStack.value.pop()
  if (prev) {
    await applyTaskStep(prev)
  }
}

async function redoStep() {
  if (!canRedoStep.value || stepApplying.value) {
    return
  }
  const current = captureTaskStep()
  if (current) {
    undoStack.value.push(current)
  }
  const next = redoStack.value.pop()
  if (next) {
    await applyTaskStep(next)
  }
}

function ensureUnlocked(operation: string): boolean {
  if (!taskLocked.value) {
    return true
  }
  const reason = taskLockReason.value || "当前任务已锁定"
  $message(`${operation}已禁用：${reason}`)
  return false
}

const sessions = ref<mapWork.DatasetSession[]>([])
const selectedGroupId = ref<string>("")
const selectedDirectoryLock = computed<DirectoryLockRecord | null>(() => {
  const key = String(selectedGroupId.value || "")
  if (!key) {
    return null
  }
  return directoryLockMap.value[key] || null
})
const taskLocked = computed(() => {
  if (selectedDirectoryLock.value?.locked && !superAdminUser.value) {
    return true
  }
  return !!taskLock.value.locked
})
const taskLockReason = computed(() => {
  if (selectedDirectoryLock.value?.locked && !superAdminUser.value) {
    return String(selectedDirectoryLock.value.reason || "目录已锁定")
  }
  return String(taskLock.value.reason || "")
})

async function loadDirectoryLocks() {
  const datasetId = String(currentDataset.value?.datasetId || "")
  if (!datasetId) {
    directoryLockMap.value = {}
    return
  }
  try {
    const res = await getDirectoryLocks(datasetId)
    const next: Record<string, DirectoryLockRecord> = {}
    ;(res.success && Array.isArray(res.data) ? res.data : []).forEach((item) => {
      next[String(item.directoryId || "")] = item
    })
    directoryLockMap.value = next
  } catch {
    directoryLockMap.value = {}
  }
}

const currentDatasetTitle = computed(() => {
  const ds = currentDataset.value
  if (!ds?.datasetId) {
    return "当前导入数据集"
  }
  return ds.name || ds.datasetId
})

let teardownMapWatch: null | (() => void) = null
let sidebarObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null
const POPOVER_LAYOUT_KEY = "ksh002_current_task_popover_layout_v1"
const DIALOG_PERSIST_KEY = "mars_dialog_persist_v1_current-task_panel"
const DIR_ORDER_KEY = "ksh002_current_task_dir_order_v1"
let anchorSaveTimer: number | null = null
let mapRefreshRafId: number | null = null
let mapPollTimer: number | null = null
let remoteSyncTimer: number | null = null
let mapPollSignature = ""

function readDirOrderState(): DirOrderState {
  try {
    const raw = localStorage.getItem(DIR_ORDER_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as DirOrderState) : {}
  } catch {
    return {}
  }
}

function writeDirOrderState(state: DirOrderState): void {
  try {
    localStorage.setItem(DIR_ORDER_KEY, JSON.stringify(state))
  } catch {
  }
}

function reorderIds(list: string[], dragId: string, dropId: string, before: boolean): string[] {
  const next = list.slice()
  const from = next.indexOf(dragId)
  if (from !== -1) {
    next.splice(from, 1)
  }
  const baseIndex = next.indexOf(dropId)
  let insertAt = next.length
  if (baseIndex !== -1) {
    insertAt = before ? baseIndex : baseIndex + 1
  }
  next.splice(Math.max(0, insertAt), 0, dragId)
  return next
}

function applyDirOrderForTree(tree: any[], sessionGroupId: string): any[] {
  const state = readDirOrderState()
  const orderMap = state[sessionGroupId] || {}

  const walk = (nodes: any[]): any[] => {
    const out = nodes.map((n) => {
      if (Array.isArray(n?.children) && n.children.length) {
        return { ...n, children: walk(n.children) }
      }
      return n
    })

    out.forEach((n: any) => {
      if (!Array.isArray(n?.children) || n.children.length === 0) {
        return
      }
      const parentId = String(n.key || "")
      const desired = Array.isArray(orderMap[parentId]) ? orderMap[parentId] : null
      if (!desired) {
        return
      }

      const groups = n.children.filter((c: any) => !!c?.group)
      const others = n.children.filter((c: any) => !c?.group)

      const idx = new Map<string, number>()
      desired.forEach((id, i) => idx.set(String(id), i))

      groups.sort((a: any, b: any) => {
        const ai = idx.has(String(a.key)) ? (idx.get(String(a.key)) as number) : Number.MAX_SAFE_INTEGER
        const bi = idx.has(String(b.key)) ? (idx.get(String(b.key)) as number) : Number.MAX_SAFE_INTEGER
        return ai - bi
      })

      n.children = [...groups, ...others]
    })

    return out
  }

  return walk(Array.isArray(tree) ? tree : [])
}

function collectGroupChildOrder(tree: any[], parentId: string): string[] {
  const pid = String(parentId || "")
  if (!pid) {
    return []
  }
  const stack: any[] = Array.isArray(tree) ? tree.slice() : []
  while (stack.length) {
    const node = stack.shift()
    if (!node) {
      continue
    }
    if (String(node.key || "") === pid) {
      const children = Array.isArray(node.children) ? node.children : []
      return children.filter((c: any) => !!c?.group).map((c: any) => String(c.key))
    }
    if (Array.isArray(node.children) && node.children.length) {
      stack.push(...node.children)
    }
  }
  return []
}

function enableGroupDrag(tree: any[]): any[] {
  const walk = (nodes: any[]): any[] => {
    return nodes.map((n) => {
      const out: any = { ...n }
      if (out?.group) {
        out.draggable = true
        out.disableDrag = false
        out.disableDrop = false
      }
      if (Array.isArray(out.children) && out.children.length) {
        out.children = walk(out.children)
      }
      return out
    })
  }
  return walk(Array.isArray(tree) ? tree : [])
}

onMounted(() => {
  prevBodyOverflow = document.body.style.overflow

  disposeDatasetWatch = onCurrentDatasetChange((ds) => {
    currentDataset.value = ds
  })

  const disposeLock = onCurrentTaskLockChange((lock) => {
    taskLock.value = lock
  })

  // 初始化全局对象（必须在 handler 赋值之前）
  ;(window as any).__mars_current_task = (window as any).__mars_current_task || {}

  const handlePersistSession = (evt: Event) => {
    const detail = (evt as CustomEvent).detail
    if (!detail) {
      return
    }
    try {
      mapWork.persistSession(detail)
    } catch {
    }
  }
  window.addEventListener("mars3d:session-persist", handlePersistSession as EventListener)
  ;(window as any).__mars_current_task.__persistSessionHandler = handlePersistSession

  // 监听地图图层变化事件，自动刷新目录（工单 3-32 实时数据同步）
  const handleLayersChanged = () => {
    if (panelVisible.value && selectedGroupId.value) {
      refreshTree()
    }
  }
  mapWork.eventTarget.on("layersChanged", handleLayersChanged)

  // 监听全局图层变化事件（来自 dataset-repository 等其他 widget 的通知）
  const handleGlobalLayersChanged = () => {
    if (panelVisible.value) {
      refreshTree()
    }
  }
  window.addEventListener("mars3d_layersChanged", handleGlobalLayersChanged as EventListener)
  ;(window as any).__mars_current_task.__globalLayersChangedHandler = handleGlobalLayersChanged

  // 监听告警确认定稿事件，自动锁定当前任务目录（工单 3-33）
  const handleAlertConfirmed = (evt: Event) => {
    const detail = (evt as CustomEvent).detail
    const alertInfo = detail?.alertInfo
    const reason = alertInfo ? `告警已定稿：${alertInfo.location || ""}` : "告警已定稿"
    const datasetId = String(currentDataset.value?.datasetId || "")
    const directoryId = String(selectedGroupId.value || "")
    if (datasetId && directoryId && superAdminUser.value) {
      upsertDirectoryLock(directoryId, {
        datasetId,
        directoryType: "alert",
        locked: true,
        reason
      }).then(() => loadDirectoryLocks()).catch(() => {})
    } else {
      setCurrentTaskLock({ locked: true, reason })
    }
    $message(`任务目录已锁定：${reason}`)
  }
  window.addEventListener("mars3d_alertConfirmed", handleAlertConfirmed as EventListener)
  ;(window as any).__mars_current_task.__alertConfirmedHandler = handleAlertConfirmed

  const disposeDatasetSync = onDatasetSync((detail) => {
    if (!panelVisible.value) {
      return
    }
    const currentDatasetId = String(currentDataset.value?.datasetId || "")
    if (detail.datasetId && currentDatasetId && detail.datasetId !== currentDatasetId) {
      return
    }
    refreshSessions()
    refreshTree()
    if (detail.reason === "lock" || detail.reason === "refresh") {
      loadDirectoryLocks()
    }
    if (isSectionActive("artifacts") || detail.reason === "artifact") {
      loadArtifacts()
    }
    if (isSectionActive("versions") || detail.reason === "revision" || detail.reason === "saved") {
      loadRevisions()
    }
    if (isSectionActive("thematics")) {
      loadThematicsCount()
      loadThematicsJobs()
    } else {
      loadThematicsCount()
    }
    if (["refresh", "revision", "import"].includes(detail.reason)) {
      scheduleDatasetLayerRefresh(detail)
    }
  })

  ;(window as any).__mars_current_task.setLock = (locked: boolean, reason?: string) => {
    setCurrentTaskLock({ locked: !!locked, reason })
  }
  ;(window as any).__mars_current_task.getLock = () => getCurrentTaskLock()
  ;(window as any).__mars_current_task.clearLock = () => clearCurrentTaskLock()
  ;(window as any).__mars_current_task.__disposeLock = disposeLock
  ;(window as any).__mars_current_task.__disposeDatasetSync = disposeDatasetSync
  ;(window as any).__mars_current_task.__layersChangedHandler = handleLayersChanged
})

onUnmounted(() => {
  setWidgetProtected("current-task", false)
  disconnectDatasetSync(currentDataset.value?.datasetId)
  clearSessionRefreshTimers()
  // 移除图层变化事件监听（工单 3-32）
  const w: any = window as any
  if (w.__mars_current_task?.__layersChangedHandler) {
    try {
      mapWork.eventTarget.off("layersChanged", w.__mars_current_task.__layersChangedHandler)
    } catch {}
  }
  window.removeEventListener("mars3d_layersChanged", (w.__mars_current_task?.__globalLayersChangedHandler || (() => {})) as EventListener)
  window.removeEventListener("mars3d_alertConfirmed", (w.__mars_current_task?.__alertConfirmedHandler || (() => {})) as EventListener)
  window.removeEventListener("mars3d:session-persist", (w.__mars_current_task?.__persistSessionHandler || (() => {})) as EventListener)

  disposeDatasetWatch?.()
  disposeDatasetWatch = null
  if (w.__mars_current_task?.__disposeLock) {
    try {
      w.__mars_current_task.__disposeLock()
    } catch {
    }
  }
  if (w.__mars_current_task?.__disposeDatasetSync) {
    try {
      w.__mars_current_task.__disposeDatasetSync()
    } catch {
    }
  }
  teardownMapWatch?.()
  teardownMapWatch = null
  sidebarObserver?.disconnect?.()
  sidebarObserver = null
  themeObserver?.disconnect?.()
  themeObserver = null
  if (mapRefreshRafId !== null) {
    window.cancelAnimationFrame(mapRefreshRafId)
    mapRefreshRafId = null
  }
  if (mapPollTimer !== null) {
    window.clearInterval(mapPollTimer)
    mapPollTimer = null
  }
  document.body.style.overflow = prevBodyOverflow
})

const popoverRef = ref<HTMLElement | null>(null)
const sidebarRect = ref<DOMRect | null>(null)
const achievementTop = ref<number | null>(null)
const popoverThemeVars = ref<Record<string, string>>({})

type PopoverLayout = {
  top: number
  left: number
  width: number
  height: number
}

const manualLayout = ref<PopoverLayout | null>(null)
const manualLayoutEnabled = computed(() => manualLayout.value !== null)

function readSavedLayout(): PopoverLayout | null {
  try {
    const raw = localStorage.getItem(POPOVER_LAYOUT_KEY)
    if (!raw) {
      return null
    }
    const v = JSON.parse(raw) as Partial<PopoverLayout>
    if (
      typeof v.top !== "number" ||
      typeof v.left !== "number" ||
      typeof v.width !== "number" ||
      typeof v.height !== "number"
    ) {
      return null
    }
    return { top: v.top, left: v.left, width: v.width, height: v.height }
  } catch {
    return null
  }
}

function saveLayout(layout: PopoverLayout | null) {
  if (!layout) {
    localStorage.removeItem(POPOVER_LAYOUT_KEY)
    return
  }
  localStorage.setItem(POPOVER_LAYOUT_KEY, JSON.stringify(layout))
}

function scheduleSaveLayout() {
  if (!manualLayout.value) {
    return
  }
  if (anchorSaveTimer !== null) {
    window.clearTimeout(anchorSaveTimer)
  }
  anchorSaveTimer = window.setTimeout(() => {
    anchorSaveTimer = null
    if (manualLayout.value) {
      saveLayout(manualLayout.value)
    }
  }, 200)
}

function clampLayout(layout: PopoverLayout): PopoverLayout {
  const minWidth = 320
  const minHeight = 240
  const maxWidth = Math.max(minWidth, window.innerWidth - 12)
  const maxHeight = Math.max(minHeight, window.innerHeight - 12)
  const width = Math.min(maxWidth, Math.max(minWidth, Math.round(layout.width)))
  const height = Math.min(maxHeight, Math.max(minHeight, Math.round(layout.height)))
  const left = Math.min(window.innerWidth - 6 - width, Math.max(6, Math.round(layout.left)))
  const top = Math.min(window.innerHeight - 6 - height, Math.max(6, Math.round(layout.top)))
  return { top, left, width, height }
}

function snapLayout(layout: PopoverLayout): PopoverLayout {
  return clampLayout(layout)
}

function updateSidebarRect() {
  const el = document.querySelector(".sidebar") as HTMLElement | null
  sidebarRect.value = el?.getBoundingClientRect?.() || null
}

function updateAchievementTop() {
  const titles = Array.from(document.querySelectorAll(".sidebar .group-title")) as HTMLElement[]
  const target = titles.find((el) => (el.textContent || "").trim() === "成果管理") || null
  achievementTop.value = target?.getBoundingClientRect?.().top ?? null
}

function updateAnchorRect() {
  updateSidebarRect()
  updateAchievementTop()
  if (manualLayout.value) {
    manualLayout.value = clampLayout(manualLayout.value)
    scheduleSaveLayout()
  }
}

function installSidebarObserver() {
  if (sidebarObserver) {
    return
  }
  const el = document.querySelector(".sidebar") as HTMLElement | null
  if (el && typeof ResizeObserver !== "undefined") {
    sidebarObserver = new ResizeObserver(() => {
      updateAnchorRect()
    })
    sidebarObserver.observe(el)
  }
  window.addEventListener("resize", updateAnchorRect)
}

function uninstallSidebarObserver() {
  window.removeEventListener("resize", updateAnchorRect)
  sidebarObserver?.disconnect?.()
  sidebarObserver = null
}

function installThemeObserver() {
  if (themeObserver) {
    return
  }
  themeObserver = new MutationObserver(() => {
    nextTick(() => {
      updatePopoverTheme()
    })
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
}

function uninstallThemeObserver() {
  themeObserver?.disconnect?.()
  themeObserver = null
}

type ParsedColor = { r: number; g: number; b: number; a: number }

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function parseCssColor(input: string): ParsedColor | null {
  const s = String(input || "").trim().toLowerCase()
  const m = s.match(/^rgba?\((.+)\)$/)
  if (!m) {
    return null
  }
  const inner = String(m[1] || "").trim()
  const commaParts = inner.split(",").map((v) => v.trim()).filter(Boolean)
  const parts = commaParts.length >= 3 ? commaParts : inner.replace(/\s*\/\s*/g, " ").split(/\s+/).map((v) => v.trim()).filter(Boolean)
  if (parts.length < 3) {
    return null
  }
  const r = Number(parts[0])
  const g = Number(parts[1])
  const b = Number(parts[2])
  const a = parts.length >= 4 ? Number(parts[3]) : 1
  if (![r, g, b, a].every((n) => Number.isFinite(n))) {
    return null
  }
  return { r, g, b, a: clamp01(a) }
}

function blend(over: ParsedColor, under: ParsedColor): ParsedColor {
  const a = clamp01(over.a + under.a * (1 - over.a))
  if (a <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 }
  }
  const r = Math.round((over.r * over.a + under.r * under.a * (1 - over.a)) / a)
  const g = Math.round((over.g * over.a + under.g * under.a * (1 - over.a)) / a)
  const b = Math.round((over.b * over.a + under.b * under.a * (1 - over.a)) / a)
  return { r, g, b, a }
}

function srgbToLinear(c: number) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function luminance(c: ParsedColor) {
  const r = srgbToLinear(c.r)
  const g = srgbToLinear(c.g)
  const b = srgbToLinear(c.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: ParsedColor, b: ParsedColor) {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

function readRootCssVar(name: string) {
  const v = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  return String(v || "").trim()
}

function updatePopoverTheme() {
  const el = popoverRef.value
  if (!el) {
    return
  }
  const bgStr = window.getComputedStyle(el).backgroundColor
  const bodyBgStr = window.getComputedStyle(document.body).backgroundColor
  const bg = parseCssColor(bgStr) || { r: 255, g: 255, b: 255, a: 1 }
  const bodyBg = parseCssColor(bodyBgStr) || { r: 255, g: 255, b: 255, a: 1 }
  const effectiveBg = bg.a < 1 ? blend(bg, bodyBg) : bg

  const candidateA = parseCssColor(readRootCssVar("--text-primary"))
  const candidateB = parseCssColor(readRootCssVar("--text-invert"))
  const fallback = parseCssColor(readRootCssVar("--mars-text-color"))
  const c1 = candidateA || fallback || { r: 23, g: 35, b: 61, a: 1 }
  const c2 = candidateB || fallback || { r: 255, g: 255, b: 255, a: 1 }

  const r1 = contrastRatio(c1, effectiveBg)
  const r2 = contrastRatio(c2, effectiveBg)
  const pick = r1 >= r2 ? c1 : c2
  popoverThemeVars.value = {
    "--task-popover-fg": `rgb(${pick.r} ${pick.g} ${pick.b})`
  }
}

// 固定初始宽度，确保「图层/专题图/附件/版本」标签完整可见；勿用 computed 绑定宽度以免重渲染覆盖用户缩放
const PANEL_INITIAL_WIDTH = 420
const PANEL_MIN_WIDTH = 420
const PANEL_MIN_HEIGHT = 420

// mars-dialog 定位参照 #mars-main-view（地图区域），贴左且与地图同高
const dialogPosition = { top: 0, left: 0, bottom: 0 }

function isAnyDropdownOpen(): boolean {
  const list = Array.from(document.querySelectorAll(".ant-dropdown")) as HTMLElement[]
  for (const el of list) {
    const style = window.getComputedStyle(el)
    if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
      return true
    }
  }
  return false
}

const isDragging = ref(false)
const isMovingOrResizing = ref(false)

function onDragStart() {
  isDragging.value = true
}

function onDragEnd() {
  isDragging.value = false
}

function closePopover() {
  emit("update:visible", false)
}

function onBackdropClick() {
  if (isDragging.value) {
    return
  }
  if (isMovingOrResizing.value) {
    return
  }
  if (isAnyDropdownOpen()) {
    return
  }
  if (createGroupDialogOpen.value || renameDialogOpen.value || moveDialogOpen.value || deleteDialogOpen.value || clearDialogOpen.value || artifactPreviewOpen.value || manifestViewOpen.value || forkDialogOpen.value) {
    return
  }
  closePopover()
}

function handleEsc() {
  if (isAnyDropdownOpen()) {
    return
  }
  if (isMovingOrResizing.value) {
    return
  }
  if (createGroupDialogOpen.value || renameDialogOpen.value || moveDialogOpen.value || deleteDialogOpen.value || clearDialogOpen.value || artifactPreviewOpen.value || manifestViewOpen.value || forkDialogOpen.value) {
    return
  }
  closePopover()
}

function isInteractiveInHeader(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) {
    return false
  }
  return Boolean(el.closest("button,a,.ant-btn,.ant-dropdown,input,textarea,select"))
}

function setManualLayout(next: PopoverLayout | null) {
  manualLayout.value = next ? clampLayout(next) : null
  saveLayout(manualLayout.value)
}

function resetLayout() {
  localStorage.removeItem(POPOVER_LAYOUT_KEY)
  localStorage.removeItem(DIALOG_PERSIST_KEY)
  manualLayout.value = null
  clearStepHistory()
  updateAnchorRect()
}

type PointerSession = {
  pointerId: number
  startX: number
  startY: number
  startTop: number
  startLeft: number
  startWidth: number
  startHeight: number
}

const moveSession = ref<PointerSession | null>(null)
const resizeSession = ref<PointerSession | null>(null)
let moveRafId: number | null = null
let resizeRafId: number | null = null
let pendingMoveLayout: PopoverLayout | null = null
let pendingResizeLayout: PopoverLayout | null = null

function onMoveStart(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  if (isInteractiveInHeader(e.target)) {
    return
  }
  const el = popoverRef.value
  if (!el) {
    return
  }
  const box = el.getBoundingClientRect()
  const current = manualLayout.value ? clampLayout(manualLayout.value) : clampLayout({ top: box.top, left: box.left, width: box.width, height: box.height })
  setManualLayout(current)
  isMovingOrResizing.value = true
  moveSession.value = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startTop: current.top,
    startLeft: current.left,
    startWidth: current.width,
    startHeight: current.height
  }
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
  }
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onMoveEnd, { once: true })
}

function onMove(e: PointerEvent) {
  const s = moveSession.value
  if (!s || e.pointerId !== s.pointerId) {
    return
  }
  pendingMoveLayout = clampLayout({
    top: s.startTop + (e.clientY - s.startY),
    left: s.startLeft + (e.clientX - s.startX),
    width: s.startWidth,
    height: s.startHeight
  })
  if (moveRafId !== null) {
    return
  }
  moveRafId = window.requestAnimationFrame(() => {
    moveRafId = null
    if (pendingMoveLayout) {
      manualLayout.value = pendingMoveLayout
      pendingMoveLayout = null
    }
  })
}

function onMoveEnd(e: PointerEvent) {
  const s = moveSession.value
  if (!s || e.pointerId !== s.pointerId) {
    return
  }
  window.removeEventListener("pointermove", onMove)
  moveSession.value = null
  isMovingOrResizing.value = false
  if (moveRafId !== null) {
    window.cancelAnimationFrame(moveRafId)
    moveRafId = null
  }
  if (pendingMoveLayout) {
    manualLayout.value = pendingMoveLayout
    pendingMoveLayout = null
  }
  if (manualLayout.value) {
    manualLayout.value = snapLayout(manualLayout.value)
    setManualLayout(manualLayout.value)
  }
}

function onResizeStart(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  const el = popoverRef.value
  if (!el) {
    return
  }
  e.preventDefault()
  const box = el.getBoundingClientRect()
  const current = manualLayout.value ? clampLayout(manualLayout.value) : clampLayout({ top: box.top, left: box.left, width: box.width, height: box.height })
  setManualLayout(current)
  isMovingOrResizing.value = true
  resizeSession.value = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startTop: current.top,
    startLeft: current.left,
    startWidth: current.width,
    startHeight: current.height
  }
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
  }
  window.addEventListener("pointermove", onResize)
  window.addEventListener("pointerup", onResizeEnd, { once: true })
}

function onResize(e: PointerEvent) {
  const s = resizeSession.value
  if (!s || e.pointerId !== s.pointerId) {
    return
  }
  pendingResizeLayout = clampLayout({
    top: s.startTop,
    left: s.startLeft,
    width: s.startWidth + (e.clientX - s.startX),
    height: s.startHeight + (e.clientY - s.startY)
  })
  if (resizeRafId !== null) {
    return
  }
  resizeRafId = window.requestAnimationFrame(() => {
    resizeRafId = null
    if (pendingResizeLayout) {
      manualLayout.value = pendingResizeLayout
      pendingResizeLayout = null
    }
  })
}

function onResizeEnd(e: PointerEvent) {
  const s = resizeSession.value
  if (!s || e.pointerId !== s.pointerId) {
    return
  }
  window.removeEventListener("pointermove", onResize)
  resizeSession.value = null
  isMovingOrResizing.value = false
  if (resizeRafId !== null) {
    window.cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
  if (pendingResizeLayout) {
    manualLayout.value = pendingResizeLayout
    pendingResizeLayout = null
  }
  if (manualLayout.value) {
    manualLayout.value = snapLayout(manualLayout.value)
    setManualLayout(manualLayout.value)
  }
}

const rootOpen = ref(true)

type TaskSection = "layers" | "thematics" | "artifacts" | "versions"
const activeSection = ref<TaskSection>("layers")

const sectionTabs = computed(() => [
  { key: "layers" as TaskSection, label: "图层", count: layerCountText.value },
  { key: "thematics" as TaskSection, label: "专题图", count: thematicsCountText.value },
  { key: "artifacts" as TaskSection, label: "附件", count: artifactsCountText.value },
  { key: "versions" as TaskSection, label: "版本", count: null as string | null }
])

function toggleRoot() {
  rootOpen.value = !rootOpen.value
}

function switchSection(key: TaskSection) {
  if (activeSection.value === key) {
    return
  }
  activeSection.value = key
  if (key === "thematics") {
    loadThematicsCount()
    loadThematicsJobs()
  } else if (key === "artifacts") {
    loadArtifacts()
  } else if (key === "versions") {
    loadRevisions()
  }
}

function isSectionActive(key: TaskSection) {
  return activeSection.value === key
}

function refreshSessions() {
  const id = currentDataset.value?.datasetId || ""
  const next = mapWork.listDatasetSessions(id)
  sessions.value = next
  if (!selectedGroupId.value || !next.find((x) => x.groupId === selectedGroupId.value)) {
    selectedGroupId.value = next[0]?.groupId || ""
  }
}

function clearSessionRefreshTimers() {
  if (sessionRefreshTimer !== null) {
    window.clearTimeout(sessionRefreshTimer)
    sessionRefreshTimer = null
  }
  if (sessionRefreshMessageTimer !== null) {
    window.clearTimeout(sessionRefreshMessageTimer)
    sessionRefreshMessageTimer = null
  }
}

function setSessionRefreshMessage(message = "", loading = false, autoClearMs = 0) {
  sessionRefreshLoading.value = loading
  sessionRefreshText.value = message
  if (sessionRefreshMessageTimer !== null) {
    window.clearTimeout(sessionRefreshMessageTimer)
    sessionRefreshMessageTimer = null
  }
  if (!loading && autoClearMs > 0 && message) {
    sessionRefreshMessageTimer = window.setTimeout(() => {
      sessionRefreshMessageTimer = null
      sessionRefreshText.value = ""
    }, autoClearMs)
  }
}

function getSessionLayerPrefix(openedAt: number, layerIdPrefix?: string): string {
  if (layerIdPrefix !== null && layerIdPrefix !== undefined) {
    return String(layerIdPrefix)
  }
  const datasetId = String(currentDataset.value?.datasetId || "")
  if (!datasetId) {
    return ""
  }
  return buildScopedLayerPrefix("eoapi", datasetId, openedAt)
}

function getSessionManifestLayers(manifest?: Manifest | null): any[] {
  return Array.isArray(manifest?.layers) ? manifest.layers : []
}

function buildIncrementalManifest(manifest: Manifest, impactedIds: Set<string>): Manifest {
  const layers = getSessionManifestLayers(manifest)
  if (!layers.length || impactedIds.size === 0) {
    return { ...manifest, layers: [] }
  }
  const layerMap = new Map<string, any>()
  layers.forEach((layer: any) => {
    const id = String(layer?.id || "")
    if (id) {
      layerMap.set(id, layer)
    }
  })
  const keepIds = new Set<string>()
  const includeWithAncestors = (startId: string) => {
    let cursor = startId
    for (let i = 0; i < 30 && cursor; i++) {
      if (keepIds.has(cursor)) {
        return
      }
      keepIds.add(cursor)
      const layer = layerMap.get(cursor)
      const pid = String(layer?.pid ?? "")
      if (!pid || !layerMap.has(pid)) {
        return
      }
      cursor = pid
    }
  }
  impactedIds.forEach((id) => includeWithAncestors(String(id)))
  return {
    ...manifest,
    layers: layers.filter((layer: any) => keepIds.has(String(layer?.id || "")))
  }
}

function collectImpactedLayerIds(diff: ReturnType<typeof diffManifests>): Set<string> {
  const impacted = new Set<string>()
  diff.added.forEach((item: any) => impacted.add(String(item?.id || "")))
  diff.removed.forEach((item: any) => impacted.add(String(item?.id || "")))
  diff.changed.forEach((item: any) => impacted.add(String(item?.id || "")))
  diff.moved.forEach((item: any) => impacted.add(String(item?.id || "")))
  impacted.delete("")
  return impacted
}

function removeImpactedSessionLayers(params: {
  previousManifest?: Manifest | null
  latestManifest: Manifest
  impactedIds: Set<string>
  layerIdPrefix: string
}) {
  const previousLayerMap = new Map<string, any>()
  getSessionManifestLayers(params.previousManifest).forEach((layer: any) => {
    const id = String(layer?.id || "")
    if (id) {
      previousLayerMap.set(id, layer)
    }
  })
  const latestLayerMap = new Map<string, any>()
  getSessionManifestLayers(params.latestManifest).forEach((layer: any) => {
    const id = String(layer?.id || "")
    if (id) {
      latestLayerMap.set(id, layer)
    }
  })
  Array.from(params.impactedIds).forEach((baseId) => {
    const actualId = `${params.layerIdPrefix}${baseId}`
    const targetLayer = previousLayerMap.get(baseId) || latestLayerMap.get(baseId)
    if (String(targetLayer?.sourceType || "") === "group") {
      mapWork.removeGroupTree(actualId)
      return
    }
    mapWork.removeLayerById(actualId)
  })
}

async function applyDatasetLayerRefresh(detail?: DatasetSyncDetail) {
  const datasetId = String(currentDataset.value?.datasetId || "")
  if (!datasetId) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  const allSessions = mapWork.listDatasetSessions(datasetId)
  if (!allSessions.length) {
    return
  }
  setSessionRefreshMessage("检测到数据集更新，正在增量刷新关联图层...", true)
  try {
    const latestRes = await getLatestDatasetManifest(datasetId)
    if (!latestRes.success || !latestRes.data?.manifest) {
      throw new Error(latestRes.message || "获取最新成果包失败")
    }
    const latestManifest = latestRes.data.manifest as Manifest
    let refreshedSessions = 0
    let impactedLayerCount = 0
    for (const session of allSessions) {
      const persisted = mapWork.getPersistedSession(session.groupId)
      if (!persisted?.manifest) {
        continue
      }
      const diff = diffManifests(persisted.manifest, latestManifest)
      const impactedIds = collectImpactedLayerIds(diff)
      if (impactedIds.size === 0) {
        continue
      }
      const layerIdPrefix = getSessionLayerPrefix(session.openedAt, persisted.layerIdPrefix)
      const currentGroup = mapWork.getLayerById(session.groupId)
      const groupName = typeof currentGroup?.name === "string"
        ? String(currentGroup.name || "")
        : (persisted.groupName || session.groupName || "本次导入")
      setSessionRefreshMessage(`正在刷新 ${groupName}（${impactedIds.size} 个变更图层）...`, true)
      mapWork.ensureGroupLayer(session.groupId, groupName)
      removeImpactedSessionLayers({
        previousManifest: persisted.manifest,
        latestManifest,
        impactedIds,
        layerIdPrefix
      })
      const partialManifest = buildIncrementalManifest(latestManifest, impactedIds)
      if (getSessionManifestLayers(partialManifest).length > 0) {
        await restoreWorkspace(map, partialManifest, {
          strategy: "overlay",
          conflictResolution: "replace",
          restoreView: false,
          restoreLayers: true,
          restoreDrawFeatures: true,
          flyDuration: 0,
          layerIdPrefix,
          layerParentId: session.groupId,
          drawIdPrefix: layerIdPrefix,
          clearExistingDrawFeatures: false
        })
      }
      mapWork.persistSession({
        datasetId,
        groupId: session.groupId,
        openedAt: session.openedAt,
        source: session.source,
        groupName,
        layerIdPrefix,
        manifest: latestManifest
      } as any)
      refreshedSessions += 1
      impactedLayerCount += impactedIds.size
    }
    refreshSessions()
    refreshTree()
    if (refreshedSessions > 0) {
      setSessionRefreshMessage(`已完成增量刷新：${refreshedSessions} 个目录，${impactedLayerCount} 个图层已同步`, false, 4000)
      window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
      return
    }
    setSessionRefreshMessage(detail?.reason === "refresh" ? "已检查最新版本，当前图层无需刷新" : "", false, 2500)
  } catch (error: any) {
    const message = error?.message || "关联图层刷新失败"
    setSessionRefreshMessage(message, false, 5000)
    $message(message)
  }
}

function scheduleDatasetLayerRefresh(detail: DatasetSyncDetail) {
  const datasetId = String(currentDataset.value?.datasetId || "")
  if (!datasetId) {
    return
  }
  if (detail.datasetId && detail.datasetId !== datasetId) {
    return
  }
  pendingSessionSyncDetail = detail
  if (sessionRefreshTimer !== null) {
    window.clearTimeout(sessionRefreshTimer)
  }
  sessionRefreshTimer = window.setTimeout(() => {
    sessionRefreshTimer = null
    const nextDetail = pendingSessionSyncDetail
    pendingSessionSyncDetail = null
    if (!nextDetail) {
      return
    }
    applyDatasetLayerRefresh(nextDetail).catch(() => {})
  }, 800)
}

function selectSession(groupId: string) {
  selectedGroupId.value = groupId
  refreshTree()
}

function formatDateTime(v: number) {
  const d = new Date(v)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${yy}-${mm}-${dd} ${hh}:${mi}`
}

function sessionIcon(s: mapWork.DatasetSession) {
  if (s.source === "repository") {
    return "link"
  }
  if (s.source === "my-repository") {
    return "people"
  }
  return "warning"
}

const recentImports = computed(() => {
  const dsName = currentDataset.value?.name || currentDataset.value?.datasetId || "当前数据集"
  return sessions.value.slice(0, 5).map((s) => {
    const name = s.groupName || dsName
    return {
      groupId: s.groupId,
      name,
      time: formatDateTime(s.openedAt),
      icon: sessionIcon(s)
    }
  })
})

const fullTree = ref<any[]>([])
const treeData = ref<any[]>([])
const displayTreeData = computed(() => {
  const kw = String(layerSearch.value || "").trim()
  if (!kw) {
    return treeData.value
  }
  return filterTreeByKeyword(fullTree.value, kw).tree
})
const expandedKeys = ref<string[]>([])
const checkedKeys = ref<string[]>([])
const selectedKeys = ref<string[]>([])
const opacityValue = ref<Record<string, number>>({})
const defaultExpandedKeys = ref<string[]>([])
const prevExpandedKeys = ref<string[] | null>(null)
const layerCount = ref(0)

function normalizeTags(input: any): string[] {
  const raw = input
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean)
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

function filterTreeByKeyword(nodes: any[], keyword: string): { tree: any[]; expandKeys: string[] } {
  const kw = String(keyword || "").trim().toLowerCase()
  const expand = new Set<string>()
  const walk = (arr: any[], parentKeys: string[]): any[] => {
    const out: any[] = []
    for (const n of arr) {
      if (!n) {
        continue
      }
      const title = String(n.title || "")
      const tags = normalizeTags((n as any)._tags)
      const hay = `${title} ${tags.join(" ")}`.toLowerCase()
      const matched = kw ? hay.includes(kw) : true
      const children = Array.isArray(n.children) ? n.children : []
      const nextChildren = walk(children, [...parentKeys, String(n.key)])
      if (matched || nextChildren.length) {
        out.push({ ...n, children: nextChildren })
        parentKeys.forEach((k) => expand.add(String(k)))
        if (nextChildren.length || (n as any).group) {
          expand.add(String(n.key))
        }
      }
    }
    return out
  }
  const tree = walk(Array.isArray(nodes) ? nodes : [], [])
  return { tree, expandKeys: Array.from(expand) }
}

function refreshTree() {
  const groupId = selectedGroupId.value
  if (!groupId) {
    fullTree.value = []
    treeData.value = []
    expandedKeys.value = []
    checkedKeys.value = []
    selectedKeys.value = []
    defaultExpandedKeys.value = []
    prevExpandedKeys.value = null
    opacityValue.value = {}
    layerCount.value = 0
    return
  }

  const showIds: string[] = []
  const openIds: string[] = []
  const opacityMap: Record<string, number> = {}
  let count = 0

  const result = mapWork.getLayrsTree({
    basemaps: false,
    filter: function (layer: any) {
      if (!layer?.name) {
        return false
      }
      return mapWork.isLayerUnderGroup(layer, groupId)
    },
    forEach: function (item: any, layer: any) {
      item.key = String(item.id)
      item.title = item.name || `未命名(${layer?.type || "layer"})`
      item.hasZIndex = !!layer?.hasZIndex
      item.hasOpacity = !!layer?.hasOpacity
      item._tags = normalizeTags(layer?.tags ?? layer?.options?.tags ?? layer?.attr?.tags)
      if (!item.group) {
        count += 1
      }

      opacityMap[String(item.id)] = layer?.opacity ?? 1
      if (item.show) {
        showIds.push(String(item.id))
      }
      if (item.group && item.open !== false) {
        openIds.push(String(item.id))
      }
    }
  })

  const tree = Array.isArray(result?.tree) ? result.tree : []
  const orderedTree = enableGroupDrag(applyDirOrderForTree(tree, groupId))
  fullTree.value = orderedTree
  treeData.value = orderedTree
  opacityValue.value = opacityMap
  layerCount.value = count

  checkedKeys.value = showIds
  expandedKeys.value = openIds
  defaultExpandedKeys.value = openIds

  nextTick(() => {
    if (!expandedKeys.value.includes(String(groupId))) {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, String(groupId)]))
      defaultExpandedKeys.value = Array.from(new Set([...defaultExpandedKeys.value, String(groupId)]))
    }
  })
}

watch(
  () => layerSearch.value,
  (kw) => {
    const keyword = String(kw || "").trim()
    if (!keyword) {
      return
    }
    const r = filterTreeByKeyword(fullTree.value, keyword)
    const next = new Set(expandedKeys.value.map(String))
    r.expandKeys.forEach((k) => next.add(String(k)))
    if (selectedGroupId.value) {
      next.add(String(selectedGroupId.value))
    }
    expandedKeys.value = Array.from(next)
  }
)

let isProcessingCheckChange = false
function checkedChange(keys: string[], e: any) {
  if (!ensureUnlocked("修改图层")) {
    refreshTree()
    return
  }
  if (isProcessingCheckChange) {
    return
  }
  try {
    isProcessingCheckChange = true
    processCheckedChange(keys, e)
  } finally {
    isProcessingCheckChange = false
  }
}

function processCheckedChange(keys: string[], e: any) {
  const key = String(e.node?.key || "")
  const isChecked = keys.indexOf(key) !== -1

  // 处理当前节点对应的图层
  const layer = mapWork.getLayerById(key)
  if (layer) {
    mapWork.updateLayerShowOnly(layer, isChecked)
  }

  // 如果是 group 节点，递归设置地图上所有子图层的显隐
  const isGroup = e.node?.group || (layer && String(layer.type) === "group")
  if (isGroup) {
    const allLayers = mapWork.getAllLayers()
    for (const child of allLayers) {
      if (mapWork.isLayerUnderGroup(child, key)) {
        mapWork.updateLayerShowOnly(child, isChecked)
      }
    }
  }

  // 同时递归处理树节点的子节点
  if (e.node.children && e.node.children.length) {
    e.node.children.forEach((child: any) => {
      const childLayer = mapWork.getLayerById(child.key)
      if (childLayer) {
        mapWork.updateLayerShowOnly(childLayer, isChecked)
      }
      // 子节点如果是 group 也递归其地图子图层
      if (child.group) {
        const allLayers = mapWork.getAllLayers()
        for (const sub of allLayers) {
          if (mapWork.isLayerUnderGroup(sub, String(child.key))) {
            mapWork.updateLayerShowOnly(sub, isChecked)
          }
        }
      }
      if (child.children && child.children.length) {
        processCheckedChange(keys, { node: child, checked: isChecked })
      }
    })
  }
}

function handleSelect(keys: any, e: any) {
  try {
    if (Array.isArray(keys)) {
      selectedKeys.value = keys.map(String)
    }
  } catch {
  }
  if (e?.node?.key) {
    const id = String(e.node.key)
    if (opacityValue.value[id] === undefined) {
      opacityValue.value[id] = 1
    }
  }
}

function focusNode(node: any) {
  if (!node?.key) {
    return
  }
  if (node.group) {
    const id = String(node.key)
    const cur = new Set(expandedKeys.value.map(String))
    if (cur.has(id)) {
      cur.delete(id)
    } else {
      cur.add(id)
    }
    expandedKeys.value = Array.from(cur)
    return
  }
  mapWork.flyToLayer(node.key)
  mapWork.flashLayer(node.key, { times: 3, intervalMs: 500 })
}

function toggleNodeShow(node: any) {
  if (!ensureUnlocked("修改图层")) {
    return
  }
  const layer = mapWork.getLayerById(node?.key)
  if (!layer) {
    return
  }
  mapWork.updateLayerShowOnly(layer, !layer.show)
  refreshTree()
}

function moveNode(node: any, action: "up" | "down") {
  if (!ensureUnlocked("修改图层")) {
    return
  }
  if (!node?.key) {
    return
  }
  mapWork.moveLayerZIndex(node.key, action)
  refreshTree()
}

function opcityChange(node: any, value: any) {
  if (!ensureUnlocked("修改图层")) {
    refreshTree()
    return
  }
  if (!node?.key) {
    return
  }
  const v = Number(value)
  if (!Number.isFinite(v)) {
    return
  }
  mapWork.setLayerOpacity(node.key, v)
}

function canRename(node: any): boolean {
  if (!node?.key) {
    return false
  }
  return true
}

function canMove(node: any): boolean {
  if (!node?.key) {
    return false
  }
  return String(node.key) !== String(selectedGroupId.value)
}

function canRemoveFromDir(node: any): boolean {
  if (!node?.key || node?.group) {
    return false
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    return false
  }
  const layer: any = mapWork.getLayerById(node.key)
  if (!layer) {
    return false
  }
  const pid = layer?.pid ?? layer?.options?.pid
  if (pid === null || pid === undefined || pid === "") {
    return false
  }
  if (String(pid) === String(groupId)) {
    return false
  }
  return mapWork.isLayerUnderGroup(layer, groupId)
}

function canDelete(node: any): boolean {
  if (!node?.key) {
    return false
  }
  return String(node.key) !== String(selectedGroupId.value)
}

function nodeIsSessionRoot(node: any): boolean {
  return String(node?.key) === String(selectedGroupId.value)
}

function canCreateGroupUnder(node: any): boolean {
  if (!selectedGroupId.value) {
    return false
  }
  if (nodeIsSessionRoot(node)) {
    return true
  }
  return !!node?.group
}

function onContextMenuClick(node: any, key: string) {
  if (!ensureUnlocked("修改图层")) {
    return
  }
  if (key === "expand-all") {
    expandAllUnder(node)
    return
  }
  if (key === "collapse-all") {
    collapseAllUnder(node)
    return
  }
  if (key === "show-only") {
    showOnlyUnder(node)
    return
  }
  if (key === "hide-others") {
    showOnlyUnder(node)
    return
  }
  if (key === "top" || key === "bottom" || key === "up" || key === "down") {
    mapWork.moveLayerZIndex(node.key, key as any)
    refreshTree()
    return
  }
  if (key === "rename") {
    openRename(node)
    return
  }
  if (key === "move") {
    openMove(node)
    return
  }
  if (key === "remove-from-dir") {
    const groupId = selectedGroupId.value
    if (!groupId) {
      return
    }
    mapWork.setLayerPid(node.key, groupId)
    refreshTree()
    return
  }
  if (key === "delete") {
    openDelete(node)
    return
  }
  if (key === "create-group") {
    openCreateGroup(node)
    return
  }
  if (key === "clear-session") {
    clearSession()
  }
}

function collectGroupKeysUnder(node: any): string[] {
  const out: string[] = []
  const walk = (n: any) => {
    if (!n) {
      return
    }
    if (n.group) {
      out.push(String(n.key))
    }
    const children = Array.isArray(n.children) ? n.children : []
    children.forEach(walk)
  }
  walk(node)
  return Array.from(new Set(out))
}

function expandAllUnder(node: any) {
  if (!node?.key) {
    return
  }
  const keys = collectGroupKeysUnder(node)
  const next = new Set(expandedKeys.value.map(String))
  keys.forEach((k) => next.add(String(k)))
  next.add(String(node.key))
  expandedKeys.value = Array.from(next)
}

function collapseAllUnder(node: any) {
  if (!node?.key) {
    return
  }
  const keys = collectGroupKeysUnder(node)
  const remove = new Set(keys.map(String))
  remove.add(String(node.key))
  expandedKeys.value = expandedKeys.value.filter((k) => !remove.has(String(k)))
}

function showOnlyUnder(node: any) {
  const groupId = selectedGroupId.value
  if (!groupId || !node?.key) {
    return
  }
  const target = String(node.key)
  const layers = mapWork.getAllLayers().filter((l) => mapWork.isLayerUnderGroup(l, groupId))
  layers.forEach((layer) => {
    const shouldShow = mapWork.isLayerUnderGroup(layer, target)
    mapWork.updateLayerShowOnly(layer, shouldShow)
  })
  refreshTree()
}

const groupOptions = computed(() => {
  const groupId = selectedGroupId.value
  if (!groupId) {
    return []
  }
  const opts: Array<{ value: string; label: string }> = []
  const seen = new Set<string>()
  const walk = (nodes: any[]) => {
    nodes.forEach((n) => {
      if (!n) {
        return
      }
      const id = String(n.key ?? n.id)
      if (n.group && !seen.has(id)) {
        seen.add(id)
        opts.push({ value: id, label: String(n.title || id) })
      }
      if (Array.isArray(n.children) && n.children.length) {
        walk(n.children)
      }
    })
  }
  walk(fullTree.value)
  if (!seen.has(String(groupId))) {
    opts.unshift({ value: String(groupId), label: "根分组" })
  } else {
    const idx = opts.findIndex((x) => x.value === String(groupId))
    if (idx > 0) {
      const root = opts.splice(idx, 1)[0]
      opts.unshift({ value: root.value, label: "根分组" })
    } else if (idx === 0) {
      opts[0] = { value: opts[0].value, label: "根分组" }
    }
  }
  return opts
})

let quickDrawLayer: any | null = null
const quickCreateOpen = ref(false)
const quickCreateGraphic = ref<any | null>(null)
const quickCreateName = ref("")
const quickCreatePid = ref<string>("")

function ensureQuickDrawLayer() {
  const map = mapWork.getMap()
  if (!map) {
    return null
  }
  if (quickDrawLayer) {
    return quickDrawLayer
  }
  try {
    quickDrawLayer = new (mars3d as any).layer.GraphicLayer({
      id: `__current_task_quick_draw_${Date.now()}`,
      name: "框选临时",
      show: true
    })
    map.addLayer(quickDrawLayer)
    return quickDrawLayer
  } catch {
    return null
  }
}

function defaultQuickCreatePid(): string {
  const groupId = selectedGroupId.value
  if (!groupId) {
    return ""
  }
  const picked = Array.isArray(selectedKeys.value) ? selectedKeys.value[0] : ""
  if (!picked) {
    return String(groupId)
  }
  const find = (nodes: any[]): any | null => {
    for (const n of nodes) {
      if (!n) {
        continue
      }
      if (String(n.key) === String(picked)) {
        return n
      }
      const hit = Array.isArray(n.children) ? find(n.children) : null
      if (hit) {
        return hit
      }
    }
    return null
  }
  const node = find(fullTree.value)
  if (node?.group) {
    return String(node.key)
  }
  return String(groupId)
}

function startQuickCreate(type: "rectangle" | "polygon") {
  if (!ensureUnlocked("框选新建")) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  const layer = ensureQuickDrawLayer()
  if (!layer) {
    $message("框选能力不可用")
    return
  }
  try {
    layer.clear?.()
  } catch {
  }
  try {
    layer.startDraw({
      type,
      style: {
        fill: true,
        color: "rgba(255,255,0,0.2)",
        outline: true,
        outlineWidth: 2,
        outlineColor: "rgba(255,255,0,1)"
      },
      success: function (graphic: any) {
        quickCreateGraphic.value = graphic
        quickCreateName.value = `范围-${new Date().toLocaleString()}`
        quickCreatePid.value = defaultQuickCreatePid()
        quickCreateOpen.value = true
      }
    })
  } catch {
    $message("框选失败")
  }
}

function cancelQuickCreate() {
  quickCreateOpen.value = false
  const g = quickCreateGraphic.value
  quickCreateGraphic.value = null
  try {
    quickDrawLayer?.removeGraphic?.(g)
  } catch {
  }
  try {
    quickDrawLayer?.remove?.(g)
  } catch {
  }
  try {
    quickDrawLayer?.clear?.()
  } catch {
  }
}

function confirmQuickCreate(fly: boolean) {
  if (!ensureUnlocked("保存框选内容")) {
    cancelQuickCreate()
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    cancelQuickCreate()
    return
  }
  const name = String(quickCreateName.value || "").trim()
  if (!name) {
    $message("请输入名称")
    return
  }
  const g = quickCreateGraphic.value
  if (!g) {
    cancelQuickCreate()
    return
  }
  const id = `task_quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const pid = quickCreatePid.value || groupId
  const layer = mapWork.createGraphicLayer({ id, name, pid })
  if (!layer) {
    $message("保存失败")
    cancelQuickCreate()
    return
  }
  try {
    quickDrawLayer?.removeGraphic?.(g)
  } catch {
  }
  try {
    layer.addGraphic?.(g)
  } catch {
    $message("保存失败")
    cancelQuickCreate()
    return
  }
  quickCreateOpen.value = false
  quickCreateGraphic.value = null
  try {
    quickDrawLayer?.clear?.()
  } catch {
  }
  refreshSessions()
  refreshTree()
  if (fly) {
    mapWork.flyToLayer(id)
    mapWork.flashLayer(id, { times: 2, intervalMs: 160 })
  }
}

const createGroupDialogOpen = ref(false)
const createGroupName = ref("")
const createGroupPid = ref<string>("")

function openCreateGroup(parentNode?: any) {
  if (!ensureUnlocked("新建分组")) {
    return
  }
  const pid = parentNode?.key ? String(parentNode.key) : String(selectedGroupId.value)
  createGroupPid.value = pid
  createGroupName.value = ""
  createGroupDialogOpen.value = true
}

function cancelCreateGroup() {
  createGroupDialogOpen.value = false
}

function confirmCreateGroup() {
  if (!ensureUnlocked("新建分组")) {
    return
  }
  const pid = createGroupPid.value || selectedGroupId.value
  const name = String(createGroupName.value || "").trim()
  if (!pid) {
    return
  }
  if (!name) {
    return
  }
  const id = `task_group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  mapWork.ensureGroupLayer(id, name, pid)
  createGroupDialogOpen.value = false
  refreshSessions()
  refreshTree()
}

const renameDialogOpen = ref(false)
const renameTargetId = ref<string>("")
const renameName = ref("")

function openRename(node: any) {
  if (!ensureUnlocked("重命名")) {
    return
  }
  renameTargetId.value = String(node.key)
  renameName.value = String(node.title || "")
  renameDialogOpen.value = true
}

function cancelRename() {
  renameDialogOpen.value = false
}

function confirmRename() {
  if (!ensureUnlocked("重命名")) {
    return
  }
  pushUndoStep()
  const id = renameTargetId.value
  const name = String(renameName.value || "").trim()
  if (!id || !name) {
    return
  }
  const ok = mapWork.setLayerName(id, name)
  if (!ok) {
    $message("重命名失败")
    return
  }
  renameDialogOpen.value = false
  refreshTree()
}

const moveDialogOpen = ref(false)
const moveTargetId = ref<string>("")
const moveTargetPid = ref<string>("")
const moveTargetOptions = ref<Array<{ value: string; label: string }>>([])

function findPathById(nodes: any[], targetId: string): any[] | null {
  for (const n of nodes) {
    if (String(n.key ?? n.id) === String(targetId)) {
      return [n]
    }
    const children = Array.isArray(n.children) ? n.children : []
    const childPath = findPathById(children, targetId)
    if (childPath) {
      return [n, ...childPath]
    }
  }
  return null
}

function collectDescendantIds(node: any, out: Set<string>) {
  if (!node) {
    return
  }
  out.add(String(node.key ?? node.id))
  const children = Array.isArray(node.children) ? node.children : []
  children.forEach((c: any) => collectDescendantIds(c, out))
}

function buildGroupOptions(nodes: any[], excludeIds: Set<string>, out: Array<{ value: string; label: string }>, skipId?: string) {
  nodes.forEach((n) => {
    const id = String(n.key ?? n.id)
    if (n.group && !excludeIds.has(id) && id !== skipId) {
      out.push({ value: id, label: String(n.title || id) })
    }
    if (Array.isArray(n.children) && n.children.length) {
      buildGroupOptions(n.children, excludeIds, out, skipId)
    }
  })
}

function openMove(node: any) {
  if (!ensureUnlocked("移动")) {
    return
  }
  moveTargetId.value = String(node.key)
  const groupId = selectedGroupId.value
  moveTargetPid.value = groupId
  const exclude = new Set<string>()
  const path = findPathById(fullTree.value, moveTargetId.value)
  const targetNode = path ? path[path.length - 1] : null
  if (targetNode) {
    collectDescendantIds(targetNode, exclude)
  }
  const options: Array<{ value: string; label: string }> = []
  if (groupId) {
    options.push({ value: String(groupId), label: "根分组" })
  }
  buildGroupOptions(fullTree.value, exclude, options, groupId)
  moveTargetOptions.value = options
  moveDialogOpen.value = true
}

function cancelMove() {
  moveDialogOpen.value = false
}

function confirmMove() {
  if (!ensureUnlocked("移动")) {
    return
  }
  pushUndoStep()
  const id = moveTargetId.value
  const pid = moveTargetPid.value || null
  if (!id) {
    return
  }
  if (String(id) === String(pid)) {
    return
  }
  const ok = mapWork.setLayerPid(id, pid)
  if (!ok) {
    $message("移动失败")
    return
  }
  moveDialogOpen.value = false
  refreshTree()
}

const deleteDialogOpen = ref(false)
const deleteTargetId = ref<string>("")
const deleteTargetTitle = ref("")
const deleteTargetIsGroup = ref(false)

function openDelete(node: any) {
  if (!ensureUnlocked("删除")) {
    return
  }
  deleteTargetId.value = String(node.key)
  deleteTargetTitle.value = String(node.title || node.key)
  deleteTargetIsGroup.value = node?.group === true || String(node?.sourceType || "") === "group"
  deleteDialogOpen.value = true
}

function cancelDelete() {
  deleteDialogOpen.value = false
  deleteTargetIsGroup.value = false
}

function confirmDelete() {
  if (!ensureUnlocked("删除")) {
    return
  }
  pushUndoStep()
  const id = deleteTargetId.value
  if (!id) {
    return
  }
  const ok = deleteTargetIsGroup.value ? (mapWork.removeGroupTree(id), true) : mapWork.removeLayerById(id)
  if (!ok) {
    $message("删除失败")
    return
  }
  if (deleteTargetIsGroup.value) {
    mapWork.removePersistedSession(id)
    if (selectedGroupId.value === id) {
      selectedGroupId.value = ""
    }
  }
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
  deleteDialogOpen.value = false
  deleteTargetIsGroup.value = false
  refreshSessions()
  refreshTree()
}

async function clearSession() {
  if (!ensureUnlocked("清空本次导入")) {
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    return
  }
  clearDialogOpen.value = true
}

const clearDialogOpen = ref(false)

function confirmClearSession() {
  if (!ensureUnlocked("清空本次导入")) {
    clearDialogOpen.value = false
    return
  }
  const groupId = selectedGroupId.value
  if (!groupId) {
    clearDialogOpen.value = false
    return
  }
  mapWork.removeGroupTree(groupId)
  mapWork.removePersistedSession(groupId)
  selectedGroupId.value = ""
  clearDialogOpen.value = false
  window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
  refreshSessions()
  refreshTree()
}

function cancelClearSession() {
  clearDialogOpen.value = false
}

function installMapWatch() {
  if (teardownMapWatch) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    return
  }
  const anyMap: any = map as any
  const EventType = mars3d.EventType
  const scheduleMapRefresh = () => {
    if (mapRefreshRafId !== null) {
      return
    }
    mapRefreshRafId = window.requestAnimationFrame(() => {
      mapRefreshRafId = null
      refreshSessions()
      refreshTree()
    })
  }
  const onAdd = () => {
    scheduleMapRefresh()
  }
  const onRemove = () => {
    scheduleMapRefresh()
  }
  try {
    map.on(EventType.addLayer, onAdd)
    map.on(EventType.removeLayer, onRemove)
  } catch {
    return
  }
  teardownMapWatch = () => {
    try {
      map.off(EventType.addLayer, onAdd)
      map.off(EventType.removeLayer, onRemove)
    } catch {
    }
  }
  anyMap.__currentTaskWatch = teardownMapWatch
}

onBeforeMount(() => {
  updateAnchorRect()
})

onMounted(() => {
  nextTick(() => {
    installMapWatch()
  })
})

watch(
  () => panelVisible.value,
  async (v) => {
    if (v) {
      await nextTick()
      updateAnchorRect()
      installSidebarObserver()
      const dsId = String(currentDataset.value?.datasetId || "")
      if (dsId) {
        mapWork.restorePersistedSessions(dsId).catch(() => {})
      }
      refreshSessions()
      refreshTree()
      loadThematicsCount()
      loadDirectoryLocks()
      if (isSectionActive("artifacts")) {
        loadArtifacts()
      }
      if (isSectionActive("versions")) {
        loadRevisions()
      }
      if (mapPollTimer === null) {
        mapPollSignature = computeMapSignature()
        mapPollTimer = window.setInterval(() => {
          const sig = computeMapSignature()
          if (sig && sig !== mapPollSignature) {
            mapPollSignature = sig
            refreshSessions()
            refreshTree()
          }
        }, 1500)
      }
      if (eoApiConfig.autoSync && remoteSyncTimer === null) {
        remoteSyncTimer = window.setInterval(() => {
          if (!currentDataset.value?.datasetId) {
            return
          }
          refreshSessions()
          refreshTree()
          if (isSectionActive("artifacts")) {
            loadArtifacts()
          }
          if (isSectionActive("versions")) {
            loadRevisions()
          }
          if (isSectionActive("thematics")) {
            loadThematicsCount()
            loadThematicsJobs()
          }
        }, 10000)
      }
      if (eoApiConfig.autoSync && currentDataset.value?.datasetId) {
        connectDatasetSync(currentDataset.value.datasetId)
      }
      return
    }
    clearStepHistory()
    uninstallSidebarObserver()
    if (mapPollTimer !== null) {
      window.clearInterval(mapPollTimer)
      mapPollTimer = null
    }
    if (remoteSyncTimer !== null) {
      window.clearInterval(remoteSyncTimer)
      remoteSyncTimer = null
    }
    disconnectDatasetSync(currentDataset.value?.datasetId)
    isDragging.value = false
    isMovingOrResizing.value = false
    moveSession.value = null
    resizeSession.value = null
    if (moveRafId !== null) {
      window.cancelAnimationFrame(moveRafId)
      moveRafId = null
    }
    if (resizeRafId !== null) {
      window.cancelAnimationFrame(resizeRafId)
      resizeRafId = null
    }
    pendingMoveLayout = null
    pendingResizeLayout = null
    if (anchorSaveTimer !== null) {
      window.clearTimeout(anchorSaveTimer)
      anchorSaveTimer = null
    }
    if (mapRefreshRafId !== null) {
      window.cancelAnimationFrame(mapRefreshRafId)
      mapRefreshRafId = null
    }
  },
  { immediate: true }
)

function computeMapSignature(): string {
  const map = mapWork.getMap()
  if (!map) {
    return ""
  }
  const layers = mapWork.getAllLayers()
  const parts = layers
    .map((l: any) => {
      const id = String(l?.id ?? "")
      if (!id) {
        return ""
      }
      const name = String(l?.name ?? "")
      const show = l?.show ? "1" : "0"
      const pid = String(l?.pid ?? l?.options?.pid ?? "")
      const order = String(l?.options?.order ?? "")
      return `${id}:${show}:${pid}:${order}:${name}`
    })
    .filter(Boolean)
  return parts.join("|")
}

function getDropPid(dropNode: any): string | null {
  if (!dropNode?.key) {
    return selectedGroupId.value || null
  }
  if (dropNode.group) {
    return String(dropNode.key)
  }
  const layer: any = mapWork.getLayerById(dropNode.key)
  const pid = layer?.pid ?? layer?.options?.pid
  if (pid === null || pid === undefined || pid === "") {
    return selectedGroupId.value || null
  }
  return String(pid)
}

function handleDrop(info: any) {
  if (!ensureUnlocked("拖拽调整")) {
    return
  }
  pushUndoStep()
  const dragId = String(info?.dragNode?.key || "")
  const dropId = String(info?.node?.key || "")
  if (!dragId || !dropId || dragId === dropId) {
    return
  }

  const isDropToGap = !!info?.dropToGap
  const dropNode = info?.node
  if (!dropNode) {
    return
  }

  if (selectedGroupId.value) {
    const dragLayer: any = mapWork.getLayerById(dragId)
    const dropLayer: any = mapWork.getLayerById(dropId)
    const dragPid = String(dragLayer?.pid ?? dragLayer?.options?.pid ?? "")
    const dropPid = String(dropLayer?.pid ?? dropLayer?.options?.pid ?? "")
    const dragIsGroup =
      !!(info?.dragNode?.group || info?.dragNode?.dataRef?.group) ||
      String(dragLayer?.type ?? dragLayer?.options?.type ?? "").toLowerCase().includes("group")
    const dropIsGroup =
      !!(dropNode?.group || dropNode?.dataRef?.group) ||
      String(dropLayer?.type ?? dropLayer?.options?.type ?? "").toLowerCase().includes("group")
    if (dragPid && dropPid && dragPid === dropPid) {
      if (dragIsGroup && dropIsGroup) {
        const state = readDirOrderState()
        const sessionId = String(selectedGroupId.value)
        const sessionMap = state[sessionId] || {}
        const current =
          Array.isArray(sessionMap[dragPid]) && sessionMap[dragPid].length
            ? sessionMap[dragPid].slice()
            : collectGroupChildOrder(fullTree.value, dragPid)
        const before = isDropToGap ? Number(info?.dropPosition ?? 0) < 0 : false
        const nextOrder = reorderIds(current, dragId, dropId, before)
        sessionMap[dragPid] = nextOrder
        state[sessionId] = sessionMap
        writeDirOrderState(state)
        refreshTree()
        return
      }
    }
  }

  if (isDropToGap) {
    const ok = mapWork.exchangeLayerZIndex(dragId, dropId)
    if (!ok) {
      const pid = getDropPid(dropNode)
      mapWork.setLayerPid(dragId, pid)
    }
  } else {
    const pid = getDropPid(dropNode)
    mapWork.setLayerPid(dragId, pid)
  }
  refreshTree()
}

const artifactsLoading = ref(false)
const artifacts = ref<Artifact[]>([])
const artifactUploadType = ref<ArtifactType>("other")
const artifactFilterType = ref<ArtifactType | "">("")
const displayArtifacts = computed(() => {
  const t = artifactFilterType.value
  if (!t) {
    return artifacts.value
  }
  return artifacts.value.filter((a) => a.type === t)
})
const artifactPreviewOpen = ref(false)
const artifactPreviewUrl = ref("")
const artifactPreviewMime = ref("")
const manifestViewOpen = ref(false)
const manifestViewText = ref("")
const forkDialogOpen = ref(false)
const forkRevisionId = ref("")
const forkName = ref("")

function formatArtifactDesc(a: Artifact) {
  const parts: string[] = []
  parts.push(getArtifactTypeName(a.type))
  if (a.size) {
    parts.push(formatArtifactSize(a.size))
  }
  if (a.createdAt) {
    parts.push(new Date(a.createdAt).toLocaleString())
  }
  return parts.join(" · ")
}

async function loadArtifacts() {
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    artifacts.value = []
    return
  }
  artifactsLoading.value = true
  try {
    const res = await getArtifacts({ datasetId, limit: 50 })
    artifacts.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch {
    artifacts.value = []
  } finally {
    artifactsLoading.value = false
  }
}

async function beforeUploadArtifact(file: File) {
  if (!ensureUnlocked("上传附件")) {
    return false
  }
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    $message("缺少数据集 ID")
    return false
  }
  const type: ArtifactType = artifactUploadType.value || "other"
  try {
    const res = await smartUploadArtifact(
      {
        file,
        name: file.name,
        type,
        datasetId
      },
      { presignedThreshold: 50 * 1024 * 1024 }
    )
    if (!res.success) {
      $message(res.message || "上传失败")
      return false
    }
    $message("上传成功", "success")
    await loadArtifacts()
  } catch (e: any) {
    $message(e?.message || "上传失败")
  }
  return false
}

async function downloadArtifact(a: Artifact) {
  try {
    const res = await getArtifactDownloadUrl(a.artifactId)
    const url = res.success && (res.data as any)?.downloadUrl ? (res.data as any).downloadUrl : a.url
    window.open(url, "_blank")
  } catch {
    window.open(a.url, "_blank")
  }
}

function canPreviewArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  if (mime === "application/pdf" || mime === "text/html") {
    return true
  }
  const url = String((a as any)?.url || "")
  if (/\.(pdf|html?)(\?.*)?$/i.test(url)) {
    return true
  }
  return /\.(png|jpg|jpeg|gif|webp|tif|tiff)(\?.*)?$/i.test(url)
}

function isTiffArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "").toLowerCase()
  if (mime.includes("tiff")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(tif|tiff)(\?.*)?$/i.test(url)
}

function isImageArtifact(a: Artifact): boolean {
  const mime = String((a as any)?.mime || "")
  if (mime.startsWith("image/")) {
    return true
  }
  const url = String((a as any)?.url || "")
  return /\.(png|jpg|jpeg|gif|webp|tif|tiff)(\?.*)?$/i.test(url)
}

function canAddArtifactToMap(a: Artifact): boolean {
  return isImageArtifact(a)
}

function resolveBoundsFromMetadata(meta: any): [number, number, number, number] | null {
  const candidates = [meta?.bounds, meta?.bbox, meta?.extent?.bbox, meta?.coverage?.bbox, meta?.coverage?.bounds]
  for (const c of candidates) {
    const arr = Array.isArray(c) ? c : null
    if (!arr || arr.length !== 4) {
      continue
    }
    const west = Number(arr[0])
    const south = Number(arr[1])
    const east = Number(arr[2])
    const north = Number(arr[3])
    if ([west, south, east, north].every((n) => Number.isFinite(n))) {
      return [west, south, east, north]
    }
  }
  return null
}

function getDefaultImageBounds(map: any): [number, number, number, number] | null {
  const Cesium = (mars3d as any)?.Cesium
  if (!Cesium || !map?.camera?.computeViewRectangle) {
    return null
  }
  const rect = map.camera.computeViewRectangle()
  if (rect) {
    const west = Cesium.Math.toDegrees(rect.west)
    const south = Cesium.Math.toDegrees(rect.south)
    const east = Cesium.Math.toDegrees(rect.east)
    const north = Cesium.Math.toDegrees(rect.north)
    if ([west, south, east, north].every((n) => Number.isFinite(n))) {
      const cx = (west + east) / 2
      const cy = (south + north) / 2
      const dx = Math.max(0.00001, Math.abs(east - west) * 0.18)
      const dy = Math.max(0.00001, Math.abs(north - south) * 0.18)
      return [cx - dx, cy - dy, cx + dx, cy + dy]
    }
  }
  try {
    const center = map?.camera?.positionCartographic
    const lng = Cesium.Math.toDegrees(center.longitude)
    const lat = Cesium.Math.toDegrees(center.latitude)
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      const dx = 0.05
      const dy = 0.03
      return [lng - dx, lat - dy, lng + dx, lat + dy]
    }
  } catch {
  }
  return null
}

async function previewArtifact(a: Artifact) {
  if (!canPreviewArtifact(a)) {
    await downloadArtifact(a)
    return
  }
  artifactPreviewMime.value = String((a as any)?.mime || "")
  try {
    const res = await getArtifactDownloadUrl(a.artifactId)
    const url = res.success && (res.data as any)?.downloadUrl ? (res.data as any).downloadUrl : a.url
    artifactPreviewUrl.value = url
  } catch {
    artifactPreviewUrl.value = a.url
  }
  artifactPreviewOpen.value = true
}

function closeArtifactPreview() {
  artifactPreviewOpen.value = false
  artifactPreviewUrl.value = ""
  artifactPreviewMime.value = ""
}

async function addArtifactToMap(a: Artifact) {
  if (!ensureUnlocked("附件上图")) {
    return
  }
  const datasetId = String(currentDataset.value?.datasetId || "")
  if (!datasetId) {
    $message("缺少数据集 ID")
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    $message("地图尚未初始化")
    return
  }
  let url = String(a?.url || "")
  const artifactId = String((a as any)?.artifactId || "")
  try {
    if (artifactId) {
      const res = await getArtifactDownloadUrl(artifactId)
      url = String((res.success && (res.data as any)?.downloadUrl) || url)
    }
  } catch {
  }
  if (!url) {
    $message("缺少附件地址")
    return
  }

  const datasetToken = normalizeLayerIdToken(datasetId, "dataset")
  const groupId = `myrepo_group_${datasetToken}_artifacts`
  const datasetName = String((currentDataset.value as any)?.datasetName || (currentDataset.value as any)?.name || datasetId)
  mapWork.ensureGroupLayer(groupId, `数据集成果/${datasetName}`)

  const layerKey = artifactId || String((a as any)?.name || url || "")
  const desiredLayerId = `myrepo_${datasetToken}_artifact_${normalizeLayerIdToken(layerKey, "artifact")}`
  const layerId = ensureUniqueMapLayerId(map as any, desiredLayerId, { fallbackBase: `myrepo_${datasetToken}_artifact` })

  const isXyz = /\{x\}|\{y\}|\{z\}/.test(url)
  let sourceType: any = "image"
  if (isXyz) {
    sourceType = "xyz"
  } else if (isTiffArtifact(a)) {
    sourceType = "geotiff"
  }
  const bounds = resolveBoundsFromMetadata((a as any)?.metadata) || (sourceType === "image" ? getDefaultImageBounds(map) : null)
  const options = sourceType === "image" && bounds ? { bounds } : undefined

  try {
    const manifest: Manifest = {
      manifestVersion: "1.0",
      layers: [
        {
          id: layerId,
          name: String(a?.name || "附件图层"),
          sourceType: sourceType as any,
          sourceRef: url,
          pid: groupId,
          visible: true,
          opacity: 1,
          options
        } as any
      ],
      createdAt: Date.now()
    }
    await restoreWorkspace(map as any, manifest as any, {
      strategy: "overlay",
      conflictResolution: "skip",
      restoreView: false,
      restoreDrawFeatures: false
    })
    window.dispatchEvent(new CustomEvent("mars3d_layersChanged"))
    mapWork.flyToLayer(layerId)
    $message("已上图", "success")
  } catch (e: any) {
    $message(e?.message || "上图失败")
  }
}

async function removeArtifact(a: Artifact) {
  if (!ensureUnlocked("删除附件")) {
    return
  }
  try {
    const res = await deleteArtifact(a.artifactId)
    if (!res.success) {
      $message(res.message || "删除失败")
      return
    }
    $message("已删除", "success")
    await loadArtifacts()
  } catch (e: any) {
    $message(e?.message || "删除失败")
  }
}

const artifactsCountText = computed(() => String(artifacts.value.length))

const layerCountText = computed(() => {
  if (!selectedGroupId.value) {
    return "0"
  }
  return String(layerCount.value)
})

const thematicsCount = ref<number | null>(null)
const thematicsCountText = computed(() => (thematicsCount.value === null ? "…" : String(thematicsCount.value)))

async function loadThematicsCount() {
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    thematicsCount.value = 0
    return
  }
  thematicsCount.value = null
  try {
    const res = await getJobs({ datasetId, limit: 200, offset: 0 })
    thematicsCount.value = res.success && Array.isArray(res.data) ? res.data.length : 0
  } catch {
    thematicsCount.value = 0
  }
}

const thematicsLoading = ref(false)
const thematicsJobs = ref<ThematicJob[]>([])
const selectedThematicJobId = ref("")
const selectedThematicResult = ref<ThematicJobResult | null>(null)
const thematicResultExpanded = ref(true)
const thematicsLastLayerId = ref("")

async function loadThematicsJobs() {
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    thematicsJobs.value = []
    selectedThematicJobId.value = ""
    selectedThematicResult.value = null
    return
  }
  thematicsLoading.value = true
  try {
    const res = await getJobs({ datasetId, limit: 50, offset: 0 })
    thematicsJobs.value = res.success && Array.isArray(res.data) ? (res.data as ThematicJob[]) : []
  } catch {
    thematicsJobs.value = []
  } finally {
    thematicsLoading.value = false
  }
  if (!selectedThematicJobId.value && thematicsJobs.value.length) {
    await selectThematicJob(thematicsJobs.value[0])
  }
}

async function selectThematicJob(job: ThematicJob) {
  if (!job?.jobId) {
    return
  }
  selectedThematicJobId.value = job.jobId
  selectedThematicResult.value = null
  thematicResultExpanded.value = true
  try {
    const res = await getJobResult(job.jobId)
    selectedThematicResult.value = res.success ? ((res.data as any) || null) : null
  } catch {
    selectedThematicResult.value = null
  }
}

function getThematicJobLabel(job: ThematicJob): string {
  const id = String(job?.templateId || "")
  if (/local/i.test(id)) {
    return "local"
  }
  return id || "专题任务"
}

function isThematicPreviewArtifact(a: any): boolean {
  return String(a?.type || "") === "thumbnail" || String(a?.name || "") === "预览图"
}

function collapseThematicResult() {
  thematicResultExpanded.value = false
}

function expandThematicResult() {
  thematicResultExpanded.value = true
}

function clearSelectedThematicJob() {
  selectedThematicJobId.value = ""
  selectedThematicResult.value = null
  thematicResultExpanded.value = true
}

function previewThematicArtifact(a: any) {
  const url = String(a?.url || "")
  if (!url) {
    return
  }
  artifactPreviewUrl.value = url
  artifactPreviewMime.value = String(a?.mime || "")
  artifactPreviewOpen.value = true
}

function downloadThematicArtifact(a: any) {
  const url = String(a?.url || "")
  if (!url) {
    return
  }
  window.open(url, "_blank")
}

function addThematicServiceLayer(serviceRef: ServiceRef) {
  const url = String((serviceRef as any)?.urlTemplate || (serviceRef as any)?.url || "")
  const layerId = `thematics_${selectedThematicJobId.value || Date.now()}`
  let layer: any = null
  if (/^data:application\/geo\+json/i.test(url)) {
    const idx = url.indexOf(",")
    const raw = idx >= 0 ? url.slice(idx + 1) : ""
    try {
      const json = JSON.parse(decodeURIComponent(raw))
      layer = mapWork.addGeoJsonLayer(layerId, json, { name: "专题服务" })
    } catch {
      layer = null
    }
  } else if (url) {
    layer = mapWork.addXyzLayer(layerId, url, {
      name: "专题服务",
      minZoom: (serviceRef as any).minZoom,
      maxZoom: (serviceRef as any).maxZoom,
      bounds: (serviceRef as any).bounds
    })
  }
  if (layer) {
    thematicsLastLayerId.value = layerId
    $message("已上图", "success")
  } else {
    $message("上图失败")
  }
}

function locateThematicService(serviceRef: ServiceRef) {
  const bounds = ((serviceRef as any)?.bounds || (serviceRef as any)?.bbox) as [number, number, number, number] | undefined
  if (bounds && bounds.length === 4) {
    mapWork.flyToBbox(bounds, 1.2)
    return
  }
  const id = thematicsLastLayerId.value
  if (id) {
    mapWork.flyToLayer(id)
  }
}

function exportThematicResult() {
  const res = selectedThematicResult.value as any
  const artifacts = Array.isArray(res?.artifacts) ? res.artifacts : []
  const preferred = artifacts.find((x: any) => x?.type === "export") || artifacts.find((x: any) => x?.type === "report") || artifacts[0]
  const url = String(preferred?.url || "")
  if (!url) {
    $message("未找到可导出的附件")
    return
  }
  window.open(url, "_blank")
}

type RevisionListItem = { revisionId: string; title: string; desc: string }
const revisionsLoading = ref(false)
const revisions = ref<RevisionListItem[]>([])

const revisionOptions = computed(() => {
  return revisions.value.map((r) => ({ value: r.revisionId, label: r.title || r.revisionId }))
})

const artifactLinkOpen = ref(false)
const artifactLinkArtifactId = ref("")
const artifactLinkRevisionId = ref<string | undefined>(undefined)

function openLinkArtifact(a: Artifact) {
  if (!ensureUnlocked("关联附件")) {
    return
  }
  artifactLinkArtifactId.value = a.artifactId
  artifactLinkRevisionId.value = undefined
  if (!revisions.value.length) {
    loadRevisions()
  }
  artifactLinkOpen.value = true
}

function cancelLinkArtifact() {
  artifactLinkOpen.value = false
  artifactLinkArtifactId.value = ""
  artifactLinkRevisionId.value = undefined
}

async function confirmLinkArtifact() {
  if (!ensureUnlocked("关联附件")) {
    cancelLinkArtifact()
    return
  }
  const datasetId = currentDataset.value?.datasetId
  const artifactId = artifactLinkArtifactId.value
  if (!datasetId || !artifactId) {
    cancelLinkArtifact()
    return
  }
  try {
    const res = await linkArtifactToDataset(artifactId, {
      datasetId,
      revisionId: artifactLinkRevisionId.value || undefined
    })
    if (!res.success) {
      $message(res.message || "关联失败")
      return
    }
  } catch (e: any) {
    $message(e?.message || "关联失败")
    return
  }
  $message("已关联", "success")
  artifactLinkOpen.value = false
  artifactLinkArtifactId.value = ""
  artifactLinkRevisionId.value = undefined
  loadArtifacts()
}

async function loadRevisions() {
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    revisions.value = []
    return
  }
  revisionsLoading.value = true
  try {
    const res = await getItems(datasetId, { limit: 50 })
    const items = res.success && Array.isArray(res.data) ? res.data : []
    revisions.value = items.map((it: any) => {
      const rid = String(it.id || "")
      const title = String(it?.properties?.title || it?.properties?.name || rid || "版本")
      const dt = it?.properties?.datetime ? new Date(it.properties.datetime).getTime() : undefined
      const desc = dt ? formatDateTime(dt) : ""
      return { revisionId: rid, title, desc }
    })
  } catch {
    revisions.value = []
  } finally {
    revisionsLoading.value = false
  }
}

async function openManifestView(revisionId: string) {
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    return
  }
  try {
    const res = await getRevisionManifest(datasetId, revisionId)
    if (!res.success || !res.data) {
      $message(res.message || "无法获取 manifest")
      return
    }
    manifestViewText.value = JSON.stringify(res.data, null, 2)
    manifestViewOpen.value = true
  } catch {
    $message("无法获取 manifest")
  }
}

function closeManifestView() {
  manifestViewOpen.value = false
  manifestViewText.value = ""
}

async function restoreRevision(revisionId: string) {
  if (!ensureUnlocked("恢复版本")) {
    return
  }
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    return
  }
  const map = mapWork.getMap()
  if (!map) {
    $message("地图未就绪")
    return
  }
  try {
    const res = await getRevisionManifest(datasetId, revisionId)
    if (!res.success || !res.data) {
      $message(res.message || "无法获取 manifest")
      return
    }
    await restoreWorkspace(map as any, res.data, { strategy: "replace" })
    $message("已恢复到该版本", "success")
  } catch (e: any) {
    $message(e?.message || "恢复失败")
  }
}

function openForkDialog(revisionId: string) {
  if (!ensureUnlocked("复制数据集")) {
    return
  }
  forkRevisionId.value = revisionId
  const base = currentDataset.value?.name || currentDataset.value?.datasetId || "数据集"
  forkName.value = `${base}-副本`
  forkDialogOpen.value = true
}

async function confirmFork() {
  if (!ensureUnlocked("复制数据集")) {
    forkDialogOpen.value = false
    return
  }
  const datasetId = currentDataset.value?.datasetId
  const revisionId = forkRevisionId.value
  if (!datasetId || !revisionId) {
    forkDialogOpen.value = false
    return
  }
  try {
    const res = await forkDataset(datasetId, revisionId, forkName.value || undefined)
    if (!res.success) {
      $message(res.message || "复制失败")
      return
    }
    $message("已复制为新数据集", "success")
    forkDialogOpen.value = false
  } catch (e: any) {
    $message(e?.message || "复制失败")
  }
}

function cancelFork() {
  forkDialogOpen.value = false
}

async function saveAsNewRevision(revisionId: string) {
  if (!ensureUnlocked("保存版本")) {
    return
  }
  const datasetId = currentDataset.value?.datasetId
  if (!datasetId) {
    return
  }
  try {
    const res = await getRevisionManifest(datasetId, revisionId)
    if (!res.success || !res.data) {
      $message(res.message || "无法获取 manifest")
      return
    }
    const save = await saveDatasetRevision(datasetId, { message: `从 ${revisionId} 另存为新版本`, manifest: res.data as any })
    if (!save.success) {
      $message(save.message || "保存失败")
      return
    }
    $message("已保存为新版本", "success")
    loadRevisions()
  } catch (e: any) {
    $message(e?.message || "保存失败")
  }
}

watch(
  () => currentDataset.value?.datasetId,
  (datasetId, prevDatasetId) => {
    if (prevDatasetId && prevDatasetId !== datasetId) {
      disconnectDatasetSync(prevDatasetId)
    }
    if (!panelVisible.value) {
      return
    }
    const dsId = String(currentDataset.value?.datasetId || "")
    if (dsId) {
      mapWork.restorePersistedSessions(dsId).catch(() => {})
      if (eoApiConfig.autoSync) {
        connectDatasetSync(dsId)
      }
    }
    loadDirectoryLocks()
    refreshSessions()
    refreshTree()
    loadThematicsCount()
    if (isSectionActive("artifacts")) {
      loadArtifacts()
    }
    if (isSectionActive("versions")) {
      loadRevisions()
    }
  }
)

watch(
  () => selectedGroupId.value,
  () => {
    if (selectedDirectoryLock.value?.locked && !superAdminUser.value) {
      setCurrentTaskLock({ locked: true, reason: selectedDirectoryLock.value.reason || "目录已锁定" })
      return
    }
    if (taskLock.value.reason === "目录已锁定" || String(taskLock.value.reason || "").startsWith("告警已定稿")) {
      setCurrentTaskLock({ locked: false })
    }
  }
)
</script>

<style scoped>
.task-panel-body {
  padding: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
}

.current-task_panel :deep(.ant-empty-description),
.current-task_panel :deep(.ant-spin-text) {
  color: inherit;
}

.current-task_panel :deep(.ant-list-item),
.current-task_panel :deep(.ant-list-item-meta),
.current-task_panel :deep(.ant-list-item-meta-content) {
  min-width: 0;
}

.current-task_panel :deep(.ant-list-item-meta-title),
.current-task_panel :deep(.ant-list-item-meta-description) {
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-task_panel :deep(.ant-list-item-meta-description) {
  color: color-mix(in srgb, var(--text-primary) 70%, transparent);
}

.current-task_panel :deep(.ant-list-item-action a) {
  color: var(--primary);
}

.versions-panel {
  padding-left: 10px;
}

.current-task_panel :deep(.versions-list .ant-list-item) {
  align-items: flex-start;
}

.current-task_panel :deep(.versions-list .version-meta-title),
.current-task_panel :deep(.versions-list .version-meta-desc) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.current-task_panel :deep(.versions-list .version-meta-desc) {
  color: color-mix(in srgb, var(--text-primary) 70%, transparent);
}

.current-task_panel :deep(.versions-list .ant-list-item-action-split) {
  display: none;
}

.current-task_panel :deep(.versions-list .version-action-btn.ant-btn) {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  color: color-mix(in srgb, var(--text-primary) 88%, transparent);
}

.current-task_panel :deep(.versions-list .ant-list-item-action) {
  margin-inline-start: 10px;
}

.current-task_panel :deep(.versions-list .ant-list-item-action > li) {
  padding: 0;
}

.current-task_panel :deep(.versions-list .version-actions) {
  display: flex;
  align-items: center;
  gap: 6px;
}

.current-task_panel :deep(.versions-list .version-action-view.ant-btn:hover) {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
}

.current-task_panel :deep(.versions-list .version-action-restore.ant-btn:hover) {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.current-task_panel :deep(.versions-list .version-action-more.ant-btn) {
  padding: 0 10px;
}

.task-tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: visible;
}

.tree-row {
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
  border-radius: 6px;
  color: inherit;
}

.tree-row:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.tree-children {
  margin-left: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.task-section-tabs {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 4px;
  flex-shrink: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--overlay-border);
}

.task-section-tab {
  flex: 1 1 0;
  min-width: 0;
  height: 32px;
  padding: 0 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 13px;
  line-height: 1.2;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.task-section-tab:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.task-section-tab.active {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary, #2d8cf0);
  font-weight: 600;
}

.task-section-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-section-tab-count {
  flex-shrink: 0;
  opacity: 0.85;
  font-size: 12px;
}

.task-section-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-panel {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
}

.tree-text {
  font-size: 14px;
  line-height: 32px;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-spacer {
  flex: 1 1 auto;
}

.tree-caret {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(0deg);
  transition: transform 200ms ease;
}

.tree-caret.open {
  transform: rotate(90deg);
}

.tree-panel {
  padding: 0;
  overscroll-behavior: contain;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-panel > .empty {
  padding: 8px 0;
}

.layers-panel {
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior: contain;
}

.layers-panel :deep(.ant-tree) {
  background: transparent;
  color: inherit;
}

.layers-panel :deep(.ant-tree-node-content-wrapper) {
  color: inherit;
}

.layers-panel :deep(.ant-tree-title) {
  color: inherit;
}

.layers-panel :deep(.ant-tree-switcher) {
  color: inherit;
}

.layers-panel :deep(.ant-tree-checkbox-inner) {
  border-color: color-mix(in srgb, var(--text-primary) 40%, transparent);
}

.layers-panel :deep(.ant-tree-checkbox-checked .ant-tree-checkbox-inner) {
  background-color: var(--primary);
  border-color: var(--primary);
}

.layers-panel :deep(.ant-input) {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--text-primary) 20%, transparent);
  color: inherit;
}

.layers-panel :deep(.ant-input::placeholder) {
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
}

.layers-panel :deep(.ant-btn) {
  border-color: color-mix(in srgb, var(--text-primary) 20%, transparent);
}

.layers-panel :deep(.ant-tag) {
  background: color-mix(in srgb, var(--text-primary) 12%, transparent);
  border-color: transparent;
  color: inherit;
}

.layers-tree {
  flex: 1 1 auto;
  min-height: 80px;
  overflow: auto;
  padding: 6px 0 2px;
  overscroll-behavior: contain;
}

.layers-toolbar {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 0 2px;
}

.layers-search {
  flex: 1;
  min-width: 120px;
}

.layers-lock {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  color: inherit;
}

.session-refresh-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: inherit;
  font-size: 12px;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  line-height: 32px;
}

.node-highlight {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  border-radius: 4px;
  padding: 0 2px;
}

.node-tags {
  display: inline-flex;
  gap: 4px;
  margin-left: 4px;
  flex-wrap: wrap;
}

.node-tag {
  margin-inline-end: 0;
}

.node-hover-actions {
  margin-left: auto;
  display: none;
  align-items: center;
  gap: 4px;
}

.node-title:hover .node-hover-actions {
  display: inline-flex;
}

.node-hover-action {
  padding: 0 4px;
  height: 24px;
}

.tree-slider {
  margin-left: 8px;
  display: inline-block;
  width: 120px;
}

.thematics-panel {
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  overscroll-behavior: contain;
}

.thematics-panel :deep(.thematic-jobs) {
  color: inherit;
}

.thematics-panel :deep(.thematic-jobs .jobs-header) {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.thematics-jobs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.thematics-header {
  display: flex;
  justify-content: flex-end;
}

.artifacts,
.versions {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.thematics-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.thematics-list .thematic-job-block {
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
  overflow: hidden;
}

.thematics-list .thematic-job-block.active {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
}

.thematic-job-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  cursor: pointer;
}

.thematic-job-header .job-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}

.thematic-job-header .job-meta {
  flex-shrink: 0;
  font-size: 12px;
  opacity: 0.8;
}

.thematic-job-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.thematic-toggle-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--transition-fast), opacity var(--transition-fast);
}

.thematic-toggle-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.thematic-toggle-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.job-detail-panel {
  margin: 0 8px 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
  border-radius: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--text-primary) 4%, transparent);
}

.job-detail-panel .detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.job-detail-panel .detail-title {
  font-size: 13px;
  font-weight: 600;
}

.thematic-result-children {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 4px;
  padding-left: 10px;
  border-left: 2px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
}

.thematic-artifact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.thematic-artifact .artifact-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.thematic-artifact-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.thematic-outline-btn :deep(.ant-btn) {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 22%, transparent);
  background: transparent;
  box-shadow: none;
  color: inherit;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
}

.thematic-outline-btn :deep(.ant-btn:hover) {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: inherit;
  border-color: color-mix(in srgb, var(--text-primary) 30%, transparent);
}

.service-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.thematic-service-btn {
  width: 100%;
}

.thematic-service-btn :deep(.ant-btn) {
  width: 100%;
  border-radius: 8px;
}

.artifacts-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.artifacts-tool {
  flex: 1 1 calc(50% - 4px);
  min-width: 136px;
  max-width: 100%;
}

.artifacts-tool-upload {
  display: flex;
}

.artifacts-tool-upload :deep(.ant-upload) {
  width: 100%;
}

.artifacts-tool-upload :deep(.ant-btn) {
  width: 100%;
}

.task-round-btn {
  border-radius: 8px !important;
}

.artifacts-list {
  flex: 1 1 auto;
  min-height: 80px;
  overflow: auto;
  overscroll-behavior: contain;
}

.versions-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 80px;
  overflow: auto;
  overscroll-behavior: contain;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
}

.version-item-info {
  min-width: 0;
}

.version-item .version-meta-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-item .version-meta-desc {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-item .version-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.empty {
  padding: 8px 0;
}

.loading-container {
  padding: 12px 0;
}

.recent-divider {
  height: 1px;
  flex-shrink: 0;
  background: var(--overlay-border);
  margin: 10px 0 8px;
}

.recent-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: inherit;
}

.recent {
  flex-shrink: 0;
  max-height: 180px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.recent-empty {
  font-size: 13px;
  color: color-mix(in srgb, var(--text-primary) 55%, transparent);
  padding: 6px 0;
}

.recent-item {
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
  border-radius: 6px;
}

.recent-item:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.recent-item.active {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.recent-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
}

.recent-name {
  font-size: 14px;
  line-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
}

.recent-time {
  font-size: 13px;
  color: color-mix(in srgb, var(--text-primary) 55%, transparent);
  flex: 0 0 auto;
}

.artifact-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
}

.manifest-view {
  max-height: 60vh;
  overflow: auto;
  background: #0b1020;
  color: #e6e6e6;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.45;
  overscroll-behavior: contain;
}

</style>

<style lang="less">
.current-task_panel {
  border-radius: 8px;
  overflow: hidden;

  .mars-dialog__header {
    display: flex;
    align-items: center;
    line-height: normal;
    overflow: visible;

    .icon {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: var(--popup-header-height);
    }

    .mars-dialog__header-right {
      float: none;
      margin-top: 0;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .close-btn {
      float: none;
      margin-top: 0;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      border-radius: calc(var(--popup-radius, 8px) - 2px);
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }

  .mars-dialog__content {
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .task-header-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .task-header-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: calc(var(--popup-radius, 8px) - 2px);
    color: var(--mars-text-color);
    cursor: pointer;
    opacity: 0.85;
    transition: background var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);

    &:hover:not(:disabled) {
      opacity: 1;
      color: var(--color-primary, #2d8cf0);
      background: rgba(255, 255, 255, 0.08);
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  .readonly-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 4px;
    user-select: none;

    .readonly-label {
      font-size: 12px;
      color: var(--mars-text-color);
      white-space: nowrap;
    }
  }
}
</style>
