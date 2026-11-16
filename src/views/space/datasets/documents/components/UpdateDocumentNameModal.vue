<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { type Form, Message } from '@arco-design/web-vue'
import { getDocument, updateDocumentName } from '@/services/dataset'

// 1. Define the component props and the v-model visible state
const props = defineProps<{
  dataset_id: string
  document_id: string
  visible: boolean
  onAfterUpdate?: () => void
}>()
const emits = defineEmits(['update:visible'])
const loading = ref(false)
const form = reactive({ name: '' })
const formRef = ref<InstanceType<typeof Form>>()

// 2. Close the modal and reset the form
const handleCancel = () => {
  formRef.value?.resetFields()
  emits('update:visible', false)
}

// 3. Validate the form, save the new name, then run the callback
const handleSubmit = async () => {
  const errors = await formRef.value?.validate()
  if (errors) return

  try {
    loading.value = true
    const resp = await updateDocumentName(props.dataset_id, props.document_id, form.name)
    Message.success(resp.message)
    handleCancel()
    props.onAfterUpdate?.()
  } finally {
    loading.value = false
  }
}

// 4. Load the current document name each time the modal opens
watch(
  () => props.visible,
  async (visible) => {
    if (!visible || !props.document_id) return
    const resp = await getDocument(props.dataset_id, props.document_id)
    form.name = resp.data.name
  },
)
</script>

<template>
  <a-modal
    :width="520"
    :visible="props.visible"
    hide-title
    :footer="false"
    modal-class="rounded-xl"
    @cancel="handleCancel"
  >
    <!-- Top title -->
    <div class="flex items-center justify-between">
      <div class="text-lg font-bold text-gray-700">Rename Document</div>
      <a-button type="text" class="!text-gray-700" size="small" @click="handleCancel">
        <template #icon>
          <icon-close />
        </template>
      </a-button>
    </div>
    <!-- Middle form -->
    <div class="pt-6">
      <a-form ref="formRef" :model="form" layout="vertical" @submit="handleSubmit">
        <a-form-item
          field="name"
          label="Document Name"
          asterisk-position="end"
          :rules="[{ required: true, message: 'The document name cannot be empty.' }]"
        >
          <a-input
            id="document-name"
            v-model="form.name"
            placeholder="Enter the document name"
            show-word-limit
            :max-length="100"
          />
        </a-form-item>
        <!-- Bottom buttons -->
        <div class="flex items-center justify-end">
          <a-space :size="16">
            <a-button class="rounded-lg" @click="handleCancel">Cancel</a-button>
            <a-button :loading="loading" type="primary" html-type="submit" class="rounded-lg">
              Save
            </a-button>
          </a-space>
        </div>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped></style>
