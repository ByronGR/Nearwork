(function(){function __run(){
/* Renderer for Nearwork per-industry landing pages.
   Reads window.NW_INDUSTRY, pulls copy from window.NW_CONTENT and
   roles from window.NEARWORK_DATA, and builds the full page into #app. */
(function(){
  var IND = window.NW_INDUSTRY;
  var DATA = window.NEARWORK_DATA || {industries:[], roles:{}};
  var C = (window.NW_CONTENT && window.NW_CONTENT[IND]) || null;
  var app = document.getElementById('app');
  if(!IND || !C || !app){ if(app) app.innerHTML='<p style="padding:120px;text-align:center">Industry not found.</p>'; return; }

  var meta = (DATA.industries||[]).filter(function(i){return i.name===IND;})[0] || {slug:'', count:0};
  var slug = meta.slug, count = meta.count;
  var roles = (DATA.roles && DATA.roles[IND]) || [];
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ---------- NAV (matches services / marketing pages) ---------- */
  var NAV = ''
  + '<div class="nav-wrap"><div class="nav-pill" id="nav-pill">'
  +   '<a href="/" class="wordmark">Nearwork</a>'
  +   '<nav class="nav-center" id="navCenter">'
  +     '<div class="dd" data-dd="services"><button class="dd-btn">Services <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>'
  +       '<div class="dd-panel wide wide-grid">'
  +         '<a class="dd-item" href="../services/direct-recruiting.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg></div><div><div class="dd-title">Direct Recruiting</div><div class="dd-desc">Source, screen, evaluate, and place top candidates</div></div></a>'
  +         '<a class="dd-item" href="../services/sourcing.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div><div><div class="dd-title">Sourcing</div><div class="dd-desc">A screened shortlist — you run the interviews</div></div></a>'
  +         '<a class="dd-item" href="../services/cor.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg></div><div><div class="dd-title">COR</div><div class="dd-desc">Hire talent without opening a local entity</div></div></a>'
  +         '<a class="dd-item" href="../services/dedicated-team.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg></div><div><div class="dd-title">Dedicated Team</div><div class="dd-desc">Dedicated teams with leads and support</div></div></a>'
  +         '<a class="dd-item" href="../services/strategic-partner-program.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 17l2 2 3-4"/></svg></div><div><div class="dd-title">Strategic Partner Program</div><div class="dd-desc">White-label recruiting for partner firms</div></div></a>'
  +       '</div></div>'
  +     '<div class="dd" data-dd="industries"><button class="dd-btn">Industries <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>'
  +       '<div class="dd-panel wide wide-grid">'
  +         '<a class="dd-item" href="customer-support.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg></div><div><div class="dd-title">Customer Support</div><div class="dd-desc">Empathetic, English-fluent support teams</div></div></a>'
  +         '<a class="dd-item" href="software-development.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div><div><div class="dd-title">Software Development</div><div class="dd-desc">Engineers across every stack</div></div></a>'
  +         '<a class="dd-item" href="sales.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div><div class="dd-title">Sales</div><div class="dd-desc">SDRs, AEs, and revenue operators</div></div></a>'
  +         '<a class="dd-item" href="finance-and-accounting.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div><div class="dd-title">Finance &amp; Accounting</div><div class="dd-desc">Bookkeepers, analysts, and controllers</div></div></a>'
  +         '<a class="dd-item" href="marketing-and-content.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 01-5.8-1.6"/></svg></div><div><div class="dd-title">Marketing &amp; Content</div><div class="dd-desc">Growth, content, SEO, and demand-gen</div></div></a>'
  +         '<a class="dd-item" href="operations-and-administration.html"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></div><div><div class="dd-title">Operations &amp; Admin</div><div class="dd-desc">Coordinators, VAs, and ops leads</div></div></a>'
  +         '<div class="dd-footer"><div class="dd-footer-text">Don\'t see your industry? <strong>We staff every white-collar function.</strong></div><a class="dd-footer-cta" href="index.html">Browse all 18 industries <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div>'
  +       '</div></div>'
  +     '<div class="dd" data-dd="pricing"><button class="dd-btn">Pricing <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>'
  +       '<div class="dd-panel">'
  +         '<a class="dd-item" href="../pricing.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div><div class="dd-title">All plans &amp; pricing</div><div class="dd-desc">Essential, Growth, Scale — full breakdown</div></div></a>'
  +         '<a class="dd-item" href="../services/cor.html#cor-pricing"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg></div><div><div class="dd-title">COR pricing</div><div class="dd-desc">Jump to COR plans, fees, and benefits</div></div></a>'
  +       '</div></div>'
  +     '<div class="dd" data-dd="candidates"><button class="dd-btn">For candidates <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>'
  +       '<div class="dd-panel">'
  +         '<a class="dd-item" href="https://talent.nearwork.co" target="_blank" rel="noopener"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div><div class="dd-title">Candidate login</div><div class="dd-desc">talent.nearwork.co — your profile &amp; status</div></div></a>'
  +         '<a class="dd-item" href="https://jobs.nearwork.co" target="_blank" rel="noopener"><div class="dd-icon" style="background:var(--gold-lt);"><svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg></div><div><div class="dd-title">Browse open roles</div><div class="dd-desc">jobs.nearwork.co — find your next position</div></div></a>'
  +       '</div></div>'
  +     '<div class="dd" data-dd="about"><button class="dd-btn">About <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>'
  +       '<div class="dd-panel">'
  +         '<a class="dd-item" href="../about.html"><div class="dd-icon" style="background:var(--teal-lt);"><svg viewBox="0 0 24 24" stroke="var(--teal)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div><div><div class="dd-title">About Nearwork</div><div class="dd-desc">Who we are and what we believe</div></div></a>'
  +         '<a class="dd-item" href="../why-colombia.html"><div class="dd-icon" style="background:var(--violet-lt);"><svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div><div class="dd-title">Why Colombia</div><div class="dd-desc">The talent advantage — explained with data</div></div></a>'
  +       '</div></div>'
  +   '</nav>'
  +   '<div class="nav-right"><a href="https://app.nearwork.co" class="nav-ghost">Client login</a><a href="/book" class="nav-cta">Hire on demand <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a></div>'
  +   '<button class="hamburger" id="hamBtn" aria-label="Menu"><span></span><span></span><span></span></button>'
  + '</div></div>'
  + '<div class="mobile-menu" id="mobMenu">'
  +   '<div class="mob-section"><div class="mob-section-title">Services</div><a class="mob-link" href="../services/direct-recruiting.html">Direct Recruiting</a><a class="mob-link" href="../services/sourcing.html">Sourcing</a><a class="mob-link" href="../services/cor.html">COR</a><a class="mob-link" href="../services/dedicated-team.html">Dedicated Team</a><a class="mob-link" href="../services/strategic-partner-program.html">Strategic Partner Program</a></div>'
  +   '<div class="mob-section"><div class="mob-section-title">Industries</div><a class="mob-link" href="customer-support.html">Customer Support</a><a class="mob-link" href="software-development.html">Software Development</a><a class="mob-link" href="sales.html">Sales</a><a class="mob-link" href="index.html">Browse all 18</a></div>'
  +   '<div class="mob-section"><div class="mob-section-title">More</div><a class="mob-link" href="../pricing.html">Pricing</a><a class="mob-link" href="https://talent.nearwork.co" target="_blank">Candidate login</a><a class="mob-link" href="../about.html">About</a></div>'
  +   '<div class="mob-ctas"><a class="mob-ghost" href="https://app.nearwork.co">Client login</a><a class="mob-primary" href="/book">Hire on demand</a></div>'
  + '</div>';

  /* ---------- pieces ---------- */
  var em = esc(IND);
  var kicker = em + ' · Remote from Colombia';

  var crumb = '<div class="wrap"><div class="crumb" data-crumb><a href="/">Home</a><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg><a href="index.html">Industries</a><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg><span class="cur">'+em+'</span></div></div>';

  var top = C.criteria[0];
  var heroCard = ''
  + '<div class="h-card"><div class="h-card-top">'
  +   '<div class="h-av" style="background-image:url(\'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80\');"></div>'
  +   '<div><div class="h-nm">Valentina Ríos</div><div class="h-rl" data-card-role>'+esc(roles[0]?roles[0].title:IND)+'</div>'
  +   '<div class="h-loc"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>Medellín, Colombia</div></div>'
  +   '<span class="h-badge">Top match</span>'
  + '</div><div class="h-stats">'
  +   '<div class="h-stat"><b class="teal">'+top[1]+'</b><span>'+esc(C.metric)+'</span></div>'
  +   '<div class="h-stat"><b>C1</b><span>English</span></div>'
  +   '<div class="h-stat"><b>5y</b><span>Experience</span></div>'
  + '</div></div>';

  var hero = '<section class="hero"><div class="wrap">'
  + '<div class="heroA"><div>'
  +   '<div class="h-kicker" data-kicker>'+kicker+'</div>'
  +   '<h1 data-hero-title>Hire vetted <em>'+em+'</em> talent, managed for you.</h1>'
  +   '<p class="h-lead" data-hero-lead>'+esc(C.lead)+'</p>'
  +   '<div class="h-actions"><a class="btn-teal" href="/book">Hire on demand <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a><a class="btn-link" href="../cost-calculator.html">Calculate your savings →</a></div>'
  + '</div>'+heroCard+'</div>'
  + '<div class="strip">'+C.strip.map(function(s){return '<div class="s"><b class="teal">'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div>';}).join('')+'</div>'
  + '</div></section>';

  var svcIcon = {
    dr:'<svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    eor:'<svg viewBox="0 0 24 24" stroke="var(--gold-dk)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg>',
    mt:'<svg viewBox="0 0 24 24" stroke="var(--teal)"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>',
    spp:'<svg viewBox="0 0 24 24" stroke="var(--violet)"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M18 17l2 2 3-4"/></svg>'
  };
  var whatWeDo = '<section class="sec"><div class="wrap">'
  + '<div class="sec-head center"><div class="tag">New to Nearwork?</div><h2 class="sh" data-wwd-title>Vetted '+em.toLowerCase()+' talent — sourced, employed and managed for you.</h2>'
  +   '<p class="lede" style="margin-inline:auto;">Nearwork is a managed remote-staffing partner. We help US and Canadian companies hire English-fluent talent from Colombia without the cost, risk or overhead of doing it alone.</p></div>'
  + '<div class="ps">'
  +   '<div class="ps-card prob"><div class="ps-tag">The problem</div><h3 data-prob-title>Hiring a great '+esc(C.noun)+' is slow, costly and risky.</h3><p>A US hire is expensive and takes months. Going remote on your own means sifting résumés, chasing contractors, running payroll across borders and hoping the person actually works out.</p></div>'
  +   '<div class="ps-card sol"><div class="ps-tag">The solution</div><h3>One partner that sources, vets and runs the role.</h3><p>We source and rigorously assess '+em+' talent in Colombia, then employ, payroll and manage them for you. You get a proven '+esc(C.noun)+' on your team in about two weeks, at roughly half the US cost — fully managed.</p></div>'
  + '</div>'
  + '<div class="svc-grid">'
  +   '<a class="svc" href="../services/direct-recruiting.html"><div class="svc-ic" style="background:var(--teal-lt);">'+svcIcon.dr+'</div><b>Direct Recruiting</b><p>We source, screen and score candidates — you hire them directly onto your payroll.</p></a>'
  +   '<a class="svc" href="../services/sourcing.html"><div class="svc-ic" style="background:var(--teal-lt);">'+svcIcon.dr+'</div><b>Sourcing</b><p>We run the search and hand you a screened shortlist — you interview and hire on your own terms.</p></a>'
  +   '<a class="svc" href="../services/cor.html"><div class="svc-ic" style="background:var(--gold-lt);">'+svcIcon.eor+'</div><b>COR &amp; Payroll</b><p>We become the legal employer — contracts, payroll, benefits and compliance, no local entity.</p></a>'
  +   '<a class="svc" href="../services/dedicated-team.html"><div class="svc-ic" style="background:var(--teal-lt);">'+svcIcon.mt+'</div><b>Dedicated Team</b><p>A dedicated team with a Nearwork lead running quality, coaching and day-to-day delivery.</p></a>'
  +   '<a class="svc" href="../services/strategic-partner-program.html"><div class="svc-ic" style="background:var(--violet-lt);">'+svcIcon.spp+'</div><b>Partner Program</b><p>White-label recruiting and staffing for agencies and firms that place talent for clients.</p></a>'
  + '</div></div></section>';

  var avail = '<section class="sec alt"><div class="wrap"><div class="avail">'
  + '<div><div class="tag teal">Talent, ready now</div><h2 class="sh">Deep '+em+' talent, already here.</h2>'
  +   '<p class="lede">'+esc(C.poolLine)+'</p>'
  +   '<ul class="avail-list" style="margin-top:24px;">'+C.availList.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>'
  + '<div class="avail-cards">'+C.strip.map(function(s){return '<div class="acard"><b>'+esc(s[0])+'</b><span>'+esc(s[1].charAt(0).toUpperCase()+s[1].slice(1))+'</span></div>';}).join('')+'</div>'
  + '</div></div></section>';

  var bars = C.criteria.map(function(c){
    return '<div class="abar"><div class="abar-top"><h4>'+esc(c[0])+'</h4><span class="abar-score">'+c[1]+' / 100</span></div><p>'+esc(c[2])+'</p><div class="abar-track"><div class="abar-fill" style="width:'+c[1]+'%"></div></div></div>';
  }).join('');
  var assess = '<section class="sec"><div class="wrap">'
  + '<div class="sec-head"><div class="tag violet">How we vet</div><h2 class="sh" data-assess-title>We assess what makes '+em.toLowerCase()+' talent <span class="accent">actually good</span>.</h2>'
  +   '<p class="lede">Every '+esc(C.noun)+' is scored on the skills that matter for the role — so you hire on evidence, not a résumé.</p></div>'
  + '<div class="asmt-bars">'+bars+'</div>'
  + '<div class="asmt-foot"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Every score comes with evidence — <b>assessment recordings, references and a DISC profile</b> in your portal.</div>'
  + '</div></section>';

  var rolesSec = '<section class="sec alt"><div class="wrap"><div class="sec-head"><div class="tag teal">Roles we place</div><h2 class="sh">Every '+em+' role, vetted the same way.</h2><p class="lede">Pick the role you\'re hiring for — we shortlist scored, English-fluent candidates in about two weeks.</p></div><div class="roles-cloud" data-roles-cloud></div></div></section>';

  var managed = '<section class="sec dark"><div class="wrap"><div class="sec-head"><div class="tag teal">Managed service</div><h2 class="sh">We don\'t just place them — we run them for you.</h2><p class="lede">Nearwork is the Employer of Record and the operating layer. You get the output of a '+esc(C.noun)+'; we handle everything behind it.</p></div>'
  + '<div class="steps">'
  +   '<div class="step"><div class="step-n">1</div><h3>Source &amp; assess</h3><p>We screen the market and score every '+esc(C.noun)+' on the criteria that matter — then present 2–3 finalists.</p></div>'
  +   '<div class="step"><div class="step-n">2</div><h3>Onboard &amp; contract</h3><p>We hire them locally as Employer of Record — compliant contracts, payroll, benefits and equipment. No entity needed.</p></div>'
  +   '<div class="step"><div class="step-n">3</div><h3>Manage &amp; coach</h3><p>A dedicated success lead runs 1:1s, quality reviews, performance tracking, time-off and day-to-day HR.</p></div>'
  +   '<div class="step"><div class="step-n">4</div><h3>Report &amp; scale</h3><p>Monthly performance reviews and SLAs — plus a 6-month replacement guarantee if the fit isn\'t right.</p></div>'
  + '</div></div></section>';

  var cost = '<section class="sec"><div class="wrap"><div class="sec-head center"><div class="tag">The math</div><h2 class="sh" data-cost-title>A senior '+esc(C.noun)+', for less than half.</h2></div>'
  + '<div class="cost">'
  +   '<div class="cost-row"><div class="cost-lbl">US in-house hire</div><div class="cost-bar us" style="width:100%;">'+esc(C.cost.us)+'</div></div>'
  +   '<div class="cost-row"><div class="cost-lbl">With Nearwork</div><div class="cost-bar nw" style="width:'+C.cost.nwpct+'%;">'+esc(C.cost.nw)+'</div></div>'
  +   '<div class="cost-save"><span class="pill">'+esc(C.cost.save)+'</span><span>Same caliber of talent — payroll, benefits and management fully included.</span></div>'
  + '</div></div></section>';

  /* candidates (generated) */
  var POOL = [
    ["Valentina Ríos","https://images.unsplash.com/photo-1544005313-94ddf0286df2"],
    ["Mateo Jiménez","https://images.unsplash.com/photo-1519085360753-af0119f7cbe7"],
    ["Camila Torres","https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e"],
    ["Andrés Vargas","https://images.unsplash.com/photo-1500648767791-00dcc994a43e"],
    ["Daniela Gómez","https://images.unsplash.com/photo-1494790108377-be9c29b29330"],
    ["Santiago Rojas","https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"],
    ["Mariana López","https://images.unsplash.com/photo-1438761681033-6461ffad8d80"],
    ["Sebastián Muñoz","https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"]
  ];
  var CITIES = ["Medellín","Bogotá","Cali","Barranquilla","Bucaramanga","Cartagena"];
  var h=0; for(var k=0;k<IND.length;k++){ h=(h*31+IND.charCodeAt(k))>>>0; }
  var baseK = parseInt(String(C.cost.nw).replace(/[^0-9]/g,''),10) || 40;
  var topScore = parseInt(top[1],10);
  var cand = [0,1,2].map(function(n){
    var p = POOL[(h+n*3)%POOL.length];
    var city = CITIES[(h+n)%CITIES.length];
    var exp = 4 + ((h>>(n+1))%4); // 4-7y
    var score = topScore - n*2;
    var eng = n<2 ? "C1" : "B2";
    var rate = baseK + (n===0?2:(n===1?0:3));
    return '<div class="prof"><div class="prof-top"><div class="prof-av" style="background-image:url(\''+p[1]+'?auto=format&fit=crop&w=120&q=80\');"></div><div><div class="prof-nm">'+esc(p[0])+'</div><div class="prof-loc">'+city+', CO · '+exp+'y exp</div></div></div>'
      + '<div class="prof-tags"><span class="prof-tag" data-prof-role>'+em+'</span><span class="prof-tag">'+eng+' English</span><span class="prof-tag">Available</span></div>'
      + '<div class="prof-row"><div class="m"><b>'+score+'</b>'+esc(C.metric)+'</div><div class="r"><b>$'+rate+'k/yr</b><span>all-in</span></div></div></div>';
  }).join('');
  var profiles = '<section class="sec alt"><div class="wrap"><div class="sec-head"><div class="tag teal">The talent</div><h2 class="sh" data-prof-title>Meet a few '+esc(C.noun)+'s ready now.</h2><p class="lede">A sample of vetted, available candidates. Tell us your brief and we\'ll shortlist for your exact needs.</p></div><div class="profiles">'+cand+'</div></div></section>';

  /* FAQ = 2 tailored + 3 generic */
  var genFaq = [
    ["Do I need a legal entity in Colombia?","No. Nearwork acts as the Employer of Record and handles local contracts, payroll, benefits and compliance. Your hire works for you day to day; we\'re their legal employer."],
    ["How fast can I hire?","Most searches produce a scored shortlist in about 14 days. You interview the finalists you like and pick — no résumé piles."],
    ["What if a hire isn\'t the right fit?","You\'re covered by a 6-month replacement guarantee. If it isn\'t working out, we re-source at no extra cost."]
  ];
  var allFaq = C.faqs.concat(genFaq);
  var faq = '<section class="sec"><div class="wrap"><div class="sec-head"><div class="tag">FAQ</div><h2 class="sh" data-faq-title>Hiring '+em+' talent, answered.</h2></div><div class="faq">'
    + allFaq.map(function(f,i){ return '<details'+(i===0?' open':'')+'><summary>'+esc(f[0])+'<span></span></summary><p>'+esc(f[1])+'</p></details>'; }).join('')
    + '</div></div></section>';

  /* related = 4 other industries */
  var allInd = DATA.industries || [];
  var myIx = 0; allInd.forEach(function(i,ix){ if(i.name===IND) myIx=ix; });
  var rel = '';
  for(var r=1; r<=4; r++){
    var o = allInd[(myIx+r)%allInd.length];
    if(!o || o.name===IND) continue;
    var d = (window.NW_CONTENT[o.name] && window.NW_CONTENT[o.name].noun) || '';
    rel += '<a class="rel-card" href="'+o.slug+'.html"><b>'+esc(o.name)+'</b><span>'+o.count+' vetted roles</span><i>View industry →</i></a>';
  }
  var related = '<section class="sec alt"><div class="wrap"><div class="sec-head"><div class="tag teal">Explore more</div><h2 class="sh">Related industries</h2></div><div class="rel">'+rel+'</div></div></section>';

  var cta = '<section class="sec"><div class="cta-band"><h2 data-cta-title>Ready to hire '+em+' talent?</h2><p>Tell us the brief. We\'ll have scored, vetted finalists in front of you in about two weeks.</p><div class="cta-actions"><a class="btn-teal" href="/book">Hire on demand <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a><a class="btn-ghost" href="../pricing.html">See pricing</a></div></div></section>';

  var footer = '<footer class="rf"><div class="rf-in">'
  + '<div class="rf-brand"><div class="lg">Nearwork</div><p>On-demand remote staffing for US &amp; Canadian companies. Vetted talent, managed for you, at a fraction of US cost.</p></div>'
  + '<div class="rf-col"><h4>Industries</h4><a href="index.html">All industries</a><a href="software-development.html">Software Development</a><a href="sales.html">Sales</a><a href="finance-and-accounting.html">Finance &amp; Accounting</a></div>'
  + '<div class="rf-col"><h4>Services</h4><a href="../services/direct-recruiting.html">Direct Recruiting</a><a href="../services/sourcing.html">Sourcing</a><a href="../services/cor.html">COR</a><a href="../services/dedicated-team.html">Dedicated Team</a><a href="../services/strategic-partner-program.html">Partner Program</a></div>'
  + '<div class="rf-col"><h4>Company</h4><a href="/">Home</a><a href="../pricing.html">Pricing</a><a href="/book">Hire on demand</a></div>'
  + '</div><div class="rf-bot">© 2026 Nearwork. Remote staffing &amp; Employer of Record.</div></footer>';

  app.innerHTML = NAV + crumb + hero + whatWeDo + avail + assess + rolesSec + managed + cost + profiles + faq + related + cta + footer;

  /* ---------- behavior ---------- */
  // role chips
  var cloud = document.querySelector('[data-roles-cloud]');
  function chipHTML(r){ return '<a class="rchip" href="?role='+encodeURIComponent(r.title)+'">'+esc(r.title)+' <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>'; }
  if(cloud){
    if((window.NW_ROLES_MARQUEE !== false) && roles.length > 3){
      var mid = Math.ceil(roles.length/2);
      var setA = roles.slice(0,mid).map(chipHTML).join('');
      var setB = roles.slice(mid).map(chipHTML).join('');
      cloud.classList.remove('roles-cloud');
      cloud.classList.add('rmarquee');
      cloud.innerHTML = '<div class="rmq-row"><div class="rmq-track" aria-hidden="false">'+setA+setA+'</div></div>'
                      + '<div class="rmq-row"><div class="rmq-track rev">'+setB+setB+'</div></div>';
      // Reliably freeze the whole marquee while hovered so every chip is easy to click.
      var mqTracks = cloud.querySelectorAll('.rmq-track');
      var setState = function(v){ mqTracks.forEach(function(t){ t.style.animationPlayState = v; }); };
      cloud.addEventListener('pointerenter', function(){ setState('paused'); });
      cloud.addEventListener('pointerleave', function(){ setState('running'); });
      // If a drag/scroll happens, a stray click shouldn't be swallowed — anchors handle nav natively.
    } else {
      cloud.innerHTML = roles.map(chipHTML).join('');
    }
  }

  // deep-link ?role=
  var params = new URLSearchParams(location.search);
  var role = (params.get('role')||window.NW_ROLE);
  var match = role && roles.filter(function(r){ return r.title.toLowerCase()===role.toLowerCase(); })[0];
  if(match){
    var t = esc(match.title);
    var rt = match.title;
    var setTxt=function(sel,val){ var el=document.querySelector(sel); if(el) el.textContent=val; };
    // hero
    var ht=document.querySelector('[data-hero-title]'); if(ht) ht.innerHTML='Hire a <em>'+t+'</em>, managed for you.';
    var hl=document.querySelector('[data-hero-lead]'); if(hl) hl.textContent='A vetted, English-fluent '+rt+' — assessed for what matters in the role and fully managed by Nearwork.';
    var cr=document.querySelector('[data-card-role]'); if(cr) cr.textContent=rt;
    setTxt('[data-kicker]', rt+' · Remote from Colombia');
    // breadcrumb: add the role as its own level
    var cb=document.querySelector('[data-crumb]');
    if(cb){ var chev='<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>'; cb.innerHTML='<a href="/">Home</a>'+chev+'<a href="index.html">Industries</a>'+chev+'<a href="'+slug+'.html">'+em+'</a>'+chev+'<span class="cur">'+t+'</span>'; }
    // what-we-do + assessment + cost + profiles + faq headings
    setTxt('[data-wwd-title]', 'Vetted '+rt+' talent — sourced, employed and managed for you.');
    setTxt('[data-prob-title]', 'Hiring a great '+rt+' is slow, costly and risky.');
    var at=document.querySelector('[data-assess-title]'); if(at) at.innerHTML='We assess what makes a great <span class="accent">'+t+'</span>.';
    setTxt('[data-cost-title]', 'A senior '+rt+', for less than half.');
    setTxt('[data-prof-title]', 'Meet a few '+rt+'s ready now.');
    setTxt('[data-faq-title]', 'Hiring a '+rt+', answered.');
    // profile role chips
    document.querySelectorAll('[data-prof-role]').forEach(function(el){ el.textContent=rt; });
    // cta + page title
    var ct=document.querySelector('[data-cta-title]'); if(ct) ct.textContent='Ready to hire a '+rt+'?';
    document.title='Hire a '+rt+' | Nearwork — '+IND+' Talent from Colombia';
  }

  // nav dropdowns + scroll + mobile
  var pill=document.getElementById('nav-pill');
  window.addEventListener('scroll',function(){ pill.classList.toggle('scrolled', window.scrollY>20); });
  var dds=document.querySelectorAll('.dd');
  dds.forEach(function(dd){ dd.querySelector('.dd-btn').addEventListener('click',function(e){ e.stopPropagation(); var w=dd.classList.contains('open'); dds.forEach(function(d){d.classList.remove('open');}); if(!w) dd.classList.add('open'); }); });
  document.addEventListener('click',function(e){ var inside=false; dds.forEach(function(d){ if(d.contains(e.target)) inside=true; }); if(!inside) dds.forEach(function(d){ d.classList.remove('open'); }); });
  var ham=document.getElementById('hamBtn'); if(ham) ham.addEventListener('click',function(){ document.getElementById('mobMenu').classList.toggle('open'); });
})();

}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',__run);}else{__run();}})();