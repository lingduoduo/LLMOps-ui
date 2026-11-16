/* eslint-disable @typescript-eslint/no-explicit-any */
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  createDataset,
  deleteDataset,
  deleteDocument,
  getDataset,
  getDatasetsWithPage,
  getDocumentsWithPage,
  updateDataset,
  updateDocumentEnabled,
} from '@/services/dataset'
import { type FileItem, Form, Message, Modal } from '@arco-design/web-vue'

export const useGetDatasetsWithPage = () => {
  // 1. Define the data: loading state, knowledge base list, and paginator
  const route = useRoute()
  const loading = ref(false)
  const datasets = reactive<Array<any>>([])
  const defaultPaginator = {
    current_page: 1,
    page_size: 20,
    total_page: 0,
    total_record: 0,
  }
  const paginator = reactive({ ...defaultPaginator })

  // 2. Define the data loading function
  const loadDatasets = async (init: boolean = false) => {
    // 2.1 Check whether this is an initial load; if so, initialize the paginator first
    if (init) {
      initPaginator()
    } else if (paginator.current_page > paginator.total_page) {
      return
    }

    // 2.2 Load more data and update the data state
    try {
      // 2.3 Call the API to get the response data
      loading.value = true
      const resp = await getDatasetsWithPage(
        paginator.current_page,
        paginator.page_size,
        String(route.query?.search_word ?? ''),
      )
      const data = resp.data

      // 2.4 Update the paginator
      updatePaginator(data)

      // 2.5 Check whether more data exists
      if (paginator.current_page <= paginator.total_page) {
        paginator.current_page += 1
      }

      // 2.6 Append or overwrite the data
      if (init) {
        datasets.splice(0, datasets.length, ...data.list)
      } else {
        datasets.push(...data.list)
      }
    } finally {
      loading.value = false
    }
  }

  // 3. Define the paginator initialization function
  const initPaginator = () => {
    Object.assign(paginator, { ...defaultPaginator })
  }

  // 4. Define the paginator update function
  const updatePaginator = (data: any) => {
    paginator.current_page = data.paginator.current_page
    paginator.page_size = data.paginator.page_size
    paginator.total_page = data.paginator.total_page
    paginator.total_record = data.paginator.total_record
  }

  // 5. Initialize the data once the page DOM has loaded
  onMounted(async () => {
    await loadDatasets(true)
  })

  // 6. Watch for changes to the route query
  watch(
    () => route.query?.search_word,
    async () => {
      await loadDatasets(true)
    },
  )

  return { loading, datasets, paginator, loadDatasets }
}

export const useDeleteDataset = () => {
  const handleDelete = (dataset_id: string, callback?: () => void) => {
    Modal.warning({
      title: 'Delete this knowledge base?',
      content:
        'After the knowledge base is deleted, apps linked to it can no longer use it, and all prompt configurations and documents will be permanently deleted',
      hideCancel: false,
      onOk: async () => {
        try {
          // 1. After OK is clicked, send the request to the API
          const resp = await deleteDataset(dataset_id)
          Message.success(resp.message)
        } finally {
          // 2. Call the callback function to run the specified callback
          callback?.()
        }
      },
    })
  }

  return { handleDelete }
}

export const useCreateOrUpdateDataset = () => {
  // 1. Define the data needed for creating and updating
  const loading = ref(false)
  const defaultForm = {
    fileList: [] as FileItem[],
    icon: '',
    name: '',
    description: '',
  }
  const form = reactive({ ...defaultForm })
  const formRef = ref<InstanceType<typeof Form>>()
  const showUpdateModal = ref(false)

  // 2. Define the function that updates showUpdateModal
  const updateShowUpdateModal = (new_value: boolean, callback?: () => void) => {
    showUpdateModal.value = new_value
    callback?.()
  }

  // 3. Define the form submit function
  const saveDataset = async (dataset_id?: string) => {
    try {
      loading.value = true
      if (dataset_id !== undefined && dataset_id !== '') {
        const resp = await updateDataset(dataset_id, {
          icon: form.icon,
          name: form.name,
          description: form.description,
        })
        Message.success(resp.message)
      } else {
        const resp = await createDataset({
          icon: form.icon,
          name: form.name,
          description: form.description,
        })
        Message.success(resp.message)
      }
    } finally {
      loading.value = false
    }
  }

  return { loading, form, formRef, saveDataset, showUpdateModal, updateShowUpdateModal }
}

export const useGetDataset = (dataset_id: string) => {
  // 1. Define the data for the knowledge base details
  const loading = ref(false)
  const dataset = reactive<any>({})

  // 2. Define the data loading function
  const loadDataset = async (dataset_id: string) => {
    try {
      loading.value = true
      const resp = await getDataset(dataset_id)
      const data = resp.data
      Object.assign(dataset, { ...data })
    } finally {
      loading.value = false
    }
  }

  // 3. Load the data once when the page has mounted
  onMounted(() => loadDataset(dataset_id))

  return { loading, dataset, loadDataset }
}

export const useGetDocumentsWithPage = (dataset_id: string) => {
  // 1. Define the data structure for the document list
  const route = useRoute()
  const loading = ref(false)
  const documents = reactive<Array<any>>([])
  const defaultPaginator = {
    current_page: 1,
    page_size: 20,
    total_page: 0,
    total_record: 0,
  }
  const paginator = reactive({ ...defaultPaginator })

  // 2. Load the document list data
  const loadDocuments = async (init: boolean = false) => {
    // 2.1 Initial-load check and paginator logic
    if (!init && paginator.current_page > paginator.total_page) return

    try {
      // 2.2 Call the API to get the response data
      loading.value = true
      const resp = await getDocumentsWithPage(dataset_id, {
        current_page: (route.query?.current_page || 1) as number,
        page_size: (route.query?.page_size || 20) as number,
        search_word: (route.query?.search_word || '') as string,
      })
      const data = resp.data

      // 2.3 Update the paginator
      updatePaginator(data)

      // 2.4 For table + paginator pagination, the data can simply be replaced
      documents.splice(0, documents.length, ...data.list)
    } finally {
      loading.value = false
    }
  }
  // 3. Define the paginator initialization function
  const initPaginator = () => {
    Object.assign(paginator, { ...defaultPaginator })
  }

  // 4. Define the paginator update function
  const updatePaginator = (data: any) => {
    paginator.current_page = data.paginator.current_page
    paginator.page_size = data.paginator.page_size
    paginator.total_page = data.paginator.total_page
    paginator.total_record = data.paginator.total_record
  }

  // 5. Initialize the data once the page DOM has loaded
  onMounted(async () => {
    await loadDocuments(true)
  })

  // 6. Watch for changes to the route query
  watch(
    () => route.query,
    async (newQuery, oldQuery) => {
      if (newQuery.search_word !== oldQuery.search_word) {
        initPaginator()
        await loadDocuments(true)
      } else if (newQuery.current_page != oldQuery.current_page) {
        await loadDocuments()
      }
    },
  )

  return { loading, documents, paginator, loadDocuments }
}

export const useDeleteDocument = () => {
  const handleDelete = (dataset_id: string, document_id: string, callback?: () => void) => {
    Modal.warning({
      title: 'Delete this document?',
      content:
        'After the document is deleted, the knowledge base/vector database can no longer retrieve it. To temporarily stop retrieving this document, you can disable it instead',
      hideCancel: false,
      onOk: async () => {
        try {
          // 1. After OK is clicked, send the request to the API
          const resp = await deleteDocument(dataset_id, document_id)
          Message.success(resp.message)
        } finally {
          // 2. Call the callback function to run the specified callback
          callback?.()
        }
      },
    })
  }

  return { handleDelete }
}

export const useUpdateDocumentEnabled = () => {
  const handleUpdate = async (
    dataset_id: string,
    document_id: string,
    enabled: boolean,
    callback?: () => void,
  ) => {
    try {
      const resp = await updateDocumentEnabled(dataset_id, document_id, enabled)
      Message.success(resp.message)
    } finally {
      // 2. Call the callback function to run the specified callback
      callback?.()
    }
  }

  return { handleUpdate }
}
