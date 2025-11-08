/**
 * Supabase Storage Utility
 *
 * Handles uploading product images to Supabase Storage instead of storing
 * base64 data URLs in the database.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const STORAGE_BUCKET = "product-images"

/**
 * Upload a base64-encoded image to Supabase Storage
 *
 * @param base64Data - Base64 string (without data URL prefix)
 * @param mimeType - Image MIME type (e.g., "image/png", "image/jpeg")
 * @param filename - Optional filename (will generate UUID if not provided)
 * @returns Public URL of the uploaded image, or null if upload fails
 */
export async function uploadProductImage(
  base64Data: string,
  mimeType: string = "image/png",
  filename?: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient()

    // Generate filename if not provided
    const fileExtension = mimeType.split("/")[1] || "png"
    const finalFilename = filename || `product-${crypto.randomUUID()}.${fileExtension}`

    // Convert base64 to binary buffer
    const buffer = Buffer.from(base64Data, "base64")

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(finalFilename, buffer, {
        contentType: mimeType,
        upsert: false, // Don't overwrite existing files
      })

    if (error) {
      console.error("[Supabase Storage] Upload failed:", error)
      return null
    }

    if (!data) {
      console.error("[Supabase Storage] No data returned from upload")
      return null
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path)

    if (!publicUrlData?.publicUrl) {
      console.error("[Supabase Storage] Failed to get public URL")
      return null
    }

    console.log("[Supabase Storage] Successfully uploaded image:", publicUrlData.publicUrl)
    return publicUrlData.publicUrl
  } catch (error) {
    console.error("[Supabase Storage] Error uploading product image:", error)
    return null
  }
}

/**
 * Delete a product image from Supabase Storage
 *
 * @param imageUrl - Public URL of the image to delete
 * @returns true if deletion succeeded, false otherwise
 */
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdminClient()

    // Extract filename from URL
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split("/")
    const filename = pathParts[pathParts.length - 1]

    if (!filename) {
      console.error("[Supabase Storage] Could not extract filename from URL:", imageUrl)
      return false
    }

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filename])

    if (error) {
      console.error("[Supabase Storage] Delete failed:", error)
      return false
    }

    console.log("[Supabase Storage] Successfully deleted image:", filename)
    return true
  } catch (error) {
    console.error("[Supabase Storage] Error deleting product image:", error)
    return false
  }
}
