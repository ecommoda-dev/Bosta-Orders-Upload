// ══════════════════════════════════════════════════════════════
// توقيت القاهرة — node tests/cairo-time.test.cjs
//
// 🔴 البند اللي بيحميه: الإزاحة كانت مكتوبة ثابت `+ 3 * 60 * 60 * 1000`.
//    مصر بتوقف التوقيت الصيفي **29-10-2026**، ومن ساعتها كل وقت معروض
//    بيغلط بساعة **من غير أي رسالة** (`ecommoda-constants` §13).
//
// 🔴 والبند التاني اتكشف وقت الإصلاح نفسه: `Intl.formatToParts` **بترمي**
//    `RangeError` على تاريخ غير صالح، والنسخة القديمة كانت بترجّع NaN بلا رمي.
//    صف واحد بتاريخ ناقص كان بيرمي جوّه `applyFilters()` — ودي بتتنده من دالة
//    `async`، فالاستثناء بيتبلع في promise محدش بيقراها والشاشة بتقف صامتة.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// بلوك الوقت لوحده — مالوش أي اعتماد على DOM
const from = html.indexOf('const CAIRO_TZ');
const to   = html.indexOf('const fmtNum');
if (from < 0 || to < 0) { console.error('❌ مش لاقي بلوك الوقت في index.html'); process.exit(1); }
const api = new Function(html.slice(from, to) + `
  return { toCairo, cairoOffsetMinutes, isValidDate,
           formatDateTime, formatDate, formatTimeOnly,
           formatDateForExport, formatTimeForExport, cairoDateStr };`)();

let pass = 0, fail = 0;
const chk = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${extra}` : ''}`); }
};

console.log('\n① الإزاحة بتتحسب — مش ثابتة');
{
  const summer = api.cairoOffsetMinutes(new Date('2026-09-13T10:00:00.000Z'));
  const winter = api.cairoOffsetMinutes(new Date('2026-11-15T10:00:00.000Z'));
  chk('صيفًا ١٨٠ دقيقة', summer === 180, summer);
  chk('شتاءً ١٢٠ دقيقة (بعد 29-10-2026)', winter === 120, winter);
  // 🔴 ده بالظبط اللي الثابت القديم كان هيغلط فيه: كان هيقول 01:00 مساءً
  chk('والفرق بيبان في النص المعروض', api.formatDateTime('2026-11-15T10:00:00.000Z').includes('12:00 مساءً'),
      api.formatDateTime('2026-11-15T10:00:00.000Z'));
}

console.log('\n② حدود اليوم بتتحسب صح');
{
  // 22:30 UTC شتاءً = 00:30 من اليوم اللي بعده بتوقيت القاهرة
  chk('بعد منتصف الليل بتوقيت القاهرة بيروح لليوم اللي بعده',
      api.formatDate('2026-11-15T22:30:00.000Z').includes('16/11/2026'),
      api.formatDate('2026-11-15T22:30:00.000Z'));
  chk('و cairoDateStr متسقة معاها', api.cairoDateStr('2026-11-15T22:30:00.000Z') === '2026-11-16',
      api.cairoDateStr('2026-11-15T22:30:00.000Z'));
}

console.log('\n③ التاريخ غير الصالح مابيرميش');
{
  for (const bad of [undefined, null, '', 'مش تاريخ', NaN]) {
    let threw = null;
    try { api.toCairo(bad); } catch (e) { threw = e; }
    chk(`toCairo(${JSON.stringify(bad)}) مابيرميش`, threw === null, threw && threw.message);
  }
  // ولا بيطلّع NaN/NaN/NaN زي القديم
  chk('والعرض بيقول «—» مش NaN', api.formatDateTime(undefined) === '—', api.formatDateTime(undefined));
  chk('نفس الكلام في التصدير', api.formatDateForExport(undefined) === '—', api.formatDateForExport(undefined));
  chk('و isValidDate بتفرّق صح',
      api.isValidDate(new Date('2026-09-13T10:00:00Z')) === true && api.isValidDate(new Date('x')) === false);
}

console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
