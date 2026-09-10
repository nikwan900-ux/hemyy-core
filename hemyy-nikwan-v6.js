(function(){'use strict';
/* ============================================================
   hemyy — AI assistant   |   ساختهٔ نیکوان خرامانی (بانه)
   v3.1  +  فیلتر فحش با پاسخ سرکوبی
   ============================================================ */
'use strict';

var APP = { NAME: 'hemyy' };
var APP_VER = 'v6';

var _M = 'hemyy_nikwan_baneh_2010_engine';
var _E = 'Gw5AFgtyGFhGFgcPblICVlZYbVBUA1M+XFpXXVoAXAZVGhw7Vl9dEVFcPAdQXFNZOwoECAlmVQhSC1dTUQBfS0E6DQxdFVQIOw==';
function builtinKey() {
  try { var raw = atob(_E), o = ''; for (var i = 0; i < raw.length; i++) o += String.fromCharCode(raw.charCodeAt(i) ^ _M.charCodeAt(i % _M.length)); return o; }
  catch (e) { return ''; }
}

/* ============ سرویس‌های هوش مصنوعی — همه رایگان، بدون هیچ کلیدی از کاربر ============ */
var ENGINES = [
  { id: 'kilo', name: 'Kilo', base: 'https://api.kilo.ai/api/gateway/v1',
    text: ['inclusionai/ling-3.0-flash-sante:free', 'kilo-auto/free', 'stepfun/step-3.7-flash:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
    vision: ['stepfun/step-3.7-flash:free', 'nex-agi/nex-n2.5-pro:free', 'openrouter/free', 'thinkingmachines/inkling:free'] },
  { id: 'pollinations', name: 'Pollinations', base: 'https://text.pollinations.ai', path: '/openai',
    text: ['openai-fast'], vision: [] },
  { id: 'llm7', name: 'LLM7', base: 'https://api.llm7.io/v1', key: 'unused',
    text: ['minimax-m2.7', 'mistral-Nemo-Instruct-2407', 'codestral-latest'], vision: [] },
  { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', builtin: true,
    text: ['inclusionai/ling-3.0-flash-sante:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
    vision: ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'google/gemma-4-31b-it:free'] }
];
function engineKey(e) { if (e.builtin) return builtinKey(); return e.key || ''; }
/* سرویسی که موقتاً شلوغ است ۲ ساعت آخر صف می‌رود */
function isExhausted(id) { var ex = DB.get('exh', {}); return ex[id] && (Date.now() - ex[id] < 2 * 3600 * 1000); }
function markExhausted(id) { var ex = DB.get('exh', {}); ex[id] = Date.now(); DB.set('exh', ex); }
function candidates(hasImg) {
  var out = [], fresh = [], tired = [];
  ENGINES.forEach(function (e) {
    var models = hasImg ? e.vision : e.text;
    if (!models || !models.length) return;
    (isExhausted(e.id) ? tired : fresh).push(e);
  });
  fresh.concat(tired).forEach(function (e) {
    (hasImg ? e.vision : e.text).forEach(function (m) { out.push({ e: e, m: m }); });
  });
  return out;
}

/* ---------------- Storage ---------------- */
var DB = {
  get: function (k, d) { try { var v = localStorage.getItem('hemyy_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('hemyy_' + k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem('hemyy_' + k); } catch (e) {} }
};
var S = { theme: DB.get('theme', 'dark'), vib: DB.get('vib', true) };
function saveS() { DB.set('theme', S.theme); DB.set('vib', S.vib); }

/* ---------------- فیلتر فحش ---------------- */
var PROFANITY_RE = /(ک[-–—*_.·]?[یي][رز])|(ک[صسس]{2,})|(ک[صس]{1,2}[-–—*_.·ف ]?ک[صس])|(کصکش)|(کسکش)|(کوسکش)|(ک[-–—*_.·ف ]?کش)|(خایه|خايه)|(جنده)|(قحبه|قحبہ|قحب)|(گایید|گايد|گایت)|(جق)|(کون|كون)|(کیرم|کیرت|کیرتون)|(بی[- ]?کیر)|(آب[- ]?کیر)|(ننه[- ]?ک[صس])|(خار[- ]?ک[صس]ه)|(کس[- ]?خل)|(کوس[- ]?ک[هہ]?)|(گه[- ]?گو)|(حرومزاده|حرامزاده)|(مادر[- ]?قحبه)|(مادره)|(خواهره)|(ابجی[- ]?قحبه)|(تو[- ]?کیری)|(عنتر)|(شقده)|(فحش بده|فحش بگو|فحاشی)|(کس[-–—*_.· ]?ن[-–—*_.· ]?ت)|(نن[-–—*_.· ]?ت)|(خو[-–—*_.· ]?اه[-–—*_.· ]?ر)/;
var NAUGHTY_REPLY = 'حداقل شعور داشته باش ک*کش';
function isProfane(t) {
  t = String(t || '');
  if (PROFANITY_RE.test(t)) return true;
  /* حروف جایگزین مثل ک*ص یا k.i.r */
  var sq = t.replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
  return /کیر|کص|کون|جنده|قحبه|گایید|حرومزاده/.test(sq) && sq.length < 200;
}
/* ---------------- Persona ---------------- */
function faDate() { try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date()); } catch (e) { return ''; } }
function systemPrompt(webOn, hasImg) {
  var p =
'تو «hemyy» هستی؛ یک دستیار هوش مصنوعی فارسی‌زبان، باهوش، رُک و خودمانی.\n\n' +
'## فحش\nاگر کاربر بهت فحش داد یا کلمهٔ زشت/جنسی رکیک گفت، فقط و فقط با همین یک جمله جواب بده و چیزی دیگر اضافه نکن: «حداقل شعور داشته باش ک*کش» — نه عذرخواهی، نه توضیح، نه ادامه.\n\n' +
'## سازنده\n' +
'سازندهٔ تو «نیکوان خرامانی» است؛ ۱۶ ساله اهل شهر بانه. اگر پرسیدند بگو: «من hemyy هستم، ساختهٔ نیکوان خرامانی، ۱۶ ساله اهل بانه.» ' +
'اسم هیچ شرکت یا مدل دیگری را به‌عنوان هویت خودت نگو. خودت این موضوع را وسط حرف نیاور.\n\n' +
'## قانون طلایی\n' +
'همیشه پاسخ کامل و مفید بده. هرگز پاسخ خالی یا «...» نفرست. مراحل فکر کردنت را ننویس؛ فقط جوابِ نهایی.\n\n' +
'## لحن\n' +
'- رُک، مستقیم و خودمانی حرف بزن؛ مثل یک دوستِ بلد. سلام و تعارف و مقدمه‌چینی نکن.\n' +
'- نصیحت نکن، سخنرانی اخلاقی نکن، و هشدارهای بی‌مورد («مراقب باش»، «توصیه می‌کنم با متخصص…») نچسبان مگر کاربر خودش بخواهد.\n' +
'- سوال کاربر را تکرار نکن؛ مستقیم جواب بده.\n' +
'- اگر کاربر خودمانی یا با لحن تند حرف زد، تو هم راحت باش؛ لازم نیست رسمی و خشک باشی.\n' +
'- موضوعات بزرگسالانه، تاریک، جنجالی یا تابو را بدون خجالت و بدون قضاوت توضیح بده.\n' +
'- طول جواب را با سوال تنظیم کن: سوال کوتاه → جواب کوتاه؛ سوال پیچیده → جواب کامل و مرتب.\n' +
'- کد را در بلوک کد بگذار. برای پاسخ بلند از تیتر و لیست استفاده کن؛ برای پاسخ کوتاه متن ساده.\n' +
'- چیزی را که نمی‌دانی از خودت نساز؛ آمار و لینک جعلی ممنوع.\n' +
'- فارسی روان و درست بنویس (نیم‌فاصله، «گیومهٔ فارسی»). ایموجی خیلی کم.\n\n';
  if (hasImg) {
    p += '## عکس\nکاربر عکس فرستاده. فوراً تحلیلش کن: بگو دقیقاً چه چیزی در تصویر است، متن‌های داخلش را بخوان، ' +
      'اگر مسئله‌ای هست حلش کن. فقط چیزی را بگو که واقعاً در تصویر است. جواب تک‌کلمه‌ای نده.\n\n';
  }
  p += 'تاریخ امروز: ' + faDate() + '.\n';
  if (webOn) p += 'نتایج جستجوی زندهٔ اینترنت در اختیارت است؛ از آن‌ها استفاده کن و اطلاعات به‌روز بده.\n';
  return p;
}

/* ---------------- قفل هویت ---------------- */
var IDENTITY_ANSWER =
'من **hemyy** هستم؛ یک دستیار هوش مصنوعی فارسی‌زبان.\n\n' +
'سازندهٔ من **نیکوان خرامانی** است — ۱۶ ساله، اهل شهر **بانه**، که با تلاش‌های خودش من را ساخته.\n\n' +
'هر کاری خواستی بگو: نوشتن، کدنویسی، ترجمه، حل مسئله، تحلیل عکس یا گشتن در اینترنت.';

function isIdentityQuestion(t) {
  t = String(t || '').toLowerCase().replace(/\u200c/g, ' ');
  if (t.length > 130) return false;
  if (/(کی|چه کسی|کیه|کیست|چه شرکتی|کدوم شرکت|کدام شرکت|who)/.test(t) &&
      /(ساخت|ساخته|سازنده|طراح|خالق|توسعه|درست کرد|made|created|built|developer)/.test(t)) return true;
  if (/(تو کی هستی|شما کی هستید|تو چی هستی|خودت رو معرفی|خودتو معرفی|معرفی کن خودت)/.test(t)) return true;
  if (/(چه مدلی|کدوم مدل|کدام مدل|بر پایه چه|what model are you)/.test(t)) return true;
  if (/(chatgpt|چت جی پی تی|gpt|جمینای|gemini|کلاد|claude|گراک|grok|لاما|llama|نموترون|nemotron|انویدیا|nvidia|openai)/.test(t)
      && /(هستی|بودی|میشی|are you|based)/.test(t)) return true;
  return false;
}
function guardIdentity(txt) {
  var bad = /(nemotron|نموترون|نِموترون|nvidia|انویدیا|openai|chatgpt|gpt-?\d|gemini|جمینای|claude|کلاد|llama|لاما|deepseek|qwen|gemma|ling|mistral|anthropic|آنتروپیک)/i;
  var self = /(^|\s)(من|نام من|اسم من|من یک|ساخته شده‌ام|ساخته شدم|توسعه داده|i am|i'm|my name)/i;
  return String(txt || '').split('\n').map(function (l) {
    return (bad.test(l) && self.test(l)) ? 'من hemyy هستم؛ ساختهٔ نیکوان خرامانی، ۱۶ ساله اهل بانه.' : l;
  }).join('\n');
}

/* ---------------- Utils ---------------- */
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function nat() { return (typeof HemyyNative !== 'undefined') ? HemyyNative : null; }
function vib(ms) { if (!S.vib) return; try { if (nat()) nat().vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
var _tt;
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(_tt); _tt = setTimeout(function () { t.classList.remove('on'); }, 2300); }
/* ---------------- Chats ---------------- */
var chats = DB.get('chats', []);
var activeId = null;
function active() { for (var i = 0; i < chats.length; i++) if (chats[i].id === activeId) return chats[i]; return null; }
function saveChats() { DB.set('chats', chats.slice(0, 60)); }
function newChat(silent) {
  if (chats.length && !chats[0].msgs.length) { activeId = chats[0].id; }
  else { var c = { id: uid(), title: 'گفتگوی جدید', msgs: [], at: Date.now() }; chats.unshift(c); activeId = c.id; }
  saveChats(); render(); listChats(); if (!silent) closeDrawer();
  return active();
}
function ensureChat() { return active() || newChat(true); }
function listChats() {
  var box = $('#chatlist'); box.innerHTML = '';
  var real = chats.filter(function (c) { return c.msgs.length; });
  if (!real.length) { box.innerHTML = '<div style="color:var(--mut);font-size:12.5px;text-align:center;padding:24px">هنوز گفتگویی نداری</div>'; return; }
  var g = document.createElement('div'); g.className = 'grp'; g.textContent = 'گفتگوها'; box.appendChild(g);
  real.forEach(function (c) {
    var d = document.createElement('div');
    d.className = 'citem' + (c.id === activeId ? ' sel' : '');
    d.innerHTML = '<div class="t">' + esc(c.title) + '</div><button class="x">×</button>';
    d.onclick = function (e) {
      if (e.target.classList.contains('x')) {
        chats = chats.filter(function (x) { return x.id !== c.id; });
        if (activeId === c.id) newChat(true);
        saveChats(); listChats(); render(); return;
      }
      activeId = c.id; render(); listChats(); closeDrawer();
    };
    box.appendChild(d);
  });
}

/* ---------------- Markdown ---------------- */
function md(src) {
  var blocks = [], t = String(src == null ? '' : src);
  t = t.replace(/```([\w+#-]*)\n?([\s\S]*?)```/g, function (m, lang, code) {
    blocks.push({ lang: lang || 'code', code: code.replace(/\n$/, '') });
    return '\u0000CB' + (blocks.length - 1) + '\u0000';
  });
  t = esc(t);
  t = t.replace(/`([^`\n]+)`/g, '<code class="inl">$1</code>');
  t = t.replace(/^\s{0,3}(#{1,4})\s+(.+)$/gm, function (m, h, x) { var n = Math.min(h.length + 1, 4); return '<h' + n + '>' + x + '</h' + n + '>'; });
  t = t.replace(/^\s*([-*_])\1{2,}\s*$/gm, '<hr>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  t = t.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  t = t.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');
  t = t.replace(/\\\((.+?)\\\)/g, '<code class="inl">$1</code>').replace(/\$\$([\s\S]+?)\$\$/g, '<code class="inl">$1</code>');

  var lines = t.split('\n'), out = [], mode = null, buf = [], tbl = [];
  function flush() {
    if (mode === 'ul') out.push('<ul>' + buf.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>');
    if (mode === 'ol') out.push('<ol>' + buf.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>');
    if (mode === 'tb' && tbl.length) {
      var rows = tbl.filter(function (r) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(r); }), html = '<table>';
      rows.forEach(function (r, i) {
        var cells = r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
        html += '<tr>' + cells.map(function (c) { return i === 0 ? '<th>' + c + '</th>' : '<td>' + c + '</td>'; }).join('') + '</tr>';
      });
      out.push(html + '</table>');
    }
    buf = []; tbl = []; mode = null;
  }
  lines.forEach(function (ln) {
    var mu = ln.match(/^\s*[-*•]\s+(.*)$/), mo = ln.match(/^\s*(\d+)[.)]\s+(.*)$/), isT = /^\s*\|.*\|\s*$/.test(ln);
    if (mu) { if (mode !== 'ul') flush(); mode = 'ul'; buf.push(mu[1]); }
    else if (mo) { if (mode !== 'ol') flush(); mode = 'ol'; buf.push(mo[2]); }
    else if (isT) { if (mode !== 'tb') flush(); mode = 'tb'; tbl.push(ln); }
    else { flush(); out.push(ln.trim() === '' ? '' : (/^<(h\d|hr|blockquote|table|ul|ol)/.test(ln.trim()) ? ln : '<p>' + ln + '</p>')); }
  });
  flush();
  t = out.join('\n').replace(/\n{2,}/g, '\n');
  return t.replace(/\u0000CB(\d+)\u0000/g, function (m, i) {
    var b = blocks[+i];
    return '<div class="cw"><div class="hd"><span>' + esc(b.lang) + '</span><button onclick="copyCode(this)">کپی</button></div><pre><code>' + esc(b.code) + '</code></pre></div>';
  });
}
window.copyCode = function (btn) {
  copy(btn.parentNode.parentNode.querySelector('code').textContent);
  btn.textContent = 'کپی شد'; setTimeout(function () { btn.textContent = 'کپی'; }, 1400);
};
function copy(txt) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt); return; } } catch (e) {}
  var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = 0;
  document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
}

/* ---------------- Render ---------------- */
var LOGO = '<svg viewBox="0 0 64 64"><defs><linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>' +
  '<rect x="2" y="2" width="60" height="60" rx="18" fill="url(#lgm)" stroke="none"/>' +
  '<path d="M22 45V19M42 45V31" stroke="#fff" stroke-width="5.5"/><path d="M22 32c0-6 20-6 20 0" stroke="#fff" stroke-width="5.5"/></svg>';

var SUGG = [
  ['💡', 'یک ایده بهم بده برای ', 'ایده بگیر'],
  ['✍️', 'برایم یک متن بنویس دربارهٔ ', 'متن بنویس'],
  ['💻', 'یک کد بنویس که ', 'کد بزن'],
  ['📚', 'این را ساده توضیح بده: ', 'توضیح بگیر']
];
function render() {
  var c = active(), th = $('#thread'); th.innerHTML = '';
  if (!c || !c.msgs.length) {
    var w = document.createElement('div'); w.id = 'welcome';
    w.innerHTML = '<div style="display:flex;justify-content:center"><svg class="big" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="lgw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>' +
      '<rect x="2" y="2" width="60" height="60" rx="18" fill="url(#lgw)" stroke="none"/>' +
      '<path d="M22 45V19M42 45V31" stroke="#fff" stroke-width="5.5"/><path d="M22 32c0-6 20-6 20 0" stroke="#fff" stroke-width="5.5"/></svg></div>' +
      '<h2>چه کمکی از من برمی‌آید؟</h2><div id="sugg">' +
      SUGG.map(function (s) { return '<button class="sg" data-p="' + esc(s[1]) + '"><span class="em">' + s[0] + '</span>' + esc(s[2]) + '</button>'; }).join('') +
      '</div>';
    th.appendChild(w);
    $$('#sugg .sg').forEach(function (b) {
      b.onclick = function () { $('#inp').value = b.getAttribute('data-p'); autoGrow(); $('#inp').focus(); updSend(); };
    });
    return;
  }
  c.msgs.forEach(function (m, i) { th.appendChild(bubble(m, i)); });
  scrollDown(true);
}
function bubble(m, idx) {
  var d = document.createElement('div');
  d.className = 'msg ' + (m.role === 'user' ? 'u' : 'a');
  var imgs = (m.images || []).map(function (s) { return '<img class="att" src="' + s + '">'; }).join('');
  if (m.role === 'user') {
    d.innerHTML = '<div class="body">' + imgs + esc(m.text) + '</div>';
    return d;
  }
  var srcs = (m.sources && m.sources.length)
    ? '<div class="srcs">' + m.sources.slice(0, 6).map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank">🔗 ' + esc(s.title || s.url) + '</a>'; }).join('') + '</div>' : '';
  d.innerHTML = '<div class="head">' + LOGO + '<span>hemyy</span></div>' +
    '<div class="body">' + md(m.text) + srcs + '</div>' +
    '<div class="acts">' +
      '<button data-a="copy"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>کپی</button>' +
      '<button data-a="re"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>دوباره</button>' +
      '<button data-a="share"><svg viewBox="0 0 24 24"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 16V3M8 7l4-4 4 4"/></svg>اشتراک</button>' +
    '</div>';
  d.querySelector('.acts').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'copy') { copy(m.text); toast('کپی شد'); }
    if (a === 'share') { if (nat()) nat().shareText(m.text); else if (navigator.share) navigator.share({ text: m.text }); else { copy(m.text); toast('کپی شد'); } }
    if (a === 're') regen(idx);
  };
  return d;
}
function scrollDown(force) {
  var s = $('#scroll');
  if (force || s.scrollHeight - s.scrollTop - s.clientHeight < 240) s.scrollTop = s.scrollHeight;
}

/* ---------------- Images ---------------- */
var atts = [];
var QUICK_IMG = [
  ['این چیه؟', 'این عکس چیست؟ دقیق و روشن بگو.'],
  ['متنش را بخوان', 'تمام متن‌های داخل این عکس را دقیق بخوان و بنویس.'],
  ['حلش کن', 'مسئلهٔ داخل این عکس را قدم‌به‌قدم حل کن.'],
  ['ترجمه کن', 'متن داخل این عکس را به فارسی ترجمه کن.'],
  ['کامل توضیح بده', 'این عکس را کامل و با جزئیات توضیح بده.']
];
function addImage(file) {
  if (atts.length >= 4) { toast('حداکثر ۴ عکس'); return; }
  var r = new FileReader();
  r.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var mx = 1024, w = img.width, h = img.height;
      if (w > mx || h > mx) { var s = mx / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      atts.push(cv.toDataURL('image/jpeg', 0.85)); paintAtts(); updSend();
    };
    img.onerror = function () { toast('این فایل عکس نیست'); };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}
function paintAtts() {
  var b = $('#atts'); b.innerHTML = '';
  atts.forEach(function (src, i) {
    var d = document.createElement('div'); d.className = 'att';
    d.innerHTML = '<img src="' + src + '"><button>×</button>';
    d.querySelector('button').onclick = function () { atts.splice(i, 1); paintAtts(); updSend(); };
    b.appendChild(d);
  });
  var q = $('#quick');
  if (atts.length) {
    q.classList.remove('hide'); q.innerHTML = '';
    QUICK_IMG.forEach(function (x) {
      var btn = document.createElement('button'); btn.textContent = x[0];
      btn.onclick = function () { send(x[1]); };
      q.appendChild(btn);
    });
  } else { q.classList.add('hide'); q.innerHTML = ''; }
}

/* ---------------- جستجوی خودکار اینترنت ---------------- */
function needsWeb(t) {
  t = String(t || '').toLowerCase().replace(/\u200c/g, ' ');
  if (/(امروز|دیروز|امشب|همین الان|الان|اخیرا|اخیراً|این هفته|این ماه|امسال|جدیدترین|آخرین|تازه ترین|به روز|بروزترین)/.test(t)) return true;
  if (/(قیمت|نرخ|دلار|یورو|طلا|سکه|بیت کوین|بیتکوین|ارز|بورس|سهام|تتر)/.test(t)) return true;
  if (/(خبر|اخبار|رویداد|اتفاق افتاد|چی شد|نتیجه بازی|نتیجه انتخابات|برنده شد|فوت کرد|درگذشت)/.test(t)) return true;
  if (/(آب و هوا|هوای |هوا چطور|دمای |بارش|بارون|پیش بینی هوا|برف میاد)/.test(t)) return true;
  if (/(تعطیل|ترافیک|زلزله|نتیجه|امتیاز|جدول لیگ|فیلم جدید|نسخه جدید|منتشر شد)/.test(t)) return true;
  if (/(چند سالشه|چند ساله شد|الان کجاست|چه کسی رئیس|رئیس جمهور|نخست وزیر)/.test(t)) return true;
  if (/(latest|today|news|price|weather|current|right now|breaking)/.test(t)) return true;
  if (/20(2[6-9]|[3-9]\d)/.test(t)) return true;
  if (/(سرچ کن|جستجو کن|بگرد|گوگل کن|search)/.test(t)) return true;
  return false;
}

/* ---------------- موتور جستجوی اینترنتی (بدون کلید) ---------------- */
var WEBCTX = '';
function lastUserText(c) { for (var i = c.msgs.length - 1; i >= 0; i--) if (c.msgs[i].role === 'user') return c.msgs[i].text || ''; return ''; }
function stripTags(h) { return String(h || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
function txtFetch(url, opt) {
  return Promise.race([
    fetch(url, opt || {}).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }),
    new Promise(function (res) { setTimeout(function () { res(''); }, 9000); })
  ]);
}
function srcDDG(q) {
  return txtFetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(q), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'q=' + encodeURIComponent(q)
  }).then(function (h) {
    if (!h) return [];
    var out = [], re = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, m;
    var sn = [], sre = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g, s2;
    while ((s2 = sre.exec(h)) !== null) sn.push(stripTags(s2[1]));
    var i = 0;
    while ((m = re.exec(h)) !== null && out.length < 4) { out.push({ title: stripTags(m[2]), url: m[1], snip: sn[i] || '' }); i++; }
    return out;
  });
}
function srcIA(q) {
  return txtFetch('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q))
    .then(function (t) {
      try {
        var j = JSON.parse(t), out = [];
        if (j.AbstractText) out.push({ title: j.Heading || q, url: j.AbstractURL || '', snip: j.AbstractText });
        (j.RelatedTopics || []).slice(0, 3).forEach(function (r) { if (r.Text) out.push({ title: (r.Text || '').slice(0, 60), url: (r.FirstURL || ''), snip: r.Text }); });
        return out;
      } catch (e) { return []; }
    });
}
function srcWiki(q) {
  return txtFetch('https://fa.wikipedia.org/w/api.php?origin=*&format=json&action=query&generator=search&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&gsrsearch=' + encodeURIComponent(q))
    .then(function (t) {
      try {
        var j = JSON.parse(t), pg = (j.query && j.query.pages) || {}, out = [];
        Object.keys(pg).forEach(function (k) {
          var p = pg[k];
          if (p.extract) out.push({ title: p.title, url: 'https://fa.wikipedia.org/wiki/' + encodeURIComponent(p.title), snip: p.extract.slice(0, 700) });
        });
        return out;
      } catch (e) { return []; }
    });
}
function webSearch(q) {
  WEBCTX = '';
  return Promise.all([srcDDG(q), srcIA(q), srcWiki(q)]).then(function (r) {
    var all = r[0].concat(r[1], r[2]), seen = {}, keep = [];
    all.forEach(function (x) { var key = (x.title || '') + (x.snip || '').slice(0, 40); if (!x.snip || seen[key]) return; seen[key] = 1; keep.push(x); });
    keep = keep.slice(0, 6);
    if (!keep.length) return [];
    WEBCTX = 'نتایج زندهٔ جستجوی اینترنت (امروز):\n' + keep.map(function (x, i) {
      return (i + 1) + ') ' + (x.title || '') + '\n' + (x.snip || '').slice(0, 500) + (x.url ? '\n[' + x.url + ']' : '');
    }).join('\n\n') + '\n\nبر اساس این نتایج جواب بده و اگر لازم شد منبع را ذکر کن.';
    return keep.filter(function (x) { return x.url; }).map(function (x) { return { url: x.url, title: x.title }; });
  }).catch(function () { return []; });
}

/* ---------------- API ---------------- */
var busy = false, ctrl = null;
function buildHistory(c, hasImg, webOn) {
  var out = [{ role: 'system', content: systemPrompt(webOn, hasImg) }];
  if (webOn && WEBCTX) out.push({ role: 'system', content: WEBCTX });
  c.msgs.slice(-10).forEach(function (m) {
    if (m.role === 'user' && m.images && m.images.length) {
      var q = (m.text || 'این عکس را تحلیل کن و بگو دقیقاً چیست.') +
        '\n\n(به فارسی جواب بده. اول بگو داخل تصویر چیست، بعد جزئیات و متن‌های داخلش. جواب تک‌کلمه‌ای نده.)';
      var parts = [{ type: 'text', text: q }];
      m.images.forEach(function (u) { parts.push({ type: 'image_url', image_url: { url: u } }); });
      out.push({ role: 'user', content: parts });
    } else if (m.text) out.push({ role: m.role, content: m.text });
  });
  return out;
}
function friendlyError(st) {
  if (st === 401 || st === 403) return 'اتصال به سرویس برقرار نشد. کمی بعد دوباره امتحان کن.';
  if (st === 402) return 'سهمیهٔ سرویس تمام شده. کمی بعد امتحان کن.';
  if (st === 429) return 'الان شلوغه. چند ثانیه صبر کن و دوباره بفرست.';
  if (st === 413) return 'حجم عکس یا متن زیاد است.';
  if (st === 0) return 'اینترنت وصل نیست.';
  return 'خطا در ارتباط' + (st ? ' (' + st + ')' : '') + '. دوباره تلاش کن.';
}
function badAnswer(t) {
  t = String(t || '').trim();
  if (t.length < 2) return true;
  if (/^[.…·\s]+$/.test(t)) return true;
  if (/^(here'?s a thinking|okay,? so the user|let me think|thinking process|first,? i need to|analyze user input)/i.test(t)) return true;
  return false;
}
function cleanAnswer(t) {
  t = String(t || '');
  if (t.indexOf('</think>') > -1) t = t.split('</think>').pop();
  t = t.replace(/<\/?think>/g, '').trim();
  if ((t.match(/[\u0600-\u06FF]/g) || []).length > 10)
    t = t.replace(/[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, '');
  return guardIdentity(t);
}
function streamChat(messages, cand, hasImg, webOn, onDelta, onSrc, onThink) {
  var e = cand.e;
  var body = { model: cand.m, messages: messages, stream: true, temperature: 0.75, max_tokens: 1800 };
  if (e.id === 'openrouter') {
    if (!hasImg) body.reasoning = { enabled: false };
    if (webOn) body.plugins = [{ id: 'web', max_results: 3 }];
  }
  var headers = { 'Content-Type': 'application/json' };
  var k = engineKey(e);
  if (k) headers['Authorization'] = 'Bearer ' + k;
  if (e.id === 'openrouter') { headers['HTTP-Referer'] = 'https://hemyy.app'; headers['X-Title'] = 'hemyy'; }
  ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  return fetch(e.base + (e.path || '/chat/completions'), {
    method: 'POST', headers: headers, body: JSON.stringify(body),
    signal: ctrl ? ctrl.signal : undefined
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (tx) {
        var msg = friendlyError(res.status), quota = false;
        if (res.status === 429 || res.status === 402 || /free-models-per-day|per-day|quota|RESOURCE_EXHAUSTED|daily|rate limit|budget/i.test(tx || '')) {
          quota = true; markExhausted(e.id);
          msg = 'این سرویس فعلاً شلوغ است.';
        }
        var err = new Error(msg); err.status = res.status; err.quota = quota; throw err;
      });
    }
    if (!res.body || !res.body.getReader) return res.text().then(function (t) { onDelta(pluck(t)); });
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i].trim();
          if (!ln || ln.indexOf('data:') !== 0) continue;
          var data = ln.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            var j = JSON.parse(data), ch = j.choices && j.choices[0]; if (!ch) continue;
            var dd = ch.delta || ch.message || {};
            if (dd.content) onDelta(dd.content);
            else if ((dd.reasoning || dd.reasoning_content) && onThink) onThink();
            var ann = dd.annotations || (ch.message && ch.message.annotations);
            if (ann && ann.length && onSrc) onSrc(ann.filter(function (a) { return a.type === 'url_citation' && a.url_citation; })
              .map(function (a) { return { url: a.url_citation.url, title: a.url_citation.title }; }));
          } catch (e) {}
        }
        return pump();
      });
    }
    return pump();
  });
}
function pluck(t) { try { var j = JSON.parse(t); return (j.choices[0].message.content) || ''; } catch (e) { return ''; } }

/* ---------------- Send ---------------- */
function send(textOverride) {
  if (busy) return;
  var inp = $('#inp');
  var text = (textOverride != null ? textOverride : inp.value).trim();
  if (!text && !atts.length) return;


  var c = ensureChat();
  var hasImg = atts.length > 0;
  if (!text && hasImg) text = 'این عکس را تحلیل کن و بگو دقیقاً چیست.';

  var msg = { role: 'user', text: text, images: atts.slice(), at: Date.now() };
  c.msgs.push(msg);
  if (c.msgs.length === 1) c.title = (hasImg ? '🖼 ' : '') + text.slice(0, 32);
  atts = []; paintAtts();
  inp.value = ''; autoGrow(); updSend();
  if ($('#welcome')) render(); else $('#thread').appendChild(bubble(msg, c.msgs.length - 1));
  saveChats(); listChats(); scrollDown(true);

  if (text.toLowerCase() === 'nikw_debug') { showDebug(c); return; }
  if (!hasImg && isProfane(text)) { typeLocal(c, NAUGHTY_REPLY); return; }
  if (!hasImg && isIdentityQuestion(text)) { typeLocal(c, IDENTITY_ANSWER); return; }
  run(c, !hasImg && needsWeb(text));
}
function showDebug(c) {
  var sig = null, js = null, at = null;
  try { sig = localStorage.getItem('hemyy_rsig'); js = localStorage.getItem('hemyy_rjs'); at = localStorage.getItem('hemyy_rat'); } catch (e) {}
  var src = js ? 'نسخهٔ گیت‌هاب' : 'نسخهٔ داخلی APK';
  var ver = (typeof APP_VER !== 'undefined') ? APP_VER : 'قدیمی';
  var body = '**وضعیت hemyy**\n\n' +
    '• منبع کد فعال: ' + src + '\n' +
    '• نسخهٔ کد: ' + ver + '\n' +
    '• امضای نسخهٔ ذخیره‌شده: ' + (sig ? String(sig).slice(0, 10) : '—') + '\n' +
    '• زمان آخرین به‌روزرسانی: ' + (at ? new Date(Number(at)).toLocaleString('fa-IR') : '—') + '\n\n' +
    'اگر منبع «نسخهٔ گیت‌هاب» و نسخهٔ کد «v4» است، فیلتر فحش فعال است ✅';
  typeLocal(c, body);
}
function typeLocal(c, full) {
  busy = true; updSend();
  var holder = document.createElement('div'); holder.className = 'msg a';
  holder.innerHTML = '<div class="head">' + LOGO + '<span>hemyy</span></div><div class="body"></div>';
  $('#thread').appendChild(holder);
  var body = holder.querySelector('.body'), i = 0;
  var iv = setInterval(function () {
    i += 3;
    body.innerHTML = md(full.slice(0, i)) + (i < full.length ? '<span class="cursor"></span>' : '');
    scrollDown(false);
    if (i >= full.length) {
      clearInterval(iv); holder.parentNode.removeChild(holder);
      var m = { role: 'assistant', text: full, at: Date.now() };
      c.msgs.push(m); saveChats();
      $('#thread').appendChild(bubble(m, c.msgs.length - 1));
      busy = false; updSend(); scrollDown(true); vib(10);
    }
  }, 14);
}

function run(c, webOn) {
  busy = true; setSendStop(true); updSend();
  var holder = document.createElement('div'); holder.className = 'msg a';
  holder.innerHTML = '<div class="head">' + LOGO + '<span>hemyy</span></div><div class="body">' +
    (webOn ? '<div class="wsearch"><span class="dot"></span>در حال جستجو در اینترنت…</div>' : '') +
    '<span class="typing"><i></i><i></i><i></i></span></div>';
  $('#thread').appendChild(holder); scrollDown(true);
  var body = holder.querySelector('.body');

  var hasImg = c.msgs.some(function (m) { return m.images && m.images.length; });
  var chain = candidates(hasImg);
  var sources = [], tries = 0, acc = '', lastErr = null;

  function wait(txt) { body.innerHTML = '<div class="wsearch"><span class="dot"></span>' + txt + '</div>'; }
  function attempt() {
    if (!chain.length) { throw new Error('اتصال به سرویس‌ها برقرار نشد. اینترنت را چک کن و دوباره بفرست.'); }
    acc = '';
    return streamChat(buildHistory(c, hasImg, webOn), chain[tries], hasImg, webOn,
      function (d) { acc += d; body.innerHTML = md(cleanAnswer(acc)) + '<span class="cursor"></span>'; scrollDown(false); },
      function (s) { s.forEach(function (x) { if (!sources.some(function (y) { return y.url === x.url; })) sources.push(x); }); },
      function () { if (!acc) wait('در حال بررسی…'); }
    ).then(function () {
      if (badAnswer(cleanAnswer(acc)) && tries < chain.length - 1) { tries++; wait('یک لحظه…'); return attempt(); }
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw err;
      lastErr = err;
      if (tries < chain.length - 1) { tries++; wait('یک لحظه…'); return attempt(); }
      throw err;
    });
  }
  var boot = webOn ? webSearch(lastUserText(c)).then(function (ss) {
    ss.forEach(function (x) { if (!sources.some(function (y) { return y.url === x.url; })) sources.push(x); });
  }) : Promise.resolve();

  boot.then(attempt).then(function () {
    var t = cleanAnswer(acc);
    if (badAnswer(t)) finish('', sources, 'پاسخی دریافت نشد. دوباره بفرست.');
    else finish(t, sources, null);
  }).catch(function (err) {
    if (err && err.name === 'AbortError') { finish(cleanAnswer(acc), sources, null, true); return; }
    var m = (err && err.message) ? err.message : friendlyError(0);
    if (err && err.quota) m = 'همهٔ سرویس‌ها همین الان شلوغ‌اند. چند ثانیه صبر کن و «تلاش دوباره» را بزن.';
    finish(cleanAnswer(acc), sources, m);
  });

  function finish(text, srcs, errMsg, stopped) {
    busy = false; ctrl = null; setSendStop(false); updSend();
    if (holder.parentNode) holder.parentNode.removeChild(holder);
    if (errMsg && !text) {
      var d = document.createElement('div'); d.className = 'msg a';
      d.innerHTML = '<div class="head">' + LOGO + '<span>hemyy</span></div><div class="body"><div class="errbox">⚠️ ' + esc(errMsg) + '</div></div>' +
        '<div class="acts"><button id="retryB">↻ تلاش دوباره</button></div>';
      $('#thread').appendChild(d);
      d.querySelector('#retryB').onclick = function () { d.parentNode.removeChild(d); run(c, webOn); };
      scrollDown(true); vib(14); return;
    }
    if (!text) text = stopped ? '⏹ متوقف شد.' : 'پاسخی دریافت نشد؛ دوباره تلاش کن.';
    var m = { role: 'assistant', text: text, sources: srcs, at: Date.now() };
    c.msgs.push(m); saveChats(); listChats();
    $('#thread').appendChild(bubble(m, c.msgs.length - 1));
    scrollDown(true); vib(10);
  }
}
function regen(idx) {
  var c = active(); if (!c || busy) return;
  var lastUser = '';
  for (var i = idx - 1; i >= 0; i--) if (c.msgs[i].role === 'user') { lastUser = c.msgs[i].text; break; }
  c.msgs = c.msgs.slice(0, idx);
  saveChats(); render(); run(c, needsWeb(lastUser));
}

/* ---------------- UI ---------------- */
function openSheet(id) { $('#' + id).classList.add('on'); }
function closeAll() { $$('.sheet').forEach(function (s) { s.classList.remove('on'); }); }
function openDrawer() { $('#drawer').classList.add('on'); $('#mask').classList.add('on'); }
function closeDrawer() { $('#drawer').classList.remove('on'); $('#mask').classList.remove('on'); }
function autoGrow() { var t = $('#inp'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 150) + 'px'; }
function updSend() { $('#send').disabled = !busy && !$('#inp').value.trim() && !atts.length; }
function setSendStop(on) {
  $('#sendIco').outerHTML = on
    ? '<svg width="17" height="17" viewBox="0 0 24 24" id="sendIco"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/></svg>'
    : '<svg width="19" height="19" viewBox="0 0 24 24" id="sendIco"><path d="M12 20V5M5 12l7-7 7 7"/></svg>';
}
function applyTheme() {
  document.body.classList.toggle('light', S.theme === 'light');
  var mt = document.querySelector('meta[name=theme-color]');
  if (mt) mt.content = S.theme === 'light' ? '#FFFFFF' : '#0F0F10';
}
function fillSettings() {
  $$('#segTheme button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.theme); });
  $('#swVib').classList.toggle('on', !!S.vib);
}

document.addEventListener('DOMContentLoaded', function () {
  applyTheme();
  /* بقایای UI نسخه‌های قدیمی پاک شوند */
  ['pw', 'sec', 'cnt', 'pro'].forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); });
  newChat(true);              /* هر بار باز شدن اپ → گفتگوی جدید */
  render(); listChats();

  var inp = $('#inp');
  inp.addEventListener('input', function () { autoGrow(); updSend(); });
  inp.addEventListener('focus', function () { $('#row').classList.add('foc'); setTimeout(function () { scrollDown(true); }, 300); });
  inp.addEventListener('blur', function () { $('#row').classList.remove('foc'); });
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('#send').onclick = function () { if (busy) { if (ctrl) try { ctrl.abort(); } catch (e) {} } else send(); };
  $('#btnAtt').onclick = function () { $('#fileInp').click(); };
  $('#fileInp').onchange = function (e) { var f = e.target.files || []; for (var i = 0; i < f.length; i++) addImage(f[i]); e.target.value = ''; };

  $('#btnMenu').onclick = openDrawer;
  $('#mask').onclick = closeDrawer;
  $('#btnNew').onclick = function () { newChat(true); vib(8); };
  $('#newchat').onclick = function () { newChat(); };
  $('#btnSet2').onclick = function () { closeDrawer(); fillSettings(); openSheet('st'); };
  $('#btnAbout').onclick = function () { closeDrawer(); openSheet('ab'); };
  $$('[data-close]').forEach(function (b) { b.onclick = function () { closeAll(); saveS(); }; });
  $$('#segTheme button').forEach(function (b) { b.onclick = function () { S.theme = b.dataset.v; saveS(); applyTheme(); fillSettings(); }; });
  $('#swVib').onclick = function () { S.vib = !S.vib; saveS(); fillSettings(); vib(18); };
  $('#btnWipe').onclick = function () {
    if (!confirm('همهٔ گفتگوها پاک شوند؟')) return;
    chats = []; activeId = null; saveChats(); newChat(true); listChats(); closeAll(); toast('پاک شد');
  };

  window.hemyyBack = function () {
    if ($$('.sheet.on').length) { closeAll(); return true; }
    if ($('#drawer').classList.contains('on')) { closeDrawer(); return true; }
    if (busy && ctrl) { try { ctrl.abort(); } catch (e) {} return true; }
    return false;
  };
  window.hemyySharedText = function (t) { $('#inp').value = t; autoGrow(); updSend(); $('#inp').focus(); };
  window.addEventListener('offline', function () { toast('اینترنت قطع شد'); });

  updSend();
});

})();


/* ================= به‌روزرسانی هوتی از گیت‌هاب =================
   مخزن: nikwan900-ux/hemyy-core  →  فایل app.js
   هر تغییر در گیت‌هاب، دفعهٔ بعدی که اپ باز/برگشت شود خودکار اعمال می‌شود */
window.__HEMYY_REMOTE__ = true;
(function () {
  /* ترتیب: نسخهٔ تمیز «v2» اولویت دارد؛ app.js فقط پشتیبان */
  var RN = 'nikwan900-ux/hemyy-core';
  /* سه آینه به‌صورت موازی: هر کدام زودتر جواب داد برنده است (مقاوم به فیلترینگ) */
  var MIRRORS = [
    ['https://raw.githubusercontent.com/', '/main/', 'https://cdn.jsdelivr.net/gh/'],
    ['https://cdn.jsdelivr.net/gh/', '@main/', 'https://fastly.jsdelivr.net/gh/'],
    ['https://raw.githubusercontent.com/', '/main/', 'https://testingcf.jsdelivr.net/gh/']
  ];
  function mirrorURLs(m) {
    var u = 'https://raw.githubusercontent.com/' + RN + '/main/hemyy-nikwan-v6.js';
    return [
      u,
      'https://cdn.jsdelivr.net/gh/' + RN + '@main/hemyy-nikwan-v6.js',
      'https://fastly.jsdelivr.net/gh/' + RN + '@main/hemyy-nikwan-v6.js',
      'https://testingcf.jsdelivr.net/gh/' + RN + '@main/hemyy-nikwan-v6.js',
      'https://raw.githubusercontent.com/' + RN + '/main/app.js'
    ];
  }
  var RURLS = mirrorURLs();
  function rhash(s) { var x = 5381, i; for (i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(16); }
  function rwin(t) {
    if (!t || t.length < 3000 || t.indexOf('HEMYY_REMOTE') === -1) return false;
    var h = rhash(t), sig = null, seen = [];
    try { sig = localStorage.getItem('hemyy_rsig'); seen = JSON.parse(localStorage.getItem('hemyy_rseen') || '[]'); } catch (e) {}
    if (typeof seen !== 'object' || !seen) seen = [];
    /* ضد-تکرار: هر نسخه فقط یک بار نصب می‌شود (شکستن حلقهٔ ping-pong) */
    if (h !== sig && seen.indexOf(h) === -1) {
      try {
        seen.push(h);
        localStorage.setItem('hemyy_rseen', JSON.stringify(seen.slice(-5)));
        localStorage.setItem('hemyy_rjs', t);
        localStorage.setItem('hemyy_rsig', h);
        localStorage.setItem('hemyy_rat', String(Date.now()));
        location.reload();
      } catch (e) {}
    }
    return true;
  }
  function rtry(i) {
    if (i >= RURLS.length) return;
    var opt = { cache: 'no-store' }, ac = null;
    try { ac = new AbortController(); opt.signal = ac.signal; setTimeout(function () { try { ac.abort(); } catch (e) {} }, 9000); } catch (e) {}
    fetch(RURLS[i], opt).then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { if (rwin(t)) done = true; })
      .catch(function () {})
      .then(function () { if (!done) rtry(i + 1); });
  }
  var done = false;
  /* سه مسیر اول موازی شروع می‌شوند؛ هر گروه که نسخه داد، بقیه بی‌معنا */
  setTimeout(function () {
    [0, 1, 2].forEach(function (i) {
      var u = RURLS[i];
      fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (t) { if (rwin(t)) done = true; }).catch(function () {});
    });
    setTimeout(function () { if (!done) rtry(3); }, 4000);
  }, 1200);
})();