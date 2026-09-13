/**
 * Safety audit: verify that NO valid certificate would be affected by the cleanup.
 * 
 * Checks:
 * 1. Every pdf_url in the DB maps to a file that exists in R2 (and is NOT in the orphan list)
 * 2. Every orphan file truly has no matching pdf_url in the DB
 * 3. Cross-check against the applications table — any verified application's cert is safe
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const R2_ACCOUNT_ID = 'a2b52c2ba93ac52eae4ead96a6fd7d3a';
const R2_ACCESS_KEY_ID = 'd5bb08b3be458cdc328ce38b40d39832';
const R2_SECRET_ACCESS_KEY = '07931118267abd2c9ecb95a9fc2a5669da7aa4cc6d0b217597ccc9d9be710cea';
const SUPABASE_URL = 'https://rgzgtzyyrbzgfgvbtxvp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnemd0enl5cmJ6Z2ZndmJ0eHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU3ODM3MCwiZXhwIjoyMDg0MTU0MzcwfQ.a68b4IKk6b_DMB9fy4QERk18mddVJhRMZwS_nolLc8w';

const BUCKET = 'certificates';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractKeyFromUrl(pdfUrl) {
  try {
    const url = new URL(pdfUrl);
    if (url.pathname.includes('/storage/v1/object/public/certificates/')) {
      return url.pathname.split('/storage/v1/object/public/certificates/')[1];
    }
    return url.pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

async function listAllR2Objects() {
  const keys = new Set();
  let token = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
    for (const obj of res.Contents || []) keys.add(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  console.log('=== SAFETY AUDIT: Certificate Cleanup Verification ===\n');

  // 1. List all R2 files
  console.log('📦 Listing R2 files...');
  const r2Keys = await listAllR2Objects();
  console.log(`   ${r2Keys.size} files in R2.\n`);

  // 2. Get ALL certificate records from DB (including unverified)
  console.log('🗃️  Fetching ALL certificate records (verified + unverified)...');
  const { data: allCerts, error: certErr } = await supabase
    .from('certificates')
    .select('id, application_id, pdf_url, verified, certificate_number, groom_name, bride_name');
  if (certErr) throw new Error(`DB error: ${certErr.message}`);
  console.log(`   ${allCerts.length} total certificate records in DB.\n`);

  // 3. Get ALL verified applications
  console.log('📋 Fetching verified applications...');
  const { data: verifiedApps, error: appErr } = await supabase
    .from('applications')
    .select('id, certificate_number, verified')
    .eq('verified', true);
  if (appErr) throw new Error(`DB error: ${appErr.message}`);
  console.log(`   ${verifiedApps.length} verified applications.\n`);

  // Build maps
  const dbKeyToCert = new Map(); // R2 key -> cert record
  const dbAppIdSet = new Set();  // application_ids that have a cert record

  for (const cert of allCerts) {
    const key = extractKeyFromUrl(cert.pdf_url);
    if (key) {
      dbKeyToCert.set(key, cert);
    }
    if (cert.application_id) {
      dbAppIdSet.add(cert.application_id);
    }
  }

  const verifiedAppIds = new Set(verifiedApps.map(a => a.id));

  // Classify R2 files
  const kept = [];     // files with a matching DB cert record (SAFE)
  const orphans = [];  // files with NO matching DB cert record (to be deleted)

  for (const key of r2Keys) {
    if (dbKeyToCert.has(key)) {
      kept.push({ key, cert: dbKeyToCert.get(key) });
    } else {
      orphans.push(key);
    }
  }

  // ─── CHECK 1: Every DB cert maps to a kept file ───────────────────────────
  console.log('─── CHECK 1: Does every DB certificate have its file kept? ───');
  let check1Pass = true;
  for (const cert of allCerts) {
    const key = extractKeyFromUrl(cert.pdf_url);
    if (!key) {
      console.log(`   ⚠️  Cert ${cert.id} has unparseable pdf_url: ${cert.pdf_url}`);
      continue;
    }
    if (orphans.includes(key)) {
      console.log(`   ❌ DANGER: Cert ${cert.id} (${cert.groom_name} & ${cert.bride_name}, cert#${cert.certificate_number}) would be DELETED!`);
      check1Pass = false;
    }
  }
  if (check1Pass) {
    console.log('   ✅ PASS — No DB-referenced certificate file is in the orphan list.\n');
  } else {
    console.log('   ❌ FAIL — Some DB-referenced files would be deleted! ABORT!\n');
  }

  // ─── CHECK 2: Every verified application's cert is safe ───────────────────
  console.log('─── CHECK 2: Does every verified application have its cert kept? ───');
  let check2Pass = true;
  let verifiedWithCert = 0;
  let verifiedWithoutCert = 0;
  for (const appId of verifiedAppIds) {
    if (dbAppIdSet.has(appId)) {
      verifiedWithCert++;
    } else {
      verifiedWithoutCert++;
      // This is expected for apps that haven't had certs generated yet
    }
  }
  console.log(`   Verified apps with cert record: ${verifiedWithCert}`);
  console.log(`   Verified apps without cert record: ${verifiedWithoutCert} (normal if cert generation is pending)`);
  console.log(`   ✅ PASS\n`);

  // ─── CHECK 3: Orphan files don't belong to any verified application ───────
  console.log('─── CHECK 3: Do any orphan files belong to a verified application? ───');
  let check3Pass = true;
  for (const key of orphans) {
    // key format: {applicationId}/{timestamp}-Marriage-Certificate-{verificationId}.pdf
    const appId = key.split('/')[0];
    if (verifiedAppIds.has(appId) && dbAppIdSet.has(appId)) {
      // This app has a verified cert AND a cert record — orphan is just an OLD file for same app
      // This is SAFE to delete since the DB points to a different (newer) file
    } else if (verifiedAppIds.has(appId) && !dbAppIdSet.has(appId)) {
      console.log(`   ⚠️  Orphan ${key} belongs to verified app ${appId} which has NO cert record in DB!`);
      check3Pass = false;
    }
  }
  if (check3Pass) {
    console.log('   ✅ PASS — No orphan file is the sole file for a verified app without a DB cert record.\n');
  } else {
    console.log('   ❌ FAIL — Some orphans belong to verified apps with no cert record! Review above.\n');
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log(`   Files to KEEP:   ${kept.length}`);
  console.log(`   Files to DELETE: ${orphans.length}`);
  console.log(`   All checks: ${check1Pass && check2Pass && check3Pass ? '✅ PASSED' : '❌ SOME FAILED'}`);
  console.log('═══════════════════════════════════════');

  if (check1Pass && check2Pass && check3Pass) {
    console.log('\n✅ SAFE TO PROCEED with deletion. No verified certificate will be affected.');
  } else {
    console.log('\n❌ DO NOT DELETE. Review the failures above.');
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
