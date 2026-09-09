import { supabase } from '@/lib/supabase'
import { uploadMenuItemImage } from '@/services/storageService'

/**
 * Converts a Base64 data URL to a binary Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return new Blob([array], { type: mime })
}

export interface MigrationResult {
  totalScanned: number
  totalMigrated: number
  skipped: number
  errors: { itemId: string; error: string }[]
}

/**
 * Scans Menu_Items for embedded Base64 image strings, uploads them to Supabase Storage,
 * and replaces the Base64 strings with lightweight public CDN URLs.
 *
 * This flushes megabytes of legacy text out of PostgreSQL rows.
 */
export async function migrateExistingBase64Images(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalScanned: 0,
    totalMigrated: 0,
    skipped: 0,
    errors: [],
  }

  const { data: items, error } = await supabase
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME, ITEM_IMAGE_URL, ITEM_IMAGE')

  if (error || !items) {
    throw error ?? new Error('Failed to fetch menu items for migration.')
  }

  result.totalScanned = items.length

  for (const row of items) {
    const itemId = String(row['ITEM_ID'])
    const itemName = String(row['ITEM_NAME'] || 'dish')
    const imgUrl = (row['ITEM_IMAGE_URL'] as string | undefined) || ''
    const imgBlob = (row['ITEM_IMAGE'] as string | undefined) || ''

    const base64Data = imgUrl.startsWith('data:image/')
      ? imgUrl
      : imgBlob.startsWith('data:image/')
        ? imgBlob
        : null

    if (!base64Data) {
      result.skipped++
      continue
    }

    try {
      const blob = dataUrlToBlob(base64Data)
      const sanitizedName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const publicUrl = await uploadMenuItemImage(blob, `migrated-${sanitizedName}-${itemId}`)

      // Update row: set ITEM_IMAGE_URL to CDN URL and clear heavy ITEM_IMAGE column
      const { error: updateError } = await supabase
        .from('Menu_Items')
        .update({
          ITEM_IMAGE_URL: publicUrl,
          ITEM_IMAGE: null,
        })
        .eq('ITEM_ID', row['ITEM_ID'])

      if (updateError) throw updateError

      result.totalMigrated++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[migrateExistingImages] Failed for item #${itemId}:`, err)
      result.errors.push({ itemId, error: msg })
    }
  }

  return result
}
