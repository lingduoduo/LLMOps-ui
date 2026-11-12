<script setup lang="ts">
import {
  useCreateOrUpdateDataset,
  useDeleteDataset,
  useGetDatasetsWithPage,
} from '@/hooks/use-dataset'
import { getDataset } from '@/services/dataset'
import { uploadImage } from '@/services/upload-file'
import moment from 'moment'
import type { RequestOption, UploadRequest, ValidatedError } from '@arco-design/web-vue'

let updateDatasetID = ''
const props = defineProps({
  createType: {
    type: String,
    required: true,
  },
})
const emits = defineEmits(['update-create-type'])
const { loading, datasets, paginator, loadDatasets } = useGetDatasetsWithPage()
const {
  loading: submitLoading,
  form,
  formRef,
  saveDataset,
  showUpdateModal,
  updateShowUpdateModal,
} = useCreateOrUpdateDataset()
const { handleDelete } = useDeleteDataset()

// Scroll pagination handler
const handleScroll = async (event: UIEvent) => {
  // 1. Get the scroll distance, the maximum scrollable distance, and the client/browser window height
  const { scrollTop, scrollHeight, clientHeight } = event.target as HTMLElement

  // 2. Check whether it has scrolled to the bottom
  if (scrollTop + clientHeight >= scrollHeight - 10) {
    if (loading.value) {
      return
    }
    await loadDatasets()
  }
}

// Edit knowledge base handler
const handleUpdate = (dataset_id: string) => {
  updateShowUpdateModal(true, async () => {
    // 1. Call the API to get the knowledge base details
    const resp = await getDataset(dataset_id)
    const data = resp.data
    updateDatasetID = dataset_id

    // 2. Update the form data
    formRef.value?.resetFields()
    form.fileList = [{ uid: '1', name: 'Knowledge base icon', url: data.icon }]
    form.icon = data.icon
    form.name = data.name
    form.description = data.description
  })
}

// Cancel and hide the modal
const handleCancel = () => {
  updateShowUpdateModal(false, async () => {
    // 1. Reset all form data
    updateDatasetID = ''
    formRef.value?.resetFields()

    // 2. Hide the form modal
    emits('update-create-type', '')
  })
}

// Upload the knowledge base icon
const handleUploadIcon = (option: RequestOption): UploadRequest => {
  const { fileItem, onSuccess, onError } = option
  if (!fileItem.file) {
    onError(new Error('No file selected'))
    return {}
  }
  uploadImage(fileItem.file)
    .then((resp) => {
      form.icon = resp.data.image_url
      onSuccess(resp)
    })
    .catch((error) => onError(error))
  return {}
}

// Clear the icon when the uploaded image is removed
const handleRemoveIcon = async () => {
  form.icon = ''
  return true
}

// Submit the modal
const handleSubmit = async ({ errors }: { errors: Record<string, ValidatedError> | undefined }) => {
  // 1. Return immediately if there are errors
  if (errors) return

  // 2. Call the save knowledge base service
  await saveDataset(updateDatasetID)

  // 3. Close the modal and refresh the data
  handleCancel()
  await loadDatasets(true)
}
</script>

<template>
  <a-spin
    :loading="loading"
    class="block h-full w-full scrollbar-w-none overflow-scroll"
    @scroll="handleScroll"
  >
    <!-- Knowledge base list -->
    <a-row :gutter="[20, 20]" class="flex-1">
      <!-- UI state with data -->
      <a-col v-for="dataset in datasets" :key="dataset.id" :span="6">
        <a-card hoverable class="cursor-pointer rounded-lg">
          <!-- Top: knowledge base name -->
          <div class="flex items-center gap-3 mb-3">
            <!-- Left: icon -->
            <a-avatar :size="40" shape="square" :image-url="dataset.icon" />
            <!-- Right: knowledge base info -->
            <div class="flex flex-1 justify-between">
              <div class="flex flex-col">
                <router-link
                  :to="{
                    name: 'space-datasets-documents-list',
                    params: { dataset_id: dataset.id },
                  }"
                  class="text-base text-gray-900 font-bold"
                  >{{ dataset.name }}
                </router-link>
                <div class="text-xs text-gray-500 line-clamp-1">
                  {{ dataset.document_count }} documents ·
                  {{ Math.round(dataset.character_count / 1000) }}k characters ·
                  {{ dataset.related_app_count }} linked apps
                </div>
              </div>
              <!-- Action buttons -->
              <a-dropdown position="br">
                <a-button type="text" size="small" class="rounded-lg !text-gray-700">
                  <template #icon>
                    <icon-more />
                  </template>
                </a-button>
                <template #content>
                  <a-doption @click="() => handleUpdate(dataset.id)">Settings</a-doption>
                  <a-doption
                    class="!text-red-500"
                    @click="() => handleDelete(dataset.id, () => loadDatasets(true))"
                  >
                    Delete
                  </a-doption>
                </template>
              </a-dropdown>
            </div>
          </div>
          <!-- Knowledge base description -->
          <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2">
            {{ dataset.description }}
          </div>
          <!-- Knowledge base owner info -->
          <div class="flex items-center gap-1.5">
            <a-avatar :size="18" class="bg-blue-700">
              <icon-user />
            </a-avatar>
            <div class="text-xs text-gray-400">
              LLMOps · Edited
              {{ moment(dataset.created_at * 1000).format('MM-DD HH:mm') }}
            </div>
          </div>
        </a-card>
      </a-col>
      <!-- UI state without data -->
      <a-col v-if="datasets.length === 0" :span="24">
        <a-empty
          description="No knowledge bases available"
          class="h-[400px] flex flex-col items-center justify-center"
        />
      </a-col>
    </a-row>
    <!-- Loader -->
    <a-row v-if="paginator.total_page >= 2">
      <!-- Loading data -->
      <a-col v-if="paginator.current_page <= paginator.total_page" :span="24" align="center">
        <a-space class="my-4">
          <a-spin />
          <div class="text-gray-400">Loading</div>
        </a-space>
      </a-col>
      <!-- Data fully loaded -->
      <a-col v-else :span="24" align="center">
        <div class="text-gray-400 my-4">All data loaded</div>
      </a-col>
    </a-row>
    <!-- Create/update modal -->
    <a-modal
      :width="520"
      :visible="props.createType === 'dataset' || showUpdateModal"
      hide-title
      :footer="false"
      modal-class="rounded-xl"
      @cancel="handleCancel"
    >
      <!-- Top title -->
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold text-gray-700">
          {{ props.createType === 'dataset' ? 'Create' : 'Update' }} Knowledge Base
        </div>
        <a-button type="text" class="!text-gray-700" size="small" @click="handleCancel">
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </div>
      <!-- Middle form -->
      <div class="pt-6">
        <a-form ref="formRef" :model="form" @submit="handleSubmit" layout="vertical">
          <a-form-item
            field="fileList"
            hide-label
            :rules="[{ required: true, message: 'The knowledge base icon cannot be empty' }]"
          >
            <a-upload
              :limit="1"
              list-type="picture-card"
              accept="image/png, image/jpeg"
              class="!w-auto mx-auto"
              v-model:file-list="form.fileList"
              image-preview
              :custom-request="handleUploadIcon"
              :on-before-remove="handleRemoveIcon"
            />
          </a-form-item>
          <a-form-item
            field="name"
            label="Knowledge base name"
            asterisk-position="end"
            :rules="[{ required: true, message: 'The knowledge base name cannot be empty' }]"
          >
            <a-input
              v-model="form.name"
              placeholder="Enter a knowledge base name"
              show-word-limit
              :max-length="60"
            />
          </a-form-item>
          <a-form-item
            field="description"
            label="Knowledge base description"
            asterisk-position="end"
          >
            <a-textarea
              v-model="form.description"
              :auto-size="{ minRows: 4, maxRows: 6 }"
              placeholder="Enter a description of the knowledge base content"
            />
          </a-form-item>
          <!-- Bottom buttons -->
          <div class="flex items-center justify-between">
            <div class=""></div>
            <a-space :size="16">
              <a-button class="rounded-lg" @click="handleCancel">Cancel</a-button>
              <a-button
                :loading="submitLoading"
                type="primary"
                html-type="submit"
                class="rounded-lg"
              >
                Save
              </a-button>
            </a-space>
          </div>
        </a-form>
      </div>
    </a-modal>
  </a-spin>
</template>

<style scoped></style>
