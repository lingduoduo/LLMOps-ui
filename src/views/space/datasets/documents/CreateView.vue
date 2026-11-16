<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { uploadFile } from '@/services/upload-file'
import { createDocuments, getDocumentsStatus } from '@/services/dataset'
import { type Form, Message } from '@arco-design/web-vue'
import { unescapeString } from '@/utils/helper'

// 1. Define the base page data: timer, route, current step, form data and API loading state
let timer: any = null // Timer, empty by default
let batch = '' // Batch identifier
const route = useRoute()
const currentStep = ref(1)
const createDocumentsForm = reactive({
  file_list: [] as any[], // Uploaded file list
  process_type: 'automatic', // Processing type
  rule: {
    separators: ['\\n'],
    chunk_size: 500,
    chunk_overlap: 50,
    pre_process_rules: [] as string[],
  },
})
const customRuleFormRef = ref<InstanceType<typeof Form>>()
const createDocumentsLoading = ref(false)
const documents = reactive<Array<any>>([])
let fetchCount = 0
// Set when polling stops at the request limit while documents are still processing
const pollingTimedOut = ref(false)
// The backend only accepts a chunk overlap of up to half the max segment length
const maxChunkOverlap = computed(() => Math.floor((createDocumentsForm.rule.chunk_size ?? 0) * 0.5))

// 2. Define the next-step handler
const nextStep = async () => {
  // 2.1 Check which step we are on and run the matching checks
  if (currentStep.value === 1) {
    // 2.2 Check that files were uploaded; if not, block the next step and show a message
    if (createDocumentsForm.file_list.length === 0) {
      Message.error('Please upload the files to process')
      return
    }
    // 2.3 Check that no file failed to upload
    if (createDocumentsForm.file_list.some((fileItem) => fileItem.status === 'error')) {
      Message.error('Remove the files that failed to upload before continuing')
      return
    }
    // 2.4 Check that the files have finished uploading
    const isUploaded = createDocumentsForm.file_list.every(
      (fileItem) => fileItem.response?.data?.id,
    )
    if (!isUploaded) {
      Message.warning('Files are still uploading, please wait')
      return
    }

    // 2.4 Go to the next step
    currentStep.value++
  } else {
    // 2.4 We are on step 2; check that the form is valid
    if (createDocumentsForm.process_type === 'custom') {
      // 2.5 Validate the form data and stop if there are errors
      const errors = await customRuleFormRef.value?.validate()
      if (errors) return
    }

    // 2.6 If validation passed or the rule is automatic, continue
    try {
      // 2.7 Set the loading state to true and build the request data
      createDocumentsLoading.value = true
      const req: any = {
        upload_file_ids: createDocumentsForm.file_list.map((fileItem) => fileItem.response.data.id),
        process_type: createDocumentsForm.process_type,
      }

      // 2.8 If the processing type is custom, add the processing rule
      if (createDocumentsForm.process_type === 'custom') {
        // Convert escaped separators to their unescaped form
        req.rule = {
          pre_process_rules: [
            {
              id: 'remove_extra_space',
              enabled: createDocumentsForm.rule.pre_process_rules.includes('remove_extra_space'),
            },
            {
              id: 'remove_url_and_email',
              enabled: createDocumentsForm.rule.pre_process_rules.includes('remove_url_and_email'),
            },
          ],
          segment: {
            separators: createDocumentsForm.rule.separators.map((separator) =>
              unescapeString(separator),
            ),
            chunk_size: createDocumentsForm.rule.chunk_size,
            chunk_overlap: createDocumentsForm.rule.chunk_overlap,
          },
        }
      }

      // 2.8 Send the request and get the processing batch
      const resp = await createDocuments(route.params?.dataset_id as string, req)
      batch = resp.data.batch

      // 2.9 Fetch the document status once, then start the timer
      await fetDocumentsStatus()
      startTimer()

      // Documents were created for processing, go to the next step
      currentStep.value++
    } finally {
      createDocumentsLoading.value = false
    }
  }
}

// 3. Define the function that fetches the document status
const fetDocumentsStatus = async () => {
  // 3.1 Call the API to get the document status data
  fetchCount++
  const resp = await getDocumentsStatus(route.params?.dataset_id as string, batch)
  const data = resp.data

  // 3.2 Sync the document status data
  documents.splice(0, documents.length, ...data)

  // 3.3 Stop once every document is done (completed or failed)
  const isCompleted = data.every(
    (document) => document.status === 'completed' || document.status === 'error',
  )
  if (isCompleted) {
    stopTimer()
    return
  }

  // 3.4 Stop if the request count exceeds the limit, and tell the user
  if (fetchCount >= 30) {
    stopTimer()
    pollingTimedOut.value = true
  }
}

// 5. Define the function that starts the timer
const startTimer = () => (timer = setInterval(fetDocumentsStatus, 5000))

// 6. Define the function that stops the timer
const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// 7. Clear the timer when the page unmounts
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Back button and title -->
    <div class="flex items-center mb-6 gap-4">
      <!-- Left: back button -->
      <router-link
        :to="{
          name: 'space-datasets-documents-list',
          params: { dataset_id: route.params?.dataset_id as string },
        }"
      >
        <a-button size="mini" type="text" class="!text-gray-700">
          <template #icon>
            <icon-left />
          </template>
        </a-button>
      </router-link>
      <div class="text-lg font-bold text-gray-700">Add Files</div>
    </div>
    <!-- Steps -->
    <div class="w-[520px] mx-auto">
      <a-steps :current="currentStep">
        <a-step>Upload</a-step>
        <a-step>Segment Settings</a-step>
        <a-step>Data Processing</a-step>
      </a-steps>
    </div>
    <!-- Step pages -->
    <div class="min-h-[calc(100vh-160px)] p-[48px]">
      <!-- Upload page -->
      <div v-if="currentStep === 1" class="">
        <!-- Upload files button -->
        <a-upload
          v-model:file-list="createDocumentsForm.file_list"
          draggable
          accept=".doc,.docx,.pdf,.txt,.md,.markdown,.html,.htm,.xlsx,.xls,.csv"
          :limit="10"
          multiple
          tip="Supports PDF, TXT, DOC, DOCX, MD, HTML, XLSX, XLS and CSV. Upload up to 10 files, each no larger than 15MB"
          :custom-request="
            (async (option: any) => {
              // 1. Extract the file item and the success and error callbacks from the options
              const { fileItem, onSuccess, onError } = option

              // 2. Call the API to upload the file and add the data; mark the file failed on error
              try {
                const resp = await uploadFile(fileItem.file)
                onSuccess(resp)
              } catch (error) {
                onError(error)
                Message.error(
                  `${fileItem.name}: ${error instanceof Error ? error.message : 'Upload failed'}`,
                )
              }
            }) as any
          "
        />
      </div>
      <!-- Segment settings page -->
      <div v-else-if="currentStep === 2" class="">
        <!-- Automatic segmentation and cleaning -->
        <div
          :class="`px-5 py-4 bg-white rounded-lg border cursor-pointer mb-4 hover:border-blue-700 ${createDocumentsForm.process_type === 'automatic' ? 'border-blue-700' : ''}`"
          @click="createDocumentsForm.process_type = 'automatic'"
        >
          <div class="font-bold text-gray-700 mb-2">Automatic Segmentation and Cleaning</div>
          <div class="text-gray-500">Automatic segmentation and preprocessing rules</div>
        </div>
        <!-- Custom -->
        <div
          :class="`px-5 py-4 bg-white rounded-lg border cursor-pointer hover:border-blue-700 ${createDocumentsForm.process_type === 'custom' ? 'border-blue-700' : ''}`"
          @click="createDocumentsForm.process_type = 'custom'"
        >
          <div class="font-bold text-gray-700 mb-2">Custom</div>
          <div class="text-gray-500">
            Custom segmentation rules, segment length and preprocessing rules
          </div>
          <!-- Custom form -->
          <div v-if="createDocumentsForm.process_type === 'custom'" class="">
            <a-divider />
            <!-- Form options -->
            <a-form :model="createDocumentsForm.rule" ref="customRuleFormRef" layout="vertical">
              <a-form-item
                field="separators"
                label="Segment Separators"
                asterisk-position="end"
                :rules="[{ required: true, message: 'Segment separators cannot be empty' }]"
              >
                <a-input-tag
                  v-model:model-value="createDocumentsForm.rule.separators"
                  placeholder="Enter a segment separator and press Enter"
                />
              </a-form-item>
              <a-form-item
                field="chunk_size"
                label="Max Segment Length"
                required
                asterisk-position="end"
                :rules="[{ required: true, message: 'Max segment length cannot be empty' }]"
              >
                <a-input-number
                  v-model:model-value="createDocumentsForm.rule.chunk_size"
                  :min="100"
                  :max="1000"
                  :step="1"
                  :default-value="500"
                  placeholder="Enter a number from 100 to 1000"
                />
              </a-form-item>
              <a-form-item
                field="chunk_overlap"
                label="Chunk Overlap"
                required
                asterisk-position="end"
                :rules="[{ required: true, message: 'Chunk overlap cannot be empty' }]"
              >
                <a-input-number
                  v-model:model-value="createDocumentsForm.rule.chunk_overlap"
                  :min="0"
                  :max="maxChunkOverlap"
                  :step="1"
                  :default-value="50"
                  :placeholder="`Enter a number from 0 to ${maxChunkOverlap}`"
                />
              </a-form-item>
              <a-form-item field="pre_process_rules" label="Text Preprocessing Rules">
                <a-checkbox-group
                  v-model:model-value="createDocumentsForm.rule.pre_process_rules"
                  direction="vertical"
                >
                  <a-checkbox value="remove_extra_space">
                    Replace consecutive spaces, newlines and tabs
                  </a-checkbox>
                  <a-checkbox value="remove_url_and_email"
                    >Remove all URLs and email addresses</a-checkbox
                  >
                </a-checkbox-group>
              </a-form-item>
            </a-form>
          </div>
        </div>
      </div>
      <!-- Data processing page -->
      <div v-else class="">
        <!-- Data processing status message -->
        <div class="text-gray-900 mb-4 text-base">The server is processing</div>
        <!-- Shown when polling stopped before every document finished -->
        <a-alert v-if="pollingTimedOut" type="warning" class="mb-4 rounded-lg">
          Processing is taking longer than expected, so this page stopped updating. Check the
          documents list for the latest status.
        </a-alert>
        <!-- Documents being processed -->
        <div class="flex flex-col gap-2">
          <div
            v-for="document in documents"
            :key="document.id"
            class="flex items-center justify-between px-4 py-3 bg-white rounded-lg border"
          >
            <!-- Left: file info -->
            <div class="flex items-center gap-2.5">
              <a-avatar shape="square" class="bg-blue-700" :size="32">
                <icon-file />
              </a-avatar>
              <div class="">
                <div class="text-gray-700">{{ document.name }}</div>
                <div class="text-gray-500">{{ (document.size / 1024).toFixed(2) }}kb</div>
              </div>
            </div>
            <!-- Processing percentage -->
            <div v-if="document.status === 'completed'" class="text-gray-500">Completed</div>
            <div v-else-if="document.status === 'error'" class="text-red-700">Failed</div>
            <div v-else-if="document.segment_count === 0" class="text-gray-500">0%</div>
            <div v-else class="text-gray-500">
              {{ ((document.completed_segment_count / document.segment_count) * 100).toFixed(2) }}%
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Buttons: previous and next step -->
    <div class="flex items-center justify-between px-[48px]">
      <div class=""></div>
      <div class="flex items-center gap-2">
        <a-button
          v-if="currentStep == 2"
          class="rounded-lg"
          @click="
            () => {
              if (currentStep > 1) currentStep--
            }
          "
        >
          Previous
        </a-button>
        <a-button
          :loading="createDocumentsLoading"
          v-if="currentStep <= 2"
          type="primary"
          class="rounded-lg"
          @click="nextStep"
        >
          Next
        </a-button>
        <!-- Content shown on the data processing page -->
        <div v-if="currentStep === 3" class="flex items-center gap-2">
          <div class="text-gray-500">
            Clicking OK does not affect processing; the documents can be used once processing
            finishes
          </div>
          <router-link
            :to="{
              name: 'space-datasets-documents-list',
              params: { dataset_id: route.params?.dataset_id as string },
            }"
          >
            <a-button type="primary" class="rounded-lg">OK</a-button>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
