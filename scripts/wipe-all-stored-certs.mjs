/**
 * Wipe All Stored Certificate PDFs from R2
 * 
 * Since certificates are now generated on-demand in the browser,
 * pre-generated PDFs in Cloudflare R2 are no longer needed.
 * 
 * Usage:
 *   node scripts/wipe-all-stored-certs.mjs              # Dry run (safe, reports count and size)
 *   node scripts/wipe-all-stored-certs.mjs --delete     # Permanently delete all objects from certificates bucket
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const R2_ACCOUNT_ID = 'a2b52c2ba93ac52eae4ead96a6fd7d3a';
const R2_ACCESS_KEY_ID = 'd5bb08b3be458cdc328ce38b40d39832';
const R2_SECRET_ACCESS_KEY = '07931118267abd2c9ecb95a9fc2a5669da7aa4cc6d0b217597ccc9d9be710cea';
const SUPABASE_URL = 'https://rgzgtzyyrbzgfgvbtxvp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnemd0enl5cmJ6Z2ZndmJ0eHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU3ODM3MCwiZXhwIjoyMDg0MTU0MzcwfQ.a68b4IKk6b_DMB9fy4QERk18mddVJhRMZwS_nolLc8w';

const BUCKET = 'certificates';
const DELETE_MODE = process.argv.includes('--delete');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listAllR2Objects() {
  const items = [];
  let continuationToken = undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    });
    const res = await s3.send(cmd);

    for (const obj of res.Contents || []) {
      if (obj.Key) {
        items.push({ key: obj.Key, size: obj.Size || 0 });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return items;
}

async function deleteInBatches(keys) {
  const batchSize = 1000;
  let deleted = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const cmd = new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: batch.map(k => ({ Key: k })),
        Quiet: true,
      },
    });

    const res = await s3.send(cmd);
    const errors = res.Errors || [];
    if (errors.length > 0) {
      console.error(`   ⚠️ Batch had ${errors.length} errors:`, errors[0]);
    }
    deleted += (batch.length - errors.length);
  }

  return deleted;
}

async function main() {
  console.log('=== Wipe Stored Certificates from R2 ===\n');
  console.log(`Mode: ${DELETE_MODE ? '🔴 LIVE DELETION' : '🟢 DRY RUN (list only)'}\n`);

  console.log('📦 Scanning R2 "certificates" bucket...');
  const objects = await listAllR2Objects();
  const totalSizeMB = objects.reduce((sum, o) => sum + o.size, 0) / (1024 * 1024);

  console.log(`   Found ${objects.length} files in bucket (${totalSizeMB.toFixed(2)} MB / ${(totalSizeMB / 1024).toFixed(3)} GB)`);

  if (objects.length === 0) {
    console.log('\n🎉 The "certificates" bucket is already completely empty (0 files, 0 MB)!');
    return;
  }

  if (!DELETE_MODE) {
    console.log('\nℹ️  To permanently delete all stored PDFs and free storage to 0 MB, run:');
    console.log('   node scripts/wipe-all-stored-certs.mjs --delete\n');
    return;
  }

  console.log(`\n🗑️  Deleting ${objects.length} files from R2...`);
  const count = await deleteInBatches(objects.map(o => o.key));
  console.log(`✅ Successfully deleted ${count} files from R2.`);

  console.log('\n🧹 Clearing pdf_url references in Supabase database...');
  const { error: dbError } = await supabase
    .from('certificates')
    .update({ pdf_url: null })
    .not('pdf_url', 'is', null);

  if (dbError) {
    console.error('   ⚠️ Warning: failed to clear pdf_url in DB:', dbError.message);
  } else {
    console.log('✅ Cleared all stale pdf_url columns in Supabase certificates table.');
  }

  console.log('\n✨ COMPLETE! Certificate storage is now 0 MB.');
}

main().catch(console.error);
