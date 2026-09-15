// ══════════════════════════════════════════════════════════════
// نافذة النتيجة واسم «حالة العنوان» — node tests/result-modal.test.cjs
//
// الملف ده بيقفل الحالات اللي **مش** هتظهر كخطأ لو اتكسرت:
//   ① الفلتر والعمود والتصدير وعنوان النافذة بيقروا نفس الاسم — اسمين
//      لنفس القيمة معناهم إن الموظف يفتكرهم حاجتين
//   ② قيم «حالة العنوان» كلها من مصدر واحد (ADDR_MODE_LABEL)
//   ③ 🔴 التفاصيل بتتفتح لوحدها في أي حالة مش نجاح — الصف الأصفر معناه
//      شحنة موجودة عند بوسطة بفلوس، وإخفاؤها ورا ضغطة بيخلي الموظف يعيد
//      الرفع ويطلّع شحنة تانية
//   ④ حالة الصف بقت «نجاح» مش «تم» — «تم» كانت بتتلخبط مع «تم جزئيًا»
//   ⑤ سياق نافذة اختيار المنطقة: العنوان الكامل فوق · قايمة المدن جوّه صف
//      بوسطة · سطر «الحالي:» اتشال وحالة العنوان بقت في العنوان
//   ⑥ 🔴 مربعات العدّادات: الإجمالي والتفاصيل من نفس المصدر، والصفر بيفضل
//      رمادي — «فشل 0» ملوّن بالأحمر بيخلي شاشة كلها نجاح تبان فيها فشل
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

const api = new Function('document','window','localStorage','Chart','ExcelJS', src + `
return { ADDR_MODE_ITEMS, ADDR_MODE_LABEL, filterLabels, tableColumns, RESULT_BADGE,
         resultsNeedDetails, dpContextHTML, renderDpTitle, rowAddrMode,
         RESULT_STATS, renderResultStats, summarize, trackingLink,
         setRows(r){ allRows = r; }, setPicked(id){ dpOrderId = id; } };`
)(doc, win, { getItem:()=>null, setItem(){}, removeItem(){} }, undefined, undefined);

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
};

// ─── ① اسم واحد للمفهوم ──────────────────────────────────────
console.log('① «حالة العنوان» — اسم واحد في كل الشاشات');
const NAME = 'حالة العنوان';
ok('اسم الفلتر', api.filterLabels.addrMode === NAME, api.filterLabels.addrMode);
const col = api.tableColumns().find(c => c.key === 'addrMode');
ok('اسم العمود', col && col.label === NAME, col && col.label);
ok('ترويسة تصدير الأوردرات', html.includes(`{ header: '${NAME}', key: 'addrMode', width: 24 }`));
ok('عنوان الفلتر في الـ HTML', html.includes(`<span class="flt-label">${NAME}</span>`));
ok('الاسم القديم «شكل العنوان» اتشال من الفلتر', !html.includes('class="flt-label">شكل العنوان'));
ok('الاسم القديم «نوع المطابقة» مابقاش عمود', !api.tableColumns().some(c => c.label === 'نوع المطابقة'));

// ─── ② مصدر واحد للقيم ───────────────────────────────────────
console.log('\n② قيم «حالة العنوان» من مصدر واحد');
ok('district بقت «📍 عنوان مظبوط»', api.ADDR_MODE_LABEL.district === '📍 عنوان مظبوط', api.ADDR_MODE_LABEL.district);
// ⚠️ التسمية القديمة لسه مذكورة في سجل التحديثات — ده تاريخ مقصود.
//    الشرط هنا على القيم الحيّة بس.
ok('التسمية القديمة اختفت من القيم الحيّة',
   !api.ADDR_MODE_ITEMS.some(it => it.label.includes('مطابقة مؤكدة')));
ok('ADDR_MODE_LABEL مبنية من ADDR_MODE_ITEMS',
   api.ADDR_MODE_ITEMS.every(it => api.ADDR_MODE_LABEL[it.value] === it.label));

// ─── ③ متى تتفتح التفاصيل ────────────────────────────────────
console.log('\n③ التفاصيل بتتفتح لوحدها في أي حالة مش نجاح');
const R = (status, extra) => Object.assign({ orderNumber:'#1', status }, extra);
ok('نجاح كامل → مقفولة', api.resultsNeedDetails([R('success'), R('success')]) === false);
ok('تحذير → مفتوحة', api.resultsNeedDetails([R('success'), R('warning')]) === true);
ok('فشل → مفتوحة',   api.resultsNeedDetails([R('error')]) === true);
ok('اتخطّى → مفتوحة', api.resultsNeedDetails([R('skipped')]) === true);
// 🔴 العملية تمت والسجل ناقص — الصف ده هو اللي بيخلي الموظف يعيد الرفع بعدين
ok('نجاح بس ما اتسجلش في D1 → مفتوحة',
   api.resultsNeedDetails([R('success', { logged:false })]) === true);
ok('قايمة فاضية → مقفولة', api.resultsNeedDetails([]) === false);

// ─── ④ «نجاح» مش «تم» ────────────────────────────────────────
console.log('\n④ حالة الصف');
ok('بادج النجاح بتقول «نجاح»', /✓ نجاح/.test(api.RESULT_BADGE.success), api.RESULT_BADGE.success);
ok('«تم جزئيًا» زي ما هي', /⚠ تم جزئيًا/.test(api.RESULT_BADGE.warning));
ok('الصفحة مافيهاش بادج «✓ تم»', !html.includes('badge-success">✓ تم<'));
ok('جدول النتايج الدايم اتشال', !html.includes('id="resultsPanel"'));
ok('نافذة النتيجة موجودة', html.includes('id="resultsOverlay"'));

// ─── ⑤ سياق نافذة اختيار المنطقة ─────────────────────────────
console.log('\n⑤ سياق النافذة');
const row = { orderId:'g1', orderNumber:'#54617', addressOk:true, mode:'province',
  cityName:'South Sinai', cityId:'c1', province:'South Sinai', addressCity:'طابا',
  ambiguous:false, cityDoubt:false, candidates:[], localZones:[], crossCity:[],
  address1:'فندق شتيجنبيرجر طابا', address2:'بجوار المعبر' };
api.setRows([row]); api.setPicked('g1');
const ctx = api.dpContextHTML(row);
ok('العنوان الكامل اسمه «العنوان بالكامل»', ctx.includes('العنوان بالكامل'));
ok('«العنوان (سطر ١)» اتشال', !ctx.includes('العنوان (سطر ١)'));
// سطر العنوان لازم يسبق الصفين — هو المصدر اللي المطابقة بتقرا منه
ok('العنوان الكامل فوق صف شوبيفاي', ctx.indexOf('dp-addr') < ctx.indexOf('dp-src shopify'));
ok('وفيه سطر ٢ جوّه النص الكامل', ctx.includes('بجوار المعبر'));
// 🔴 القوايم المنسدلة **جوّه صف بوسطة** — الصف المنفصل كان بيخلي الموظف يقرا
//    قيمة في السطر الأحمر ويغيّرها في سطر تاني
const bosta = ctx.slice(ctx.indexOf('dp-src bosta'));
ok('قايمة المدينة جوّه صف بوسطة',  bosta.includes('id="dpPick-city"'));
ok('وقايمة الزون جنبها',           bosta.includes('id="dpPick-zone"'));
ok('وقايمة المنطقة كمان',          bosta.includes('id="dpPick-district"'));
// 🔴 التلاتة لازم يبقى فيهم خانة بحث — ٢٠٧ منطقة في القليوبية والجيزة ٣٣١،
//    يعني التمرير مش وسيلة اختيار.
ok('وكل واحدة فيها خانة بحث', (bosta.match(/dp-pick-search/g) || []).length === 3,
   (bosta.match(/dp-pick-search/g) || []).length);
// 🔴 الأعمدة لازم تفضل **نفس العدد** في الصفين، وإلا خانة بوسطة مابتقعش فوق
//    خانة شوبيفاي اللي بتقابلها والمقارنة بتبقى غلط بصريًا.
const shop = ctx.slice(ctx.indexOf('dp-src shopify'), ctx.indexOf('dp-src bosta'));
// ⚠️ الريجيكس لازم يقف عند `"` أو مسافة — `\b` لوحده بيلقّط `dp-f-k` و`dp-f-v`
//    كمان (الخانات الداخلية) فالعدد بيطلع ٧ بدل ٣.
const cells = t => (t.match(/class="dp-f[ "]/g) || []).length;
ok('صف شوبيفاي تلات خانات', cells(shop) === 3, cells(shop));
ok('وصف بوسطة تلاتة كمان',  cells(bosta) === 3, cells(bosta));
// 🔴 التالتة في شوبيفاي **فاضية عن قصد**: كان فيها نص العنوان وهو مكرر حرفيًا
//    مع الصف الأخضر فوق. اتشال، والخانة فضلت عشان الأعمدة تفضل متطابقة.
ok('والتالتة في شوبيفاي فاضية', shop.includes('dp-f-blank'));
ok('ونص العنوان مش مكرر في صف شوبيفاي', !shop.includes('فندق شتيجنبيرجر طابا'), shop);
// ⚠️ وفاضية **بلا `—`** — الشرطة بتقرا «القيمة مش موجودة»، وهنا مفيش قيمة
//    أصلًا مفروض تكون موجودة.
ok('وبلا شرطة تقرا «مفيش قيمة»', !/dp-f-blank[^>]*>—/.test(shop));
ok('صف المدينة المنفصل اتشال', !html.includes('class="dp-city-row"'));
ok('سطر «الحالي:» اتشال من جسم النافذة', !html.includes('id="dpState"'));
// عنوان النافذة = رقم الأوردر + حالة العنوان بنفس قيمة العمود بالحرف
api.renderDpTitle(row);
const title = els.dpTitle.innerHTML;
ok('العنوان فيه رقم الأوردر', title.includes('#54617'), title);
ok('العنوان فيه «حالة العنوان:»', title.includes('حالة العنوان:'), title);
ok('وبنفس قيمة العمود بالحرف', title.includes(api.ADDR_MODE_LABEL[api.rowAddrMode(row)]), title);
// 🔴 **التلميح اتشال عن قصد** (v2.8.0 · بند ٦): كل tooltips نافذة اختيار
// المنطقة اتشالت ما عدا شروح الخانات التلاتة. التأكيد اتقلب — لو رجع
// `title=` على البادج ده معناه إن حد رجّع التلميحات من غير قصد.
ok('ومفيش tooltip على البادج (اتشال في v2.8.0)', !/title=/.test(title), title);

// ─── ⑥ مربعات العدّادات ──────────────────────────────────────
console.log('\n⑥ مربعات عدّادات النتيجة');
ok('خمس خانات: الإجمالي + الأربع حالات', api.RESULT_STATS.length === 5, api.RESULT_STATS.length);
ok('أول خانة هي الإجمالي', api.RESULT_STATS[0].key === 'total');
// 🔴 كل حالة بيرجّعها summarize لازم يكون ليها مربع — الإجمالي من غير
//    خانة من خاناته بيخلي الموظف يدوّر على الفرق ومايلاقيهوش
const sumKeys = Object.keys(api.summarize([]));
ok('كل حالة في summarize ليها مربع',
   sumKeys.every(k => api.RESULT_STATS.some(st => st.key === k)), sumKeys);

const rows6 = [ R('success'), R('success'), R('warning'), R('skipped') ];
api.renderResultStats(api.summarize(rows6), rows6.length);
const tiles = els.resStats.innerHTML;
const tile = cls => (tiles.match(new RegExp(`res-stat ${cls}[^"]*"><span class="res-stat-num">([^<]*)`)) || [])[1];
const isOn  = cls => new RegExp(`res-stat ${cls} on"`).test(tiles);
ok('الإجمالي 4',  tile('total')   === '4', tile('total'));
ok('نجاح 2',      tile('success') === '2', tile('success'));
ok('تحذير 1',     tile('warn')    === '1', tile('warn'));
ok('فشل 0',       tile('error')   === '0', tile('error'));
ok('اتخطّى 1',    tile('skip')    === '1', tile('skip'));
// الصفر رمادي — مافيش كلاس `on`
ok('خانة الفشل الفاضية مش ملوّنة', isOn('error') === false);
ok('وخانة النجاح ملوّنة',          isOn('success') === true);
ok('الاسم تحت الرقم في نفس المربع', /res-stat-num">2<\/span><span class="res-stat-lbl">نجاح/.test(tiles));
// الأزرار: التفاصيل جوّاها زرار «✕ إلغاء الشحنة» — لازم تبان
ok('زرار التفاصيل ليه تصميم خاص', html.includes('class="res-ftr-btn details"'));
ok('وزرار التصدير كمان',          html.includes('class="res-ftr-btn export"'));
ok('البادجات القديمة اتشالت من النافذة', !html.includes('id="resSummary"'));

// ─── ⑦ رقم التتبع = لينك لداشبورد بوسطة (واجهة v2.15.0) ──────
// 🔴 الصيغة نفسها هي العقد: `https://business.bosta.co/orders/{trackingNumber}`.
//    أي تغيير فيها بيدّي **404 على داشبورد بوسطة** — لينك بيفتح ومش بيوصل،
//    وده أسوأ من نص عادي الموظف بينسخه.
// ⚠️ والتلات أماكن لازم يقروا من نفس الدالة: السجل · تفاصيل نافذة النتيجة ·
//    بادج «🔁 مرفوع» في جدول الرفع. أي مكان يرجع لـ`esc(...)` على طول بيرجع
//    نص ميت من غير أي خطأ.
console.log('\n⑦ رقم التتبع لينك لبوسطة');
const tl = api.trackingLink('9473166262');
ok('بيطلّع لينك business.bosta.co/orders/{tn}',
   /href="https:\/\/business\.bosta\.co\/orders\/9473166262"/.test(tl), tl);
ok('والرقم نفسه هو نص اللينك', />9473166262<\/a>/.test(tl), tl);
ok('وبيفتح في تاب جديد بأمان', /target="_blank"/.test(tl) && /rel="noopener"/.test(tl));
ok('ومن غير رقم بيرجّع شرطة مش لينك فاضي', api.trackingLink('') === '—'
   && api.trackingLink(null) === '—');
// ⚠️ الصفوف القديمة في D1 جايه من كتابة حرة — قيمة غريبة في `tracking`
//    مالهاش أي وسيلة تخرج من حدود المسار ولا من حدود النص
const evil = api.trackingLink('12"><script>alert(1)</script>');
ok('والقيمة الغريبة محبوسة في المسار', !/["<>]/.test((evil.match(/href="([^"]*)"/) || [])[1] || '"'), evil);
ok('ومفيش أي تاج بيتولد منها', (evil.match(/</g) || []).length === 2, evil);
ok('السجل بيقرا من الدالة', html.includes('${trackingLink(r.tracking)}'));
ok('وتفاصيل النتيجة كمان', html.includes('${trackingLink(r.trackingNumber)}'));
ok('وبادج «مرفوع» في جدول الرفع', html.includes('${trackingLink(r.previousTracking)}'));
// واللينك جوّه البادج بياخد لون البادج — الأزرق جوّه بادج صفرا بيقرا كأنه حالة تانية
ok('واللينك جوّه البادج بلون البادج', /\.badge \.order-link\{color:inherit/.test(html));

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} نجحت · ${fail} فشلت`);
process.exit(fail === 0 ? 0 : 1);
