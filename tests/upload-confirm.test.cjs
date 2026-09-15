// ══════════════════════════════════════════════════════════════
// نافذة تأكيد الرفع — node tests/upload-confirm.test.cjs
//
// البنود اللي بيقفلها الملف ده — كلها **مش** هتظهر كخطأ لو اتكسرت:
//   ① 🔴 **نافذة واحدة للزرارين.** «رفع الكل» و«رفع المحدد» بيعملوا نفس
//      الحاجة بالظبط — شحنات بفلوس حقيقية. لو زرار منهم رجع ينادي
//      `startUpload()` على طول، الرفع بيتنفّذ من غير أي وقفة مراجعة
//      والشاشة ماتقولش حاجة.
//   ② 🔴 **مجموع المربعات = الإجمالي دايمًا.** المربعات بتتبني من
//      `ADDR_MODE_ITEMS`، وأي حالة برّه القايمة بتتعرض بمفتاحها الخام في
//      الآخر. من غير الذيل ده الإجمالي بيبقى أكبر من المجموع في صمت — نفس
//      فخ `RESULT_STATS` بالظبط.
//   ③ 🔴 **أرقام المربعات = الصفوف اللي هتترفع فعلًا**، مش المعروض ولا
//      المحدد الخام. رقم أكبر من اللي هيتنفّذ بيخلي الموظف يأكّد دفعة
//      وهو فاكر إنها أكبر، ورقم أقل بيخفي شحنات بفلوس.
//   ④ 🔴 **نوع الشحنة لازم يفضل على الشاشة.** الجسم بقى أرقام بس، والأداة
//      تلات أوضاع — من غير النوع الموظف يأكّد «استرجاع» وهو فاكر «شحن».
//   ⑤ زرار «إلغاء» أحمر وزرار التأكيد أسبق منه في الـ DOM (ترتيب القراءة
//      في RTL)، والنص القديم اتشال من الجسم.
//   ⑥ 🔴 **التثبيت على المحافظة بياخد نفس أخضر التثبيت على المدينة** —
//      رمادي معناه إن الموظف يقرا الصف كأن محدش لمسه فيعيد التثبيت.
//   ⑦ تسميات «حالة العنوان» الجديدة — والقيم القديمة مالهاش أثر حي.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src  = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const written = {};
const mk = id => ({ id,
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  style:{}, dataset:{}, addEventListener(){}, querySelectorAll(){ return []; },
  appendChild(){}, focus(){}, closest(){ return null; }, value:'', textContent:'', checked:false,
  set innerHTML(v){ written[this.id] = v; }, get innerHTML(){ return written[this.id] || ''; } });
const els = {};
const doc = { getElementById: id => (els[id] || (els[id] = mk(id))),
  querySelector: () => mk(), querySelectorAll: () => [], addEventListener(){},
  body: mk(), contains(){ return false; }, createElement: () => mk() };
const win = { addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}),
  scrollY:0, innerWidth:1400, devicePixelRatio:1, open(){} };

const toasts = [];
const api = new Function('document','window','localStorage','Chart','ExcelJS', src + `
showToast = (m, t) => toastSink.push({ m, t });
return { ADDR_MODE_ITEMS, ADDR_MODE_LABEL, bulkConfirmRows, bulkAddrModeStats,
         renderBulkConfirmStats, openBulkConfirm, confirmBulkUpload, closeBulkAllConfirm,
         addrModeInfo, districtCell, rowAddrMode,
         setState(rows, vis, sel){ allRows = rows; visibleRows = vis; selected = new Set(sel); },
         setOv(o){ districtOverride = o; },
         setJob(k){ currentJobKey = k; },
         startedWith(){ return started; },
         stubStart(){ started = null; startUpload = () => { started = [...selected]; }; } };`
     .replace('return {', 'let started = null; const toastSink = arguments[5]; return {')
)(doc, win, { getItem:()=>null, setItem(){}, removeItem(){} }, undefined, undefined, toasts);

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
};

const R = (id, extra) => Object.assign({
  orderId: id, orderNumber: '#' + id, uploadable: true, addressOk: true, mode: 'district',
  districtName: 'D-' + id, cityName: 'Behira', cityId: 'beh',
  ambiguous: false, cityDoubt: false, crossCity: [], alreadyUploaded: false }, extra);

// ─── ① نافذة واحدة للزرارين ───────────────────────────────────
console.log('① نافذة التأكيد بتتفتح من الزرارين');
ok('زرار «رفع الكل» بيسأل الأول',
   /id="bulkAllBtn"[\s\S]{0,200}askUploadAllVisible\(\)/.test(html));
ok('🔴 زرار «رفع المحدد» بيسأل الأول كمان',
   /id="bulkBtn"[\s\S]{0,200}askUploadSelected\(\)/.test(html));
ok('🔴 ومفيش زرار بينادي startUpload() على طول',
   !/onclick="[^"]*startUpload\(\)/.test(html));
ok('الزرارين بيروحوا لنفس الدالة',
   html.includes('function askUploadAllVisible() { openBulkConfirm(\'all\'); }') &&
   html.includes('function askUploadSelected()   { openBulkConfirm(\'sel\'); }'));

// ─── ② مجموع المربعات = الإجمالي ──────────────────────────────
console.log('\n② مجموع المربعات = الإجمالي — حتى لو الحالة مش في القايمة');
const sumOf = rows => api.bulkAddrModeStats(rows).reduce((a, s) => a + s.count, 0);
const mixed = [ R('A'), R('B'), R('C', { mode: 'province' }),
                R('D', { mode: 'zone' }), R('E', { mode: 'province' }) ];
api.setOv({});
ok('المجموع = عدد الصفوف', sumOf(mixed) === mixed.length, sumOf(mixed));
const stats = api.bulkAddrModeStats(mixed);
ok('عنوان مظبوط = 2', stats.find(s => s.label === api.ADDR_MODE_LABEL.district)?.count === 2, stats);
ok('المحافظة فقط = 2', stats.find(s => s.label === api.ADDR_MODE_LABEL.province)?.count === 2, stats);
ok('المدينة فقط = 1', stats.find(s => s.label === api.ADDR_MODE_LABEL.zone)?.count === 1, stats);
ok('الحالات الصفرية مابتتعرضش', stats.length === 3, stats.length);
ok('الترتيب = ترتيب ADDR_MODE_ITEMS',
   stats.map(s => s.label).join('|') ===
   api.ADDR_MODE_ITEMS.filter(it => ['district','zone','province'].includes(it.value))
     .map(it => it.label).join('|'), stats.map(s => s.label));
// 🔴 الحارس الحقيقي: حالة الـ Worker بيكتبها ومش متسجّلة في ADDR_MODE_ITEMS
const alien = [ R('A'), R('Z', { mode: 'brand_new_mode' }) ];
ok('🔴 حالة مش في القايمة بتتعدّ برضه', sumOf(alien) === 2, api.bulkAddrModeStats(alien));
ok('وبتتعرض بمفتاحها الخام',
   api.bulkAddrModeStats(alien).some(s => s.label === 'brand_new_mode'));

// ─── ③ الأرقام = اللي هيترفع فعلًا ────────────────────────────
console.log('\n③ الصفوف المعدودة = اللي هيترفع فعلًا');
const pool = [ R('A'), R('B', { uploadable: false }),
               R('C', { mode: 'province', cityDoubt: true,
                        crossCity: [{ cityId:'c', cityName:'Cairo', districtId:'d1',
                                      districtName:'Obour', matchedText:'العبور' }] }),
               R('D') ];
api.setState(pool, [pool[0], pool[1], pool[2]], ['A','B','C','D']);
ok('«الكل» = المعروض بس، من غير الموقوف ومن غير 🟠',
   api.bulkConfirmRows('all').map(r => r.orderId).join() === 'A', api.bulkConfirmRows('all').map(r=>r.orderId));
ok('«المحدد» = المحدد الصالح — حتى لو مش معروض',
   api.bulkConfirmRows('sel').map(r => r.orderId).join() === 'A,C,D', api.bulkConfirmRows('sel').map(r=>r.orderId));
ok('🟠 المحدد بالإيد بيعدّي في «المحدد»',
   api.bulkConfirmRows('sel').some(r => r.orderId === 'C'));
ok('الموقوف مابيتعدّش في الاتنين',
   !api.bulkConfirmRows('all').concat(api.bulkConfirmRows('sel')).some(r => r.orderId === 'B'));

api.stubStart();
api.setState(pool, [pool[0], pool[3]], []);
api.openBulkConfirm('all');
api.confirmBulkUpload();
ok('تأكيد «الكل» بيحدد المعروض ويرفع', (api.startedWith() || []).sort().join() === 'A,D', api.startedWith());

api.stubStart();
api.setState(pool, [], ['A','D']);
api.openBulkConfirm('sel');
api.confirmBulkUpload();
ok('تأكيد «المحدد» بيرفع التحديد زي ما هو', (api.startedWith() || []).sort().join() === 'A,D', api.startedWith());

api.stubStart();
api.setState(pool, [], ['A']);
api.openBulkConfirm('sel');
api.closeBulkAllConfirm();
api.confirmBulkUpload();
ok('🔴 «إلغاء» مابيرفعش — والتأكيد بعدها مالوش مصدر',
   api.startedWith() === null, api.startedWith());

api.stubStart();
api.setState(pool, [], []);
api.openBulkConfirm('sel');
ok('تحديد فاضي = تنبيه من غير نافذة', api.startedWith() === null);

// ─── ④ نوع الشحنة على الشاشة ─────────────────────────────────
console.log('\n④ نوع الشحنة في ترويسة النافذة');
api.setState(pool, [pool[0]], []);
api.setJob('return');
api.openBulkConfirm('all');
const title = els.bulkAllTitle.textContent;
ok('🔴 الترويسة بتسمّي نوع الشحنة', /استرجاع/.test(title) && /type\s*25/.test(title), title);
api.setJob('s1');
api.openBulkConfirm('all');
ok('وبتتغيّر مع الوضع', /type\s*10/.test(els.bulkAllTitle.textContent), els.bulkAllTitle.textContent);

// ─── ⑤ الجسم والأزرار ────────────────────────────────────────
console.log('\n⑤ الجسم مربعات · الأزرار');
const modal = html.match(/<div class="eco-overlay" id="bulkAllOverlay"[\s\S]*?\n<\/div>/)[0];
ok('النص القديم اتشال', !modal.includes('كل المعروض حسب الفلتر الحالي'));
ok('و«أيوه، ارفعهم» اتشالت', !modal.includes('أيوه، ارفعهم'));
ok('و`bulkAllMsg` مابقاش موجود', !html.includes('bulkAllMsg'));
ok('الجسم فيه حاوية المربعات', modal.includes('id="bulkAllStats"'));
ok('زرار التأكيد اسمه «تأكيد الرفع»', modal.includes('>تأكيد الرفع</button>'));
ok('🔴 زرار «إلغاء» أحمر', /class="btn-red"[^>]*>إلغاء</.test(modal));
ok('والتأكيد أسبق منه في الـ DOM',
   modal.indexOf('>تأكيد الرفع<') < modal.indexOf('>إلغاء<'));
api.setState(pool, [pool[0], pool[3]], []);
api.renderBulkConfirmStats(api.bulkConfirmRows('all'));
ok('مربع الإجمالي أول واحد وفيه العدد الصح',
   written.bulkAllStats.startsWith('<div class="res-stat total on"><span class="res-stat-num">2</span>'),
   written.bulkAllStats.slice(0, 80));
ok('والمربعات بتستخدم نفس كلاسات نافذة النتيجة',
   written.bulkAllStats.includes('res-stat-num') && written.bulkAllStats.includes('res-stat-lbl'));

// ─── ⑥ التثبيت على المحافظة = نفس الأخضر ─────────────────────
console.log('\n⑥ التثبيت على المحافظة بياخد نفس أخضر التثبيت على المدينة');
const row = R('P');
api.setState([row], [row], []);
api.setOv({ P: { forceZone: true, zoneName: 'October 6', zoneId: 'z1' } });
const zoneCell = api.districtCell(row);
api.setOv({ P: { forceProvince: true, cityName: 'Alexandria' } });
const provCell = api.districtCell(row);
ok('تثبيت المدينة أخضر', /class="mini-btn set"/.test(zoneCell), zoneCell.slice(0, 60));
ok('🔴 وتثبيت المحافظة أخضر بنفس الكلاس', /class="mini-btn set"/.test(provCell), provCell.slice(0, 60));
ok('والاتنين مكتوب عليهم «مثبّت»',
   zoneCell.includes('مثبّت') && provCell.includes('مثبّت'));
// 🔴 `set` معناها «مفتاح عنوان هيتبعت لبوسطة» — والتثبيت على المحافظة
//    مابيبعتش ولا `districtId` ولا `zoneId`. العلامة الخضرا علم منفصل.
ok('🔴 و`set` فضلت false على تثبيت المحافظة — مفيش مفتاح بيتبعت',
   api.addrModeInfo(row).set === false && api.addrModeInfo(row).pinned === true,
   api.addrModeInfo(row));
api.setOv({});
ok('وصف مالوش تثبيت مش أخضر', !/class="mini-btn set"/.test(api.districtCell(R('Q', { mode: 'province' }))));

// ─── ⑦ التسميات الجديدة ──────────────────────────────────────
console.log('\n⑦ تسميات «حالة العنوان»');
ok('zone = «المدينة فقط»',     api.ADDR_MODE_LABEL.zone === '🗺️ المدينة فقط', api.ADDR_MODE_LABEL.zone);
ok('province = «المحافظة فقط»', api.ADDR_MODE_LABEL.province === '🏙️ المحافظة فقط', api.ADDR_MODE_LABEL.province);
ok('blocked = «محافظة خارج الجدول»',
   api.ADDR_MODE_LABEL.blocked === '⛔ محافظة خارج الجدول', api.ADDR_MODE_LABEL.blocked);
ok('التسميات القديمة مالهاش أثر حي',
   !api.ADDR_MODE_ITEMS.some(it => ['🗺️ بالمدينة','🏙️ بالمحافظة بس','⛔ محافظة مش في الجدول'].includes(it.label)));
ok('ADDR_MODE_LABEL لسه مبنية من ADDR_MODE_ITEMS',
   api.ADDR_MODE_ITEMS.every(it => api.ADDR_MODE_LABEL[it.value] === it.label));

console.log(`\n══════════════════════════════════════════════════`);
console.log(`نجح ${pass} · فشل ${fail}`);
process.exit(fail ? 1 : 0);
