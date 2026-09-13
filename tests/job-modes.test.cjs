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
return { tableColumns, renderTable, codCell, cycleCell, itemsCell, upCell, JOBS, sortConfig,
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
  ok('الاسترجاع فيه الدورة والقطع والمبلغ',
     re.includes('cycle') && re.includes('items') && re.includes('cod'), re);
  ok('ومفيهوش حالة S1', !re.includes('s1'));
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

console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
