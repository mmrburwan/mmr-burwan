import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Allow using service role key from env or fallback to anon key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const R2_ACCOUNT_ID = process.env.VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase configuration in .env.local');
  process.exit(1);
}

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing R2 configuration in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Check if object already exists in R2.
 * Uses the Supabase bucket name as the R2 bucket name (separate buckets).
 */
async function objectExistsInR2(r2Bucket, key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: r2Bucket,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return false;
  }
}

/**
 * Recursively list all files in a Supabase storage bucket
 */
async function listAllFiles(bucket, folder = '') {
  let fileList = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const itemPath = folder ? `${folder}/${item.name}` : item.name;

      if (item.id === null) {
        // It's a folder / prefix, recurse into it
        const subFiles = await listAllFiles(bucket, itemPath);
        fileList.push(...subFiles);
      } else {
        // It's a file
        fileList.push({
          bucket,
          path: itemPath,
          name: item.name,
          metadata: item.metadata,
        });
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return fileList;
}

/**
 * Determine content type from filename
 */
function getContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

async function migrate() {
  console.log('====================================================');
  console.log('🚀 Supabase Storage → Cloudflare R2 Migration Script');
  console.log('====================================================');
  console.log(`Supabase URL:   ${SUPABASE_URL}`);
  console.log(`R2 Account:     ${R2_ACCOUNT_ID}`);
  console.log(`Strategy:       Separate R2 buckets (documents, certificates)\n`);

  // Verify R2 connection first using one of the buckets
  try {
    console.log('Testing R2 connection...');
    await objectExistsInR2('documents', '__test_connection_ping__');
    console.log('✅ Connected to Cloudflare R2 successfully!\n');
  } catch (err) {
    console.error('❌ Failed to connect to Cloudflare R2:', err.message);
    console.error('   Make sure the "documents" and "certificates" buckets exist in R2.');
    process.exit(1);
  }

  const buckets = ['documents', 'certificates'];
  let grandTotal = 0;
  let grandSuccess = 0;
  let grandSkipped = 0;
  let grandFailed = 0;

  for (const bucket of buckets) {
    console.log(`\n📂 Scanning Supabase bucket: [${bucket}]...`);
    console.log(`   → Will upload to R2 bucket: [${bucket}]`);
    let files = [];

    try {
      files = await listAllFiles(bucket);
      console.log(`Found ${files.length} file(s) in [${bucket}].`);
    } catch (err) {
      console.error(`❌ Failed to list files in bucket [${bucket}]:`, err.message || err);
      continue;
    }

    grandTotal += files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // In separate-bucket mode, the R2 key is just the file path (no bucket prefix)
      const r2Key = file.path;
      const r2Bucket = bucket; // Same name as Supabase bucket
      const prefix = `[${bucket}][${i + 1}/${files.length}]`;

      // Check if already in R2
      const exists = await objectExistsInR2(r2Bucket, r2Key);
      if (exists) {
        console.log(`${prefix} ⏩ Already in R2: ${r2Bucket}/${r2Key} (Skipping)`);
        grandSkipped++;
        continue;
      }

      console.log(`${prefix} ⬇️  Downloading from Supabase: ${file.path}...`);

      try {
        const { data: blob, error: downloadErr } = await supabase.storage
          .from(bucket)
          .download(file.path);

        if (downloadErr) {
          throw downloadErr;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = file.metadata?.mimetype || getContentType(file.name);

        console.log(`${prefix} ⬆️  Uploading to R2: ${r2Bucket}/${r2Key} (${(buffer.length / 1024).toFixed(1)} KB)...`);

        await r2Client.send(new PutObjectCommand({
          Bucket: r2Bucket,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));

        console.log(`${prefix} ✅ Migrated: ${r2Bucket}/${r2Key}`);
        grandSuccess++;
      } catch (err) {
        console.error(`${prefix} ❌ Error migrating ${r2Bucket}/${r2Key}:`, err.message || err);
        grandFailed++;
      }
    }
  }

  console.log('\n====================================================');
  console.log('📊 Migration Summary');
  console.log('====================================================');
  console.log(`Total files found:   ${grandTotal}`);
  console.log(`Successfully moved:  ${grandSuccess}`);
  console.log(`Skipped (existing):  ${grandSkipped}`);
  console.log(`Failed:              ${grandFailed}`);
  console.log('====================================================\n');
}

migrate();
