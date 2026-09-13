import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Per-bucket public URLs (each R2 bucket has its own r2.dev subdomain)
const R2_DOCUMENTS_PUBLIC_URL = process.env.VITE_R2_DOCUMENTS_PUBLIC_URL;
const R2_CERTIFICATES_PUBLIC_URL = process.env.VITE_R2_CERTIFICATES_PUBLIC_URL;

// Legacy fallback: single public URL
const R2_PUBLIC_URL_FALLBACK = process.env.VITE_R2_PUBLIC_URL;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase configuration in .env.local');
  process.exit(1);
}

if (!R2_DOCUMENTS_PUBLIC_URL && !R2_CERTIFICATES_PUBLIC_URL && !R2_PUBLIC_URL_FALLBACK) {
  console.error('❌ Missing R2 public URL configuration in .env.local');
  console.error('   Set VITE_R2_DOCUMENTS_PUBLIC_URL and VITE_R2_CERTIFICATES_PUBLIC_URL');
  console.error('   Or set VITE_R2_PUBLIC_URL as a fallback');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

/**
 * Get the R2 public URL base for a given bucket.
 * Uses per-bucket URL if available, falls back to legacy single URL with bucket prefix.
 */
const BUCKET_PUBLIC_URLS = {
  documents: R2_DOCUMENTS_PUBLIC_URL,
  certificates: R2_CERTIFICATES_PUBLIC_URL,
};

function getR2BaseUrl(bucket) {
  const perBucketUrl = BUCKET_PUBLIC_URLS[bucket];
  if (perBucketUrl) {
    return perBucketUrl.replace(/\/$/, '');
  }
  // Legacy fallback: single URL with bucket name as prefix
  const fallback = (R2_PUBLIC_URL_FALLBACK || '').replace(/\/$/, '');
  return fallback ? `${fallback}/${bucket}` : '';
}

// The old Supabase storage URL pattern
const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

/**
 * Check if a URL is a Supabase storage URL (not yet migrated to R2).
 */
function isSupabaseStorageUrl(url) {
  if (!url) return false;
  return url.includes(SUPABASE_URL) && SUPABASE_STORAGE_PATTERN.test(url);
}

/**
 * Convert a Supabase storage URL to an R2 public URL.
 * 
 * Supabase format:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * 
 * R2 format (separate buckets):
 *   https://pub-<documents-id>.r2.dev/<path>      (for documents bucket)
 *   https://pub-<certificates-id>.r2.dev/<path>   (for certificates bucket)
 * 
 * @param {string} oldUrl - The old Supabase storage URL
 * @param {string} expectedBucket - The expected bucket name (e.g., 'documents', 'certificates')
 * @returns {string|null} - The new R2 public URL
 */
function convertToR2Url(oldUrl, expectedBucket) {
  try {
    const url = new URL(oldUrl);
    // Extract everything after /storage/v1/object/public/
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
    if (!match) {
      console.warn(`  ⚠️  Could not extract path from URL: ${oldUrl}`);
      return null;
    }
    const fullPath = match[1]; // e.g., "documents/appId/file.pdf"

    // Remove the bucket prefix from the path since we're now using separate buckets
    // e.g., "documents/appId/file.pdf" → "appId/file.pdf"
    let filePath = fullPath;
    if (fullPath.startsWith(`${expectedBucket}/`)) {
      filePath = fullPath.slice(expectedBucket.length + 1);
    }

    const r2BaseUrl = getR2BaseUrl(expectedBucket);
    if (!r2BaseUrl) {
      console.warn(`  ⚠️  No R2 public URL configured for bucket: ${expectedBucket}`);
      return null;
    }

    return `${r2BaseUrl}/${filePath}`;
  } catch (err) {
    console.warn(`  ⚠️  Invalid URL: ${oldUrl}`, err.message);
    return null;
  }
}

/**
 * Update URLs in the documents table.
 */
async function migrateDocumentUrls(dryRun) {
  console.log('\n📄 Processing documents table...');

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, url, file_path');

  if (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    return { total: 0, updated: 0, skipped: 0, failed: 0 };
  }

  let total = documents.length;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of documents) {
    if (!isSupabaseStorageUrl(doc.url)) {
      skipped++;
      continue;
    }

    const newUrl = convertToR2Url(doc.url, 'documents');
    if (!newUrl) {
      console.error(`  ❌ [doc ${doc.id}] Could not convert URL: ${doc.url}`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`  🔍 [DRY RUN] [doc ${doc.id}]`);
      console.log(`     Old: ${doc.url}`);
      console.log(`     New: ${newUrl}`);
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ url: newUrl })
      .eq('id', doc.id);

    if (updateError) {
      console.error(`  ❌ [doc ${doc.id}] Update failed:`, updateError.message);
      failed++;
    } else {
      console.log(`  ✅ [doc ${doc.id}] URL updated`);
      updated++;
    }
  }

  return { total, updated, skipped, failed };
}

/**
 * Update URLs in the certificates table.
 */
async function migrateCertificateUrls(dryRun) {
  console.log('\n📜 Processing certificates table...');

  const { data: certificates, error } = await supabase
    .from('certificates')
    .select('id, pdf_url');

  if (error) {
    console.error('❌ Failed to fetch certificates:', error.message);
    return { total: 0, updated: 0, skipped: 0, failed: 0 };
  }

  let total = certificates.length;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const cert of certificates) {
    if (!isSupabaseStorageUrl(cert.pdf_url)) {
      skipped++;
      continue;
    }

    const newUrl = convertToR2Url(cert.pdf_url, 'certificates');
    if (!newUrl) {
      console.error(`  ❌ [cert ${cert.id}] Could not convert URL: ${cert.pdf_url}`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`  🔍 [DRY RUN] [cert ${cert.id}]`);
      console.log(`     Old: ${cert.pdf_url}`);
      console.log(`     New: ${newUrl}`);
      updated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('certificates')
      .update({ pdf_url: newUrl })
      .eq('id', cert.id);

    if (updateError) {
      console.error(`  ❌ [cert ${cert.id}] Update failed:`, updateError.message);
      failed++;
    } else {
      console.log(`  ✅ [cert ${cert.id}] URL updated`);
      updated++;
    }
  }

  return { total, updated, skipped, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('====================================================');
  console.log('🔄 Supabase → R2 Database URL Migration Script');
  console.log('====================================================');
  console.log(`Supabase URL:        ${SUPABASE_URL}`);
  console.log(`Documents R2 URL:    ${R2_DOCUMENTS_PUBLIC_URL || `${R2_PUBLIC_URL_FALLBACK}/documents (fallback)`}`);
  console.log(`Certificates R2 URL: ${R2_CERTIFICATES_PUBLIC_URL || `${R2_PUBLIC_URL_FALLBACK}/certificates (fallback)`}`);
  console.log(`Mode:                ${dryRun ? '🔍 DRY RUN (no changes)' : '🚀 LIVE (will update DB)'}`);

  if (!dryRun) {
    console.log('\n⚠️  This will modify database records. Use --dry-run first to preview changes.');
    console.log('    Proceeding in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const docResults = await migrateDocumentUrls(dryRun);
  const certResults = await migrateCertificateUrls(dryRun);

  console.log('\n====================================================');
  console.log(`📊 Migration Summary ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('====================================================');

  console.log('\n📄 Documents:');
  console.log(`   Total records:        ${docResults.total}`);
  console.log(`   URLs to migrate:      ${docResults.updated}`);
  console.log(`   Already on R2:        ${docResults.skipped}`);
  console.log(`   Failed:               ${docResults.failed}`);

  console.log('\n📜 Certificates:');
  console.log(`   Total records:        ${certResults.total}`);
  console.log(`   URLs to migrate:      ${certResults.updated}`);
  console.log(`   Already on R2:        ${certResults.skipped}`);
  console.log(`   Failed:               ${certResults.failed}`);

  console.log('\n====================================================');

  if (dryRun && (docResults.updated > 0 || certResults.updated > 0)) {
    console.log('\n💡 To apply changes, run without --dry-run:');
    console.log('   node scripts/update-storage-urls.mjs');
  }

  if (!dryRun && docResults.updated === 0 && certResults.updated === 0 
      && docResults.failed === 0 && certResults.failed === 0) {
    console.log('\n✅ All URLs are already pointing to R2. No changes needed.');
  }
}

main();
