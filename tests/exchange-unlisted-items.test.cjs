// ══════════════════════════════════════════════════════════════
// تحذير «قطعة في الأوردر ومش في الاستبدال» — node tests/exchange-unlisted-items.test.cjs
// حالة #65434: الاستبدال فيه SD1 بس، وCS ضافت NC1 بتعديل أوردر.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/export default \{[\s\S]*$/, '');
const api = new Function(src + ` return { analyzeReturnCycles };`)();

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}

const line = (sku, cur, unf) => ({ node: { sku, name: sku, currentQuantity: cur, unfulfilledQuantity: unf } });
const exch = (sku, qty = 1) => ({ node: { quantity: qty, lineItems: [{ sku, name: sku }] } });
function order(lines, exchanges) {
  return {
    name: '#65434', s2Status: { value: 'Confirmed + EXCHANGE' },
    lineItems: { edges: lines },
    returns: { pageInfo: { hasNextPage: false }, edges: [{ node: {
      name: '#65434-R1', status: 'OPEN', createdAt: '2026-11-13T12:15:00Z', closedAt: null,
      exchangeLineItems: { edges: exchanges },
    } }] },
  };
}
const codes = (o, job = 'exchange') => api.analyzeReturnCycles(o, job).info.warnings.map((w) => w.code);

console.log('\n① #65434 — NC1 مضافة بتعديل أوردر');
{
  const o = order([line('SD1', 0, 0), line('SD1', 1, 1), line('NC1', 1, 1)], [exch('SD1')]);
  const a = api.analyzeReturnCycles(o, 'exchange');
  const w = a.info.warnings.find((x) => x.code === 'EXCHANGE_UNLISTED_ITEMS');
  ok('التحذير ظهر', !!w);
  ok('بيسمّي NC1 x1 بس (مش SD1)', w && w.value === 'NC1 x1', w && w.value);
  ok('مش حاجب', !a.info.blocked);
  ok('القطع الخارجة ما اتغيّرتش (SD1 بس — تحذير مش دمج)', a.outgoing.items.length === 1 && a.outgoing.items[0].label === 'SD1');
}

console.log('\n② استبدال سليم — مفيش تحذير');
ok('SD1 في الاتنين', !codes(order([line('SD1', 0, 0), line('SD1', 1, 1)], [exch('SD1')])).includes('EXCHANGE_UNLISTED_ITEMS'));
ok('كمية 2 في الاتنين', !codes(order([line('SD1', 2, 2)], [exch('SD1', 2)])).includes('EXCHANGE_UNLISTED_ITEMS'));

console.log('\n③ نفس القطعة بكمية زيادة');
ok('الأوردر 2 والاستبدال 1', codes(order([line('SD1', 2, 2)], [exch('SD1', 1)])).includes('EXCHANGE_UNLISTED_ITEMS'));

console.log('\n④ سطر اتسلّم أو اتشال — مش بيتحسب');
ok('unfulfilled 0', !codes(order([line('SD1', 1, 1), line('NC1', 1, 0)], [exch('SD1')])).includes('EXCHANGE_UNLISTED_ITEMS'));
ok('currentQuantity 0 (اتشال)', !codes(order([line('SD1', 1, 1), line('NC1', 0, 1)], [exch('SD1')])).includes('EXCHANGE_UNLISTED_ITEMS'));

console.log('\n⑤ الاسترجاع مش متأثر');
ok('jobType return', !codes(order([line('SD1', 1, 1), line('NC1', 1, 1)], [exch('SD1')]), 'return').includes('EXCHANGE_UNLISTED_ITEMS'));

console.log('\n⑥ fallback (الدورة فاضية) — التحذير القديم بس');
{
  const c = codes(order([line('SD1', 1, 1), line('NC1', 1, 1)], []));
  ok('EXCHANGE_ITEMS_RECOVERED موجود', c.includes('EXCHANGE_ITEMS_RECOVERED'));
  ok('والجديد مش موجود', !c.includes('EXCHANGE_UNLISTED_ITEMS'));
}

console.log(`\n${pass} ✅  ${fail} ❌`);
process.exit(fail ? 1 : 0);
