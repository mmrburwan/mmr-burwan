import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from './supabase';

// R2 Configuration from environment variables
const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;

// Per-bucket public URLs (each R2 bucket has its own r2.dev subdomain)
const R2_DOCUMENTS_PUBLIC_URL = import.meta.env.VITE_R2_DOCUMENTS_PUBLIC_URL;
const R2_CERTIFICATES_PUBLIC_URL = import.meta.env.VITE_R2_CERTIFICATES_PUBLIC_URL;

// Legacy fallback: single public URL (used if per-bucket URLs are not set)
const R2_PUBLIC_URL_FALLBACK = import.meta.env.VITE_R2_PUBLIC_URL;

// Validate required environment variables
if (!R2_ACCOUNT_ID) {
  console.warn('Missing VITE_R2_ACCOUNT_ID environment variable');
}
if (!R2_ACCESS_KEY_ID) {
  console.warn('Missing VITE_R2_ACCESS_KEY_ID environment variable');
}
if (!R2_SECRET_ACCESS_KEY) {
  console.warn('Missing VITE_R2_SECRET_ACCESS_KEY environment variable');
}

// Create S3-compatible client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Map of logical bucket names to their public r2.dev URLs.
 * Each R2 bucket has its own public subdomain.
 */
const BUCKET_PUBLIC_URLS: Record<string, string | undefined> = {
  documents: R2_DOCUMENTS_PUBLIC_URL,
  certificates: R2_CERTIFICATES_PUBLIC_URL,
};

/**
 * Get the public URL base for a given bucket.
 * Falls back to the legacy single public URL with bucket prefix if per-bucket URL is not configured.
 */
function getPublicUrlBase(bucket: string): string {
  const perBucketUrl = BUCKET_PUBLIC_URLS[bucket];
  if (perBucketUrl) {
    return perBucketUrl.replace(/\/$/, '');
  }
  // Legacy fallback: single URL with bucket name as prefix
  const fallback = R2_PUBLIC_URL_FALLBACK?.replace(/\/$/, '') || '';
  return fallback ? `${fallback}/${bucket}` : '';
}

/**
 * Upload a file to Cloudflare R2.
 * The bucket parameter maps directly to the actual R2 bucket name.
 * @param bucket - The R2 bucket name (e.g., 'documents', 'certificates')
 * @param path - The file path within the bucket (e.g., 'appId/1234.pdf')
 * @param file - The file to upload (File or Blob)
 * @param options - Upload options
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { cacheControl?: string; contentType?: string; upsert?: boolean }
): Promise<{ publicUrl: string; storageType: 'r2' | 'supabase' }> {
  // 1. Try Cloudflare R2 first if credentials are configured
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: new Uint8Array(arrayBuffer),
        ContentType: options?.contentType || (file instanceof File ? file.type : 'application/octet-stream'),
        CacheControl: options?.cacheControl || '3600',
      });

      await s3Client.send(command);
      return { publicUrl: getPublicUrl(bucket, path), storageType: 'r2' };
    } catch (r2Error: any) {
      console.warn(`[Storage] R2 upload failed for ${bucket}/${path} (likely CORS or network error). Falling back to Supabase Storage:`, r2Error);
    }
  }

  // 2. Fallback to Supabase Storage
  const { data: uploadData, error: supabaseError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: options?.cacheControl || '3600',
      upsert: options?.upsert ?? false,
    });

  if (supabaseError) {
    throw new Error(supabaseError.message);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: urlData.publicUrl, storageType: 'supabase' };
}

/**
 * Delete a single file from Cloudflare R2.
 * @param bucket - The R2 bucket name
 * @param path - The file path within the bucket
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: path,
  });

  await s3Client.send(command);
}

/**
 * Delete multiple files from Cloudflare R2.
 * @param bucket - The R2 bucket name
 * @param paths - Array of file paths within the bucket
 */
export async function deleteFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  // Try R2
  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: paths.map(path => ({ Key: path })),
      },
    });
    await s3Client.send(command);
  } catch (err) {
    console.warn(`[Storage] R2 delete failed for ${bucket}, attempting Supabase delete:`, err);
  }

  // Also remove from Supabase in case file was stored there
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch {}
}

/**
 * Get the public URL for a file in Cloudflare R2.
 * Uses the per-bucket public URL (each R2 bucket has its own r2.dev subdomain).
 * @param bucket - The R2 bucket name
 * @param path - The file path within the bucket
 * @returns The public URL string
 */
export function getPublicUrl(bucket: string, path: string): string {
  const baseUrl = getPublicUrlBase(bucket);
  return `${baseUrl}/${path}`;
}

/**
 * Create a pre-signed URL for temporary access to a file.
 * @param bucket - The R2 bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns The signed URL string
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: path,
  });

  const signedUrl = await awsGetSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

/**
 * Storage utility object that provides a Supabase-like API for easier migration.
 * Usage: storage.from('documents').upload(path, file)
 *
 * The bucket name passed to .from() maps directly to the actual R2 bucket name,
 * matching the same structure as Supabase storage buckets.
 */
export const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File | Blob, options?: { cacheControl?: string; upsert?: boolean }) {
        try {
          const result = await uploadFile(bucket, path, file, options);
          return { data: { path, publicUrl: result.publicUrl, storageType: result.storageType }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async remove(paths: string[]) {
        try {
          await deleteFiles(bucket, paths);
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: getPublicUrl(bucket, path) } };
      },
      async createSignedUrl(path: string, expiresIn: number = 3600) {
        const cleanPath = path.replace(/^\/+/, '');

        // 1. Check if the file is in Supabase Storage first.
        // Supabase validates against storage.objects in the DB and returns a signed URL
        // only if the file exists and the user has permission.
        try {
          const { data: sbData, error: sbError } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, expiresIn);
          if (!sbError && sbData?.signedUrl) {
            const url = sbData.signedUrl.startsWith('http')
              ? sbData.signedUrl
              : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${sbData.signedUrl.startsWith('/') ? '' : '/'}${sbData.signedUrl}`;
            return { data: { signedUrl: url }, error: null };
          }
        } catch (sbErr) {
          // If Supabase check fails, fall through to R2
        }

        // 2. If not found in Supabase Storage, fall back to Cloudflare R2 presigned URL
        try {
          if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
            const signedUrl = await createSignedUrl(bucket, cleanPath, expiresIn);
            return { data: { signedUrl }, error: null };
          }
        } catch (error) {
          return { data: null, error };
        }

        return { data: null, error: new Error('Failed to create signed URL') };
      },
    };
  },
};

