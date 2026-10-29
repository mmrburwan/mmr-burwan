import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const R2_ACCOUNT_ID = process.env.VITE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC_URL_DOCS = process.env.VITE_R2_DOCUMENTS_PUBLIC_URL || 'https://pub-8c46b651293349a4b01ccd365dbc6d5c.r2.dev';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rgzgtzyyrbzgfgvbtxvp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const EXTRACTED_DIR = 'C:\\Users\\AMD\\Downloads\\extracted_documents';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

async function existsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: 'documents', Key: key }));
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Restoring Documents from Backup to Cloudflare R2');
  console.log('====================================================\n');

  console.log('1. Fetching all document records from Supabase...');
  const { data: allDocs, error } = await supabase
    .from('documents')
    .select('id, application_id, type, belongs_to, name, url, file_path, uploaded_at')
    .order('uploaded_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    process.exit(1);
  }

  console.log(`   Found ${allDocs.length} total document records in DB.\n`);

  let uploadedToR2 = 0;
  let skippedExistingR2 = 0;
  let missingOnDisk = 0;
  let dbUrlsUpdated = 0;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    const filePath = doc.file_path || (doc.url ? doc.url.split('/documents/')[1]?.split('?')[0] : '');

    if (!filePath) {
      console.warn(`[${i + 1}/${allDocs.length}] ⚠️ No file_path for doc ${doc.id}`);
      continue;
    }

    const cleanPath = filePath.replace(/^\/+/, '');
    const alreadyInR2 = await existsInR2(cleanPath);

    if (alreadyInR2) {
      skippedExistingR2++;
    } else {
      const localFilePath = path.join(EXTRACTED_DIR, cleanPath.replace(/\//g, path.sep));
      if (!fs.existsSync(localFilePath)) {
        console.warn(`[${i + 1}/${allDocs.length}] ❌ File not found locally: ${localFilePath}`);
        missingOnDisk++;
      } else {
        const fileBuffer = fs.readFileSync(localFilePath);
        const contentType = getContentType(doc.name || cleanPath);

        try {
          await s3.send(new PutObjectCommand({
            Bucket: 'documents',
            Key: cleanPath,
            Body: fileBuffer,
            ContentType: contentType,
            CacheControl: '3600',
          }));
          uploadedToR2++;
          console.log(`[${i + 1}/${allDocs.length}] ⬆️  Uploaded to R2: ${cleanPath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (uploadErr) {
          console.error(`[${i + 1}/${allDocs.length}] ❌ Failed to upload ${cleanPath}:`, uploadErr.message);
          continue;
        }
      }
    }

    // Update DB URL if it currently points to supabase.co
    if (doc.url && doc.url.includes('supabase.co')) {
      const newUrl = `${R2_PUBLIC_URL_DOCS}/${cleanPath}`;
      const { error: updateErr } = await supabase
        .from('documents')
        .update({ url: newUrl })
        .eq('id', doc.id);

      if (!updateErr) {
        dbUrlsUpdated++;
      } else {
        console.error(`   ⚠️ Failed to update DB url for ${doc.id}:`, updateErr.message);
      }
    }
  }

  console.log('\n====================================================');
  console.log('📊 Migration & Restore Summary');
  console.log('====================================================');
  console.log(`Total documents processed:  ${allDocs.length}`);
  console.log(`Already existed in R2:      ${skippedExistingR2}`);
  console.log(`Successfully uploaded to R2:${uploadedToR2}`);
  console.log(`Missing on local disk:      ${missingOnDisk}`);
  console.log(`Database URLs updated to R2:${dbUrlsUpdated}`);
  console.log('====================================================\n');

  // Verify Noor Mahammad Sk & Nasrin Khatun's joint photo in R2
  const testKey = 'fec4719d-7625-47b5-a164-895c0faf232d/1792678467852.jpg';
  console.log(`🔍 Verifying Noor Mahammad Sk certificate photo in R2:`);
  console.log(`   Key: ${testKey}`);
  const testUrl = `${R2_PUBLIC_URL_DOCS}/${testKey}`;
  try {
    const res = await fetch(testUrl);
    console.log(`   Public URL status: ${res.status} ${res.statusText} (${res.headers.get('content-type')}, ${res.headers.get('content-length')} bytes)`);
    if (res.ok) {
      console.log('   ✅ Certificate joint image is NOW LIVE on Cloudflare R2 CDN!');
    }
  } catch (fetchErr) {
    console.error('   ❌ Test fetch failed:', fetchErr.message);
  }
}

main().catch(console.error);
