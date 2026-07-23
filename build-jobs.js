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
// Presentation helpers (high-fidelity redesign)
// ---------------------------------------------------------------------------

// Company logo tile colors (from the design handoff demo palette).
const BRAND_PALETTE = ['#16A085', '#E74C7C', '#AF7AC5', '#1ABC9C', '#3B82F6'];

// Deterministic color from a seed string, so a company keeps the same tile.
function brandColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return BRAND_PALETTE[h % BRAND_PALETTE.length];
}

function initialOf(job) {
  const src = (job.orgName || job.title || '?').trim();
  const m = src.match(/[A-Za-z0-9]/);
  return (m ? m[0] : '?').toUpperCase();
}

function companyName(job) {
  return job.orgName || 'Nearwork';
}

function workTypeLabel(job) {
  return mapEmploymentType(job.contract) === 'CONTRACTOR' ? 'Contract' : 'Full-time';
}

function locationLabel(job) {
  return job.location || job.city || job.timezone || 'Remote';
}

function experienceLabel(job) {
  return job.seniority || '';
}

function daysSince(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function isNewJob(job) {
  const d = daysSince(job.publishedAt);
  return d !== null && d >= 0 && d <= 14;
}

function postedAgo(job) {
  const d = daysSince(job.publishedAt);
  if (d === null) return '';
  if (d <= 0) return 'Posted today';
  if (d === 1) return 'Posted 1 day ago';
  if (d < 7) return `Posted ${d} days ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `Posted ${w} week${w === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  return `Posted ${mo <= 1 ? '1 month' : mo + ' months'} ago`;
}

// Inline SVG icon set (stroke-based; colored via CSS).
const ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  dollar: '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.9 7.6.6-5.8 5 1.8 7.5L12 18l-6.4 4 1.8-7.5-5.8-5 7.6-.6z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
  crumb: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>',
};

function chipHtml(icon, label) {
  return `<span class="meta-chip">${icon}${escapeHtml(label)}</span>`;
}

function factHtml(icon, inner) {
  return `<div class="fact">${icon}${inner}</div>`;
}

function sectionHtml(heading, inner) {
  return `      <div class="section">
        <h2>${escapeHtml(heading)}</h2>
        ${inner}
      </div>\n`;
}

function bulletList(items) {
  return `<ul>\n${items.map((b) => `          <li>${escapeHtml(b)}</li>`).join('\n')}\n        </ul>`;
}

function checkList(items) {
  return `<ul>\n${items.map((b) => `          <li class="check">${escapeHtml(b)}</li>`).join('\n')}\n        </ul>`;
}

function benefitsGrid(benefits) {
  const cards = benefits.map((b) =>
    `<div class="benefit"><div class="benefit-ico">${ICON.check}</div><div><div class="benefit-label">${escapeHtml(b)}</div></div></div>`
  ).join('');
  return `<div class="benefits-grid">${cards}</div>`;
}

// PostHog snippet — added to <head> of every generated page (matches the site).
const POSTHOG = `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once set_config".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init("phc_nYb2G6jySuJgxmmc55d9jMfT5TyuxpBGbgbZAGfYb7Ep",{api_host:"https://us.i.posthog.com",person_profiles:"identified_only"});</script>`;

// ---------------------------------------------------------------------------
// Shared style
// ---------------------------------------------------------------------------

const STYLE = `
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --teal:#16A085; --teal-dk:#0E7060; --teal-lt:#E4F5F1; --teal-mid:#A4DAD0;
    --gold:#E74C7C; --gold-dk:#B43564; --gold-lt:#FDEEF4;
    --violet:#AF7AC5; --violet-lt:#F3EEF9;
    --fg:#111111; --fg-2:#4A4A4A; --fg-3:#888888; --fg-4:#B8B8B5;
    --border:#E8E8E4; --border-d:#D8D8D4;
    --bg:#FAFAF8; --bg-cream:#F5F2EC; --white:#FFFFFF;
    --ease:cubic-bezier(0.16,1,0.3,1); --max-w:1200px;
  }
  html { scroll-behavior:smooth; -webkit-font-smoothing:antialiased; }
  body { font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--fg); overflow-x:hidden; line-height:1.6; }
  a { color:var(--teal-dk); text-decoration:none; }
  a:hover { color:var(--teal); }
  svg { display:block; }

  /* ══ NAV ══ */
  .nav-wrap { position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:200; width:calc(100% - 48px); max-width:1140px; }
  .nav-pill { position:relative; background:rgba(255,255,255,0.92); backdrop-filter:blur(20px) saturate(180%); -webkit-backdrop-filter:blur(20px) saturate(180%); border:1px solid rgba(255,255,255,0.9); border-radius:18px; box-shadow:0 4px 24px rgba(0,0,0,0.08),0 1px 3px rgba(0,0,0,0.04); padding:0 8px 0 18px; height:60px; display:flex; align-items:center; justify-content:space-between; transition:box-shadow 300ms var(--ease),background 300ms; }
  .nav-pill.scrolled { background:rgba(255,255,255,0.97); box-shadow:0 8px 40px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.05); }
  .wordmark { position:relative; display:inline-block; font-weight:700; font-size:20px; color:var(--fg); letter-spacing:-0.03em; line-height:1; text-decoration:none; flex-shrink:0; }
  .wordmark::after { content:''; position:absolute; bottom:-3px; left:0; width:56%; height:3px; background:var(--teal); border-radius:2px; }
  .wordmark:hover { color:var(--fg); }
  .nav-center { display:flex; align-items:center; gap:2px; flex:1; justify-content:center; }
  .nav-link { font-size:13.5px; font-weight:500; color:var(--fg-2); padding:7px 14px; border-radius:10px; transition:color 150ms,background 150ms; white-space:nowrap; }
  .nav-link:hover { color:var(--fg); background:var(--bg-cream); }
  .nav-link.active { color:var(--teal-dk); font-weight:600; }
  .nav-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .nav-ghost { font-size:13px; font-weight:600; color:var(--teal-dk); text-decoration:none; padding:8px 16px; border-radius:10px; border:1.5px solid transparent; transition:color 150ms,background 150ms,border-color 150ms; white-space:nowrap; }
  .nav-ghost:hover { color:#fff; background:var(--teal); border-color:var(--teal); }
  .nav-cta { display:inline-flex; align-items:center; gap:6px; background:var(--fg); color:#fff; font-size:13px; font-weight:600; text-decoration:none; padding:9px 16px; border-radius:11px; transition:background 150ms,transform 100ms; white-space:nowrap; }
  .nav-cta:hover { background:#2a2a2a; color:#fff; }
  .nav-cta:active { transform:scale(0.97); }
  .nav-cta svg { width:13px; height:13px; stroke:currentColor; stroke-width:2.5; fill:none; }
  .hamburger { display:none; flex-direction:column; gap:5px; background:none; border:none; cursor:pointer; padding:10px; }
  .hamburger span { display:block; width:20px; height:2px; background:var(--fg); border-radius:2px; transition:all 0.25s; }
  .mobile-menu { display:none; position:fixed; top:88px; left:16px; right:16px; z-index:199; background:var(--white); border:1px solid var(--border); border-radius:18px; padding:18px; box-shadow:0 16px 64px rgba(0,0,0,0.14); max-height:calc(100vh - 110px); overflow-y:auto; }
  .mobile-menu.open { display:block; }
  .mob-section { margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--border); }
  .mob-section:last-child { border-bottom:none; }
  .mob-section-title { font-size:11px; font-weight:700; color:var(--fg-3); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; padding:0 4px; }
  .mob-link { display:block; font-size:14px; font-weight:500; color:var(--fg); text-decoration:none; padding:10px 8px; border-radius:8px; }
  .mob-link:hover { background:var(--bg-cream); }
  .mob-ctas { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
  .mob-primary { display:block; text-align:center; padding:14px; border-radius:11px; background:var(--fg); color:#fff; font-size:15px; font-weight:600; text-decoration:none; }
  .mob-ghost { display:block; text-align:center; padding:14px; border-radius:11px; border:1.5px solid var(--border-d); color:var(--fg); font-size:15px; font-weight:600; text-decoration:none; }

  /* ══ JOBS HERO ══ */
  .jobs-hero { max-width:var(--max-w); margin:0 auto; padding:128px 48px 36px; }
  .eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--teal-dk); margin-bottom:18px; }
  .eyebrow::before { content:''; width:22px; height:2px; background:var(--teal); border-radius:2px; }
  .jobs-hero h1 { font-size:clamp(38px,5.6vw,60px); font-weight:800; letter-spacing:-0.035em; line-height:1.03; }
  .jobs-hero h1 em, .jobs-hero h1 .accent { font-style:normal; color:var(--teal); }
  .jobs-lede { font-size:18px; color:var(--fg-2); line-height:1.6; max-width:560px; margin-top:18px; text-wrap:pretty; }
  .hero-stats { display:flex; gap:10px; flex-wrap:wrap; margin-top:26px; }
  .stat-chip { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--fg-2); background:var(--white); border:1px solid var(--border); padding:9px 15px; border-radius:999px; }
  .stat-chip svg { width:15px; height:15px; stroke:var(--teal); stroke-width:2; fill:none; }
  .stat-chip strong { color:var(--fg); }
  .hub-links { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
  .hub-links a { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--teal-dk); background:var(--teal-lt); border:1px solid var(--teal-mid); padding:8px 15px; border-radius:999px; transition:background 150ms; }
  .hub-links a:hover { background:#d5efe8; color:var(--teal-dk); }
  .hub-links a svg { width:14px; height:14px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; }

  /* ══ FILTER BAR ══ */
  .filter-bar { position:sticky; top:84px; z-index:100; }
  .filter-bar::before { content:''; position:absolute; inset:0 -50vw; background:rgba(250,250,248,0.88); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-bottom:1px solid var(--border); z-index:-1; }
  .filter-inner { max-width:var(--max-w); margin:0 auto; padding:14px 48px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .job-search { position:relative; flex:1; min-width:220px; display:flex; align-items:center; }
  .job-search svg { position:absolute; left:15px; width:17px; height:17px; stroke:var(--fg-3); stroke-width:2; fill:none; pointer-events:none; }
  .job-search input { width:100%; font-family:inherit; font-size:14px; color:var(--fg); padding:12px 16px 12px 42px; border-radius:12px; border:1.5px solid var(--border); background:var(--white); outline:none; transition:border-color 160ms,box-shadow 160ms; }
  .job-search input::placeholder { color:var(--fg-3); }
  .job-search input:focus { border-color:var(--teal-mid); box-shadow:0 0 0 4px var(--teal-lt); }
  .filter-select { position:relative; }
  .filter-select select { appearance:none; -webkit-appearance:none; font-family:inherit; font-size:13.5px; font-weight:500; color:var(--fg-2); background:var(--white); border:1.5px solid var(--border); border-radius:12px; padding:12px 38px 12px 15px; cursor:pointer; outline:none; transition:border-color 160ms; }
  .filter-select select:hover { border-color:var(--teal-mid); }
  .filter-select select:focus { border-color:var(--teal); }
  .filter-select.set select { border-color:var(--teal-mid); color:var(--teal-dk); background:var(--teal-lt); font-weight:600; }
  .filter-select svg { position:absolute; right:14px; top:50%; transform:translateY(-50%); width:12px; height:12px; stroke:var(--fg-3); stroke-width:2.5; fill:none; pointer-events:none; }

  /* ══ RESULT ROW ══ */
  .result-row { max-width:var(--max-w); margin:0 auto; padding:26px 48px 6px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .result-count { font-size:15px; color:var(--fg-2); }
  .result-count strong { color:var(--fg); font-weight:700; }
  .clear-btn { font-family:inherit; font-size:13px; font-weight:600; color:var(--teal-dk); background:none; border:none; cursor:pointer; display:none; align-items:center; gap:5px; }
  .clear-btn.show { display:inline-flex; }
  .clear-btn svg { width:13px; height:13px; stroke:currentColor; stroke-width:2.5; fill:none; }

  /* ══ JOB GRID ══ */
  .job-grid { max-width:var(--max-w); margin:0 auto; padding:18px 48px 96px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .job-card { position:relative; display:flex; flex-direction:column; background:var(--white); border:1px solid var(--border); border-radius:20px; padding:24px; transition:transform 200ms var(--ease),box-shadow 200ms var(--ease),border-color 200ms; text-decoration:none; }
  .job-card:hover { transform:translateY(-4px); box-shadow:0 16px 44px rgba(0,0,0,0.09); border-color:var(--border-d); }
  .jc-top { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
  .jc-logo { width:48px; height:48px; border-radius:13px; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:#fff; flex-shrink:0; }
  .jc-head { flex:1; min-width:0; }
  .jc-title { font-size:18px; font-weight:700; letter-spacing:-0.02em; line-height:1.25; color:var(--fg); }
  .job-card:hover .jc-title { color:var(--teal-dk); }
  .jc-company { font-size:13.5px; color:var(--fg-3); margin-top:3px; }
  .jc-company strong { color:var(--fg-2); font-weight:600; }
  .jc-badge { flex-shrink:0; font-size:10.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; padding:4px 9px; border-radius:999px; }
  .badge-new { background:var(--teal-lt); color:var(--teal-dk); }
  .jc-meta { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:16px; }
  .meta-chip { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:500; color:var(--fg-2); background:var(--bg-cream); padding:5px 10px; border-radius:8px; }
  .meta-chip svg { width:12px; height:12px; stroke:var(--fg-3); stroke-width:2; fill:none; }
  .jc-salary { font-size:15px; font-weight:700; color:var(--fg); letter-spacing:-0.01em; margin-top:auto; margin-bottom:0; }
  .jc-foot { display:flex; align-items:center; justify-content:space-between; margin-top:18px; padding-top:16px; border-top:1px solid var(--border); }
  .jc-posted { font-size:12px; color:var(--fg-3); }
  .jc-view { display:inline-flex; align-items:center; gap:5px; font-size:13px; font-weight:700; color:var(--teal-dk); transition:gap 150ms; }
  .job-card:hover .jc-view { gap:9px; }
  .jc-view svg { width:14px; height:14px; stroke:currentColor; stroke-width:2.4; fill:none; }

  .empty-state { grid-column:1 / -1; padding:70px 24px; text-align:center; border:1px dashed var(--border-d); border-radius:20px; color:var(--fg-3); }
  .empty-state svg { width:36px; height:36px; stroke:var(--fg-4); stroke-width:1.5; fill:none; margin:0 auto 12px; }
  .empty-state h3 { font-size:17px; font-weight:600; color:var(--fg-2); margin-bottom:4px; }
  .empty-state p { font-size:14px; }

  /* ══ SIGN-IN TEASER ══ */
  .teaser { max-width:var(--max-w); margin:0 auto 40px; padding:0 48px; }
  .teaser-inner { display:flex; align-items:center; gap:16px; background:var(--teal-lt); border:1px solid var(--teal-mid); border-radius:16px; padding:16px 22px; }
  .teaser-inner > svg { width:22px; height:22px; stroke:var(--teal-dk); stroke-width:2; fill:none; flex-shrink:0; }
  .teaser-text { flex:1; font-size:14px; color:var(--teal-dk); line-height:1.5; }
  .teaser-text strong { font-weight:700; }
  .teaser-cta { flex-shrink:0; font-size:13px; font-weight:700; color:#fff; background:var(--teal-dk); padding:10px 18px; border-radius:10px; white-space:nowrap; }
  .teaser-cta:hover { color:#fff; background:var(--teal); }

  /* ══ DETAIL HEADER ══ */
  .detail-head { max-width:var(--max-w); margin:0 auto; padding:120px 48px 0; }
  .breadcrumb { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--fg-3); margin-bottom:26px; flex-wrap:wrap; }
  .breadcrumb a { color:var(--fg-3); font-weight:500; }
  .breadcrumb a:hover { color:var(--fg); }
  .breadcrumb svg { width:13px; height:13px; stroke:var(--fg-4); stroke-width:2; fill:none; }
  .head-card { display:flex; align-items:flex-start; gap:20px; }
  .head-logo { width:64px; height:64px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:800; color:#fff; flex-shrink:0; }
  .head-main { flex:1; min-width:0; }
  .head-badges { display:flex; gap:8px; margin-bottom:10px; }
  .detail-head h1 { font-size:clamp(30px,4vw,42px); font-weight:800; letter-spacing:-0.03em; line-height:1.08; }
  .head-company { font-size:16px; color:var(--fg-2); margin-top:8px; }
  .head-company strong { color:var(--fg); font-weight:600; }

  /* ══ DETAIL LAYOUT ══ */
  .detail-layout { max-width:var(--max-w); margin:0 auto; padding:40px 48px 88px; display:grid; grid-template-columns:1fr 350px; gap:56px; align-items:start; }
  .detail-body { min-width:0; }
  .detail-body .meta-row { display:flex; flex-wrap:wrap; gap:9px; margin-bottom:32px; }
  .detail-body .meta-row .meta-chip { font-size:13px; color:var(--fg-2); background:var(--white); border:1px solid var(--border); padding:8px 13px; border-radius:10px; }
  .detail-body .meta-row .meta-chip svg { width:14px; height:14px; stroke:var(--teal); }
  .detail-body .meta-row .meta-chip strong { color:var(--fg); font-weight:600; }
  .section { margin-bottom:36px; }
  .section h2 { font-size:21px; font-weight:700; letter-spacing:-0.02em; color:var(--fg); margin-bottom:14px; }
  .section p { font-size:15.5px; color:var(--fg-2); line-height:1.7; margin-bottom:12px; text-wrap:pretty; white-space:pre-line; }
  .section ul { list-style:none; display:flex; flex-direction:column; gap:11px; }
  .section li { position:relative; padding-left:28px; font-size:15px; color:var(--fg-2); line-height:1.6; }
  .section li::before { content:''; position:absolute; left:2px; top:9px; width:8px; height:8px; border-radius:50%; background:var(--teal-mid); }
  .section li.check::before { content:''; left:0; top:4px; width:16px; height:16px; border-radius:50%; background:var(--teal-lt) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2316A085' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E") center/11px no-repeat; }
  .benefits-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .benefit { display:flex; gap:13px; align-items:flex-start; background:var(--white); border:1px solid var(--border); border-radius:14px; padding:16px; }
  .benefit-ico { width:38px; height:38px; border-radius:10px; background:var(--teal-lt); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .benefit-ico svg { width:18px; height:18px; stroke:var(--teal-dk); stroke-width:2; fill:none; }
  .benefit-label { font-size:14px; font-weight:600; color:var(--fg); line-height:1.4; }

  /* ══ APPLY RAIL ══ */
  .apply-rail { position:sticky; top:96px; display:flex; flex-direction:column; gap:16px; }
  .apply-card { background:var(--white); border:1px solid var(--border); border-radius:20px; padding:24px; box-shadow:0 8px 30px rgba(0,0,0,0.05); }
  .apply-salary { font-size:24px; font-weight:800; letter-spacing:-0.02em; color:var(--fg); line-height:1.2; }
  .apply-salary span { display:block; font-size:12.5px; font-weight:500; color:var(--fg-3); letter-spacing:0; margin-top:4px; }
  .apply-facts { display:flex; flex-direction:column; gap:12px; margin:20px 0; padding:20px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
  .fact { display:flex; align-items:center; gap:11px; font-size:13.5px; color:var(--fg-2); }
  .fact svg { width:16px; height:16px; stroke:var(--fg-3); stroke-width:2; fill:none; flex-shrink:0; }
  .fact strong { color:var(--fg); font-weight:600; }
  .btn-apply { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; font-size:15px; font-weight:700; color:#fff; background:var(--fg); border:none; padding:15px; border-radius:13px; cursor:pointer; text-decoration:none; transition:background 150ms,transform 100ms; }
  .btn-apply:hover { background:#2a2a2a; color:#fff; }
  .btn-apply:active { transform:scale(0.98); }
  .btn-apply svg { width:16px; height:16px; stroke:currentColor; stroke-width:2.4; fill:none; }
  .btn-save { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; font-size:14px; font-weight:600; color:var(--fg-2); background:var(--white); border:1.5px solid var(--border); padding:12px; border-radius:12px; cursor:pointer; text-decoration:none; margin-top:10px; transition:all 150ms; }
  .btn-save:hover { border-color:var(--teal-mid); color:var(--teal-dk); background:var(--teal-lt); }
  .btn-save svg { width:15px; height:15px; stroke:currentColor; stroke-width:2; fill:none; }
  .apply-note { font-size:12px; color:var(--fg-3); line-height:1.5; margin-top:14px; text-align:center; }
  .apply-note a { font-weight:600; }
  .trust-card { background:var(--teal-lt); border:1px solid var(--teal-mid); border-radius:16px; padding:18px 20px; }
  .trust-card h4 { font-size:13px; font-weight:700; color:var(--teal-dk); margin-bottom:6px; }
  .trust-card p { font-size:12.5px; color:var(--teal-dk); line-height:1.55; opacity:0.9; }

  /* ══ RELATED ══ */
  .related { max-width:var(--max-w); margin:0 auto; padding:0 48px 90px; }
  .related h2 { font-size:24px; font-weight:800; letter-spacing:-0.02em; margin-bottom:24px; }
  .related-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  .rel-card { background:var(--white); border:1px solid var(--border); border-radius:18px; padding:20px; transition:transform 200ms var(--ease),box-shadow 200ms var(--ease); text-decoration:none; }
  .rel-card:hover { transform:translateY(-4px); box-shadow:0 14px 40px rgba(0,0,0,0.08); }
  .rel-top { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
  .rel-logo { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:17px; font-weight:800; color:#fff; flex-shrink:0; }
  .rel-title { font-size:15.5px; font-weight:700; letter-spacing:-0.01em; line-height:1.25; color:var(--fg); }
  .rel-card:hover .rel-title { color:var(--teal-dk); }
  .rel-company { font-size:12.5px; color:var(--fg-3); margin-top:2px; }
  .rel-meta { font-size:12.5px; color:var(--fg-2); display:flex; gap:8px; flex-wrap:wrap; }
  .rel-sal { font-weight:700; color:var(--fg); }

  /* ══ FOOTER ══ */
  footer { background:var(--white); border-top:1px solid var(--border); padding:72px 0 0; margin-top:20px; }
  .footer-grid { max-width:var(--max-w); margin:0 auto 56px; padding:0 48px; display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; }
  .footer-brand-desc { font-size:14px; color:var(--fg-2); line-height:1.65; max-width:300px; margin:18px 0 0; }
  .footer-col-title { font-size:11px; font-weight:700; color:var(--fg); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:16px; }
  .footer-links { list-style:none; display:flex; flex-direction:column; gap:10px; }
  .footer-links li a { font-size:13.5px; color:var(--fg-2); text-decoration:none; transition:color 150ms; }
  .footer-links li a:hover { color:var(--fg); }
  .footer-bottom { max-width:var(--max-w); margin:0 auto; padding:24px 48px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .footer-copy { font-size:13px; color:var(--fg-3); }
  .footer-co { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--fg-3); }
  .footer-co svg { width:12px; height:12px; stroke:currentColor; stroke-width:2; fill:none; }

  /* ══ RESPONSIVE ══ */
  @media (max-width:1024px) {
    .nav-center { display:none; }
    .hamburger { display:flex; }
    .detail-layout { grid-template-columns:1fr; gap:8px; }
    .apply-rail { position:static; margin-top:16px; }
    .related-grid { grid-template-columns:1fr 1fr; }
    .footer-grid { grid-template-columns:1fr 1fr 1fr; gap:36px; padding:0 32px; }
    .footer-grid > div:first-child { grid-column:1 / -1; }
    .footer-bottom { padding:24px 32px; }
  }
  @media (max-width:768px) {
    .nav-wrap { width:calc(100% - 24px); top:10px; }
    .nav-right .nav-ghost { display:none; }
    .hamburger { margin-left:auto; }
    .jobs-hero { padding:108px 24px 24px; }
    .filter-inner { padding:14px 24px; }
    .filter-select select { padding:11px 34px 11px 13px; }
    .result-row { padding:22px 24px 4px; }
    .job-grid { grid-template-columns:1fr; padding:16px 24px 72px; }
    .teaser { padding:0 24px; }
    .teaser-inner { flex-direction:column; align-items:flex-start; }
    .detail-head { padding:104px 24px 0; }
    .head-logo { width:52px; height:52px; font-size:22px; }
    .detail-layout { padding:32px 24px 64px; }
    .benefits-grid { grid-template-columns:1fr; }
    .related { padding:0 24px 72px; }
    .related-grid { grid-template-columns:1fr; }
    .footer-grid { grid-template-columns:1fr 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior:auto; }
    *,*::before,*::after { animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important; }
  }
`;

// ---------------------------------------------------------------------------
// Shared shell: nav, footer, and <head> builder
// ---------------------------------------------------------------------------

function navHtml() {
  return `<div class="nav-wrap">
  <div class="nav-pill" id="nav-pill">
    <a href="/" class="wordmark">Nearwork</a>
    <nav class="nav-center">
      <a class="nav-link" href="/services/direct-recruiting">Services</a>
      <a class="nav-link" href="/industries">Industries</a>
      <a class="nav-link" href="/pricing">Pricing</a>
      <a class="nav-link active" href="/jobs">Jobs</a>
      <a class="nav-link" href="/about">About</a>
      <a class="nav-link" href="/blog">Blog</a>
    </nav>
    <div class="nav-right">
      <a href="https://app.nearwork.co" class="nav-ghost">Client login</a>
      <a href="/book" class="nav-cta">Hire on demand ${ICON.arrow}</a>
    </div>
    <button class="hamburger" id="hamBtn" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</div>
<div class="mobile-menu" id="mobMenu">
  <div class="mob-section"><div class="mob-section-title">Explore</div>
    <a class="mob-link" href="/services/direct-recruiting">Services</a>
    <a class="mob-link" href="/industries">Industries</a>
    <a class="mob-link" href="/pricing">Pricing</a>
    <a class="mob-link" href="/jobs">Jobs</a>
    <a class="mob-link" href="/about">About</a>
    <a class="mob-link" href="/blog">Blog</a>
  </div>
  <div class="mob-ctas"><a class="mob-ghost" href="https://app.nearwork.co">Client login</a><a class="mob-primary" href="/book">Hire on demand</a></div>
</div>`;
}

function footerHtml() {
  return `<footer>
  <div class="footer-grid">
    <div>
      <a href="/" class="wordmark" style="font-size:19px;">Nearwork</a>
      <p class="footer-brand-desc">On-demand remote staffing for US &amp; Canadian companies. Vetted talent from across Latin America, paid in USD — full pipeline visibility and a C1 English standard.</p>
    </div>
    <div>
      <div class="footer-col-title">Services</div>
      <ul class="footer-links"><li><a href="/services/direct-recruiting">Direct Recruiting</a></li><li><a href="/services/eor">EOR</a></li><li><a href="/services/managed-team">Managed Team</a></li><li><a href="/services/strategic-partner-program">Strategic Partner Program</a></li></ul>
    </div>
    <div>
      <div class="footer-col-title">Industries</div>
      <ul class="footer-links"><li><a href="/industries">All industries</a></li><li><a href="/industries/software-development">Software Development</a></li><li><a href="/industries/customer-support">Customer Support</a></li><li><a href="/industries/sales">Sales</a></li></ul>
    </div>
    <div>
      <div class="footer-col-title">Company</div>
      <ul class="footer-links"><li><a href="/">Home</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/blog">Blog</a></li><li><a href="/jobs">Jobs</a></li><li><a href="/book">Hire on demand</a></li></ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span class="footer-copy">© 2026 Nearwork. All rights reserved.</span>
    <span class="footer-co">${ICON.pin}Built with care from Colombia · Serving the US &amp; Canada</span>
  </div>
</footer>`;
}

// Shared page script: nav shadow on scroll + mobile menu toggle.
const NAV_SCRIPT = `<script>
(function(){
  var pill=document.getElementById('nav-pill');
  if(pill){window.addEventListener('scroll',function(){pill.classList.toggle('scrolled',window.scrollY>20);},{passive:true});}
  var ham=document.getElementById('hamBtn'),mob=document.getElementById('mobMenu');
  if(ham&&mob){ham.addEventListener('click',function(){mob.classList.toggle('open');});}
})();
</script>`;

// Build the <head>. `title`, `desc`, `canonical` must already be escaped.
// `extraHead` is inserted verbatim (JSON-LD, hash-forward script, etc.).
function pageHead(title, desc, canonical, extraHead) {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${POSTHOG}
${extraHead || ''}  <style>${STYLE}</style>
</head>`;
}

// ---------------------------------------------------------------------------
// Job card (board + hub grids)
// ---------------------------------------------------------------------------

function jobCardHtml(job) {
  const color = brandColor(job.orgName || job.code);
  const initial = initialOf(job);
  const sal = salaryLine(job) || 'Competitive · USD';
  const loc = locationLabel(job);
  const wtype = workTypeLabel(job);
  const exp = experienceLabel(job);
  const posted = postedAgo(job);
  const badge = isNewJob(job) ? '<span class="jc-badge badge-new">New</span>' : '';
  const search = `${job.title} ${companyName(job)} ${job.industry}`.toLowerCase();
  const company = `<strong>${escapeHtml(companyName(job))}</strong>${job.industry ? ' · ' + escapeHtml(job.industry) : ''}`;
  const chips = [chipHtml(ICON.pin, loc), chipHtml(ICON.bag, wtype)];
  if (exp) chips.push(chipHtml(ICON.chart, exp));

  return `      <a class="job-card" href="/jobs/${escapeHtml(job.code)}" data-search="${escapeHtml(search)}" data-func="${escapeHtml(job.industry || '')}" data-type="${escapeHtml(wtype)}" data-exp="${escapeHtml(exp)}" data-loc="${escapeHtml(loc)}" data-salmin="${job.salaryMin || 0}">
        <div class="jc-top">
          <div class="jc-logo" style="background:${color}">${escapeHtml(initial)}</div>
          <div class="jc-head"><div class="jc-title">${escapeHtml(job.title)}</div><div class="jc-company">${company}</div></div>
          ${badge}
        </div>
        <div class="jc-meta">${chips.join('')}</div>
        <div class="jc-salary">${escapeHtml(sal)}</div>
        <div class="jc-foot"><span class="jc-posted">${escapeHtml(posted)}</span><span class="jc-view">View role ${ICON.arrow}</span></div>
      </a>`;
}

// ---------------------------------------------------------------------------
// Per-job page
// ---------------------------------------------------------------------------

function similarRoles(job, allJobs) {
  const others = allJobs.filter((j) => j.code !== job.code);
  const sameIndustry = others.filter((j) => j.industry && j.industry === job.industry);
  const rest = others.filter((j) => !(j.industry && j.industry === job.industry));
  return sameIndustry.concat(rest).slice(0, 3);
}

function renderJobPage(job, allJobs) {
  const desc = truncate(job.publicSummary || job.about, 155);
  const jsonLd = buildJsonLd(job);
  const color = brandColor(job.orgName || job.code);
  const initial = initialOf(job);
  const intro = job.about || job.publicSummary;
  const sal = salaryLine(job);
  const loc = locationLabel(job);
  const wtype = workTypeLabel(job);
  const exp = experienceLabel(job);
  const posted = postedAgo(job);
  const company = companyName(job);
  const newBadge = isNewJob(job) ? '<span class="jc-badge badge-new">New</span>' : '';

  // Meta-chip row.
  const chips = [chipHtml(ICON.pin, loc), chipHtml(ICON.bag, wtype)];
  if (exp) chips.push(chipHtml(ICON.chart, exp));
  if (posted) chips.push(chipHtml(ICON.clock, posted));

  // Content sections (omit gracefully where we have no data).
  let sections = '';
  if (intro) sections += sectionHtml('About', `<p>${escapeHtml(intro)}</p>`);
  if (job.responsibilities.length) sections += sectionHtml("What you'll do", bulletList(job.responsibilities));
  if (job.qualifications.length) sections += sectionHtml("What we're looking for", checkList(job.qualifications));
  if (job.benefits.length) sections += sectionHtml('Benefits & perks', benefitsGrid(job.benefits));

  // Apply-rail salary block.
  const railSalary = sal
    ? `${escapeHtml(sal)}<span>Base salary · USD</span>`
    : `Competitive — USD<span>Salary shared during the process</span>`;

  // Facts list.
  const facts = [
    factHtml(ICON.pin, escapeHtml(loc)),
    factHtml(ICON.bag, `<strong>${escapeHtml(wtype)}</strong>`),
    exp ? factHtml(ICON.chart, escapeHtml(exp)) : '',
    factHtml(ICON.clock, 'Process takes <strong>~21 days</strong>'),
  ].filter(Boolean).join('\n        ');

  // Company / industry line.
  const companyLine = `<strong>${escapeHtml(company)}</strong>${job.industry ? ' · ' + escapeHtml(job.industry) : ''} · placed through Nearwork`;

  // Similar roles.
  const similar = similarRoles(job, allJobs);
  let relatedBlock = '';
  if (similar.length) {
    const relCards = similar.map((j) => {
      const rc = brandColor(j.orgName || j.code);
      const rSal = salaryLine(j) || 'Competitive · USD';
      return `    <a class="rel-card" href="/jobs/${escapeHtml(j.code)}">
      <div class="rel-top"><div class="rel-logo" style="background:${rc}">${escapeHtml(initialOf(j))}</div><div><div class="rel-title">${escapeHtml(j.title)}</div><div class="rel-company">${escapeHtml(companyName(j))}</div></div></div>
      <div class="rel-meta"><span>${escapeHtml(locationLabel(j))}</span></div>
      <div class="rel-meta" style="margin-top:8px;"><span class="rel-sal">${escapeHtml(rSal)}</span></div>
    </a>`;
    }).join('\n');
    relatedBlock = `
<section class="related">
  <h2>Similar roles</h2>
  <div class="related-grid">
${relCards}
  </div>
</section>`;
  }

  const applyUrl = `https://jobs.nearwork.co/apply?code=${escapeHtml(job.code)}`;
  const jsonLdBlock = `  <script type="application/ld+json">\n${jsonLd}\n  </script>\n`;
  const title = `${escapeHtml(job.title)} — Remote Job in Latin America | Nearwork`;

  return `<!doctype html>
<html lang="en">
${pageHead(title, escapeHtml(desc), `${CANONICAL_BASE}/jobs/${escapeHtml(job.code)}`, jsonLdBlock)}
<body>
${navHtml()}

<div class="detail-head">
  <div class="breadcrumb">
    <a href="/jobs">Jobs</a>
    ${ICON.crumb}
    <span>${escapeHtml(job.title)}</span>
  </div>
  <div class="head-card">
    <div class="head-logo" style="background:${color}">${escapeHtml(initial)}</div>
    <div class="head-main">
      ${newBadge ? `<div class="head-badges">${newBadge}</div>` : ''}
      <h1>${escapeHtml(job.title)}</h1>
      <p class="head-company">${companyLine}</p>
    </div>
  </div>
</div>

<div class="detail-layout">
  <div class="detail-body">
    <div class="meta-row">
      ${chips.join('\n      ')}
    </div>
${sections}  </div>

  <aside class="apply-rail">
    <div class="apply-card">
      <div class="apply-salary">${railSalary}</div>
      <div class="apply-facts">
        ${facts}
      </div>
      <a class="btn-apply" href="${applyUrl}">Apply now ${ICON.arrow}</a>
      <a class="btn-save" href="https://talent.nearwork.co">${ICON.bookmark}Save role</a>
      <p class="apply-note">Applying takes ~2 minutes. <a href="https://talent.nearwork.co">Sign in</a> to autofill from your profile.</p>
    </div>
    <div class="trust-card">
      <h4>How Nearwork helps</h4>
      <p>We prep you for interviews, advocate on salary, and handle contracts &amp; USD payments. You always work with the company directly — we just make it smooth.</p>
    </div>
  </aside>
</div>
${relatedBlock}
${footerHtml()}
${NAV_SCRIPT}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Board index
// ---------------------------------------------------------------------------

function distinctValues(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function optionTags(values) {
  return values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function renderIndex(jobs) {
  const cards = jobs.map(jobCardHtml).join('\n');

  const industries = distinctValues(jobs.map((j) => j.industry));
  const types = distinctValues(jobs.map(workTypeLabel));
  const seniorities = distinctValues(jobs.map(experienceLabel));
  const locations = distinctValues(jobs.map(locationLabel));

  // Salary thresholds (monthly USD) built from the roles that show salary.
  const salMins = jobs.filter((j) => j.showSalary && j.salaryMin).map((j) => j.salaryMin);
  const maxMin = salMins.length ? Math.max(...salMins) : 0;
  const SAL_STEPS = [1000, 1500, 2000, 2500, 3000, 4000, 5000];
  const salOpts = SAL_STEPS.filter((v) => v <= maxMin);
  const salSelect = salOpts.length
    ? `<div class="filter-select"><select id="f-sal" aria-label="Salary"><option value="0">Any salary</option>${salOpts.map((v) => `<option value="${v}">$${v.toLocaleString('en-US')}+/mo</option>`).join('')}</select>${ICON.chevron}</div>`
    : '';

  const funcSelect = industries.length
    ? `<div class="filter-select"><select id="f-func" aria-label="Function"><option value="">All functions</option>${optionTags(industries)}</select>${ICON.chevron}</div>`
    : '';
  const typeSelect = types.length
    ? `<div class="filter-select"><select id="f-type" aria-label="Work type"><option value="">Any type</option>${optionTags(types)}</select>${ICON.chevron}</div>`
    : '';
  const expSelect = seniorities.length
    ? `<div class="filter-select"><select id="f-exp" aria-label="Experience"><option value="">Any level</option>${optionTags(seniorities)}</select>${ICON.chevron}</div>`
    : '';
  const locSelect = locations.length
    ? `<div class="filter-select"><select id="f-loc" aria-label="Location"><option value="">Any location</option>${optionTags(locations)}</select>${ICON.chevron}</div>`
    : '';

  const gridInner = jobs.length
    ? cards + '\n'
    : '';
  const emptyDisplay = jobs.length ? 'none' : 'block';

  // Hash-forward script (preserves old jobs.nearwork.co/#NW-1234 deep links).
  const hashForward = `  <script>
    (function () {
      var m = /^#(NW-\\w+)/i.exec(location.hash || '');
      if (m) location.replace('/jobs/' + m[1]);
    })();
  </script>\n`;

  const filterScript = `<script>
(function(){
  var q=document.getElementById('q'),grid=document.getElementById('grid'),countEl=document.getElementById('count'),clearBtn=document.getElementById('clear'),empty=document.getElementById('emptyState');
  if(!grid)return;
  var selFunc=document.getElementById('f-func'),selType=document.getElementById('f-type'),selExp=document.getElementById('f-exp'),selLoc=document.getElementById('f-loc'),selSal=document.getElementById('f-sal');
  var cards=[].slice.call(grid.querySelectorAll('.job-card'));
  function render(){
    var query=(q.value||'').trim().toLowerCase();
    var fFunc=selFunc?selFunc.value:'',fType=selType?selType.value:'',fExp=selExp?selExp.value:'',fLoc=selLoc?selLoc.value:'',fSal=selSal?+selSal.value:0;
    var anySet=!!(query||fFunc||fType||fExp||fLoc||fSal);
    [[selFunc,fFunc],[selType,fType],[selExp,fExp],[selLoc,fLoc]].forEach(function(p){if(p[0])p[0].parentElement.classList.toggle('set',!!p[1]);});
    if(selSal)selSal.parentElement.classList.toggle('set',fSal>0);
    if(clearBtn)clearBtn.classList.toggle('show',anySet);
    var visible=0;
    cards.forEach(function(c){
      var ok=true;
      if(fFunc&&c.getAttribute('data-func')!==fFunc)ok=false;
      if(fType&&c.getAttribute('data-type')!==fType)ok=false;
      if(fExp&&c.getAttribute('data-exp')!==fExp)ok=false;
      if(fLoc&&c.getAttribute('data-loc')!==fLoc)ok=false;
      if(fSal&&(+c.getAttribute('data-salmin')||0)<fSal)ok=false;
      if(query&&(c.getAttribute('data-search')||'').indexOf(query)===-1)ok=false;
      c.style.display=ok?'':'none';
      if(ok)visible++;
    });
    if(countEl)countEl.innerHTML='<strong>'+visible+'</strong> open role'+(visible===1?'':'s')+(anySet?' match your filters':'');
    if(empty)empty.style.display=visible===0?'block':'none';
  }
  var ctrls=[q,selFunc,selType,selExp,selLoc,selSal].filter(Boolean);
  ctrls.forEach(function(el){el.addEventListener('input',render);});
  if(clearBtn)clearBtn.addEventListener('click',function(){if(q)q.value='';[selFunc,selType,selExp,selLoc].forEach(function(s){if(s)s.value='';});if(selSal)selSal.value='0';render();});
  render();
})();
</script>`;

  const title = 'Remote Jobs in Latin America — Paid in USD | Nearwork';
  const desc = 'Find fully-remote jobs with US &amp; Canada companies, open to professionals across Latin America and paid in USD. Search current openings and apply today.';

  return `<!doctype html>
<html lang="en">
${pageHead(title, desc, `${CANONICAL_BASE}/jobs`, hashForward)}
<body>
${navHtml()}

<header class="jobs-hero">
  <span class="eyebrow">Careers through Nearwork</span>
  <h1>Remote jobs at<br><span class="accent">US &amp; Canada companies</span></h1>
  <p class="jobs-lede">Paid in USD, on your time zone, fully remote. Browse current openings from growing US and Canadian teams hiring talent across Latin America.</p>
  <div class="hero-stats">
    <span class="stat-chip">${ICON.dollar}Paid in <strong>USD</strong></span>
    <span class="stat-chip">${ICON.home}<strong>100%</strong> remote</span>
    <span class="stat-chip">${ICON.clock}US &amp; Canada <strong>time zones</strong></span>
  </div>
  <div class="hub-links">
    <a href="/jobs/remote-customer-support-latin-america">Remote Customer Support Jobs ${ICON.arrow}</a>
    <a href="/jobs/remote-software-developer-latin-america">Remote Software Developer Jobs ${ICON.arrow}</a>
  </div>
</header>

<div class="filter-bar">
  <div class="filter-inner">
    <div class="job-search">
      ${ICON.search}
      <input type="search" id="q" placeholder="Search role, company or industry…" aria-label="Search jobs" autocomplete="off">
    </div>
    ${funcSelect}
    ${typeSelect}
    ${expSelect}
    ${locSelect}
    ${salSelect}
  </div>
</div>

<div class="result-row">
  <div class="result-count" id="count"></div>
  <button class="clear-btn" id="clear"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Clear filters</button>
</div>

<div class="job-grid" id="grid">
${gridInner}      <div class="empty-state" id="emptyState" style="display:${emptyDisplay};">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3>${jobs.length ? 'No roles match those filters' : 'No open roles right now'}</h3>
        <p>${jobs.length ? 'Try clearing a filter or broadening your search.' : 'Check back soon — new roles are posted regularly.'}</p>
      </div>
</div>

<div class="teaser">
  <div class="teaser-inner">
    ${ICON.star}
    <div class="teaser-text"><strong>Have a Nearwork talent account?</strong> Sign in to see your match score on every role, save favorites, and track applications.</div>
    <a class="teaser-cta" href="https://talent.nearwork.co">Sign in</a>
  </div>
</div>

${footerHtml()}
${NAV_SCRIPT}
${filterScript}
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

  const cards = matching.map(jobCardHtml).join('\n');
  const gridInner = matching.length
    ? `<div class="job-grid">\n${cards}\n</div>`
    : `<div class="job-grid"><div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No open roles in this category right now</h3><p>Check back soon, or <a href="/jobs">browse all jobs</a>.</p></div></div>`;

  return `<!doctype html>
<html lang="en">
${pageHead(escapeHtml(hub.title), escapeHtml(hub.description), hub.canonical, '')}
<body>
${navHtml()}

<header class="jobs-hero">
  <span class="eyebrow">Careers through Nearwork</span>
  <h1>${escapeHtml(hub.h1)}</h1>
  <p class="jobs-lede">${escapeHtml(hub.intro)}</p>
  <div class="hero-stats">
    <span class="stat-chip">${ICON.dollar}Paid in <strong>USD</strong></span>
    <span class="stat-chip">${ICON.home}<strong>100%</strong> remote</span>
    <span class="stat-chip">${ICON.clock}US &amp; Canada <strong>time zones</strong></span>
  </div>
</header>

${gridInner}

<div class="teaser">
  <div class="teaser-inner">
    ${ICON.star}
    <div class="teaser-text"><strong>Have a Nearwork talent account?</strong> Sign in to see your match score on every role, save favorites, and track applications.</div>
    <a class="teaser-cta" href="https://talent.nearwork.co">Sign in</a>
  </div>
</div>

${footerHtml()}
${NAV_SCRIPT}
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
    const html = renderJobPage(job, jobs);
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
