#!/usr/bin/env node
// build-jobs.js — Static-site generator for the Nearwork job board migration.
// Node 18+ (uses global fetch, no npm dependencies).
// Fetches published openings from the public Firestore REST API and writes
// server-rendered, Nearwork-branded HTML pages into ./jobs/.

'use strict';

const fs = require('fs');
const path = require('path');

const KEY = 'AIzaSyApRNyW8PoP28E0x77dUB5jOgHuTqA2by4';
const PROJECT = 'nearwork-97e3c';
const OUT_DIR = path.join(__dirname, 'jobs');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const CANONICAL_BASE = 'https://www.nearwork.co';
const SITEMAP_LASTMOD = '2026-07-22';

// ---------------------------------------------------------------------------
// Firestore value helpers
// ---------------------------------------------------------------------------

// Unwrap a Firestore REST "value" object into a plain JS value.
function val(field) {
  if (field === undefined || field === null) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('booleanValue' in field) return field.booleanValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) {
    const values = (field.arrayValue && field.arrayValue.values) || [];
    return values.map(val);
  }
  if ('mapValue' in field) {
    const out = {};
    const f = (field.mapValue && field.mapValue.fields) || {};
    for (const k of Object.keys(f)) out[k] = val(f[k]);
    return out;
  }
  return null;
}

// Convenience: read a field from a doc's fields map, unwrapped.
function f(fields, name) {
  return val(fields[name]);
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

// Strip a leading bullet / tab / whitespace from a bullet string.
function cleanBullet(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/^[\s••\t\-–—]+/, '').trim();
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

// Normalize an array-ish field into an array of cleaned bullet strings.
function toBullets(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(cleanBullet).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Fetch published openings
// ---------------------------------------------------------------------------

async function fetchOpenings() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'openings' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'published' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore query failed: ${res.status} ${res.statusText}\n${body}`);
  }
  const rows = await res.json();
  const docs = [];
  for (const row of rows) {
    if (!row.document) continue;
    const fields = row.document.fields || {};
    const id = row.document.name.split('/').pop();
    docs.push({ id, fields });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Model: turn a raw doc into a normalized job object
// ---------------------------------------------------------------------------

function buildJob(doc) {
  const fields = doc.fields;
  const code = f(fields, 'code') || doc.id;
  const title = f(fields, 'title');

  const salaryMin = f(fields, 'salaryMin');
  const salaryMax = f(fields, 'salaryMax');
  const currency = f(fields, 'salaryCurrency') || f(fields, 'currency') || 'USD';
  const hideSalary = f(fields, 'hideSalary') === true;
  // Only positive numbers count as a real salary; -1 / 0 / null are placeholders.
  const validMin = typeof salaryMin === 'number' && salaryMin > 0;
  const validMax = typeof salaryMax === 'number' && salaryMax > 0;
  const hasSalary = validMin || validMax;
  const showSalary = !hideSalary && hasSalary;

  const about = f(fields, 'content_about') || f(fields, 'publicSummary') || '';
  const publicSummary = f(fields, 'publicSummary') || f(fields, 'content_about') || '';

  const publishedAt = f(fields, 'publishedAt');

  return {
    id: doc.id,
    code,
    title,
    seniority: f(fields, 'seniority') || '',
    contract: f(fields, 'contract') || '',
    workMode: f(fields, 'workMode') || (f(fields, 'wfh') ? 'remote' : ''),
    wfh: f(fields, 'wfh'),
    location: f(fields, 'location') || '',
    city: f(fields, 'city') || '',
    timezone: f(fields, 'timezone') || '',
    industry: f(fields, 'industry') || '',
    about,
    publicSummary,
    responsibilities: toBullets(f(fields, 'content_responsibilities')),
    qualifications: toBullets(f(fields, 'content_qualifications')),
    benefits: toBullets(f(fields, 'content_benefits')),
    salaryMin: validMin ? salaryMin : null,
    salaryMax: validMax ? salaryMax : null,
    currency,
    hideSalary,
    showSalary,
    publishedAt,
    orgName: f(fields, 'orgName') || '',
  };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

function mapEmploymentType(contract) {
  const c = (contract || '').toLowerCase();
  if (c.includes('payroll') || c.includes('employment') || c.includes('full')) return 'FULL_TIME';
  if (c.includes('contract')) return 'CONTRACTOR';
  return 'FULL_TIME';
}

function isoDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function addDaysIso(ts, days) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function metaBits(job) {
  const bits = [];
  if (job.workMode) bits.push(cap(job.workMode));
  if (job.seniority) bits.push(job.seniority);
  const loc = job.city || job.location;
  if (loc) bits.push(loc);
  return bits;
}

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function salaryLine(job) {
  if (!job.showSalary) return '';
  const min = job.salaryMin;
  const max = job.salaryMax;
  const fmt = (n) => '$' + Number(n).toLocaleString('en-US');
  let range;
  if (min && max && min !== max) range = `${fmt(min)}–${fmt(max)}`;
  else range = fmt(max || min);
  return `${range} ${job.currency} / mo`;
}

// ---------------------------------------------------------------------------
// JSON-LD JobPosting
// ---------------------------------------------------------------------------

function buildJsonLd(job) {
  // HTML description string (Google requires HTML).
  let desc = '';
  const intro = job.about || job.publicSummary;
  if (intro) desc += `<p>${escapeHtml(intro)}</p>`;
  if (job.responsibilities.length) {
    desc += '<h3>Responsibilities</h3><ul>' +
      job.responsibilities.map((b) => `<li>${escapeHtml(b)}</li>`).join('') + '</ul>';
  }
  if (job.qualifications.length) {
    desc += "<h3>What we're looking for</h3><ul>" +
      job.qualifications.map((b) => `<li>${escapeHtml(b)}</li>`).join('') + '</ul>';
  }

  const datePosted = isoDate(job.publishedAt);
  const validThrough = addDaysIso(job.publishedAt, 60);

  const obj = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: desc,
    employmentType: mapEmploymentType(job.contract),
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Nearwork',
      sameAs: 'https://www.nearwork.co',
    },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Colombia',
    },
  };
  if (datePosted) obj.datePosted = datePosted;
  if (validThrough) obj.validThrough = validThrough;

  if (job.showSalary) {
    const minValue = job.salaryMin != null ? job.salaryMin : job.salaryMax;
    const maxValue = job.salaryMax != null ? job.salaryMax : job.salaryMin;
    obj.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.currency,
      value: {
        '@type': 'QuantitativeValue',
        minValue: minValue,
        maxValue: maxValue,
        unitText: 'MONTH',
      },
    };
  }

  return JSON.stringify(obj, null, 2);
}

// ---------------------------------------------------------------------------
// Shared style
// ---------------------------------------------------------------------------

const STYLE = `
  :root { --teal:#16A085; --teal-dark:#0f7a63; --ink:#111; --muted:#5b6670; --line:#e6e9ec; --bg:#f5f7f8; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--ink); background:var(--bg); line-height:1.6; }
  a { color:var(--teal); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .site-header { background:#fff; border-bottom:1px solid var(--line); }
  .site-header .inner { max-width:760px; margin:0 auto; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; }
  .wordmark { font-weight:700; font-size:20px; color:var(--ink); letter-spacing:-0.02em; }
  .wordmark:hover { text-decoration:none; }
  .back-link { font-size:14px; font-weight:500; color:var(--muted); }
  .wrap { max-width:760px; margin:0 auto; padding:32px 20px 64px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:36px 40px; box-shadow:0 1px 2px rgba(17,17,17,0.04); }
  h1 { font-size:30px; line-height:1.2; margin:0 0 14px; letter-spacing:-0.02em; }
  h2 { font-size:19px; margin:32px 0 12px; letter-spacing:-0.01em; }
  .meta-row { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 14px; }
  .chip { background:#eef6f3; color:var(--teal-dark); font-size:13px; font-weight:500; padding:4px 12px; border-radius:999px; }
  .salary { font-size:17px; font-weight:600; color:var(--ink); margin:6px 0 20px; }
  p { margin:0 0 16px; color:#25303a; }
  ul { margin:0 0 8px; padding-left:22px; }
  li { margin:6px 0; color:#25303a; }
  .apply { display:inline-block; margin-top:28px; background:var(--teal); color:#fff; font-weight:600; font-size:16px; padding:14px 32px; border-radius:10px; }
  .apply:hover { background:var(--teal-dark); text-decoration:none; }
  /* Board index */
  .lede { font-size:17px; color:#25303a; max-width:680px; }
  .benefits { list-style:none; padding:0; margin:22px 0 8px; display:grid; gap:10px; }
  .benefits li { padding-left:28px; position:relative; }
  .benefits li:before { content:'\\2713'; position:absolute; left:0; color:var(--teal); font-weight:700; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; margin-top:28px; }
  .job-card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:22px 24px; display:flex; flex-direction:column; transition:box-shadow .15s,transform .15s; }
  .job-card:hover { box-shadow:0 6px 18px rgba(17,17,17,0.08); transform:translateY(-2px); }
  .job-card h3 { font-size:17px; margin:0 0 8px; letter-spacing:-0.01em; }
  .job-card .jmeta { font-size:13px; color:var(--muted); margin:0 0 16px; }
  .job-card .view { margin-top:auto; font-weight:600; font-size:14px; }
  .empty { color:var(--muted); font-size:16px; margin-top:24px; }
  .categories { margin-top:30px; }
  .categories h2 { font-size:16px; margin:0 0 12px; color:var(--muted); font-weight:600; letter-spacing:0; }
  .cat-links { display:flex; flex-wrap:wrap; gap:10px; }
  .cat-links a { background:#eef6f3; color:var(--teal-dark); font-size:14px; font-weight:600; padding:10px 18px; border-radius:999px; }
  .cat-links a:hover { background:#e0efe9; text-decoration:none; }
`;

function headerHtml() {
  return `  <header class="site-header">
    <div class="inner">
      <a class="wordmark" href="/">Nearwork</a>
      <a class="back-link" href="/jobs">← All jobs</a>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// Per-job page
// ---------------------------------------------------------------------------

function renderJobPage(job) {
  const desc = truncate(job.publicSummary || job.about, 155);
  const jsonLd = buildJsonLd(job);
  const chips = metaBits(job).map((b) => `<span class="chip">${escapeHtml(b)}</span>`).join('\n        ');
  const salary = salaryLine(job);
  const intro = job.about || job.publicSummary;

  let body = '';
  if (intro) body += `      <p>${escapeHtml(intro)}</p>\n`;
  if (job.responsibilities.length) {
    body += '      <h2>Responsibilities</h2>\n      <ul>\n' +
      job.responsibilities.map((b) => `        <li>${escapeHtml(b)}</li>`).join('\n') +
      '\n      </ul>\n';
  }
  if (job.qualifications.length) {
    body += "      <h2>What we're looking for</h2>\n      <ul>\n" +
      job.qualifications.map((b) => `        <li>${escapeHtml(b)}</li>`).join('\n') +
      '\n      </ul>\n';
  }
  if (job.benefits.length) {
    body += '      <h2>Benefits</h2>\n      <ul>\n' +
      job.benefits.map((b) => `        <li>${escapeHtml(b)}</li>`).join('\n') +
      '\n      </ul>\n';
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(job.title)} — Remote Job in Latin America | Nearwork</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <link rel="canonical" href="${CANONICAL_BASE}/jobs/${escapeHtml(job.code)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script type="application/ld+json">
${jsonLd}
  </script>
  <style>${STYLE}</style>
</head>
<body>
${headerHtml()}
  <main class="wrap">
    <article class="card">
      <h1>${escapeHtml(job.title)}</h1>
      <div class="meta-row">
        ${chips}
      </div>
${salary ? `      <div class="salary">${escapeHtml(salary)}</div>\n` : ''}${body}      <a class="apply" href="https://jobs.nearwork.co/apply/${escapeHtml(job.code)}">Apply for this role</a>
    </article>
  </main>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Board index
// ---------------------------------------------------------------------------

function renderIndex(jobs) {
  const cards = jobs.map((job) => {
    const meta = metaBits(job).map(escapeHtml).join(' · ');
    return `      <a class="job-card" href="/jobs/${escapeHtml(job.code)}">
        <h3>${escapeHtml(job.title)}</h3>
        <div class="jmeta">${meta}</div>
        <span class="view">View role →</span>
      </a>`;
  }).join('\n');

  const gridOrEmpty = jobs.length
    ? `    <div class="grid">\n${cards}\n    </div>`
    : `    <p class="empty">No open roles right now — check back soon.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remote Jobs in Latin America — Paid in USD | Nearwork</title>
  <meta name="description" content="Find fully-remote jobs with US &amp; Canada companies, open to professionals across Latin America and paid in USD. Browse current openings across 18 industries.">
  <link rel="canonical" href="${CANONICAL_BASE}/jobs">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    // Forward old jobs.nearwork.co/#NW-1234 deep links to the new per-job page.
    (function () {
      var m = /^#(NW-\\w+)/i.exec(location.hash || '');
      if (m) location.replace('/jobs/' + m[1]);
    })();
  </script>
  <style>${STYLE}</style>
</head>
<body>
${headerHtml()}
  <main class="wrap">
    <h1>Remote Jobs at US &amp; Canada Companies — For Talent Across Latin America</h1>
    <p class="lede">Nearwork connects skilled professionals across Latin America with fully-remote roles at growing companies in the US and Canada. Whether you're in customer support, software development, finance, marketing, or one of many other fields, you'll find real opportunities that pay in USD and let you build your career from wherever you call home.</p>
    <ul class="benefits">
      <li><strong>Paid in USD</strong> — Earn a competitive salary in US dollars.</li>
      <li><strong>Fully remote</strong> — Work from anywhere in Latin America, no relocation.</li>
      <li><strong>US &amp; Canada companies</strong> — Join established teams hiring across 18 industries.</li>
    </ul>
    <div class="categories">
      <h2>Browse by category</h2>
      <div class="cat-links">
        <a href="/jobs/remote-customer-support-latin-america">Remote Customer Support Jobs →</a>
        <a href="/jobs/remote-software-developer-latin-america">Remote Software Developer Jobs →</a>
      </div>
    </div>
${gridOrEmpty}
  </main>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Category hub pages
// ---------------------------------------------------------------------------

const HUBS = [
  {
    slug: 'remote-customer-support-latin-america',
    keywords: ['support', 'customer', 'cx', 'help desk', 'helpdesk', 'success'],
    title: 'Remote Customer Support Jobs in Latin America | Nearwork',
    description: 'Remote customer support jobs with US & Canada companies, open to professionals across Latin America and paid in USD. Browse current openings and apply today.',
    canonical: `${CANONICAL_BASE}/jobs/remote-customer-support-latin-america`,
    h1: 'Remote Customer Support Jobs in Latin America',
    intro: "Looking for a remote customer support job that pays in USD? Nearwork helps talented professionals across Latin America land fully-remote support roles with companies in the US and Canada. From customer success and technical support to help-desk and account management, these positions let you put your English skills and problem-solving talent to work for growing international teams — all without leaving your home country. You'll be paid a competitive salary in US dollars. Browse our current remote customer support openings below.",
  },
  {
    slug: 'remote-software-developer-latin-america',
    keywords: ['developer', 'engineer', 'software', 'frontend', 'backend', 'full-stack', 'fullstack', 'devops', 'mobile', '.net', 'react', 'python', 'java', 'node'],
    title: 'Remote Software Developer Jobs in Latin America | Nearwork',
    description: 'Remote software developer jobs with US & Canada companies, open to engineers across Latin America and paid in USD. Explore current openings and apply today.',
    canonical: `${CANONICAL_BASE}/jobs/remote-software-developer-latin-america`,
    h1: 'Remote Software Developer Jobs in Latin America',
    intro: "Ready for a remote software developer job that pays in USD? Nearwork connects engineers across Latin America with fully-remote roles at companies in the US and Canada. Whether you work in frontend, backend, full-stack, mobile, or DevOps, you'll find opportunities to build real products alongside talented international teams — from your home anywhere in the region. You'll earn a competitive salary in US dollars, work on modern stacks, and grow your career with an established company. Browse our current remote developer openings below.",
  },
];

// Does a job match a hub's keywords (in title or industry)?
function jobMatchesHub(job, hub) {
  const hay = `${job.title || ''} ${job.industry || ''}`.toLowerCase();
  return hub.keywords.some((k) => hay.includes(k.toLowerCase()));
}

function renderHub(hub, jobs) {
  const matching = jobs.filter((job) => jobMatchesHub(job, hub));

  const cards = matching.map((job) => {
    const meta = metaBits(job).map(escapeHtml).join(' · ');
    return `      <a class="job-card" href="/jobs/${escapeHtml(job.code)}">
        <h3>${escapeHtml(job.title)}</h3>
        <div class="jmeta">${meta}</div>
        <span class="view">View role →</span>
      </a>`;
  }).join('\n');

  const gridOrEmpty = matching.length
    ? `    <div class="grid">\n${cards}\n    </div>`
    : `    <p class="empty">No open roles in this category right now — check back soon, or <a href="/jobs">browse all jobs</a>.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(hub.title)}</title>
  <meta name="description" content="${escapeHtml(hub.description)}">
  <link rel="canonical" href="${hub.canonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${STYLE}</style>
</head>
<body>
${headerHtml()}
  <main class="wrap">
    <h1>${escapeHtml(hub.h1)}</h1>
    <p class="lede">${escapeHtml(hub.intro)}</p>
${gridOrEmpty}
  </main>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

// Rewrite sitemap.xml so its /jobs entries exactly match the current board.
// Idempotent: strips every existing <url> whose <loc> contains "/jobs", then
// appends the current set. All non-jobs entries are left untouched.
function updateSitemap(jobs) {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.warn(`\nsitemap.xml not found at ${SITEMAP_PATH} — skipping sitemap update.`);
    return [];
  }
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');

  // Remove any existing <url>…</url> block whose <loc> contains "/jobs".
  xml = xml.replace(/[ \t]*<url>[\s\S]*?<\/url>\s*/g, (block) => {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(block);
    if (loc && loc[1].includes('/jobs')) return '';
    return block;
  });

  // Build the current jobs URL set.
  const urls = [];
  urls.push({ loc: `${CANONICAL_BASE}/jobs`, changefreq: 'daily', priority: '0.8' });
  for (const hub of HUBS) {
    urls.push({ loc: `${CANONICAL_BASE}/jobs/${hub.slug}`, changefreq: 'weekly', priority: '0.7' });
  }
  for (const job of jobs) {
    urls.push({ loc: `${CANONICAL_BASE}/jobs/${job.code}`, changefreq: 'weekly', priority: '0.6' });
  }

  const blocks = urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${SITEMAP_LASTMOD}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

  // Insert the new blocks immediately before </urlset>.
  xml = xml.replace(/\s*<\/urlset>\s*$/, `\n${blocks}\n</urlset>\n`);

  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  return urls.map((u) => u.loc);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching published openings from Firestore…');
  const docs = await fetchOpenings();
  console.log(`Firestore returned ${docs.length} published document(s).`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [];
  const skipped = [];
  for (const doc of docs) {
    const job = buildJob(doc);
    if (!job.title || !job.code) {
      skipped.push({ id: doc.id, reason: !job.title ? 'missing title' : 'missing code' });
      continue;
    }
    jobs.push(job);
  }

  // Sort newest first by publishedAt desc.
  jobs.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  let pagesWritten = 0;
  let salaryShown = 0;
  let salaryHidden = 0;
  const emptyDesc = [];

  for (const job of jobs) {
    const html = renderJobPage(job);
    fs.writeFileSync(path.join(OUT_DIR, `${job.code}.html`), html, 'utf8');
    pagesWritten++;
    if (job.showSalary) salaryShown++;
    else salaryHidden++;
    if (!job.about && !job.publicSummary) emptyDesc.push(job.code);
  }

  // Index page.
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(jobs), 'utf8');
  pagesWritten++;

  // Category hub pages.
  for (const hub of HUBS) {
    fs.writeFileSync(path.join(OUT_DIR, `${hub.slug}.html`), renderHub(hub, jobs), 'utf8');
    pagesWritten++;
    const matched = jobs.filter((job) => jobMatchesHub(job, hub)).length;
    console.log(`Hub "${hub.slug}": ${matched} matching job(s).`);
  }

  // Update sitemap with current job + hub URLs.
  const sitemapJobUrls = updateSitemap(jobs);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n===== BUILD SUMMARY =====');
  console.log(`Published jobs found:      ${docs.length}`);
  console.log(`Jobs rendered:             ${jobs.length}`);
  console.log(`Pages written:             ${pagesWritten} (${jobs.length} job pages + 1 index + ${HUBS.length} hubs)`);
  console.log(`Sitemap /jobs URLs:        ${sitemapJobUrls.length} (1 board + ${HUBS.length} hubs + ${jobs.length} jobs)`);
  console.log(`Salary shown:              ${salaryShown}`);
  console.log(`Salary hidden/none:        ${salaryHidden}`);
  if (skipped.length) {
    console.log(`Skipped (missing data):    ${skipped.length}`);
    for (const s of skipped) console.log(`   - ${s.id}: ${s.reason}`);
  } else {
    console.log('Skipped (missing data):    0');
  }
  if (emptyDesc.length) {
    console.log(`Jobs with empty intro:     ${emptyDesc.length} (${emptyDesc.join(', ')})`);
  }

  // -------------------------------------------------------------------------
  // Validate: every jobs/*.html JSON-LD parses.
  // -------------------------------------------------------------------------
  console.log('\n===== JSON-LD VALIDATION =====');
  const hubFiles = new Set(HUBS.map((h) => `${h.slug}.html`));
  const files = fs.readdirSync(OUT_DIR)
    .filter((n) => n.endsWith('.html') && n !== 'index.html' && !hubFiles.has(n));
  let validLd = 0;
  let missingLd = 0;
  const badLd = [];
  for (const name of files) {
    const html = fs.readFileSync(path.join(OUT_DIR, name), 'utf8');
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) {
      missingLd++;
      badLd.push(`${name}: no JSON-LD block`);
      continue;
    }
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed['@type'] === 'JobPosting') validLd++;
      else badLd.push(`${name}: @type is not JobPosting`);
    } catch (e) {
      badLd.push(`${name}: JSON parse error — ${e.message}`);
    }
  }
  console.log(`HTML job pages checked:    ${files.length}`);
  console.log(`Valid JobPosting JSON-LD:  ${validLd}`);
  if (missingLd) console.log(`Missing JSON-LD:           ${missingLd}`);
  if (badLd.length) {
    console.log('Problems:');
    for (const b of badLd) console.log(`   - ${b}`);
  } else {
    console.log('All JSON-LD blocks parse cleanly.');
  }
}

main().catch((err) => {
  console.error('BUILD FAILED:', err);
  process.exit(1);
});
