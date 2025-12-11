# 🚀 Pre-Deployment Checklist

**Last Updated:** December 11, 2024  
**Status:** Ready for deployment after completing critical items below

---

## ✅ COMPLETED - Ready for Production

### Assets & Branding
- ✅ All favicon files created (16x16, 32x32, 180x180, 192x192, 512x512)
- ✅ Master SVG logo created (`public/logo.svg`)
- ✅ Logo PNG for structured data (`public/logo.png`)
- ✅ Reusable Logo component created

### Technical Setup
- ✅ SEO meta tags configured in `index.html`
- ✅ Open Graph tags for social media
- ✅ Twitter Card metadata
- ✅ Structured data (JSON-LD) components
- ✅ robots.txt configured
- ✅ sitemap.xml created
- ✅ PWA manifest.json configured
- ✅ Build optimizations (code splitting, minification)
- ✅ Security headers in `.htaccess`
- ✅ SPA routing configured

---

## 🔴 CRITICAL - Must Complete Before Launch

### 1. Create Missing Assets ⚠️

**OG Image for Social Sharing:**
- [ ] Create `public/og-image.jpg` (1200x630px)
  - Should include: MMR Burwan logo, tagline, and key visual
  - Use high-quality image with text readable at small sizes
  - Follow brand colors (gold/rose theme)
  - **Tool:** Canva, Figma, or Photoshop
  - **Note:** Currently referenced in `index.html` and `components/SEO.tsx`

---

### 2. Environment Variables Setup 🔐

**Required Environment Variables:**
Create a `.env` file in the root directory (NEVER commit this file):

```env
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional - Only if using Gemini AI features
GEMINI_API_KEY=your_gemini_api_key
```

**For Production Deployment:**
- [ ] Set environment variables in your hosting platform:
  - **Vercel:** Project Settings → Environment Variables
  - **Netlify:** Site Settings → Environment Variables
  - **Cloudflare Pages:** Pages → Settings → Environment Variables
- [ ] Verify all environment variables are set correctly
- [ ] Test that Supabase connection works in production

**Important Security Notes:**
- ✅ Supabase anon key is safe to expose (it's public by design)
- ✅ Never expose service role keys or API secrets
- ✅ Use environment variables, never hardcode secrets

---

### 3. Update Domain URLs 🌐

**Replace `https://mmrburwan.com` with your actual domain in:**

- [ ] `index.html` (all meta tags - lines 8, 20, 23, 39, etc.)
- [ ] `public/robots.txt` (line 2, 21)
- [ ] `public/sitemap.xml` (all `<loc>` tags - lines 9, 17, 25, 33)
- [ ] `public/manifest.json` (if needed - currently doesn't have domain)
- [ ] `components/SEO.tsx` (lines 17, 18, 23)
- [ ] `components/StructuredData.tsx` (lines 17, 18, 28, 29, 59, 70)
- [ ] `components/Footer.tsx` (line 67 - if using actual domain)
- [ ] `supabase/functions/send-verification-email/index.ts` (line 9)
- [ ] `supabase/functions/send-rejection-email/index.ts` (line 8)

**Quick Find & Replace:**
```bash
# Search for all occurrences
grep -r "mmrburwan.com" .
```

---

### 4. SSL/HTTPS Setup 🔒

- [ ] SSL certificate installed on hosting platform
- [ ] HTTPS redirect configured:
  - **Option A:** Uncomment HTTPS redirect in `public/.htaccess` (lines 32-37) if using Apache
  - **Option B:** Configure redirect in hosting platform settings (Vercel/Netlify handle this automatically)
- [ ] Verify all internal links use HTTPS
- [ ] Test that mixed content warnings don't appear

---

### 5. Supabase Configuration ☁️

**Backend Setup:**
- [ ] Database migrations applied to production Supabase project
- [ ] Edge Functions deployed:
  ```bash
  supabase functions deploy send-verification-email
  supabase functions deploy send-rejection-email
  supabase functions deploy create-proxy-user
  ```
- [ ] Edge Function secrets configured in Supabase Dashboard:
  - `RESEND_API_KEY` (for email sending)
  - `FROM_EMAIL` (sender email address)
  - `SITE_URL` (your production domain)
  - `SUPABASE_URL` (auto-set)
  - `SUPABASE_SERVICE_ROLE_KEY` (auto-set)

**Database Setup:**
- [ ] All tables created and migrated
- [ ] Storage policies configured (`supabase/storage-policies.sql`)
- [ ] Admin user created (run `scripts/set-admin-role.sql` or use dashboard)
- [ ] Row Level Security (RLS) policies enabled and tested

**Storage Buckets:**
- [ ] Create required storage buckets (e.g., `documents`, `certificates`)
- [ ] Configure bucket policies for public/private access as needed
- [ ] Test file upload/download functionality

---

### 6. Email Configuration 📧

**Resend Setup (or your email provider):**
- [ ] Create Resend account or configure email provider
- [ ] Verify domain (if using custom domain)
- [ ] Add `RESEND_API_KEY` to Supabase Edge Function secrets
- [ ] Configure `FROM_EMAIL` in Edge Function secrets
- [ ] Test email sending:
  - Verification emails
  - Rejection emails
  - Password reset emails (if implemented)

---

### 7. Build & Test 🧪

**Build Production Version:**
```bash
npm run build
```

**Testing Checklist:**
- [ ] Production build succeeds without errors
- [ ] Test locally with production build:
  ```bash
  npm run preview
  ```
- [ ] Lighthouse audit (target: 90+ score):
  - Performance: > 90
  - Accessibility: > 90
  - Best Practices: > 90
  - SEO: > 90
- [ ] PageSpeed Insights test
- [ ] Mobile responsiveness verified on real devices
- [ ] Cross-browser testing:
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)
  - [ ] Mobile browsers (iOS Safari, Chrome Mobile)
- [ ] All forms tested and working:
  - [ ] User registration
  - [ ] User login
  - [ ] Application submission
  - [ ] Document upload
  - [ ] Admin verification
- [ ] All links verified (no broken links)
- [ ] Error handling tested (404, network errors, etc.)

---

### 8. Content Review 📝

- [ ] Meta descriptions optimized (50-160 characters)
- [ ] All images have alt text
- [ ] Heading structure verified (H1, H2, H3 hierarchy)
- [ ] Content is accurate and up-to-date
- [ ] Contact information is correct
- [ ] Legal pages reviewed (Privacy Policy, Terms)
- [ ] No placeholder text remaining
- [ ] All translations complete (English & Bengali)

---

### 9. Performance Optimization ⚡

- [ ] Images optimized and compressed
- [ ] Lazy loading implemented (check if needed)
- [ ] Fonts optimized (preload critical fonts if needed)
- [ ] CSS/JS minified (✅ handled by Vite build)
- [ ] Browser caching configured (✅ in `.htaccess`)
- [ ] CDN configured (if applicable)

---

### 10. Security Hardening 🔐

- [ ] Environment variables secured (not in git)
- [ ] API keys not exposed in client code (✅ using env vars)
- [ ] CORS configured correctly in Supabase
- [ ] Rate limiting considered (Supabase has built-in limits)
- [ ] Regular security updates scheduled
- [ ] `.env` file in `.gitignore` (✅ should already be)
- [ ] Supabase service role key NOT exposed in frontend

---

### 11. Monitoring & Analytics 📊

**Error Tracking (Recommended):**
- [ ] Set up error tracking (Sentry, LogRocket, or similar)
- [ ] Configure error alerts

**Analytics (Optional but Recommended):**
- [ ] Google Analytics configured
- [ ] Or Google Tag Manager setup
- [ ] Or privacy-friendly alternative (Plausible, etc.)

**Uptime Monitoring:**
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)

---

### 12. Google Services 🔍

**Google Search Console:**
- [ ] Create Google Search Console account
- [ ] Add property (your domain)
- [ ] Verify ownership
- [ ] Submit sitemap (`https://yourdomain.com/sitemap.xml`)
- [ ] Request indexing for main pages

**Optional:**
- [ ] Google Analytics setup
- [ ] Google Tag Manager setup

---

### 13. Pre-Launch Final Checks ✅

- [ ] All TODO comments removed from code
- [ ] Console logs removed or reduced (or use environment-based logging)
- [ ] Test data removed from production
- [ ] Database backup strategy in place
- [ ] Recovery plan documented
- [ ] Deployment process documented
- [ ] Team access configured for hosting platform
- [ ] DNS configured and tested
- [ ] Domain registrar configured correctly

---

## 🎯 Post-Deployment Tasks

### Week 1
- [ ] Monitor Google Search Console for errors
- [ ] Check analytics for traffic patterns
- [ ] Review server logs for errors
- [ ] Test all user flows in production
- [ ] Gather initial user feedback
- [ ] Monitor Supabase usage and limits

### Month 1
- [ ] SEO performance review
- [ ] Update sitemap if new pages added
- [ ] Review and optimize slow pages
- [ ] Check for broken links
- [ ] Update content based on analytics
- [ ] Performance audit

---

## 📋 Quick Deployment Commands

### Build for Production
```bash
npm install
npm run build
```

### Test Production Build Locally
```bash
npm run preview
```

### Deploy to Vercel
```bash
vercel --prod
```

### Deploy to Netlify
```bash
netlify deploy --prod
```

### Deploy Supabase Functions
```bash
supabase functions deploy send-verification-email
supabase functions deploy send-rejection-email
supabase functions deploy create-proxy-user
```

---

## 🔗 Important Links

- [Google Search Console](https://search.google.com/search-console)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Schema.org Validator](https://validator.schema.org/)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Supabase Dashboard](https://app.supabase.com)

---

## 📝 Notes

- Keep this checklist updated as you complete items
- Test everything in staging before production
- Have a rollback plan ready
- Document any custom deployment steps
- Keep credentials secure and backed up safely

---

**Next Steps:**
1. Complete all CRITICAL items (marked with 🔴)
2. Run production build and test locally
3. Deploy to staging environment first (if available)
4. Final testing in staging
5. Deploy to production
6. Monitor closely for first 24-48 hours

