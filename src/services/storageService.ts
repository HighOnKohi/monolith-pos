import { supabase } from '@/lib/supabase'

export const MENU_STORAGE_BUCKET = 'menu-items'

/**
 * Compresses and resizes an image file or blob using an offscreen canvas.
 * Reduces raw 2-10 MB camera uploads down to an optimized 40-80 KB JPEG.
 */
export async function compressImage(
  file: File | Blob,
  maxDimension = 800,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image for compression.'))
      img.onload = () => {
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas 2D rendering context.'))
          return
        }

        // Draw and compress to JPEG blob
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Canvas toBlob failed.'))
          },
          'image/jpeg',
          quality,
        )
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a menu item image to Supabase Object Storage.
 *
 * Process:
 * 1. Compresses image to max 800px JPEG.
 * 2. Uploads binary directly to the 'menu-items' Supabase Storage bucket.
 * 3. Returns the public CDN URL to store in the database.
 */
export async function uploadMenuItemImage(
  file: File | Blob,
  fileNamePrefix = 'dish',
): Promise<string> {
  const compressedBlob = await compressImage(file, 800, 0.8)

  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const filePath = `items/${fileNamePrefix}-${timestamp}-${randomSuffix}.jpg`

  const { error } = await supabase.storage
    .from(MENU_STORAGE_BUCKET)
    .upload(filePath, compressedBlob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year browser/CDN caching
      upsert: false,
    })

  if (error) {
    console.error('[storageService] Upload failed:', error)
    if (error.message?.includes('Bucket not found')) {
      throw new Error(
        `Storage bucket '${MENU_STORAGE_BUCKET}' was not found. Please run migration 012 in Supabase SQL Editor.`,
      )
    }
    throw error
  }

  const { data: publicData } = supabase.storage
    .from(MENU_STORAGE_BUCKET)
    .getPublicUrl(filePath)

  if (!publicData?.publicUrl) {
    throw new Error('Failed to retrieve public URL from Supabase Storage.')
  }

  return publicData.publicUrl
}

/**
 * Extracts storage path from a Supabase public URL and deletes the file.
 */
export async function deleteMenuItemImage(publicUrl: string): Promise<void> {
  if (!publicUrl || !publicUrl.includes(MENU_STORAGE_BUCKET)) return

  try {
    const parts = publicUrl.split(`/${MENU_STORAGE_BUCKET}/`)
    if (parts.length < 2) return
    const filePath = decodeURIComponent(parts[1])

    await supabase.storage.from(MENU_STORAGE_BUCKET).remove([filePath])
  } catch (err) {
    console.warn('[storageService] Could not delete old image from storage:', err)
  }
}
