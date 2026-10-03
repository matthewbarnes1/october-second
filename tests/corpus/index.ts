/** Real-world shaped inputs, each exercising a different failure mode. */
export const CORPUS: Record<string, Record<string, string>> = {
  // v0 / Lovable / bolt style: Tailwind via CDN, no stylesheet, utility classes everywhere
  'tailwind-cdn': {
    'index.html': `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lumen AI | Your AI Copilot</title>
<script src="https://cdn.tailwindcss.com"></script><script>tailwind.config={theme:{extend:{colors:{brand:'#7c3aed'}}}}</script></head>
<body class="bg-slate-950 text-white antialiased">
<header class="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/60 border-b border-white/10"><nav class="mx-auto max-w-7xl flex items-center justify-between px-6 py-4"><a href="/" class="flex items-center gap-2 text-xl font-bold"><span class="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500"></span>Lumen</a>
<ul class="hidden md:flex gap-8 text-sm text-slate-300"><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">FAQ</a></li><li><a href="/blog">Blog</a></li></ul>
<a href="/signup" class="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold hover:scale-105 transition">Get started</a></nav></header>
<main>
<section class="relative overflow-hidden py-32 text-center"><div class="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl"></div>
<div class="mx-auto max-w-4xl px-6"><span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-violet-300">✨ Powered by GPT-5</span>
<h1 class="mt-6 text-6xl font-bold tracking-tight"><span class="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Supercharge</span> your productivity with AI</h1>
<p class="mx-auto mt-6 max-w-2xl text-xl text-slate-400">Lumen is your intelligent copilot that seamlessly integrates with your workflow and unlocks unprecedented efficiency.</p>
<div class="mt-10 flex justify-center gap-4"><a href="/signup" class="rounded-xl bg-violet-600 px-8 py-4 font-semibold">Start free trial</a><a href="/demo" class="rounded-xl border border-white/20 px-8 py-4 font-semibold">Book a demo</a></div></div></section>
<section id="features" class="py-24"><div class="mx-auto max-w-7xl px-6"><h2 class="text-center text-4xl font-bold">Why teams choose Lumen</h2><p class="mx-auto mt-4 max-w-2xl text-center text-slate-400">Everything you need to ship faster.</p>
<div class="mt-16 grid gap-8 md:grid-cols-3">
<div class="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur"><div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20"><svg class="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div><h3 class="text-xl font-semibold">Instant answers</h3><p class="mt-2 text-slate-400">Ask anything and get precise, sourced responses in under a second.</p></div>
<div class="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur"><div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20"><svg class="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7"/></svg></div><h3 class="text-xl font-semibold">Verified results</h3><p class="mt-2 text-slate-400">Every claim links back to the document it came from.</p></div>
<div class="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur"><div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20"><svg class="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6v6l4 2"/></svg></div><h3 class="text-xl font-semibold">Saves hours</h3><p class="mt-2 text-slate-400">Automate reports, summaries and weekly updates.</p></div></div></div></section>
<section id="pricing" class="py-24"><div class="mx-auto max-w-5xl px-6"><h2 class="text-center text-4xl font-bold">Pricing</h2>
<div class="mt-12 grid gap-6 md:grid-cols-2"><div class="rounded-2xl border border-white/10 p-8"><h3 class="text-xl font-semibold">Solo</h3><p class="mt-4 text-4xl font-bold">$12<span class="text-base font-normal text-slate-400">/month</span></p><ul class="mt-6 space-y-3 text-slate-300"><li>1 user</li><li>500 queries</li><li>Email support</li></ul><a href="/signup?plan=solo" class="mt-8 block rounded-xl border border-white/20 py-3 text-center">Choose Solo</a></div>
<div class="rounded-2xl border-2 border-violet-500 p-8"><span class="text-xs font-semibold uppercase text-violet-300">Most popular</span><h3 class="text-xl font-semibold">Team</h3><p class="mt-4 text-4xl font-bold">$39<span class="text-base font-normal text-slate-400">/month</span></p><ul class="mt-6 space-y-3 text-slate-300"><li>10 users</li><li>Unlimited queries</li><li>Priority support</li></ul><a href="/signup?plan=team" class="mt-8 block rounded-xl bg-violet-600 py-3 text-center">Choose Team</a></div></div></div></section>
<section id="faq" class="py-24"><div class="mx-auto max-w-3xl px-6"><h2 class="text-center text-4xl font-bold">Questions</h2><div class="mt-10 divide-y divide-white/10">
<details class="py-4"><summary class="cursor-pointer font-medium">Does Lumen train on my data?</summary><p class="mt-2 text-slate-400">No. Your content is never used for training.</p></details>
<details class="py-4"><summary class="cursor-pointer font-medium">Can I use it offline?</summary><p class="mt-2 text-slate-400">Not yet, but a desktop app is on the roadmap.</p></details></div></div></section>
</main><footer class="border-t border-white/10 py-12 text-center text-sm text-slate-500"><p>© 2025 Lumen Labs. All rights reserved.</p></footer></body></html>`,
  },

  // Bootstrap 5 marketing page
  'bootstrap': {
    'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orbit CRM</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"></head>
<body><nav class="navbar navbar-expand-lg navbar-dark bg-primary"><div class="container"><a class="navbar-brand" href="#">Orbit</a><ul class="navbar-nav"><li class="nav-item"><a class="nav-link" href="#a">Product</a></li><li class="nav-item"><a class="nav-link" href="#b">Customers</a></li></ul><a class="btn btn-light" href="#c">Free trial</a></div></nav>
<div class="container py-5 text-center"><h1 class="display-4 fw-bold">Close deals faster</h1><p class="lead">Orbit keeps every conversation, task and contract in one place so your team never drops the ball.</p><a href="#c" class="btn btn-primary btn-lg">Start free</a> <a href="#a" class="btn btn-outline-secondary btn-lg">See how it works</a></div>
<section id="a" class="py-5 bg-light"><div class="container"><h2 class="text-center mb-5">Built for sales teams</h2><div class="row"><div class="col-md-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Pipeline view</h5><p class="card-text">See every deal by stage and spot the ones that are stuck.</p></div></div></div><div class="col-md-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Email sync</h5><p class="card-text">Two-way sync with Gmail and Outlook, no copy and paste.</p></div></div></div><div class="col-md-4"><div class="card h-100"><div class="card-body"><h5 class="card-title">Forecasting</h5><p class="card-text">Weighted forecasts update as deals move.</p></div></div></div></div></div></section>
<section id="b" class="py-5"><div class="container"><h2 class="text-center">Trusted by 2,000 teams</h2><div class="row text-center"><div class="col"><img src="logos/acme.svg" alt="Acme"></div><div class="col"><img src="logos/globex.svg" alt="Globex"></div><div class="col"><img src="logos/initech.svg" alt="Initech"></div></div></div></section>
<footer class="py-4 bg-dark text-white"><div class="container"><p class="mb-0">Orbit Software Ltd. Registered in England 0123456.</p></div></footer></body></html>`,
  },

  // Documentation / content-heavy: code blocks, tables, definition lists, nested lists, blockquote
  'docs-content': {
    'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quill CLI documentation</title></head><body>
<header><nav><a href="/">Quill</a><a href="/docs">Docs</a><a href="/changelog">Changelog</a></nav></header>
<main><article><h1>Getting started with Quill</h1><p>Quill is a command line tool that turns markdown into static sites. This guide covers installation and your first build.</p>
<h2>Installation</h2><pre><code>npm install --global quill-cli
quill --version</code></pre><p>Quill requires Node 20 or newer. On Windows use PowerShell as administrator.</p>
<h2>Configuration options</h2><table><thead><tr><th>Option</th><th>Default</th><th>Description</th></tr></thead><tbody><tr><td>outDir</td><td>dist</td><td>Where built files are written</td></tr><tr><td>minify</td><td>true</td><td>Compress HTML output</td></tr></tbody></table>
<h2>Concepts</h2><dl><dt>Collection</dt><dd>A folder of related markdown files.</dd><dt>Layout</dt><dd>A template that wraps rendered pages.</dd></dl>
<blockquote><p>Quill made our docs build 10x faster.</p><cite>Priya N., maintainer</cite></blockquote>
<h2>Next steps</h2><ul><li>Read the <a href="/docs/layouts">layouts guide</a></li><li>Browse <a href="/docs/plugins">plugins</a><ul><li>Search plugin</li><li>Sitemap plugin</li></ul></li></ul></article></main><footer><p>Quill is MIT licensed.</p></footer></body></html>`,
  },

  // Right-to-left, Arabic, with dir attribute
  'rtl-arabic': {
    'index.html': `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مطعم الياسمين</title><meta name="description" content="مطعم عائلي يقدم المأكولات الشامية"></head><body>
<nav><a href="/">الياسمين</a><ul><li><a href="#menu">القائمة</a></li><li><a href="#visit">زورونا</a></li></ul></nav>
<section><h1>طعم البيت في قلب المدينة</h1><p>نقدم أطباقاً شامية تقليدية تُحضّر يومياً من مكونات طازجة.</p><a class="btn" href="#visit">احجز طاولة</a></section>
<section id="menu"><h2>أطباقنا المميزة</h2><div><div><h3>حمص بالطحينة</h3><p>حمص كريمي مع زيت الزيتون.</p></div><div><h3>فتة الباذنجان</h3><p>باذنجان مقلي مع الزبادي والصنوبر.</p></div><div><h3>كبة مشوية</h3><p>كبة لحم مع البرغل والتوابل.</p></div></div></section>
<footer><p>© 2025 مطعم الياسمين</p></footer></body></html>`,
  },

  // Modern head/SEO/performance features that must not be lost
  'head-and-images': {
    'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fieldnotes Studio - architecture and interiors</title>
<meta name="description" content="Small studio."><link rel="canonical" href="https://fieldnotes.example/"><link rel="alternate" hreflang="de" href="https://fieldnotes.example/de/"><link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Journal"><link rel="manifest" href="/site.webmanifest"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta property="og:title" content="Fieldnotes"><meta property="og:image" content="https://fieldnotes.example/og.jpg"><meta name="theme-color" content="#111">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Fieldnotes Studio"}</script></head><body>
<header><a href="/">Fieldnotes</a><nav><a href="/work">Work</a><a href="/about">About</a></nav></header>
<section><h1>Rooms that remember who lives in them</h1><p>We design homes and small public buildings.</p>
<picture><source media="(min-width: 800px)" srcset="img/hero-wide.avif 1600w, img/hero-wide.webp 1200w" type="image/avif"><img src="img/hero.jpg" srcset="img/hero-640.jpg 640w, img/hero-1280.jpg 1280w" sizes="(min-width: 800px) 1200px, 100vw" width="1280" height="720" alt="Sunlit living room with oak shelving"></picture></section>
<section><h2>Recent work</h2><div><figure><img src="img/a.jpg" width="600" height="400" alt="Library renovation" loading="lazy"><figcaption>Library renovation, Leeds</figcaption></figure><figure><img src="img/b.jpg" width="600" height="400" alt="Courtyard house"><figcaption>Courtyard house, Porto</figcaption></figure><figure><img src="img/c.jpg" width="600" height="400" alt="Studio loft"><figcaption>Studio loft, Berlin</figcaption></figure></div></section>
<video controls poster="img/poster.jpg" width="640" height="360"><source src="media/tour.mp4" type="video/mp4"></video>
<footer><p>© Fieldnotes Studio</p></footer></body></html>`,
  },

  // Client-side rendered shell: nothing to redesign statically
  'spa-shell': {
    'index.html': `<!doctype html><html><head><meta charset="utf-8"><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript><script type="module" src="/assets/index-abc123.js"></script></body></html>`,
  },

  // Forms with fieldset/legend, radios, checkboxes, select groups
  'complex-form': {
    'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Join the Riverside Cycling Club</title></head><body><main><section><h1>Join the club</h1><p>Membership runs January to December and includes insurance.</p>
<form action="/join" method="post"><fieldset><legend>About you</legend><label for="n">Full name</label><input id="n" name="name" required><label for="e">Email</label><input id="e" type="email" name="email" required></fieldset>
<fieldset><legend>Your riding</legend><label><input type="radio" name="lvl" value="a"> Casual</label><label><input type="radio" name="lvl" value="b"> Weekend racer</label><label><input type="checkbox" name="news"> Send me the newsletter</label>
<label for="r">Preferred route</label><select id="r" name="route"><optgroup label="Short"><option>Canal loop</option></optgroup><optgroup label="Long"><option>Hill climb</option></optgroup></select></fieldset><button type="submit">Join now</button></form></section></main></body></html>`,
  },

  // Malformed HTML as AI tools often emit
  'malformed': {
    'index.html': `<html><body><div class="hero"><h1>Broken but readable<p>Unclosed heading and paragraph <b>bold <i>italic</b></i><div>Stray text<section><h2>Offer</h2><ul><li>One<li>Two<li>Three</ul><a href=/buy class=btn>Buy now</div></div><footer>© Someone`,
  },

  'empty': { 'index.html': '' },
  'whitespace-only': { 'index.html': '   \n\n  ' },
  'no-body': { 'index.html': '<!doctype html><html><head><title>Only a head</title></head></html>' },

  // CJK + emoji + combining characters
  'unicode': {
    'index.html': `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>桜カフェ</title></head><body><section><h1>季節を味わう、小さなカフェ</h1><p>毎朝焼き上げるパンと、丁寧に淹れたコーヒーをどうぞ。🍞☕ Ñandú café — naïve résumé.</p><a class="btn" href="/menu">メニューを見る</a></section><section><h2>おすすめ</h2><div><div><h3>抹茶ラテ</h3><p>京都産の抹茶を使用。</p></div><div><h3>あんパン</h3><p>自家製の餡。</p></div></div></section></body></html>`,
  },
};

/** Visible words of 4+ letters, used to measure whether content survived. */
export function wordsOf(html: string): string[] {
  const noScripts = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const text = noScripts.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{3,}/gu) ?? []).map((w) => w.toLowerCase());
}
