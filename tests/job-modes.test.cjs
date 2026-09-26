// ══════════════════════════════════════════════════════════════
// أوضاع الرفع التلاتة في الواجهة — node tests/job-modes.test.cjs
//
// الأداة بقت بترفع تلات أنواع شحنات من نفس الشاشة، والفرق بينهم بيتصرف فلوس.
// الملف ده بيقفل الحالات اللي **مش** هتظهر كخطأ لو اتكسرت — هتظهر كرقم غلط
// أو عمود مزحزح والموظف بيضغط عليه عادي:
//   ① أعمدة الجدول بتتغيّر بالوضع، والترويسة والجسم من **نفس** المصدر
//   ② المبلغ السالب بيتعرض «استرداد» مش رقم عادي — الاتجاه لازم يبان
//   ③ الوضع بيحدد التاج والميتافيلد اللي هيتكتبوا
//   ④ قيم فلتر السجل بتطابق اللي الـ Worker بيكتبه حرفيًا
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src  = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

const el = { classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{}, dataset:{},
  addEventListener(){}, querySelectorAll(){return []}, appendChild(){}, focus(){}, closest(){return null},
  value:'', textContent:'', innerHTML:'', checked:false };
const doc = { getElementById:()=>el, querySelector:()=>el, querySelectorAll:()=>[],
  addEventListener(){}, body:el, contains(){return false}, createElement:()=>el };
const win = { addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}),
  scrollY:0, innerWidth:1400, devicePixelRatio:1, open(){} };
const ls  = { getItem:()=>null, setItem(){}, removeItem(){} };

const tail = `
return { tableColumns, renderTable, codCell, cycleCell, upCell, JOBS, sortConfig,
         cycleCodeLabel, CYCLE_CODE_LABEL, openCycleBlockModal,
         LOG_TYPE_ITEMS, MIN_WORKER_VERSION, setJob(k){ currentJobKey = k; },
         getJob(){ return currentJobKey; }, setRows(r){ allRows = r; } };`;
const api = new Function('document','window','localStorage','Chart','ExcelJS', src + tail)(doc, win, ls, undefined, undefined);

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}

// ─── ① الأعمدة ───────────────────────────────────────────────
console.log('\n① أعمدة الجدول بتتغيّر بالوضع');
{
  api.setJob('s1');
  const s1 = api.tableColumns().map(c => c.key);
  api.setJob('return');
  const re = api.tableColumns().map(c => c.key);

  ok('الشحن العادي فيه عمود حالة S1', s1.includes('s1'));
  ok('ومفيهوش أعمدة الدورة والمبلغ', !s1.includes('cycle') && !s1.includes('cod'));
  ok('الاسترجاع فيه الدورة والمبلغ',
     re.includes('cycle') && re.includes('cod'), re);
  ok('ومفيهوش حالة S1', !re.includes('s1'));
  // عمود «القطع» اتشال من الجدول (واجهة v2.1.0) — الوصف لسه بيتبعت لبوسطة
  // ولسه في تصدير XLSX وملف بوسطة، بس مابيتعرضش في الجدول.
  ok('ومفيهوش عمود القطع', !re.includes('items'), re);
  // 🔴 ده اللي بيمنع زحف الأعمدة: الترويسة والجسم والـ colspan كلهم من نفس
  //    الدالة، فعمود يتضاف في ناحية من غير التانية مستحيل.
  api.setRows([]);
  const cols = api.tableColumns();
  api.renderTable([]);
  ok('الصف الفاضي colspan بيساوي عدد الأعمدة الفعلي',
     /colspan="(\d+)"/.test(el.innerHTML) && Number(el.innerHTML.match(/colspan="(\d+)"/)[1]) === cols.length,
     { html: el.innerHTML.slice(0, 80), cols: cols.length });
}

// ─── ② اتجاه الفلوس ─────────────────────────────────────────
console.log('\n② المبلغ — الاتجاه لازم يبان في الجدول نفسه');
{
  api.setJob('return');
  const refund  = api.codCell({ cod: -1650, codRaw: -1650, codClipped: false });
  const collect = api.codCell({ cod: 250 });
  const clipped = api.codCell({ cod: -2000, codRaw: -2700, codClipped: true, codRemainder: 700 });

  // 🔴 السالب معناه **بوسطة بتدفع للعميل عند الباب**. عرضه كرقم عادي هو
  //    بالظبط الغلط اللي Math.abs كان هيعمله، بس في العرض بدل الـ payload.
  ok('السالب بيتعرض «استرداد» مش رقم عادي', /استرداد/.test(refund) && /1,650/.test(refund), refund);
  ok('وبكلاس بيميّزه بصريًا', /cod-refund/.test(refund));
  ok('الموجب بيتعرض عادي من غير كلمة استرداد', !/استرداد/.test(collect) && /250/.test(collect), collect);
  // 🔴 القص عند -2000 حد من بوسطة (errorCode 3008) — و**معلَن** مش صامت.
  //    القص الصامت معناه إن العميل بياخد أقل من حقه ومحدش شايف.
  ok('القص بيتعلّم وبيقول الباقي كام', /✂/.test(clipped) && /700/.test(clipped), clipped);
}

// ─── ②ب عمود الدورة المفتوحة ────────────────────────────────
console.log('\n②ب الدورة المفتوحة — الحالة والاسم والعدد كلهم في الخلية');
{
  api.setJob('return');
  const one = api.cycleCell({ cycleName: 'R1-#54244',
    cycleInfo: { totalCycles: 1, currentCycleName: 'R1-#54244', blocked: false, warnings: [] } });
  const many = api.cycleCell({ cycleName: 'R3-#51656',
    cycleInfo: { totalCycles: 3, currentCycleName: 'R3-#51656', blocked: false,
                 warnings: [{ code: 'MULTI_CYCLE', action: 'دورات متتابعة — قانونية.' }] } });
  const blocked = api.cycleCell({ cycleName: null,
    cycleInfo: { totalCycles: 2, blocked: true,
                 blockReason: { code: 'CYCLE_OVERLAP_OPEN', value: 'R1 · R2', action: 'أكتر من دورة مفتوحة' },
                 warnings: [] } });

  ok('الدورة السليمة بادجها «دورة واحدة» ومعاه اسم الدورة',
     /دورة واحدة/.test(one) && /R1-#54244/.test(one), one);
  // 🔴 ده اللي كان ناقص: الأوردر اللي عدّى بتلات دورات كان شكله زي اللي ليه
  //    دورة واحدة، والصف كله متحسب من الدورة المفتوحة بس.
  ok('أكتر من دورة بيبان عددها في الخلية', /3 دورات/.test(many) && /R3-#51656/.test(many), many);
  ok('والتحذير بيتعرض بالعربي مش بالكود', /دورات متتابعة/.test(many) && !/MULTI_CYCLE</.test(many), many);
  // 🔴 الكود الخام مالوش معنى عند الموظف — اللي بيتعرض هو السبب بالعربي،
  //    والقيمة اللي وقّفت الصف تحته. الكود بيفضل في الـ tooltip بس.
  ok('الصف الموقوف بيقول السبب بالعربي', /أكتر من دورة مفتوحة/.test(blocked), blocked);
  ok('ومعاه القيمة اللي وقّفته', /R1 · R2/.test(blocked), blocked);
  ok('وبكلاس بيميّزه بصريًا', /cycle-badge blocked/.test(blocked), blocked);
}

// ─── ②ج نافذة الرفض — نفس الترجمة بتاعة العمود ──────────────
console.log('\n②ج نافذة الرفض بتقرا من نفس مصدر الترجمة');
{
  // 🔴 مصدرين للترجمة معناهم إن الموظف يقرا «أكتر من دورة مفتوحة» في الجدول
  //    و`CYCLE_OVERLAP_OPEN` في النافذة — لنفس الصف بالظبط.
  api.openCycleBlockModal({
    error: 'الرفع اتوقف', blocked: [
      { id: 'gid://1', name: '#54244', code: 'CYCLE_OVERLAP_OPEN', value: 'R1 · R2', action: 'اقفل الزيادة' },
      { id: 'gid://2', name: '#51656', code: 'COURIER_NOT_BOSTA',  value: 'Aramex',  action: 'ظبّط الكوريَر' },
    ],
  }, { label: 'استرجاع' });
  const html = el.innerHTML;

  ok('سبب التوقيف في النافذة بالعربي', /أكتر من دورة مفتوحة/.test(html), html.slice(0, 200));
  ok('وكل الأسباب مترجمة مش واحد بس', /الكوريَر مش بوسطة/.test(html), html.slice(0, 400));
  // الكود الخام بيفضل في الـ tooltip بس — التتبع مع الدعم لازم يفضل ممكن
  ok('والكود الخام مش معروض كنص', !/>CYCLE_OVERLAP_OPEN</.test(html), html.slice(0, 400));
  ok('بس لسه موجود في الـ tooltip', /title="CYCLE_OVERLAP_OPEN"/.test(html), html.slice(0, 400));
  // ⚠️ السطر ده مهم أكتر من القايمة نفسها
  ok('وسطر «لم يتم إنشاء أي شحنة» موجود وأخضر',
     /لم يتم إنشاء أي شحنة/.test(html) && /var\(--green\)/.test(html), html.slice(0, 300));

  // أي كود مش في القايمة بيرجع زي ما هو — أحسن من «—» بيخفي السبب
  ok('كود مش متعرّف بيرجع زي ما هو', api.cycleCodeLabel('SOMETHING_NEW') === 'SOMETHING_NEW');
  ok('وكل أكواد الحارس في القايمة',
     ['CYCLES_TRUNCATED','NO_OPEN_CYCLE','CYCLE_OVERLAP_OPEN','EXCHANGE_WITHOUT_ITEMS',
      'ORDER_NOT_READABLE','COURIER_NOT_BOSTA','CYCLE_OVERLAP','MULTI_CYCLE','TYPE_MISMATCH',
      'EXCHANGE_ITEMS_RECOVERED'].every(c => api.CYCLE_CODE_LABEL[c]));
}

// ─── ③ التاج والميتافيلد ────────────────────────────────────
console.log('\n③ الوضع بيحدد التاج والميتافيلد');
{
  ok('الشحن → Bosta_Uploaded_S1', api.JOBS.s1.tag === 'Bosta_Uploaded_S1');
  ok('الاسترجاع والاستبدال → Bosta_Uploaded_S2',
     api.JOBS.return.tag === 'Bosta_Uploaded_S2' && api.JOBS.exchange.tag === 'Bosta_Uploaded_S2');
  ok('الشحن → bosta_tracking_number_s1', api.JOBS.s1.trackingKey === 'bosta_tracking_number_s1');
  ok('R/E → bosta_tracking_number_s2',
     api.JOBS.return.trackingKey === 'bosta_tracking_number_s2'
     && api.JOBS.exchange.trackingKey === 'bosta_tracking_number_s2');
  // 🔴 الميتافيلد القديم اتوقف — الصفحة مالهاش أي أثر ليه
  ok('مفيش وضع لسه ماسك الميتافيلد القديم',
     !Object.values(api.JOBS).some(j => j.trackingKey === 'bosta_tracking_number'));
  ok('نوع شحنة بوسطة صح لكل وضع',
     api.JOBS.s1.bostaType === 10 && api.JOBS.return.bostaType === 25 && api.JOBS.exchange.bostaType === 30);
}

// ─── ④ فلتر السجل مقابل الـ Worker ──────────────────────────
console.log('\n④ قيم فلتر السجل لازم تطابق الـ Worker حرفيًا');
{
  // 🔴 قيمة مكتوبة غلط هنا بتدّي فلتر بيرجّع **صفر صف من غير أي خطأ** —
  //    الموظف بيفتكر إن العملية ما حصلتش. مفيش طريقة يكتشفها غير المقارنة دي.
  const workerTypes = new Set();
  for (const m of workerSrc.matchAll(/'(uploaded|upload_failed|shopify_write_failed|skipped|upload_re_return|upload_re_exchange|re_upload_failed|re_shopify_write_failed|re_cancelled|cycle_block|scan|export_return|export_exchange|confirm_return|confirm_exchange)'/g)) {
    workerTypes.add(m[1]);
  }
  const pageTypes = api.LOG_TYPE_ITEMS.map(i => i.value);
  const orphans = pageTypes.filter(t => !workerTypes.has(t));
  ok('كل قيمة في فلتر الصفحة موجودة في الـ Worker', orphans.length === 0, orphans);
  ok('والفلتر بيغطي نوعي الرفع الجداد',
     pageTypes.includes('upload_re_return') && pageTypes.includes('upload_re_exchange'));
  ok('وبيغطي الإلغاء ومنع الدورات', pageTypes.includes('re_cancelled') && pageTypes.includes('cycle_block'));
}

// ─── ⑤ حارس نسخة الـ Worker ─────────────────────────────────
console.log('\n⑤ حارس نسخة الـ Worker');
{
  // 🔴 Worker أقدم مافيهوش upload_re **ولا الميتافيلدات الجديدة**، فوضع الشحن
  //    كان هيكتب على المفتاح القديم من غير ما حد ياخد باله.
  const wv = workerSrc.match(/const WORKER_VERSION = '([\d.]+)'/)[1];
  ok('MIN_WORKER_VERSION بيساوي نسخة الـ Worker الحالية',
     api.MIN_WORKER_VERSION === wv, { page: api.MIN_WORKER_VERSION, worker: wv });
}

// ─── ⑥ بادج حالة الرفع — رقم التتبع مايختفيش ورا «موقوف» ────
// 🔴 الرفع مابيحركش حالة الأوردر، فالصف بيرجع في القايمة بعد التحديث ومعاه
//    رقم تتبع. لو كان **كمان** موقوف (عنوانه خارج التغطية مثلًا)، البادج كان
//    بيقول «⛔ موقوف» بس — ورقم التتبع يختفي من الشاشة خالص. الموظف يقرا
//    «ما اترفعش» على شحنة موجودة بفلوس، ويروح داشبورد بوسطة يتأكد بنفسه.
console.log('\n⑥ بادج حالة الرفع — الشحنة الموجودة بتتقال');
{
  api.setJob('s1');
  const up = (over) => api.upCell({ orderId:'X', uploadable:true, addressOk:true,
    mode:'district', problems:[], alreadyUploaded:true, previousTracking:'8464592804', ...over });

  const plain = up({});
  ok('الصف المرفوع السليم: «مرفوع» + رقم التتبع',
     /🔁 مرفوع/.test(plain) && plain.includes('8464592804'), plain);
  ok('ومفيهوش علامة وقف', !plain.includes('⛔'), plain);

  // 🔴 الحالة اللي كانت مكسورة — مرفوع **و**موقوف
  const both = up({ uploadable:false, coverageOnly:true, mode:'coverageBlocked' });
  ok('المرفوع الموقوف: رقم التتبع لسه باين', both.includes('8464592804'), both);
  ok('و«مرفوع» لسه هي البادج', /🔁 مرفوع/.test(both), both);
  ok('والوقف متقال جنبه (⛔)', both.includes('⛔'), both);
  ok('والتلميح بيقول إن الشحنة موجودة فعلًا',
     /موجودة عند بوسطة فعلًا/.test(both), both);

  // 🔴 (قرار أحمد 26-09-2026) البادج بقى بيقول «حالة الرفع» بس — الصف الموقوف
  //    غير المرفوع بيقول نفس كلام أي صف مش مرفوع، مش «⛔ موقوف». المنع نفسه
  //    (الصف الأحمر · الشيك بوكس المقفول) زي ما هو برّه البادج ده.
  const blocked = api.upCell({ orderId:'Y', uploadable:false, addressOk:true,
    mode:'coverageBlocked', problems:[], alreadyUploaded:false });
  ok('والموقوف غير المرفوع بيقول «لم يتم الرفع» زي أي صف مش مرفوع',
     /لم يتم الرفع/.test(blocked) && !/موقوف/.test(blocked) && !/مرفوع/.test(blocked), blocked);
}

console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
