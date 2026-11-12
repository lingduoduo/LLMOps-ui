import { upload } from '@/utils/request'
import { type UploadFileResponse, type UploadImageResponse } from '@/models/upload-file'

// Upload image service
export const uploadImage = (image: File) => {
  // 1. Build the form and append the image data
  const formData = new FormData()
  formData.append('file', image)

  // 2. Call the upload service to upload the image
  return upload<UploadImageResponse>(`/upload-files/image`, {
    data: formData,
  })
}

// Upload file service
export const uploadFile = (file: File) => {
  // 1. Build the form and append the image data
  const formData = new FormData()
  formData.append('file', file)

  // 2. Call the upload service to upload the image
  return upload<UploadFileResponse>(`/upload-files/file`, {
    data: formData,
  })
}
