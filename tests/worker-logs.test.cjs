// ══════════════════════════════════════════════════════════════
// دوال السجل في الـ Worker — node tests/worker-logs.test.cjs
//
// التلات بنود اللي بيحميها كلهم اتمسكوا في مراجعة كود v1.4.0:
// 🔴 `LOG_SORT_COLUMNS` كان object literal — والبحث فيه بيمشي على سلسلة الـ
//    prototype، فـ`sortBy=constructor` كان بيلزق دالة في نص SQL ويطلّع 500،
//    بالظبط عكس «بترجع للافتراضي بدون خطأ» المكتوب جنبها.
// 🔴 `parseInt` بلا حراسة: `parseInt('abc')` = NaN، والـ NaN بيعدّي
//    `Math.min`/`Math.max` زي ما هو ويوصل لـ D1 كـ bind.
// 🔴 فلتر التاريخ كان `substr(timestamp,1,10)` على صفوف متخزّنة UTC — والموظف
//    بيفكّر بتوقيت القاهرة، فرفع الساعة ١:٣٠ بالقاهرة كان بيختفي من «اليوم».
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/export default \{[\s\S]*$/, '');
const api = new Function(src + `
  return { orderByClause, clampInt, cairoDayBoundsUTC, cairoOffsetMinutes, buildLogFilterSQL };`)();

let pass = 0, fail = 0;
const chk = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${extra}` : ''}`); }
};

console.log('\n① الترتيب — قايمة مقفولة فعلًا');
{
  chk('مفتاح معروف بيعدّي', api.orderByClause('employee', 'asc') === ' ORDER BY employee ASC, timestamp DESC',
      api.orderByClause('employee', 'asc'));
  chk('timestamp من غير كاسر تعادل (هو نفسه الكاسر)',
      api.orderByClause('date', 'desc') === ' ORDER BY timestamp DESC', api.orderByClause('date', 'desc'));
  // 🔴 كاسر التعادل مش تحسين: من غيره صفوف نفس القيمة بترتيب عشوائي بين
  //    الصفحات، والصف الواحد ممكن يظهر في صفحتين أو مايظهرش خالص.
  chk('عمود غير timestamp لازم يكون معاه كاسر تعادل',
      api.orderByClause('orderName', 'asc').includes(', timestamp DESC'));

  for (const evil of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty', 'مش موجود', '']) {
    const out = api.orderByClause(evil, 'asc');
    chk(`«${evil}» بيرجع للافتراضي بصمت`, out === ' ORDER BY timestamp ASC', out);
  }
  chk('اتجاه غريب بيرجع DESC', api.orderByClause('date', 'DROP TABLE') === ' ORDER BY timestamp DESC');
}

console.log('\n② clampInt — الحراسة قبل ما NaN يوصل لـ D1');
{
  chk("'abc' بترجع للافتراضي", api.clampInt('abc', 100, 1, 100) === 100);
  chk('null بترجع للافتراضي', api.clampInt(null, 100, 1, 100) === 100);
  chk('الرقم بيتقص عند الحد الأعلى', api.clampInt('9999', 100, 1, 100) === 100);
  chk('والسالب بيتقص عند الأدنى', api.clampInt('-5', 0, 0, 999) === 0);
  chk('والرقم السليم بيعدّي', api.clampInt('37', 100, 1, 100) === 37);
  chk('مفيش NaN بيخرج أبدًا',
      [undefined, null, '', 'x', '1e', {}].every(v => Number.isFinite(api.clampInt(v, 7, 0, 10))));
}

console.log('\n③ حدود يوم القاهرة → UTC');
{
  // صيفًا (+٣): اليوم بيبدأ 21:00 UTC من اليوم اللي قبله
  const sum = api.cairoDayBoundsUTC('2026-09-13');
  chk('صيفًا: البداية 21:00 UTC اليوم اللي قبله', sum.start === '2026-09-12T21:00:00.000Z', sum.start);
  // شتاءً (+٢): بيبدأ 22:00 UTC
  const win = api.cairoDayBoundsUTC('2026-11-15');
  chk('شتاءً: البداية 22:00 UTC اليوم اللي قبله', win.start === '2026-11-14T22:00:00.000Z', win.start);
  chk('والنهاية بعد البداية بيوم كامل تقريبًا',
      Date.parse(win.end) - Date.parse(win.start) > 86_399_000);

  // 🔴 الحالة اللي كانت بتضيع: رفع 01:30 بالقاهرة شتاءً = 23:30 UTC امبارح
  const row = '2026-11-14T23:30:00.000Z';
  const day = api.cairoDayBoundsUTC('2026-11-15');
  chk('صف اترفع 01:30 بالقاهرة بيقع جوّه «اليوم» الصح',
      row >= day.start && row <= day.end, `${row} vs ${day.start}..${day.end}`);
  chk('والمقارنة النصّية القديمة كانت هتشيله',
      row.slice(0, 10) !== '2026-11-15');
}

console.log('\n④ الفلتر بيستخدم الحدود مش substr');
{
  const { sql, b } = api.buildLogFilterSQL('SELECT *', { tool: 't', dateFrom: '2026-11-15' });
  chk('مفيش substr في شرط التاريخ', !sql.includes('substr(timestamp'), sql);
  chk('والقيمة المربوطة ISO كاملة', b.some(v => String(v).endsWith('T22:00:00.000Z')), JSON.stringify(b));
}

console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
