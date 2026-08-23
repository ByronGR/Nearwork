#!/usr/bin/env python3
"""
Nearwork competitor-comparison page generator.

Keyword-driven: edit COMPETITORS below (SEO keywords, verdict, strengths,
capability flags) and re-run. Outputs static /compare/nearwork-vs-<slug>.html
pages that share the site's nav/footer/design system.

Usage:  python3 build_compare_pages.py
Output: <NEARWORK_REPO>/compare/nearwork-vs-*.html
"""
import os, html

REPO = os.environ.get("NEARWORK_REPO",
    "/Users/byrongiraldo/.openclaw/workspace/Nearwork")
OUT_DIR = os.path.join(REPO, "compare")

# ── shared nav (Compare added under About) ──────────────────────────────
NAV = r"""<div class="nav-wrap">
  <div class="nav-pill" id="nav-pill">
    <a href="/" class="wordmark">Nearwork</a>
    <nav class="nav-center" id="navCenter">
      <div class="dd" data-dd="services">
        <button class="dd-btn">Services <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
        <div class="dd-panel wide wide-grid">
          <a class="dd-item" href="/services/direct-recruiting.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg></div><div><div class="dd-title">Direct Recruiting</div><div class="dd-desc">Source, screen, evaluate, and place top candidates</div></div></a>
          <a class="dd-item" href="/services/sourcing.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div><div><div class="dd-title">Sourcing</div><div class="dd-desc">A screened shortlist — you run the interviews</div></div></a>
          <a class="dd-item" href="/services/cor.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg></div><div><div class="dd-title">COR</div><div class="dd-desc">Hire talent without opening a local entity</div></div></a>
          <a class="dd-item" href="/services/strategic-partner-program.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 17l2 2 3-4"/></svg></div><div><div class="dd-title">Strategic Partner Program</div><div class="dd-desc">White-label recruiting for partner firms</div></div></a>
          <a class="dd-item" href="/services/dedicated-team.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg></div><div><div class="dd-title">Dedicated Team</div><div class="dd-desc">Dedicated teams with leads, managers, and support</div></div></a>
        </div>
      </div>
      <div class="dd" data-dd="pricing">
        <button class="dd-btn">Pricing <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
        <div class="dd-panel">
          <a class="dd-item" href="/pricing.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div><div class="dd-title">All plans &amp; pricing</div><div class="dd-desc">Sourcing and recruiting — full breakdown</div></div></a>
          <a class="dd-item" href="/compare.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><path d="M9 3v18M15 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/></svg></div><div><div class="dd-title">Compare</div><div class="dd-desc">Nearwork vs. every competitor</div></div></a>
        </div>
      </div>
      <div class="dd" data-dd="about">
        <button class="dd-btn">About <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
        <div class="dd-panel">
          <a class="dd-item" href="/compare.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M9 3v18M15 3v18M3 9h6M3 15h6M15 9h6M15 15h6"/></svg></div><div><div class="dd-title">Compare</div><div class="dd-desc">Nearwork vs the competition — who wins</div></div></a>
          <a class="dd-item" href="/blog"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div><div><div class="dd-title">Blog</div><div class="dd-desc">Guides on hiring nearshore talent</div></div></a>
          <a class="dd-item" href="/about.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div><div><div class="dd-title">About Nearwork</div><div class="dd-desc">Who we are and what we believe</div></div></a>
          <a class="dd-item" href="/how-it-works.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div><div class="dd-title">How it works</div><div class="dd-desc">Client and candidate journey</div></div></a>
          <a class="dd-item" href="/why-colombia.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div><div class="dd-title">Why Colombia</div><div class="dd-desc">The talent advantage — explained with data</div></div></a>
          <a class="dd-item" href="/faq.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div><div class="dd-title">FAQ</div><div class="dd-desc">Everything you wanted to ask</div></div></a>
        </div>
      </div>
    </nav>
    <div class="nav-right">
      <a href="https://app.nearwork.co" class="nav-ghost">Client login</a>
      <a href="/book.html" class="nav-cta">Hire on demand <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
    </div>
    <button class="hamburger" id="hamBtn" onclick="toggleMob()" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</div>
<div class="mobile-menu" id="mobMenu">
  <div class="mob-section"><div class="mob-section-title">Services</div><a class="mob-link" href="/services/direct-recruiting.html">Direct Recruiting</a><a class="mob-link" href="/services/sourcing.html">Sourcing</a><a class="mob-link" href="/services/cor.html">COR</a><a class="mob-link" href="/services/strategic-partner-program.html">Strategic Partner Program</a><a class="mob-link" href="/services/dedicated-team.html">Dedicated Team</a></div>
  <div class="mob-section"><div class="mob-section-title">More</div><a class="mob-link" href="/pricing.html">Pricing</a><a class="mob-link" href="/compare.html">Compare</a><a class="mob-link" href="/blog">Blog</a><a class="mob-link" href="/about.html">About</a><a class="mob-link" href="/how-it-works.html">How it works</a><a class="mob-link" href="/faq.html">FAQ</a></div>
  <div class="mob-ctas"><a class="mob-ghost" href="https://app.nearwork.co">Client login</a><a class="mob-primary" href="/book.html">Hire on demand</a></div>
</div>"""

FOOTER = r"""<footer>
  <div class="trust-badges">
    <div class="trust-badge"><span class="tb-label"><strong>40+</strong> US and Canadian companies hiring on demand</span></div>
    <div class="trust-divider"></div>
    <div class="trust-badge" style="padding-right:0;"><span class="tb-label" style="color:var(--teal);font-weight:600;">US and Canada clients · talent across Latin America</span></div>
  </div>
  <div class="footer-grid">
    <div>
      <a href="/index.html" class="wordmark" style="font-size:19px;">Nearwork</a>
      <p class="footer-brand-desc">The remote staffing agency that reduces your labor costs. On-demand hiring of vetted nearshore talent from across Latin America for US and Canadian companies — full pipeline visibility, C1 English standard, transparent candidate evidence.</p>
    </div>
    <div>
      <div class="footer-col-title">Services</div>
      <ul class="footer-links">
        <li><a href="/services/direct-recruiting.html">Direct Recruiting</a></li>
        <li><a href="/services/sourcing.html">Sourcing</a></li>
        <li><a href="/services/cor.html">Contractor of record</a></li>
        <li><a href="/services/strategic-partner-program.html">Strategic Partner Program</a></li>
        <li><a href="/services/dedicated-team.html">Dedicated Team</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Compare</div>
      <ul class="footer-links">
        <li><a href="/compare.html">All comparisons</a></li>
        <li><a href="/compare/nearwork-vs-bairesdev.html">vs BairesDev</a></li>
        <li><a href="/compare/nearwork-vs-turing.html">vs Turing</a></li>
        <li><a href="/compare/nearwork-vs-revelo.html">vs Revelo</a></li>
        <li><a href="/compare/nearwork-vs-toptal.html">vs Toptal</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Company</div>
      <ul class="footer-links">
        <li><a href="/about.html">About Nearwork</a></li>
        <li><a href="/how-it-works.html">How it works</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/why-colombia.html">Why Colombia</a></li>
        <li><a href="/pricing.html">Pricing</a></li>
        <li><a href="/faq.html">FAQ</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Candidates</div>
      <ul class="footer-links">
        <li><a href="https://talent.nearwork.co" target="_blank">Candidate login</a></li>
        <li><a href="/jobs" target="_blank">Browse open roles</a></li>
        <li><a href="/candidates/what-to-expect.html">What to expect</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span class="footer-copy">© 2026 Nearwork. All rights reserved.</span>
    <span class="footer-co"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Built with care from Colombia · Serving the US &amp; Canada</span>
    <div class="footer-legal"><a href="/privacy-policy.html">Privacy</a><a href="/terms-of-service.html">Terms</a><a href="/cookie-policy.html">Cookies</a></div>
  </div>
</footer>"""

SCRIPTS = r"""<script>
const pill=document.getElementById('nav-pill');
window.addEventListener('scroll',()=>{pill.classList.toggle('scrolled',window.scrollY>20);});
const dropdowns=document.querySelectorAll('.dd');
dropdowns.forEach(dd=>{const btn=dd.querySelector('.dd-btn');btn.addEventListener('click',e=>{e.stopPropagation();const wasOpen=dd.classList.contains('open');dropdowns.forEach(d=>d.classList.remove('open'));if(!wasOpen)dd.classList.add('open');});});
document.addEventListener('click',e=>{let inside=false;dropdowns.forEach(d=>{if(d.contains(e.target))inside=true;});if(!inside)dropdowns.forEach(d=>d.classList.remove('open'));});
function toggleMob(){document.getElementById('mobMenu').classList.toggle('open');}
</script>"""

STYLE = '<link rel="stylesheet" href="/compare.css">'

CHECK = ('<span class="cx-ico cx-yes" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
         '</span><span class="cx-sr">Yes</span>')
DASH  = ('<span class="cx-ico cx-no" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="3.4" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>'
         '</span><span class="cx-sr">Not offered</span>')
PART  = ('<span class="cx-ico cx-part" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" '
         'stroke="none"/></svg></span><span class="cx-sr">Limited</span>')

def cell(flag, note=""):
    icon = {"yes": CHECK, "no": DASH, "partial": PART}[flag]
    if note:
        return f'{icon}<span class="sc-cell-note">{note}</span>'
    return icon

# ── competitor data (edit here to add/adjust) ───────────────────────────
# caps order: sourcing, recruiting, cor, dedicated, spp
COMPETITORS = [
  {
    "slug":"bairesdev","name":"BairesDev","cat":"nearshore software development",
    "kw":"bairesdev alternative, bairesdev vs nearwork, bairesdev pricing, bairesdev competitors, nearshore software development company",
    "meta":"BairesDev vs Nearwork compared — pricing transparency, flat placement fees, COR/EOR, and dedicated teams. See why Nearwork is the transparent BairesDev alternative for hiring Latin American talent.",
    "strength":"BairesDev is one of the largest software outsourcing firms in Latin America, with a deep bench for big, long-running engineering projects and enterprise-sized budgets.",
    "model":"Ongoing, project-based staff augmentation billed monthly. Pricing is quote-only — you book a sales call to get a number.",
    "price_them_num":"Quote only","price_them_note":"No pricing is published; rates are set per engagement after a sales call, typically at a premium to the market.",
    "caps":{"sourcing":"no","recruiting":"partial","cor":"no","dedicated":"yes","spp":"no"},
    "caps_note":{"recruiting":"as staff aug","dedicated":"managed"},
    "transparent":"no","flatfee":"no",
    "verdict":"If you're an enterprise that wants a large managed dev shop and budget isn't the constraint, BairesDev is a safe pick. If you want to <b>own your hires</b>, see the price before you talk to sales, and get sourcing, recruiting, COR/EOR and dedicated teams from one partner, <b>Nearwork wins</b>.",
    "they_win":["Massive engineering bench for large, multi-team projects","Enterprise brand recognition and process maturity","Good fit when you want a vendor to own delivery end-to-end"],
    "we_win":["Transparent, published flat fees — no sales call to see a price","You own the hire; it's your team member, not a rented seat","Sourcing, recruiting, COR/EOR, dedicated teams & SPP under one roof","Same US-Eastern hours, ~half the US cost"],
  },
  {
    "slug":"turing","name":"Turing","cat":"nearshore developer hiring",
    "kw":"turing alternative, turing.com vs nearwork, turing pricing, hire vetted developers, nearshore developers",
    "meta":"Turing vs Nearwork compared — hourly marketplace vs flat-fee placement, transparency, COR/EOR and dedicated teams. The transparent Turing alternative for hiring LATAM talent.",
    "strength":"Turing's AI-driven vetting and huge global developer pool make it fast to spin up contractors, great for remote-first teams that just want vetted engineers quickly.",
    "model":"A global marketplace priced as an hourly markup over developer pay (commonly ~$100–$200/hr) for as long as the engagement runs.",
    "price_them_num":"~$100–200/hr","price_them_note":"Hourly markup over developer pay for the life of the engagement; buy-out fees may apply to convert a contractor.",
    "caps":{"sourcing":"no","recruiting":"no","cor":"no","dedicated":"partial","spp":"no"},
    "caps_note":{"dedicated":"contractors"},
    "transparent":"partial","flatfee":"no",
    "verdict":"For fast, flexible, short-term engineering capacity, Turing is hard to beat. But it's an hourly marketplace — you rent talent indefinitely and never own the hire. If you want a <b>permanent team member</b> at a transparent flat fee, plus COR/EOR and dedicated teams, <b>Nearwork wins</b>.",
    "they_win":["Very fast to spin up vetted contractors","Large global pool beyond Latin America","Good for short bursts and project-based work"],
    "we_win":["Flat one-time fee vs an hourly markup that never ends","You own the hire full-time — no buy-out to convert","Nearshore LATAM talent in your exact timezone","One partner for sourcing, recruiting, COR/EOR, dedicated teams & SPP"],
  },
  {
    "slug":"revelo","name":"Revelo","cat":"LATAM tech talent",
    "kw":"revelo alternative, revelo vs nearwork, revelo pricing, hire latin american developers, latam tech talent",
    "meta":"Revelo vs Nearwork compared — pricing model, EOR/COR, recruiting and dedicated teams. The transparent Revelo alternative for hiring vetted Latin American talent.",
    "strength":"Revelo has a strong pre-vetted Latin American tech talent pool with built-in EOR, good for US companies that want a single platform to hire and pay LATAM engineers.",
    "model":"Platform plus EOR with recurring per-hire fees; pricing is quote-based rather than published.",
    "price_them_num":"Quote only","price_them_note":"Recurring platform/EOR fees per hire; no public flat price — you request a quote.",
    "caps":{"sourcing":"no","recruiting":"partial","cor":"yes","dedicated":"yes","spp":"no"},
    "caps_note":{"cor":"EOR","recruiting":"platform"},
    "transparent":"no","flatfee":"no",
    "verdict":"Revelo is a genuinely strong LATAM platform with EOR built in. The gap: it's recurring, quote-based, and focused on tech. <b>Nearwork</b> adds transparent flat-fee placement, standalone sourcing, a partner program, and staffs <b>every white-collar function</b> — not just engineering.",
    "they_win":["Solid pre-vetted LATAM engineering pool","Built-in EOR to hire and pay across Latin America","Platform experience for managing hires"],
    "we_win":["Transparent, published flat placement fee (from $2,500)","Every white-collar role — not just tech","COR/EOR from $99/contractor/mo, clearly priced","Sourcing, recruiting, dedicated teams & SPP in one place"],
  },
  {
    "slug":"toptal","name":"Toptal","cat":"freelance & fractional talent",
    "kw":"toptal alternative, toptal vs nearwork, toptal pricing, cheaper than toptal, hire vetted freelancers",
    "meta":"Toptal vs Nearwork compared — elite freelance marketplace vs flat-fee nearshore placement. The transparent, lower-cost Toptal alternative for building a permanent LATAM team.",
    "strength":"Toptal's brand and 'top 3%' screening are strong for short-term, high-end freelance and fractional work when you need a specialist fast.",
    "model":"Elite freelance marketplace billed hourly/weekly at a premium, plus an upfront deposit; pricing is quote-only.",
    "price_them_num":"Premium hourly","price_them_note":"Hourly/weekly premium rates plus a refundable deposit; convert-to-hire fees apply. No flat pricing published.",
    "caps":{"sourcing":"no","recruiting":"no","cor":"no","dedicated":"partial","spp":"no"},
    "caps_note":{"dedicated":"freelancers"},
    "transparent":"no","flatfee":"no",
    "verdict":"Toptal is excellent for short-term, premium freelance work. But it's expensive, hourly, and built for contractors — not for building a team you own. For a <b>permanent nearshore hire</b> at a flat fee, with COR/EOR and dedicated teams, <b>Nearwork wins on cost and ownership</b>.",
    "they_win":["Strong brand and rigorous screening","Great for short-term, specialist freelance work","Fast access to senior fractional talent"],
    "we_win":["Far lower cost — flat fee vs premium hourly","Permanent hires you own, not rented freelancers","Nearshore LATAM talent in your timezone","One partner for the full hiring lifecycle"],
  },
  {
    "slug":"tecla","name":"TECLA","cat":"nearshore staffing",
    "kw":"tecla alternative, tecla vs nearwork, tecla.io pricing, nearshore staffing, hire latam developers",
    "meta":"TECLA vs Nearwork compared — monthly staffing bundles vs flat-fee placement, transparency, COR/EOR and dedicated teams. The transparent TECLA alternative for nearshore hiring.",
    "strength":"TECLA is a solid nearshore staffing option with an all-in monthly model that bundles salary, overhead, and compliance into one predictable invoice.",
    "model":"Monthly bundles (commonly ~$4,500–$8,500/mo per hire) — convenient, but you're renting the seat; stop paying and the relationship ends.",
    "price_them_num":"~$4,500–8,500/mo","price_them_note":"Recurring monthly bundle per hire, indefinitely — salary, overhead and margin rolled into one invoice.",
    "caps":{"sourcing":"partial","recruiting":"partial","cor":"yes","dedicated":"yes","spp":"no"},
    "caps_note":{"cor":"bundled"},
    "transparent":"partial","flatfee":"no",
    "verdict":"TECLA's monthly bundle is convenient if you want one invoice and no long-term ownership. But you pay every month, forever, and never own the hire. <b>Nearwork</b> lets you pay a flat fee once and <b>own the team member</b> — with COR/EOR available separately if you want payroll handled.",
    "they_win":["Simple all-in-one monthly invoice","Compliance and payroll bundled in","Good for flexible, shorter engagements"],
    "we_win":["Pay once — no monthly markup forever","You own the hire outright","Flat, published fee from $2,500 (vs quote-based bundles)","Sourcing, recruiting, COR/EOR, dedicated teams & SPP in one place"],
  },
  {
    "slug":"hirelatam","name":"HireLATAM","cat":"LATAM recruiting",
    "kw":"hirelatam alternative, hirelatam vs nearwork, hirelatam pricing, latam recruiting, hire latin american talent",
    "meta":"HireLATAM vs Nearwork compared — both publish flat fees. See how Nearwork adds sourcing, COR/EOR, dedicated teams and a partner program on top of transparent LATAM placement.",
    "strength":"HireLATAM is one of the few competitors that publishes a flat placement fee, and they do straightforward Latin American recruiting well.",
    "model":"Flat placement fee (~$3,500 published) for direct hires — transparent and simple.",
    "price_them_num":"$3,500 flat","price_them_note":"Published flat placement fee per direct hire — one of the few transparent competitors.",
    "caps":{"sourcing":"partial","recruiting":"yes","cor":"no","dedicated":"no","spp":"no"},
    "caps_note":{},
    "transparent":"yes","flatfee":"yes",
    "verdict":"HireLATAM is our closest match — transparent, flat-fee LATAM recruiting done well. The difference: Nearwork does the same placement from <b>$2,500</b> <b>and</b> adds sourcing, COR/EOR, dedicated teams and a Strategic Partner Program. HireLATAM places the hire; <b>Nearwork covers the whole lifecycle</b>.",
    "they_win":["Transparent, published flat fee","Focused, straightforward LATAM recruiting","Simple engagement for a single direct hire"],
    "we_win":["Lower flat fee — from $2,500 vs $3,500","Sourcing, COR/EOR, dedicated teams & SPP on top of placement","COR/EOR to hire and pay without a local entity","One partner as you scale from 1 hire to a full team"],
  },
]

FEATURES = [
  ("sourcing","Sourcing","Screened shortlist, you interview"),
  ("recruiting","Direct Recruiting","Full source-screen-place"),
  ("cor","COR / EOR","Compliant payroll, no local entity"),
  ("dedicated","Dedicated Teams","Managed teams with leads"),
  ("spp","Strategic Partner Program","White-label for partner firms"),
]

def render_scorecard(c):
    rows = []
    rows.append(
      '<tr><th>Capability</th>'
      '<th class="sc-us"><span class="sc-usbadge">Winner</span><br>Nearwork</th>'
      f'<th>{html.escape(c["name"])}</th></tr>')
    body = [f'<thead>{rows[0]}</thead><tbody>']
    for key, label, sub in FEATURES:
        them = c["caps"][key]
        note = c.get("caps_note",{}).get(key,"")
        body.append(
          f'<tr><td class="sc-feat">{label}<span>{sub}</span></td>'
          f'<td class="sc-us">{CHECK}</td>'
          f'<td class="sc-them">{cell(them, note)}</td></tr>')
    # transparency rows
    body.append(
      f'<tr><td class="sc-feat">Transparent published pricing<span>See the price without a sales call</span></td>'
      f'<td class="sc-us">{CHECK}</td>'
      f'<td class="sc-them">{cell(c["transparent"])}</td></tr>')
    body.append(
      f'<tr><td class="sc-feat">Flat one-time fee<span>No monthly markup, you own the hire</span></td>'
      f'<td class="sc-us">{CHECK}</td>'
      f'<td class="sc-them">{cell(c["flatfee"])}</td></tr>')
    body.append('</tbody>')
    return "".join(body)

def render_list(items, win):
    icon = ('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            if win else
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--fg-4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/></svg>')
    return "".join(f'<li>{icon}<span>{html.escape(t)}</span></li>' for t in items)

def faq_jsonld(c):
    n = c["name"]
    qs = [
      (f"Is Nearwork a good {n} alternative?",
       f"Yes. Nearwork covers the same nearshore hiring need as {n} but publishes transparent flat pricing and adds sourcing, direct recruiting, COR/EOR, dedicated teams, and a Strategic Partner Program under one roof — so you can scale from a single hire to a full team with one partner."),
      (f"How does Nearwork pricing compare to {n}?",
       f"Nearwork charges a flat, published placement fee — $2,500 for junior to mid-level roles and $3,500 for senior and specialist roles — with no monthly subscription and no percentage of salary. {c['price_them_note']}"),
      (f"Does {n} offer sourcing, recruiting, COR/EOR and dedicated teams all in one place?",
       f"No. {n} focuses on part of the hiring lifecycle. Nearwork is the only provider in this comparison that delivers sourcing, direct recruiting, COR/EOR, dedicated teams, and a Strategic Partner Program together."),
    ]
    items = ",".join(
      '{"@type":"Question","name":%s,"acceptedAnswer":{"@type":"Answer","text":%s}}'
      % (jstr(q), jstr(a)) for q,a in qs)
    return '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[%s]}</script>' % items, qs

def jstr(s):
    return '"' + s.replace('\\','\\\\').replace('"','\\"') + '"'

def breadcrumb_jsonld(c):
    return ('<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":['
      '{"@type":"ListItem","position":1,"name":"Home","item":"https://www.nearwork.co/"},'
      '{"@type":"ListItem","position":2,"name":"Compare","item":"https://www.nearwork.co/compare"},'
      '{"@type":"ListItem","position":3,"name":"Nearwork vs %s","item":"https://www.nearwork.co/compare/nearwork-vs-%s"}]}</script>'
      % (c["name"], c["slug"]))

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>Nearwork vs {name}: {cat_title} Compared (2026)</title>
<meta name="description" content="{meta}">
<meta name="keywords" content="{kw}">
<link rel="canonical" href="https://www.nearwork.co/compare/nearwork-vs-{slug}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Nearwork">
<meta property="og:title" content="Nearwork vs {name}: {cat_title} Compared">
<meta property="og:description" content="{meta}">
<meta property="og:url" content="https://www.nearwork.co/compare/nearwork-vs-{slug}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Nearwork vs {name}">
<meta name="twitter:description" content="{meta}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/service-page.css">
{faq_ld}
{crumb_ld}
{style}
</head>
<body class="cmp-page">
{nav}
<main>

<section class="hero vs-hero">
  <div class="vs-hero-inner">
    <div class="vs-crumbs"><a href="/">Home</a> › <a href="/compare.html">Compare</a> › Nearwork vs {name}</div>
    <div class="eyebrow">Nearwork vs {name}</div>
    <h1>{name} vs Nearwork: <span class="vs-accent">which {cat} partner actually wins?</span></h1>
    <p class="hero-copy">An honest, side-by-side look at {name} and Nearwork — pricing, transparency, and what each one actually does. No invented numbers; where a competitor doesn't publish pricing, we say so.</p>
    <div class="vs-verdict">
      <span class="vs-verdict-tag">The short answer</span>
      <p>{verdict}</p>
    </div>
  </div>
</section>

<section class="section" id="scorecard">
  <div class="inner">
    <div class="section-head">
      <div class="eyebrow">Capability scorecard</div>
      <h2>Everything you can get from one partner — and what {name} covers</h2>
      <p class="section-lede">The real question isn't just price. It's whether one partner can source, recruit, employ, and scale a team for you. Here's how {name} stacks up.</p>
    </div>
    <div class="cx">
      <table class="sc">{scorecard}</table>
    </div>
    <div class="sc-punch">Does {name} do sourcing, recruiting, COR/EOR, dedicated teams <b>and</b> a partner program — all in one place? {punch} <b>Nearwork does.</b></div>
  </div>
</section>

<section class="section alt">
  <div class="inner">
    <div class="section-head">
      <div class="eyebrow">Honest take</div>
      <h2>Where {name} is strong — and where Nearwork wins</h2>
    </div>
    <div class="vs-cols">
      <div class="vs-col">
        <h3>Where {name} is strong</h3>
        <ul>{they_win}</ul>
      </div>
      <div class="vs-col win">
        <h3>Where Nearwork wins</h3>
        <ul>{we_win}</ul>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="inner">
    <div class="section-head">
      <div class="eyebrow">Pricing, side by side</div>
      <h2>What a hire actually costs</h2>
      <p class="section-lede">{model}</p>
    </div>
    <div class="vs-price">
      <div class="vp-us">
        <h4>Nearwork</h4>
        <div class="vp-num">$2,500–$3,500</div>
        <p>Flat, one-time placement fee — $2,500 junior/mid, $3,500 senior/specialist. No monthly subscription, no percentage of salary. COR/EOR available from $99/contractor/mo. 3-month replacement guarantee. You own the hire.</p>
      </div>
      <div>
        <h4>{name}</h4>
        <div class="vp-num">{price_them_num}</div>
        <p>{price_them_note}</p>
      </div>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="inner vs-final">
    <div class="eyebrow">Bottom line</div>
    <h2>One partner for the whole hiring lifecycle</h2>
    <p>Sourcing, direct recruiting, COR/EOR, dedicated teams, and a Strategic Partner Program — transparent flat pricing, nearshore LATAM talent in your timezone, at roughly half the US cost. Book a call and we'll map the fastest path to your next hire.</p>
    <div class="cmp-cta-row">
      <a class="btn primary" href="/book.html">Book a strategy call</a>
      <a class="btn" href="/pricing.html">See full pricing</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="inner vs-faq">
    <h2>Common questions</h2>
    {faq_html}
  </div>
</section>

<section class="section alt">
  <div class="inner" style="text-align:center;">
    <div class="eyebrow">Keep comparing</div>
    <h2 style="margin-bottom:26px;">See how Nearwork stacks up against others</h2>
    <div class="cmp-chip-row">{other_links}</div>
  </div>
</section>

</main>
{footer}
{scripts}
</body>
</html>
"""

def cat_title(cat):
    return cat.title()

def build():
    os.makedirs(OUT_DIR, exist_ok=True)
    slugs = [(c["slug"], c["name"]) for c in COMPETITORS]
    for c in COMPETITORS:
        faq_ld, qs = faq_jsonld(c)
        faq_html = "".join(
          f'<div class="vs-faq-item"><h3>{html.escape(q)}</h3><p>{html.escape(a)}</p></div>'
          for q,a in qs)
        punch = "No." if any(v!="yes" for v in c["caps"].values()) else "Barely."
        other = "".join(
          f'<a class="btn" href="/compare/nearwork-vs-{s}.html">vs {n}</a>'
          for s,n in slugs if s != c["slug"])
        page = PAGE.format(
          name=html.escape(c["name"]), slug=c["slug"], cat=html.escape(c["cat"]),
          cat_title=cat_title(c["cat"]), meta=html.escape(c["meta"]),
          kw=html.escape(c["kw"]), verdict=c["verdict"], model=html.escape(c["model"]),
          scorecard=render_scorecard(c), punch=punch,
          they_win=render_list(c["they_win"], False),
          we_win=render_list(c["we_win"], True),
          price_them_num=html.escape(c["price_them_num"]),
          price_them_note=html.escape(c["price_them_note"]),
          faq_ld=faq_ld, crumb_ld=breadcrumb_jsonld(c),
          faq_html=faq_html, other_links=other,
          style=STYLE, nav=NAV, footer=FOOTER, scripts=SCRIPTS)
        path = os.path.join(OUT_DIR, f"nearwork-vs-{c['slug']}.html")
        with open(path, "w") as f:
            f.write(page)
        print("wrote", path)

if __name__ == "__main__":
    build()
