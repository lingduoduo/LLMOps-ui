import { type BasePaginatorResponse, type BaseResponse } from '@/models/base'

// Response structure for the paginated knowledge base list API
export type GetDatasetsWithPageResponse = BasePaginatorResponse<{
  id: string
  name: string
  icon: string
  description: string
  document_count: number
  character_count: number
  related_app_count: number
  updated_at: number
  created_at: number
}>

// Request structure for creating a knowledge base
export type CreateDatasetRequest = {
  name: string
  icon: string
  description: string
}

// Request structure for updating a knowledge base
export type UpdateDatasetRequest = {
  name: string
  icon: string
  description: string
}

// Response structure for getting knowledge base details
export type GetDatasetResponse = BaseResponse<{
  id: string
  icon: string
  name: string
  description: string
  document_count: number
  hit_count: number
  related_app_count: number
  character_count: number
  updated_at: number
  created_at: number
}>

// Request structure for the paginated document list of a specified knowledge base
export type GetDocumentsWithPageRequest = {
  current_page: number
  page_size: number
  search_word: string
}

// Response structure for the paginated document list of a specified knowledge base
export type GetDocumentsWithPageResponse = BasePaginatorResponse<{
  id: string
  name: string
  character_count: number
  hit_count: number
  position: number
  enabled: boolean
  disabled_at: number
  status: string
  error: string
  updated_at: number
  created_at: number
}>

// Response structure for getting details of a specified document
export type GetDocumentResponse = BaseResponse<{
  id: string
  dataset_id: string
  name: string
  segment_count: number
  character_count: number
  hit_count: number
  position: number
  enabled: boolean
  disabled_at: number
  status: string
  error: string
  updated_at: number
  created_at: number
}>

// Request structure for knowledge base retrieval (hit) testing
export type HitRequest = {
  retrieval_strategy: string
  k: number
  query: string
  score: number
}

// Response structure for knowledge base retrieval (hit) testing
export type HitResponse = BaseResponse<
  Array<{
    id: string
    document: {
      id: string
      name: string
      extension: string
      mime_type: string
    }
    dataset_id: string
    score: number
    position: number
    keywords: string[]
    character_count: number
    token_count: number
    hit_count: number
    enabled: boolean
    disabled_at: number
    status: string
    error: string
    updated_at: number
    created_at: number
  }>
>

// Latest queries list for a knowledge base
export type GetDatasetQueriesResponse = BaseResponse<
  Array<{
    id: string
    query: string
    source: string
    dataset_id: string
    created_at: number
  }>
>

// Request structure for uploading a list of documents to a knowledge base
export type CreateDocumentsRequest = {
  upload_file_ids: string[]
  process_type: string
  rule: {
    pre_process_rule: {
      id: string
      enabled: boolean
    }[]
    segment: {
      separators: string[]
      chunk_size: number
      chunk_overlap: number
    }
  }
}

// Response structure for uploading a list of documents to a knowledge base
export type CreateDocumentsResponse = BaseResponse<{
  batch: string
  documents: {
    id: string
    name: string
    status: string
    created_at: string
  }[]
}>

// Response structure for getting processing progress by batch identifier
export type GetDocumentsStatusResponse = BaseResponse<
  Array<{
    id: string
    name: string
    size: number
    extension: string
    mime_type: string
    position: number
    segment_count: number
    completed_segment_count: number
    error: string
    status: string
    processing_started_at: number
    parsing_completed_at: number
    splitting_completed_at: number
    indexing_completed_at: number
    completed_at: number
    stopped_at: number
    created_at: number
  }>
>
