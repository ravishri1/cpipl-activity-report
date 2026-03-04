# Phase 2 Performance Optimization Implementation Guide

**Phase:** 2 (Medium Effort - 2-3 weeks)  
**Expected Improvement:** +20-30% (cumulative 56% from baseline)  
**Baseline Performance:** 2.7s dashboard load (post-Phase 1)  
**Phase 2 Target:** 2.0-2.1s dashboard load  
**Priority:** HIGH (dashboard is most visited page)

---

## Overview

Phase 2 focuses on two major optimizations:
1. **API Consolidation** — Reduce 6-8 dashboard API calls to 1 consolidated endpoint
2. **Image Optimization** — Implement WebP conversion, responsive images, lazy loading

| Metric | Before Phase 1 | After Phase 1 | After Phase 2 | Target |
|--------|----------------|---------------|---------------|---------|
| Dashboard Load | 4.5s | 2.7s (40% ↓) | 2.0s (26% ↓) | 2.0s |
| Time to Interactive | 5.8s | 3.2s (45% ↓) | 2.2s (31% ↓) | 2.2s |
| Largest Contentful Paint | 3.2s | 1.8s (44% ↓) | 1.3s (28% ↓) | 1.3s |
| API Response Time | 1.2-1.8s | 300-500ms | 100-150ms | <150ms |
| Image Bundle Size | 2.4MB | 1.5MB | 800KB | <800KB |

---

## Part 1: API Consolidation (1 Week)

### Goal
Convert 6-8 sequential API calls into 1 consolidated endpoint, reducing dashboard load time by ~26%.

### Current Flow (Problematic)
```
Dashboard Page Loads
  → GET /api/users/me (200ms)
  → GET /api/reports/my/today (300ms) [waits for /me]
  → GET /api/reminders (250ms) [parallel with /reports]
  → GET /api/email-activity/my (200ms) [parallel]
  → GET /api/chat-activity/my (250ms) [parallel]
  → GET /api/thumbs-ups (150ms) [parallel]
  → GET /api/announcements (100ms) [parallel]
  
Total: ~1.8s (parallel) to 1.2s (best case)
Network: 8 separate TCP connections, 8 SSL handshakes
```

### New Flow (Optimized)
```
Dashboard Page Loads
  → GET /api/dashboard?date=2026-03-04 (150ms)
    Returns: {
      user: {...},
      todayReport: {...},
      reminders: [...],
      emailActivity: {...},
      chatActivity: {...},
      thumbsUps: [...],
      announcements: [...]
    }

Total: ~150-200ms
Network: 1 TCP connection, 1 SSL handshake
```

### Implementation Steps

#### Step 1: Create Consolidated Dashboard Endpoint (Backend)

**File:** `server/src/routes/dashboard.js` (UPDATE if exists, or CREATE new)

```javascript
// server/src/routes/dashboard.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const router = express.Router();

router.use(authenticate);

// ────────────────────────────────────────────────────────────
// GET /api/dashboard — Consolidated dashboard data
// ────────────────────────────────────────────────────────────
// Returns all dashboard data in a single call:
// - user profile
// - today's report
// - upcoming reminders
// - email activity
// - chat activity
// - recent thumbs-ups
// - announcements
// ────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { date } = req.query;
  const queryDate = date ? new Date(date) : new Date();
  queryDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(queryDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Execute all queries in parallel using Promise.all
  const [user, todayReport, reminders, emailActivity, chatActivity, thumbsUps, announcements] = await Promise.all([
    // 1. User profile
    req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        driveProfilePhotoUrl: true,
        profilePhotoUrl: true,
      },
    }),

    // 2. Today's report (if submitted)
    req.prisma.dailyReport.findFirst({
      where: {
        userId: req.user.id,
        createdAt: { gte: queryDate, lt: nextDate },
      },
      select: {
        id: true,
        summary: true,
        status: true,
        createdAt: true,
      },
    }),

    // 3. Upcoming reminders (next 5)
    req.prisma.reminder.findMany({
      where: { userId: req.user.id },
      orderBy: { remindAt: 'asc' },
      take: 5,
      select: {
        id: true,
        message: true,
        remindAt: true,
        isAcknowledged: true,
      },
    }),

    // 4. Email activity (last 3 days)
    req.prisma.emailActivity.findMany({
      where: {
        userId: req.user.id,
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 5. Chat activity (last 3 days)
    req.prisma.chatActivity.findMany({
      where: {
        userId: req.user.id,
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        message: true,
        channel: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 6. Recent thumbs-ups (last 5)
    req.prisma.thumbsUp.findMany({
      where: { receivedBy: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        givenBy: { select: { name: true, id: true } },
        message: true,
        createdAt: true,
      },
    }),

    // 7. Announcements (active, limit 5)
    req.prisma.announcement.findMany({
      where: {
        OR: [
          { targetAudience: { contains: req.user.department || '' } },
          { targetAudience: 'all_employees' },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        summary: true,
        publishedAt: true,
      },
    }),
  ]);

  res.json({
    user,
    todayReport,
    reminders,
    emailActivity,
    chatActivity,
    thumbsUps,
    announcements,
    timestamp: new Date(),
  });
}));

module.exports = router;
```

#### Step 2: Register Route in App (Backend)

**File:** `server/src/app.js` (UPDATE)

Add after other route registrations:
```javascript
const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);
```

#### Step 3: Update Dashboard Component (Frontend)

**File:** `client/src/components/dashboard/Dashboard.jsx` (UPDATE)

Replace the current multiple `useFetch` calls with a single consolidated call:

```javascript
// OLD CODE (remove this):
// const { data: userProfile } = useFetch('/api/users/me');
// const { data: todayReport } = useFetch('/api/reports/my/today');
// const { data: reminders } = useFetch('/api/reminders');
// const { data: emailActivity } = useFetch('/api/email-activity/my');
// const { data: chatActivity } = useFetch('/api/chat-activity/my');
// const { data: thumbsUps } = useFetch('/api/thumbs-ups');
// const { data: announcements } = useFetch('/api/announcements');

// NEW CODE (add this):
const today = new Date().toISOString().split('T')[0];
const { data: dashboardData, loading, error, refetch } = useFetch(
  `/api/dashboard?date=${today}`,
  {
    user: null,
    todayReport: null,
    reminders: [],
    emailActivity: [],
    chatActivity: [],
    thumbsUps: [],
    announcements: [],
  }
);

// Extract consolidated data
const {
  user: userProfile = null,
  todayReport = null,
  reminders = [],
  emailActivity = [],
  chatActivity = [],
  thumbsUps = [],
  announcements = [],
} = dashboardData || {};
```

**Performance Improvement:** 1.8s → 200ms (91% reduction) for API calls

---

## Part 2: Image Optimization (1.5 Weeks)

### Goal
Reduce image bundle size by 60% and implement lazy loading, improving LCP by 28%.

### Current Image Problems
- Images served as JPEG/PNG only (inefficient)
- No responsive images (desktop images loaded on mobile)
- All images loaded eagerly (delays page paint)
- No thumbnail previews (layout shift during load)

### New Strategy
1. **WebP Conversion** — Modern format, 25-35% smaller
2. **Responsive Images** — Serve appropriate size per device
3. **Lazy Loading** — Load below-fold images on scroll
4. **Placeholder Blur** — Show low-quality placeholder during load

### Implementation Steps

#### Step 1: Setup Image Optimization Pipeline

**File:** `scripts/optimize-images.js` (NEW)

```javascript
// scripts/optimize-images.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = 'public/images';
const OUTPUT_DIR = 'public/images-optimized';

async function optimizeImage(inputPath) {
  const filename = path.basename(inputPath, path.extname(inputPath));

  // Generate WebP versions
  for (const width of [320, 640, 1280, 1920]) {
    await sharp(inputPath)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(path.join(OUTPUT_DIR, `${filename}-${width}w.webp`));
  }

  // Keep JPEG fallback for older browsers
  for (const width of [320, 640, 1280, 1920]) {
    await sharp(inputPath)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toFile(path.join(OUTPUT_DIR, `${filename}-${width}w.jpg`));
  }

  // Generate blur placeholder (50x50px)
  await sharp(inputPath)
    .resize(50, 50)
    .blur(10)
    .toFile(path.join(OUTPUT_DIR, `${filename}-blur.jpg`));

  console.log(`✓ Optimized ${filename}`);
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Get all images
  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => /\.(jpg|png|jpeg)$/i.test(f))
    .map(f => path.join(INPUT_DIR, f));

  for (const file of files) {
    await optimizeImage(file);
  }

  console.log(`\n✅ Optimized ${files.length} images`);
}

main().catch(console.error);
```

**Add to package.json:**
```json
{
  "scripts": {
    "optimize-images": "node scripts/optimize-images.js"
  },
  "devDependencies": {
    "sharp": "^0.33.0"
  }
}
```

#### Step 2: Create Image Utility Hook

**File:** `client/src/hooks/useResponsiveImage.js` (NEW)

```javascript
// client/src/hooks/useResponsiveImage.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for responsive, lazy-loaded images with blur placeholder
 * @param {string} filename - Base filename without extension
 * @param {object} options - { alt, title, className }
 * @returns {object} - { src, srcSet, placeholder, loaded, error }
 */
export function useResponsiveImage(filename, options = {}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const imgRef = useRef(null);

  // Use Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Image is in viewport, start loading
          entry.target.dataset.loaded = 'true';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '50px' } // Start loading 50px before viewport
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return {
    ref: imgRef,
    srcSet: `
      /images-optimized/${filename}-320w.webp 320w,
      /images-optimized/${filename}-640w.webp 640w,
      /images-optimized/${filename}-1280w.webp 1280w,
      /images-optimized/${filename}-1920w.webp 1920w
    `,
    src: `/images-optimized/${filename}-1280w.jpg`,
    placeholder: `/images-optimized/${filename}-blur.jpg`,
    loaded,
    error,
    onLoad: () => setLoaded(true),
    onError: (err) => setError(err),
    ...options,
  };
}
```

#### Step 3: Create Responsive Image Component

**File:** `client/src/components/shared/ResponsiveImage.jsx` (NEW)

```javascript
// client/src/components/shared/ResponsiveImage.jsx
import { useState, useRef, useEffect } from 'react';

export default function ResponsiveImage({
  filename,
  alt = '',
  className = '',
  width = 'auto',
  height = 'auto',
  title = '',
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Load image by setting src
          entry.target.src = entry.target.dataset.src;
          setLoaded(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  if (error) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <picture>
      {/* WebP source for modern browsers */}
      <source
        srcSet={`
          /images-optimized/${filename}-320w.webp 320w,
          /images-optimized/${filename}-640w.webp 640w,
          /images-optimized/${filename}-1280w.webp 1280w,
          /images-optimized/${filename}-1920w.webp 1920w
        `}
        type="image/webp"
      />

      {/* JPEG fallback for older browsers */}
      <source
        srcSet={`
          /images-optimized/${filename}-320w.jpg 320w,
          /images-optimized/${filename}-640w.jpg 640w,
          /images-optimized/${filename}-1280w.jpg 1280w,
          /images-optimized/${filename}-1920w.jpg 1920w
        `}
        type="image/jpeg"
      />

      {/* Actual image element */}
      <img
        ref={imgRef}
        data-src={`/images-optimized/${filename}-1280w.jpg`}
        src={`/images-optimized/${filename}-blur.jpg`}
        srcSet={`
          /images-optimized/${filename}-320w.jpg 320w,
          /images-optimized/${filename}-640w.jpg 640w,
          /images-optimized/${filename}-1280w.jpg 1280w,
          /images-optimized/${filename}-1920w.jpg 1920w
        `}
        alt={alt}
        title={title}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-50'} transition-opacity duration-300`}
        style={{ width, height }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </picture>
  );
}
```

#### Step 4: Update Components to Use ResponsiveImage

**File:** `client/src/components/dashboard/Dashboard.jsx` (UPDATE)

Example of converting profile images:

```javascript
// OLD:
// <img src={driveImageUrl(userProfile.driveProfilePhotoUrl)} alt={userProfile.name} className="w-12 h-12 rounded-full" />

// NEW:
import ResponsiveImage from '../shared/ResponsiveImage';

<ResponsiveImage
  filename="profile-photos/user-123"
  alt={userProfile.name}
  className="w-12 h-12 rounded-full object-cover"
  width="48px"
  height="48px"
/>
```

**Do this for all employee profile photos, announcement images, and thumbnails.**

#### Step 5: Configure Next.js Image Optimization (if applicable)

If using Next.js:
```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [320, 640, 960, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 31536000,
  },
};
```

If using Vite (current):
```javascript
// vite.config.js (add to existing config)
import imagemin from 'vite-plugin-imagemin';

export default {
  plugins: [
    imagemin({
      webp: { quality: 75 },
      mozjpeg: { quality: 75 },
      optipng: { optimizationLevel: 3 },
      svgo: { plugins: [{ removeViewBox: false }] },
    }),
  ],
};
```

---

## Part 3: Performance Monitoring (1 Week)

### Step 1: Add Performance Tracking

**File:** `client/src/utils/performanceMonitor.js` (NEW)

```javascript
// client/src/utils/performanceMonitor.js
/**
 * Monitor and log performance metrics
 */
export function initPerformanceMonitoring() {
  // Measure Web Vitals
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime, 'ms');
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = clsValue + entry.value;
          clsValue += entry.value;
          console.log('CLS:', clsValue.toFixed(3));
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstInput = entries[0];
      console.log('FID:', firstInput.processingDuration, 'ms');
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  }

  // Measure API response times
  window.apiMetrics = {};

  // Time Page Load
  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log('Page Load Time:', pageLoadTime, 'ms');
  });
}
```

### Step 2: Track in Component

**File:** `client/src/components/dashboard/Dashboard.jsx` (UPDATE)

```javascript
import { useEffect } from 'react';
import { initPerformanceMonitoring } from '../../utils/performanceMonitor';

export default function Dashboard() {
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  // ... rest of component
}
```

---

## Implementation Timeline

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 1** | API Consolidation | `/api/dashboard` endpoint, Frontend updated, 60% API load reduction |
| **Week 2** | Image Optimization Setup | Optimization pipeline, responsive image hook, first 20% of images optimized |
| **Week 3** | Image Optimization Completion | All profile images optimized, lazy loading, blur placeholders, monitoring |

---

## Testing Checklist

### API Consolidation Testing
- [ ] `/api/dashboard` endpoint returns all expected data
- [ ] Response time is <200ms
- [ ] Dashboard loads faster (measure with DevTools)
- [ ] All data is accurate and matches old endpoints
- [ ] Error handling works (if one sub-query fails, handle gracefully)
- [ ] Caching works (responses cached per user)
- [ ] No CORS errors

### Image Optimization Testing
- [ ] WebP images load in Chrome/Firefox/Safari
- [ ] JPEG fallback works in older browsers
- [ ] Lazy loading works (images load on scroll)
- [ ] Blur placeholders display
- [ ] Responsive images load correct sizes
- [ ] Image quality is acceptable (no compression artifacts)
- [ ] Bundle size reduced by 60%

### Overall Performance Testing
- [ ] Dashboard load time: 2.0-2.1s (target)
- [ ] LCP: <1.3s
- [ ] FID: <100ms
- [ ] CLS: <0.1
- [ ] No console errors
- [ ] No memory leaks (Chrome DevTools)

---

## Success Criteria

| Metric | Target | How to Verify |
|--------|--------|--------------|
| Dashboard Load | <2.1s | Chrome DevTools Network tab |
| API Response | <200ms | Network tab, /api/dashboard |
| LCP | <1.3s | Chrome Lighthouse report |
| Image Bundle | <800KB | Network tab, filter images |
| WebP Support | >95% users | Browser stats |

---

## Rollback Plan

If performance doesn't improve or issues arise:

```bash
# Revert API consolidation
git revert [api-consolidation-commit]

# Revert image optimization
git revert [image-optimization-commit]

# Clear browser cache
# Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
```

---

## Expected Results After Phase 2

| Metric | Before | After Phase 1 | After Phase 2 | Improvement |
|--------|--------|---------------|---------------|-------------|
| Dashboard Load | 4.5s | 2.7s | 2.0s | **56% ↓** |
| API Calls | 8 | 8 | 1 | **87.5% ↓** |
| Image Size | 2.4MB | 1.5MB | 0.8MB | **67% ↓** |
| LCP | 3.2s | 1.8s | 1.3s | **59% ↓** |
| User Satisfaction | Baseline | Good | Excellent | +45% |

---

## Post-Phase 2 (Future Optimization)

### Phase 3 Potential Improvements
- Database query optimization (add more indexes, optimize joins)
- Server-side caching (Redis for frequent queries)
- Service Worker upgrades (stale-while-revalidate strategy)
- Component code splitting (load features on demand)
- Estimated improvement: +10-15% additional

### Monitoring & Maintenance
- Set up Lighthouse CI in CI/CD pipeline
- Daily performance monitoring dashboard
- Alert if metrics degrade by >5%
- Quarterly performance reviews

---

## Appendix: Code Examples

### Usage of ResponsiveImage Component

```jsx
import ResponsiveImage from '../shared/ResponsiveImage';

// Simple employee profile photo
<ResponsiveImage
  filename="employee-photos/emp-001"
  alt="John Doe"
  className="w-16 h-16 rounded-full object-cover"
/>

// Announcement hero image
<ResponsiveImage
  filename="announcements/new-policy-2026"
  alt="New Policy Announcement"
  className="w-full h-64 object-cover rounded-lg"
  width="100%"
  height="256px"
/>

// Department image in card
<ResponsiveImage
  filename="departments/engineering"
  alt="Engineering Department"
  className="w-full h-48 object-cover"
  width="100%"
  height="192px"
/>
```

---

**Document Version:** 1.0  
**Created:** March 4, 2026  
**Next Review:** After implementation completion  
**Owner:** Performance Team
