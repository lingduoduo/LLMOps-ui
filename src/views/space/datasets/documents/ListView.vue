<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import moment from 'moment'
import {
  useDeleteDocument,
  useGetDataset,
  useGetDocumentsWithPage,
  useUpdateDocumentEnabled,
} from '@/hooks/use-dataset'
import UpdateDocumentNameModal from '@/views/space/datasets/documents/components/UpdateDocumentNameModal.vue'
import HitTestingModal from '@/views/space/datasets/documents/components/HitTestingModal.vue'

const route = useRoute()
const router = useRouter()
const hitModalVisible = ref(false)
const updateDocumentNameModalVisible = ref(false)
const updateDocumentID = ref('')
const { dataset, loadDataset } = useGetDataset(route.params?.dataset_id as string)
const { loading, documents, paginator, loadDocuments } = useGetDocumentsWithPage(
  route.params?.dataset_id as string,
)
const { handleDelete } = useDeleteDocument()
const { handleUpdate: handleUpdateEnabled } = useUpdateDocumentEnabled()
</script>

<template>
  <div class="p-6">
    <!-- Top: knowledge base details -->
    <div class="flex items-center w-full gap-2 mb-6">
      <!-- Left: back button -->
      <router-link :to="{ name: 'space-datasets-list' }">
        <a-button size="mini" type="text" class="!text-gray-700">
          <template #icon>
            <icon-left />
          </template>
        </a-button>
      </router-link>
      <!-- Right: knowledge base info -->
      <div class="flex items-center gap-3">
        <!-- Knowledge base icon -->
        <a-avatar :size="40" shape="square" class="rounded-lg" :image-url="dataset.icon" />
        <!-- Knowledge base info -->
        <div class="flex flex-col justify-between h-[40px]">
          <a-skeleton-line v-if="!dataset?.name" :widths="[100]" />
          <div v-else class="text-gray-700">Knowledge Base / {{ dataset.name }}</div>
          <div v-if="!dataset?.name" class="flex items-center gap-2">
            <a-skeleton-line :widths="[60]" :line-height="18" />
            <a-skeleton-line :widths="[60]" :line-height="18" />
            <a-skeleton-line :widths="[60]" :line-height="18" />
          </div>
          <div v-else class="flex items-center gap-2">
            <a-tag size="small" class="rounded h-[18px] leading-[18px] bg-gray-200 text-gray-500">
              {{ dataset.document_count }} documents
            </a-tag>
            <a-tag size="small" class="rounded h-[18px] leading-[18px] bg-gray-200 text-gray-500">
              {{ dataset.hit_count }} hits
            </a-tag>
            <a-tag size="small" class="rounded h-[18px] leading-[18px] bg-gray-200 text-gray-500">
              {{ dataset.related_app_count }} linked apps
            </a-tag>
          </div>
        </div>
      </div>
    </div>
    <!-- Middle: search and retrieval test -->
    <div class="flex items-center justify-between mb-6">
      <!-- Left: search box -->
      <a-input-search
        :default-value="route.query?.search_word || ''"
        placeholder="Enter a keyword to search documents"
        class="w-[240px] bg-white rounded-lg border-gray-200"
        @search="
          (value: string) => {
            router.push({
              path: route.path,
              query: {
                search_word: value,
                current_page: 1,
              },
            })
          }
        "
      />
      <!-- Right: buttons -->
      <a-space :size="12">
        <a-button class="rounded-lg" @click="hitModalVisible = true">Retrieval Test</a-button>
        <router-link
          :to="{
            name: 'space-datasets-documents-create',
            params: { dataset_id: route.params?.dataset_id as string },
          }"
        >
          <a-button type="primary" class="rounded-lg">Add Files</a-button>
        </router-link>
      </a-space>
    </div>
    <!-- Bottom: table -->
    <div class="">
      <!-- Table content -->
      <a-table
        hoverable
        :pagination="{
          total: paginator.total_record,
          current: paginator.current_page,
          defaultCurrent: 1,
          pageSize: paginator.page_size,
          defaultPageSize: 20,
          showTotal: true,
        }"
        :loading="loading"
        :data="documents"
        :bordered="{ wrapper: false }"
        @page-change="
          (page: number) => {
            router.push({
              path: route.path,
              query: {
                current_page: page,
                search_word: route.query?.search_word || '',
              },
            })
          }
        "
      >
        <template #columns>
          <a-table-column
            title="#"
            data-index="position"
            align="center"
            :width="80"
            header-cell-class="rounded-tl-lg !bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          />
          <a-table-column
            title="Document Name"
            data-index="name"
            :width="400"
            header-cell-class="!bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          >
            <template #cell="{ record }">
              <div class="line-clamp-1">
                {{ record.name }}
              </div>
            </template>
          </a-table-column>
          <a-table-column
            title="Characters"
            data-index="character_count"
            header-cell-class="!bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          >
            <template #cell="{ record }">
              {{ (record.character_count / 1000).toFixed(1) }}k
            </template>
          </a-table-column>
          <a-table-column
            title="Hits"
            data-index="hit_count"
            header-cell-class="!bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          />
          <a-table-column
            title="Uploaded At"
            data-index="created_at"
            header-cell-class="!bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          >
            <template #cell="{ record }">
              {{ moment(record.created_at * 1000).format('YYYY-MM-DD HH:mm:ss') }}
            </template>
          </a-table-column>
          <a-table-column
            title="Status"
            data-index="enabled"
            header-cell-class="!bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700"
          >
            <template #cell="{ record }">
              <a-space>
                <div
                  v-if="record.enabled"
                  class="w-2 h-2 bg-green-500 rounded-sm border border-green-700"
                ></div>
                <div v-else class="w-2 h-2 bg-gray-500 rounded-sm border border-gray-700"></div>
                <div v-if="record.enabled" class="text-gray-700">Available</div>
                <div v-else class="text-gray-700">Disabled</div>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column
            title="Actions"
            data-index="operator"
            header-cell-class="rounded-tr-lg !bg-gray-200 text-gray-700"
            cell-class="bg-transparent text-gray-700 !h-[40px]"
            :width="100"
          >
            <template #cell="{ record, rowIndex }">
              <a-space :size="0">
                <template #split>
                  <a-divider direction="vertical" />
                </template>
                <a-tooltip
                  position="left"
                  v-if="record.status === 'error'"
                  :content="`Error: ${record.error}`"
                >
                  <a-switch size="small" type="round" :default-checked="false" disabled />
                </a-tooltip>
                <a-switch
                  v-else
                  size="small"
                  type="round"
                  :model-value="record.enabled"
                  @change="
                    (value) => {
                      handleUpdateEnabled(
                        route.params?.dataset_id as string,
                        record.id,
                        value as boolean,
                        () => {
                          // Update the status text of the matching record
                          documents[rowIndex].enabled = value
                        },
                      )
                    }
                  "
                />
                <a-dropdown position="br">
                  <a-button type="text" size="mini" class="!text-gray-700">
                    <template #icon>
                      <icon-more />
                    </template>
                  </a-button>
                  <template #content>
                    <a-doption
                      @click="
                        () => {
                          updateDocumentNameModalVisible = true
                          updateDocumentID = record.id
                        }
                      "
                      >Rename
                    </a-doption>
                    <a-doption
                      class="!text-red-700"
                      @click="
                        () =>
                          handleDelete(route.params?.dataset_id as string, record.id, async () => {
                            await loadDocuments()
                            await loadDataset(route.params?.dataset_id as string)
                          })
                      "
                    >
                      Delete
                    </a-doption>
                  </template>
                </a-dropdown>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </div>
    <!-- Update document name modal -->
    <update-document-name-modal
      :document_id="updateDocumentID"
      :dataset_id="route.params?.dataset_id as string"
      v-model:visible="updateDocumentNameModalVisible"
      :on-after-update="() => loadDocuments()"
    />
    <!-- Retrieval test modal -->
    <hit-testing-modal
      v-model:visible="hitModalVisible"
      :dataset_id="route.params?.dataset_id as string"
    />
  </div>
</template>

<style scoped></style>
