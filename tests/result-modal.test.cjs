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
// 🔴 قايمة المدن جوّه صف بوسطة — الصف المنفصل كان بيخلي الموظف يقرا مدينة
//    في السطر الأحمر ويغيّر مدينة في سطر تاني
const bosta = ctx.slice(ctx.indexOf('dp-src bosta'));
ok('قايمة المدن جوّه صف بوسطة', bosta.includes('id="dpCity"'));
ok('صف المدينة المنفصل اتشال', !html.includes('class="dp-city-row"'));
ok('سطر «الحالي:» اتشال من جسم النافذة', !html.includes('id="dpState"'));
// عنوان النافذة = رقم الأوردر + حالة العنوان بنفس قيمة العمود بالحرف
api.renderDpTitle(row);
const title = els.dpTitle.innerHTML;
ok('العنوان فيه رقم الأوردر', title.includes('#54617'), title);
ok('العنوان فيه «حالة العنوان:»', title.includes('حالة العنوان:'), title);
ok('وبنفس قيمة العمود بالحرف', title.includes(api.ADDR_MODE_LABEL[api.rowAddrMode(row)]), title);
ok('والشرح الطويل في الـ tooltip', /title="[^"]*مسار العناوين غير الواضحة/.test(title));

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} نجحت · ${fail} فشلت`);
process.exit(fail === 0 ? 0 : 1);
