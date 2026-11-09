import { post } from '@/utils/request'
import { type UploadImageResponse } from '@/models/upload-file'

// Upload an image and get back its URL
export const uploadImage = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return post<UploadImageResponse>('/upload-files/image', { body })
}
