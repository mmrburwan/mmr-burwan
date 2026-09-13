/**
 * Cleanup Orphaned Certificate PDFs
 * 
 * This script:
 * 1. Lists ALL files in the R2 "certificates" bucket
 * 2. Fetches ALL valid pdf_url values from the Supabase "certificates" table
 * 3. Identifies orphaned files (in storage but not referenced by any DB record)
 * 4. Optionally deletes them (dry-run by default)
 * 
 * Usage:
 *   node scripts/cleanup-orphan-certs.mjs              # Dry run (list only)
 *   node scripts/cleanup-orphan-certs.mjs --delete     # Actually delete
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// ─── Config from .env.local ────────────────────────────────────────────────────
const R2_ACCOUNT_ID = 'a2b52c2ba93ac52eae4ead96a6fd7d3a';
const R2_ACCESS_KEY_ID = 'd5bb08b3be458cdc328ce38b40d39832';
const R2_SECRET_ACCESS_KEY = '07931118267abd2c9ecb95a9fc2a5669da7aa4cc6d0b217597ccc9d9be710cea';
const R2_CERTIFICATES_PUBLIC_URL = 'https://pub-d0b4d4110cb14c61b978a3374fe8fcc1.r2.dev';
const SUPABASE_URL = 'https://rgzgtzyyrbzgfgvbtxvp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnemd0enl5cmJ6Z2ZndmJ0eHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU3ODM3MCwiZXhwIjoyMDg0MTU0MzcwfQ.a68b4IKk6b_DMB9fy4QERk18mddVJhRMZwS_nolLc8w';

const BUCKET = 'certificates';
const DELETE_MODE = process.argv.includes('--delete');

// ─── Clients ───────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Step 1: List all objects in R2 bucket ──────────────────────────────────────
async function listAllR2Objects() {
  const keys = [];
  let continuationToken = undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    });
    const res = await s3.send(cmd);

    for (const obj of res.Contents || []) {
      keys.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

// ─── Step 2: Get all referenced pdf_urls from DB ────────────────────────────────
async function getReferencedPaths() {
  const { data, error } = await supabase
    .from('certificates')
    .select('pdf_url');

  if (error) {
    throw new Error(`Failed to fetch certificates from DB: ${error.message}`);
  }

  // Extract the R2 key from each pdf_url
  const referencedKeys = new Set();
  for (const row of data || []) {
    if (!row.pdf_url) continue;
    try {
      const url = new URL(row.pdf_url);
      // R2 public URL format: https://pub-xxx.r2.dev/{key}
      // Supabase format: .../storage/v1/object/public/certificates/{key}
      let key;
      if (url.pathname.includes('/storage/v1/object/public/certificates/')) {
        key = url.pathname.split('/storage/v1/object/public/certificates/')[1];
      } else {
        // R2 public URL — the path after the leading slash IS the key
        key = url.pathname.replace(/^\//, '');
      }
      if (key) referencedKeys.add(decodeURIComponent(key));
    } catch {
      // Can't parse URL, skip
    }
  }

  return referencedKeys;
}

// ─── Step 3: Delete orphaned objects ────────────────────────────────────────────
async function deleteOrphans(orphanKeys) {
  // R2 DeleteObjects supports max 1000 keys per request
  const batchSize = 1000;
  let deleted = 0;

  for (let i = 0; i < orphanKeys.length; i += batchSize) {
    const batch = orphanKeys.slice(i, i + batchSize);
    const cmd = new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
      },
    });
    const res = await s3.send(cmd);
    deleted += (res.Deleted || []).length;
    console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${(res.Deleted || []).length} files`);
  }

  // Also try deleting from Supabase storage as fallback
  try {
    const batchSb = 100;
    for (let i = 0; i < orphanKeys.length; i += batchSb) {
      const batch = orphanKeys.slice(i, i + batchSb);
      await supabase.storage.from(BUCKET).remove(batch);
    }
  } catch {}

  return deleted;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Certificate Storage Cleanup ===\n');
  console.log(`Mode: ${DELETE_MODE ? '🔴 DELETE (will remove files!)' : '🟢 DRY RUN (list only)'}\n`);

  // Step 1
  console.log('📦 Listing all files in R2 "certificates" bucket...');
  const allObjects = await listAllR2Objects();
  console.log(`   Found ${allObjects.length} files in storage.\n`);

  if (allObjects.length === 0) {
    console.log('✅ Bucket is empty. Nothing to clean up.');
    return;
  }

  // Step 2
  console.log('🗃️  Fetching referenced certificate URLs from database...');
  const referencedKeys = await getReferencedPaths();
  console.log(`   Found ${referencedKeys.size} certificates in database.\n`);

  // Step 3: Compare
  const orphans = allObjects.filter(obj => !referencedKeys.has(obj.key));
  const validFiles = allObjects.filter(obj => referencedKeys.has(obj.key));

  const orphanSizeBytes = orphans.reduce((sum, obj) => sum + (obj.size || 0), 0);
  const orphanSizeMB = (orphanSizeBytes / (1024 * 1024)).toFixed(2);

  console.log('📊 Results:');
  console.log(`   ✅ Valid files (referenced in DB):   ${validFiles.length}`);
  console.log(`   ❌ Orphaned files (NOT in DB):       ${orphans.length}`);
  console.log(`   💾 Orphan storage used:              ${orphanSizeMB} MB\n`);

  if (orphans.length === 0) {
    console.log('✅ No orphaned files found. Storage is clean!');
    return;
  }

  // List orphaned files
  console.log('📝 Orphaned files:');
  for (const obj of orphans) {
    const sizeMB = ((obj.size || 0) / (1024 * 1024)).toFixed(2);
    const date = obj.lastModified ? new Date(obj.lastModified).toISOString().split('T')[0] : 'unknown';
    console.log(`   - ${obj.key}  (${sizeMB} MB, ${date})`);
  }
  console.log();

  if (DELETE_MODE) {
    console.log('🗑️  Deleting orphaned files...');
    const deletedCount = await deleteOrphans(orphans.map(o => o.key));
    console.log(`\n✅ Deleted ${deletedCount} orphaned files. Freed ~${orphanSizeMB} MB.`);
  } else {
    console.log('ℹ️  This was a DRY RUN. To actually delete, run:');
    console.log('   node scripts/cleanup-orphan-certs.mjs --delete');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
