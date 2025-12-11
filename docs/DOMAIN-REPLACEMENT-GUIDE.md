# 🌐 Domain Replacement Guide

This guide helps you quickly replace all occurrences of `https://mmrburwan.com` with your actual production domain.

## Files That Need Domain Updates

### Critical Files (Must Update)

1. **`index.html`** - Multiple locations:
   - Line 8: `<title>` tag
   - Line 20: `og:url`
   - Line 23: `og:image`
   - Line 39: `canonical` URL

2. **`public/robots.txt`**:
   - Line 2: Comment URL
   - Line 21: Sitemap URL

3. **`public/sitemap.xml`**:
   - Line 9: Homepage `<loc>`
   - Line 17: Verify page `<loc>`
   - Line 25: Help page `<loc>`
   - Line 33: Privacy page `<loc>`

4. **`components/SEO.tsx`**:
   - Line 17: Default `image` URL
   - Line 18: Default `url`
   - Line 23: Full URL construction

5. **`components/StructuredData.tsx`**:
   - Line 17: Base data `url`
   - Line 18: Base data `logo`
   - Line 28: Organization schema `url`
   - Line 29: Organization schema `logo`
   - Line 59: Service channel `serviceUrl`
   - Line 70: Web app schema `url`

### Optional Files (Update if using actual domain)

6. **`components/Footer.tsx`**:
   - Line 67: Official site link

7. **`supabase/functions/send-verification-email/index.ts`**:
   - Line 9: `SITE_URL` default

8. **`supabase/functions/send-rejection-email/index.ts`**:
   - Line 8: `SITE_URL` default

## Quick Replacement Methods

### Method 1: Find & Replace in Editor
1. Open your editor's Find & Replace (Ctrl+Shift+H / Cmd+Shift+H)
2. Search for: `mmrburwan.com`
3. Replace with: `yourdomain.com` (or your actual domain)
4. Review each file before replacing

### Method 2: Command Line (PowerShell)
```powershell
# Find all occurrences first
Get-ChildItem -Recurse -Include *.tsx,*.ts,*.html,*.xml,*.txt | Select-String "mmrburwan.com"

# Replace (be careful - review first!)
$files = Get-ChildItem -Recurse -Include *.tsx,*.ts,*.html,*.xml,*.txt
$files | ForEach-Object {
    (Get-Content $_.FullName) -replace 'mmrburwan\.com', 'yourdomain.com' | Set-Content $_.FullName
}
```

### Method 3: Manual Review (Recommended)
1. Use grep/search to find all occurrences
2. Review each file context
3. Replace one file at a time
4. Test after each change

## Verification

After replacing, verify:
1. All URLs use HTTPS (not HTTP)
2. No mixed protocols (http/https)
3. No broken links
4. Social media preview works (test with Facebook/Twitter debuggers)
5. Sitemap is accessible at `/sitemap.xml`

## Testing Checklist

- [ ] Homepage loads correctly
- [ ] Social sharing preview shows correct image and URL
- [ ] Canonical URLs are correct
- [ ] Sitemap is accessible
- [ ] robots.txt is accessible
- [ ] Structured data validates (use Schema.org validator)
- [ ] No console errors related to URLs

## Important Notes

- **Always use HTTPS** in production
- **Test social sharing** after domain change (Facebook/Twitter debuggers)
- **Update Supabase Edge Functions** environment variables (`SITE_URL`)
- **Clear browser cache** when testing
- **Update DNS** before testing in production

