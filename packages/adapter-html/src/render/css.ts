import { tokensCss, type StyleSpec } from '@morpheus/core';

/**
 * Component stylesheet. Everything is driven by the --m-* tokens so the live editor can
 * restyle a page by changing variables only. Layout is what makes patterns look different.
 */
export function componentCss(style: StyleSpec): string {
  const motion = style.motion;
  const imageFx =
    style.imagery === 'duotone' ? '.m-img{filter:grayscale(1) contrast(1.05);mix-blend-mode:multiply}.m-tone-inverse .m-img{mix-blend-mode:screen}'
    : style.imagery === 'bordered' ? '.m-img{border:var(--m-border);box-shadow:var(--m-shadow)}'
    : style.imagery === 'grain' ? '.m-img{border-radius:var(--m-radius);filter:sepia(.12) saturate(.92)}'
    : '.m-img{border-radius:var(--m-radius)}';
  return `${tokensCss(style)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:5rem}
body{margin:0;background:var(--m-bg);color:var(--m-fg);font-family:var(--m-font-body);font-size:var(--m-base);line-height:var(--m-leading);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img,svg,video{max-width:100%;height:auto;display:block}
a{color:inherit}
p{margin:0 0 1em}
ul,ol{margin:0;padding:0}
:focus-visible{outline:3px solid var(--m-accent);outline-offset:3px}
.m-skip{position:absolute;left:-999px;top:0;background:var(--m-fg);color:var(--m-bg);padding:.75rem 1rem;z-index:100}
.m-skip:focus{left:1rem;top:1rem}
.m-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.m-container{max-width:var(--m-container);margin-inline:auto;padding-inline:var(--m-gutter)}
.m-narrow{max-width:46rem}

/* ---- type ---- */
.m-h{font-family:var(--m-font-display);font-weight:var(--m-heading-weight);letter-spacing:var(--m-tracking);line-height:1.08;margin:0 0 .5em;text-transform:var(--m-display-case);text-wrap:balance}
.m-h1{font-size:clamp(2.4rem,6.2vw,var(--m-step-5))}
.m-h2{font-size:clamp(1.9rem,4vw,var(--m-step-4))}
.m-h3{font-size:var(--m-step-2);line-height:1.2}
.m-h4{font-size:var(--m-step-1);line-height:1.25}
.m-eyebrow,.m-kicker,.m-flag{font-family:var(--m-font-mono);font-size:var(--m-step-m1);letter-spacing:.1em;text-transform:uppercase;color:var(--m-muted);margin:0 0 1.25rem}
.m-sub{font-size:var(--m-step-1);color:var(--m-muted);max-width:42rem;text-wrap:pretty}
.m-head{margin-bottom:clamp(2rem,5vw,3.5rem)}
.m-head .m-sub{margin:0}
.m-prose{max-width:42rem}
.m-prose p{color:var(--m-fg)}
.m-index,.m-big-n,.m-step-n{font-family:var(--m-font-mono);color:var(--m-accent)}

/* ---- sections ---- */
.m-sec{padding-block:var(--m-section-y);position:relative}
.m-space-tight{padding-block:calc(var(--m-section-y)*.55)}
.m-space-loose{padding-block:calc(var(--m-section-y)*1.2)}
.m-tone-plain{background:var(--m-bg)}
.m-tone-surface{background:var(--m-surface)}
.m-tone-inverse,.m-tone-accent{--m-fg:var(--m-inverse-fg);--m-muted:color-mix(in srgb,var(--m-inverse-fg) 72%,transparent);--m-line:color-mix(in srgb,var(--m-inverse-fg) 28%,transparent);--m-surface:color-mix(in srgb,var(--m-inverse-fg) 8%,transparent)}
.m-tone-inverse{background:var(--m-inverse);color:var(--m-inverse-fg)}
.m-tone-accent{background:var(--m-accent);color:var(--m-accent-fg);--m-fg:var(--m-accent-fg);--m-muted:color-mix(in srgb,var(--m-accent-fg) 80%,transparent);--m-line:color-mix(in srgb,var(--m-accent-fg) 38%,transparent)}
.m-tone-accent .m-btn-primary{background:var(--m-accent-fg);color:var(--m-accent);border-color:var(--m-accent-fg)}
.m-tone-accent .m-btn-secondary{border-color:var(--m-accent-fg);color:var(--m-accent-fg)}
.m-split{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(2rem,6vw,6rem);align-items:start}
.m-sticky{position:sticky;top:6rem}
.m-split .m-head{margin-bottom:0}

/* ---- buttons ---- */
.m-actions{display:flex;flex-wrap:wrap;gap:1rem 1.5rem;align-items:center;margin-top:2rem}
.m-btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;min-height:2.9rem;padding:.7rem 1.5rem;border-radius:var(--m-radius-btn);font:600 var(--m-step-0)/1 var(--m-font-body);text-decoration:none;border:var(--m-border-w) solid transparent;cursor:pointer;transition:background .15s,color .15s,border-color .15s${motion === 'none' ? '' : ',transform .15s'}}
.m-btn-primary{background:var(--m-accent);color:var(--m-accent-fg);border-color:var(--m-accent)}
.m-btn-primary:hover{filter:brightness(1.08)${motion === 'none' ? '' : ';transform:translateY(-1px)'}}
.m-btn-secondary{background:transparent;color:var(--m-fg);border-color:var(--m-fg)}
.m-btn-secondary:hover{background:var(--m-fg);color:var(--m-bg)}
.m-link{font-weight:600;text-decoration:underline;text-underline-offset:.25em;text-decoration-thickness:1px}
.m-link:hover{text-decoration-thickness:2px}

/* ---- header ---- */
.m-header{border-bottom:1px solid var(--m-line);background:var(--m-bg);position:sticky;top:0;z-index:50}
.m-header .m-container{display:flex;align-items:center;gap:2rem;min-height:4.5rem}
.m-brand{display:inline-flex;align-items:center;gap:.6rem;text-decoration:none;font:var(--m-heading-weight) var(--m-step-1)/1 var(--m-font-display);letter-spacing:var(--m-tracking);color:var(--m-fg)}
.m-brand-logo{height:1.8rem;width:auto}
.m-nav{margin-left:auto}
.m-nav ul{display:flex;gap:1.75rem;list-style:none;align-items:center}
.m-nav a{white-space:nowrap;text-decoration:none;font-size:var(--m-step-0);color:var(--m-fg)}
.m-nav a:hover{text-decoration:underline;text-underline-offset:.3em}
.m-more-links{position:relative}
.m-more-links summary{cursor:pointer;list-style:none}
.m-more-links ul{position:absolute;right:0;top:2rem;flex-direction:column;align-items:flex-start;gap:.5rem;background:var(--m-bg);border:var(--m-border);padding:1rem 1.25rem;min-width:11rem}
.m-header-split .m-container{flex-direction:column;gap:0;align-items:stretch}
.m-header-split .m-header-top{text-align:center;padding:1.25rem 0 .75rem}
.m-header-split .m-header-row{display:flex;align-items:center;gap:2rem;border-top:1px solid var(--m-line);padding:.6rem 0}
.m-header-split .m-nav{margin:0 auto}
.m-menu{display:none;margin-left:auto}
.m-menu summary{list-style:none;cursor:pointer;width:2.75rem;height:2.75rem;display:grid;place-items:center;border:var(--m-border);border-radius:var(--m-radius-btn)}
.m-menu summary span,.m-menu summary span::before,.m-menu summary span::after{display:block;width:1.2rem;height:2px;background:var(--m-fg);content:'';position:relative}
.m-menu summary span::before{position:absolute;top:-6px}.m-menu summary span::after{position:absolute;top:6px}
.m-menu-panel{position:absolute;left:0;right:0;top:100%;background:var(--m-bg);border-bottom:1px solid var(--m-line);padding:1.25rem var(--m-gutter) 1.75rem}
.m-menu-panel ul{list-style:none;display:grid;gap:.9rem;margin-bottom:1.25rem}.m-menu-panel a{text-decoration:none;font-size:var(--m-step-1)}

/* ---- hero ---- */
.m-hero-centered{text-align:center}
.m-hero-centered .m-sub{margin-inline:auto}
.m-hero-centered .m-actions{justify-content:center}
.m-hero-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(2rem,6vw,5rem);align-items:center}
.m-hero-art{aspect-ratio:1/1;background:repeating-linear-gradient(0deg,transparent 0 31px,var(--m-line) 31px 32px),repeating-linear-gradient(90deg,transparent 0 31px,var(--m-line) 31px 32px);border:var(--m-border);position:relative}
.m-hero-art::after{content:'';position:absolute;inset:18% 24% 30% 12%;background:var(--m-accent);border-radius:var(--m-radius)}
.m-hero-panel{border:var(--m-border);padding:2rem;background:var(--m-surface);border-radius:var(--m-radius)}
.m-hero-editorial{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:clamp(2rem,6vw,5rem);align-items:end;border-top:var(--m-border-w) solid var(--m-fg);padding-top:2.5rem}
.m-hero-editorial .m-h1{font-size:clamp(2.8rem,7.4vw,var(--m-step-5));margin:0}
.m-hero-editorial .m-hero-wide,.m-hero-editorial .m-statrow,.m-hero-editorial .m-logorow{grid-column:1/-1}
.m-hero-statement .m-h1{font-size:clamp(3rem,10vw,calc(var(--m-step-5)*1.35));line-height:.98;max-width:16ch;margin-bottom:.4em}
.m-hero-row{display:flex;flex-wrap:wrap;gap:2rem 4rem;align-items:flex-end;justify-content:space-between;border-top:var(--m-border-w) solid var(--m-line);padding-top:1.75rem;margin-top:2rem}
.m-hero-row .m-sub{max-width:34rem;margin:0}.m-hero-row .m-actions{margin-top:0}
.m-hero-proof{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:2rem 4rem;align-items:center}
.m-hero-proof .m-hero-text{grid-column:1/2}
.m-hero-solo{grid-template-columns:1fr}.m-hero-solo .m-h1{font-size:clamp(2.8rem,7vw,var(--m-step-5));max-width:18ch}.m-hero-solo .m-sub{max-width:38rem}
.m-hero-proofbar{grid-column:1/-1;border-top:1px solid var(--m-line);padding-top:2rem;margin-top:1rem}
.m-hero-media{border-radius:var(--m-radius);width:100%}

/* ---- proof ---- */
.m-statrow,.m-stats{display:flex;flex-wrap:wrap;gap:2rem 3.5rem;margin:0;list-style:none}
.m-statrow div,.m-stats div{display:flex;flex-direction:column-reverse}
.m-statrow dd,.m-stats dd{margin:0;font:var(--m-heading-weight) var(--m-step-3)/1 var(--m-font-display);letter-spacing:var(--m-tracking)}
.m-statrow dt,.m-stats dt{color:var(--m-muted);font-size:var(--m-step-m1)}
.m-stats{justify-content:space-between;border-block:1px solid var(--m-line);padding-block:2rem}
.m-stats-large{border:0;gap:3rem 6rem}.m-stats-large dd{font-size:clamp(3rem,8vw,var(--m-step-5))}
.m-logorow ul,.m-logos{display:flex;flex-wrap:wrap;gap:1.25rem 2.75rem;align-items:center;list-style:none}
.m-logo{height:1.6rem;width:auto;opacity:.65;filter:grayscale(1)}
.m-logos{justify-content:space-between}
.m-kicker{margin-bottom:1rem}

/* ---- features ---- */
.m-grid{display:grid;gap:clamp(1.25rem,3vw,2rem)}
.m-grid-2{grid-template-columns:repeat(2,1fr)}.m-grid-3{grid-template-columns:repeat(3,1fr)}.m-grid-4{grid-template-columns:repeat(4,1fr)}
.m-card{border:var(--m-border);border-radius:var(--m-radius);padding:clamp(1.25rem,3vw,2rem);background:var(--m-bg);box-shadow:var(--m-shadow)}
.m-tone-plain .m-card{background:var(--m-surface)}
.m-card-img{border-radius:var(--m-radius);margin-bottom:1rem}
.m-icon{font-size:1.75rem;display:block;margin-bottom:1rem;line-height:1}
.m-icon-svg svg{width:2rem;height:2rem}
.m-card .m-index{display:block;margin-bottom:1.25rem}
.m-card p:last-child{margin-bottom:0}
.m-rows{display:grid}
.m-row{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:2rem 5rem;padding-block:clamp(1.75rem,4vw,3rem);border-top:1px solid var(--m-line);align-items:start}
.m-row:last-child{border-bottom:1px solid var(--m-line)}
.m-row-flip{grid-template-columns:minmax(0,6fr) minmax(0,5fr)}
.m-row-flip .m-row-lead{order:2}.m-row-flip .m-row-body{order:1}
.m-row-lead .m-index{display:block;margin-bottom:.75rem}
.m-row-lead .m-h{margin:0}
.m-row-media{grid-column:1/-1}
.m-index-list{list-style:none;display:grid}
.m-index-list li{display:grid;grid-template-columns:3.5rem minmax(0,1fr);gap:1rem;padding-block:1.5rem;border-top:1px solid var(--m-line)}
.m-index-list li:last-child{border-bottom:1px solid var(--m-line)}
.m-index-list .m-h{margin-bottom:.35em}.m-index-list p{margin:0;color:var(--m-muted)}
.m-bento{display:grid;grid-template-columns:repeat(6,1fr);gap:clamp(.75rem,2vw,1.25rem)}
.m-tile{border:var(--m-border);border-radius:var(--m-radius);padding:clamp(1.25rem,3vw,2rem);background:var(--m-surface);box-shadow:var(--m-shadow);display:flex;flex-direction:column;gap:.25rem}
.m-tile-lead{background:var(--m-accent);color:var(--m-accent-fg);--m-muted:var(--m-accent-fg);--m-accent:var(--m-accent-fg)}
.m-tile .m-index{margin-bottom:auto;padding-bottom:2rem}
.m-tile p{margin:0;color:var(--m-muted)}.m-tile-lead p{color:var(--m-accent-fg)}
.m-span-2{grid-column:span 2}.m-span-3{grid-column:span 3}.m-span-4{grid-column:span 4}.m-span-6{grid-column:span 6}
.m-bullets,.m-ticks{list-style:none;display:grid;gap:.5rem;margin:1rem 0}
.m-bullets li::before,.m-ticks li::before{content:'—';margin-right:.6em;color:var(--m-accent)}
.m-timeline{list-style:none;display:grid;border-left:var(--m-border-w) solid var(--m-fg);margin-left:1rem}
.m-timeline li{display:grid;grid-template-columns:auto 1fr;gap:1.25rem;padding:0 0 2.5rem 0;position:relative;margin-left:-1.25rem}
.m-step-n{width:2.5rem;height:2.5rem;display:grid;place-items:center;background:var(--m-bg);border:var(--m-border);border-radius:999px;flex:none}
.m-steps-cols{list-style:none;display:grid;gap:2rem;grid-template-columns:repeat(var(--cols,3),1fr)}
.m-cols-2{--cols:2}.m-cols-4{--cols:4}
.m-big-n{display:block;font-size:var(--m-step-5);line-height:1;margin-bottom:1rem}

/* ---- quotes ---- */
.m-pull blockquote{margin:0}.m-pull p{font:var(--m-heading-weight) clamp(1.6rem,3.6vw,var(--m-step-4))/1.2 var(--m-font-display);letter-spacing:var(--m-tracking);text-wrap:balance;max-width:28ch}
.m-attrib{display:flex;gap:.9rem;align-items:center;margin-top:1.25rem;font-size:var(--m-step-m1)}
.m-attrib strong{display:block}.m-role{color:var(--m-muted);display:block}
.m-avatar{width:2.75rem;height:2.75rem;border-radius:999px;object-fit:cover}
.m-quote{margin:0}.m-quote blockquote{margin:0}.m-quote p{font-size:var(--m-step-1);line-height:1.45;margin:0}
.m-wall{display:grid;grid-template-columns:repeat(3,1fr);gap:2rem 3rem;align-items:start}
.m-wall .m-quote{border-top:var(--m-border-w) solid var(--m-fg);padding-top:1.25rem}
.m-wall .m-quote:nth-child(2){margin-top:3rem}.m-wall .m-quote:nth-child(3){margin-top:1.5rem}

/* ---- pricing ---- */
.m-plan{display:flex;flex-direction:column;gap:.25rem}
.m-plan .m-price{font:var(--m-heading-weight) var(--m-step-4)/1 var(--m-font-display);margin:.25rem 0 1rem}
.m-plan-hl{border-width:calc(var(--m-border-w)*2);border-color:var(--m-accent)}
.m-flag{display:inline-block;margin:0 0 .75rem;color:var(--m-accent)}
.m-plan .m-btn{margin-top:auto;align-self:flex-start}
.m-table-wrap{overflow-x:auto}
.m-table{width:100%;border-collapse:collapse;min-width:36rem}
.m-table th,.m-table td{padding:1rem 1.25rem;border-bottom:1px solid var(--m-line);text-align:center;vertical-align:top}
.m-table thead th{font:var(--m-heading-weight) var(--m-step-1)/1.2 var(--m-font-display);vertical-align:bottom}
.m-table th[scope=row]{text-align:left;font-weight:400}
.m-table .m-price{display:block;font:var(--m-heading-weight) var(--m-step-3)/1.1 var(--m-font-display);margin-top:.5rem}
.m-hl{background:var(--m-surface)}
.m-yes{color:var(--m-accent)}.m-no{color:var(--m-muted)}

/* ---- faq ---- */
.m-faq details{border-top:1px solid var(--m-line);padding-block:1.25rem}.m-faq details:last-child{border-bottom:1px solid var(--m-line)}
.m-faq summary{cursor:pointer;font:var(--m-heading-weight) var(--m-step-1)/1.3 var(--m-font-display);list-style:none;display:flex;justify-content:space-between;gap:1rem}
.m-faq summary::after{content:'+';font-family:var(--m-font-mono);color:var(--m-accent)}
.m-faq details[open] summary::after{content:'–'}
.m-faq details p{margin:1rem 0 0;max-width:38rem;color:var(--m-muted)}
.m-qa{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem 4rem;margin:0}
.m-qa dt{font:var(--m-heading-weight) var(--m-step-1)/1.3 var(--m-font-display);margin-bottom:.5rem}.m-qa dd{margin:0;color:var(--m-muted)}

/* ---- cta / contact / forms ---- */
.m-cta-band{max-width:44rem}.m-cta-band .m-h{font-size:clamp(2rem,5vw,var(--m-step-4))}
.m-cta-inline{display:flex;gap:1.5rem 3rem;justify-content:space-between;align-items:center;border-block:var(--m-border-w) solid var(--m-fg);padding-block:2rem;flex-wrap:wrap}
.m-cta-inline .m-actions{margin:0}.m-cta-inline .m-h{margin:0}.m-cta-inline .m-sub{margin:.25rem 0 0}
.m-form{display:grid;gap:1.1rem;max-width:36rem}
.m-field{display:grid;gap:.4rem}.m-field label,.m-check{font-weight:600;font-size:var(--m-step-m1)}
.m-opt{font-weight:400;color:var(--m-muted)}
.m-field input,.m-field textarea,.m-field select{font:inherit;color:var(--m-fg);background:var(--m-bg);border:var(--m-border);border-radius:var(--m-radius);padding:.8rem .9rem;width:100%}
.m-tone-inverse .m-field input,.m-tone-inverse .m-field textarea,.m-tone-inverse .m-field select{background:transparent}
.m-more{border:1px dashed var(--m-line);padding:.9rem 1rem;border-radius:var(--m-radius)}.m-more summary{cursor:pointer;font-weight:600}.m-more .m-field{margin-top:1rem}
.m-form .m-btn{justify-self:start}
.m-contact-list{display:grid;gap:1rem;margin:0 0 2rem}.m-contact-list dt{font-family:var(--m-font-mono);font-size:var(--m-step-m1);color:var(--m-muted)}.m-contact-list dd{margin:0}

/* ---- misc ---- */
.m-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.m-gallery figure{margin:0}.m-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover}
.m-gallery figcaption{font-size:var(--m-step-m1);color:var(--m-muted);margin-top:.5rem}
.m-masonry{display:block;column-count:3;column-gap:1rem}.m-masonry figure{break-inside:avoid;margin-bottom:1rem}.m-masonry img{aspect-ratio:auto}
.m-team{display:grid;grid-template-columns:repeat(4,1fr);gap:2rem}.m-portrait{aspect-ratio:1;object-fit:cover;width:100%;margin-bottom:1rem}.m-team p{color:var(--m-muted);margin:0}
.m-ruled{list-style:none}.m-ruled li{display:flex;justify-content:space-between;gap:1rem;padding-block:1rem;border-top:1px solid var(--m-line)}.m-ruled span{color:var(--m-muted)}
${imageFx}
.m-raw{overflow-x:auto}

/* ---- footer ---- */
.m-footer{border-top:1px solid var(--m-line);padding-block:clamp(3rem,6vw,5rem) 2rem;background:var(--m-bg)}
.m-footer-grid{display:grid;grid-template-columns:minmax(0,2fr) repeat(auto-fit,minmax(9rem,1fr));gap:2.5rem}
.m-footer-brand p{color:var(--m-muted);max-width:22rem;margin:1rem 0}
.m-footer-h{font:600 var(--m-step-m1)/1 var(--m-font-mono);text-transform:uppercase;letter-spacing:.1em;color:var(--m-muted);margin:0 0 1rem}
.m-footer ul{list-style:none;display:grid;gap:.6rem}.m-footer a{text-decoration:none}.m-footer a:hover{text-decoration:underline}
.m-social{display:flex!important;gap:1rem;flex-wrap:wrap}
.m-legal{margin:3rem 0 0;color:var(--m-muted);font-size:var(--m-step-m1)}
.m-footer-line{display:flex;gap:1.5rem 3rem;flex-wrap:wrap;align-items:center;justify-content:space-between}
.m-footer-links{display:flex!important;gap:1.5rem;flex-wrap:wrap}

/* ---- motion ---- */
${motion === 'none' ? '*{animation:none!important;transition:none!important}' : `@media (prefers-reduced-motion:no-preference){.m-sec{animation:m-in .5s ease both}@keyframes m-in{from{opacity:.001;transform:translateY(${motion === 'subtle' ? 10 : 4}px)}to{opacity:1;transform:none}}}`}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}

/* ---- responsive ---- */
@media (max-width:980px){
  .m-split,.m-hero-split,.m-hero-editorial,.m-hero-proof,.m-row,.m-row-flip{grid-template-columns:1fr}
  .m-sticky{position:static}.m-row-flip .m-row-lead,.m-row-flip .m-row-body{order:0}
  .m-grid-3,.m-grid-4,.m-wall,.m-team,.m-gallery{grid-template-columns:repeat(2,1fr)}
  .m-bento{grid-template-columns:repeat(2,1fr)}.m-bento .m-tile{grid-column:span 1}.m-bento .m-tile-lead{grid-column:span 2}
  .m-steps-cols{grid-template-columns:repeat(2,1fr)}.m-qa{grid-template-columns:1fr}.m-masonry{column-count:2}
  .m-wall .m-quote:nth-child(n){margin-top:0}
}
@media (max-width:720px){
  .m-nav,.m-header>.m-container>.m-btn,.m-header-row>.m-btn{display:none}.m-menu{display:block}
  .m-header-split .m-header-row{justify-content:flex-end}
  .m-grid-2,.m-grid-3,.m-grid-4,.m-wall,.m-team,.m-gallery,.m-steps-cols{grid-template-columns:1fr}
  .m-bento{grid-template-columns:1fr}.m-bento .m-tile,.m-bento .m-tile-lead{grid-column:span 1}
  .m-stats{justify-content:flex-start}.m-masonry{column-count:1}
  .m-hero-row{align-items:flex-start}
}
`;
}
