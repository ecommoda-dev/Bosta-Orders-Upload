// ══════════════════════════════════════════════════════════════
// دمج قطع الاستبدال: الدورة + سطور الأوردر غير المشحونة — node tests/exchange-merged-items.test.cjs
// حالة #65434: الاستبدال فيه SD1 بس، وCS ضافت NC1 بتعديل أوردر (v2.27.0).
// منع التكرار بمعرّف السطر (id) — مش بالاسم.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/export default \{[\s\S]*$/, '');
const api = new Function(src + ` return { analyzeReturnCycles, resolveOutgoingItems };`)();

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}

const line = (id, sku, cur, unf) => ({ node: { id, sku, name: sku, currentQuantity: cur, unfulfilledQuantity: unf, originalUnitPriceSet: { shopMoney: { amount: '1000' } } } });
const exch = (id, sku, qty = 1) => ({ node: { quantity: qty, lineItems: [{ id, sku, name: sku, originalUnitPriceSet: { shopMoney: { amount: '1000' } } }] } });
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
const analyze = (o, job = 'exchange') => api.analyzeReturnCycles(o, job);
const labels = (a) => a.outgoing.items.map((r) => `${r.label} x${r.qty}`).sort().join(' | ');
const codes = (a) => a.info.warnings.map((w) => w.code);

console.log('\n① #65434 — NC1 مضافة بتعديل أوردر');
{
  const a = analyze(order([line('L1', 'SD1', 0, 0), line('L2', 'SD1', 1, 1), line('L3', 'NC1', 1, 1)], [exch('L2', 'SD1')]));
  ok('القطع الخارجة SD1 + NC1', labels(a) === 'NC1 x1 | SD1 x1', labels(a));
  ok('SD1 اتعدّت مرة واحدة (مفيش تكرار)', a.outgoing.items.filter((r) => r.label === 'SD1').length === 1);
  ok('المصدر cycle_plus_order', a.outgoing.source === 'cycle_plus_order', a.outgoing.source);
  const w = a.info.warnings.find((x) => x.code === 'EXCHANGE_ITEMS_RECOVERED');
  ok('تحذير EXCHANGE_ITEMS_RECOVERED بيسمّي NC1 بس', w && w.value === 'NC1 x1', w && w.value);
  ok('مش حاجب', !a.info.blocked);
}

console.log('\n② استبدال سليم — مفيش تغيير');
{
  const a = analyze(order([line('L1', 'SD1', 0, 0), line('L2', 'SD1', 1, 1)], [exch('L2', 'SD1')]));
  ok('SD1 بس', labels(a) === 'SD1 x1', labels(a));
  ok('المصدر cycle ومفيش تحذير', a.outgoing.source === 'cycle' && !codes(a).includes('EXCHANGE_ITEMS_RECOVERED'));
}

console.log('\n③ نفس الـ SKU بمعرّفين مختلفين = سطرين (مش تكرار)');
{
  const a = analyze(order([line('L2', 'SD1', 1, 1), line('L9', 'SD1', 1, 1)], [exch('L2', 'SD1')]));
  ok('SD1 x2 (سطر الدورة + سطر مضاف)', labels(a) === 'SD1 x1 | SD1 x1', labels(a));
}

console.log('\n④ سطر اتسلّم أو اتشال — مش بيتضاف');
{
  ok('unfulfilled 0', labels(analyze(order([line('L2', 'SD1', 1, 1), line('L3', 'NC1', 1, 0)], [exch('L2', 'SD1')]))) === 'SD1 x1');
  ok('currentQuantity 0 (اتشال)', labels(analyze(order([line('L2', 'SD1', 1, 1), line('L3', 'NC1', 0, 1)], [exch('L2', 'SD1')]))) === 'SD1 x1');
}

console.log('\n⑤ الاسترجاع مش متأثر');
{
  const a = analyze(order([line('L2', 'SD1', 1, 1), line('L3', 'NC1', 1, 1)], [exch('L2', 'SD1')]), 'return');
  ok('نفس قطع الدورة بس', a.outgoing.source === 'cycle' && a.outgoing.items.length === 1);
}

console.log('\n⑥ الدورة فاضية — fallback زي ما كان');
{
  const a = analyze(order([line('L2', 'SD1', 1, 1), line('L3', 'NC1', 1, 1)], []));
  ok('القطعتين من الأوردر', labels(a) === 'NC1 x1 | SD1 x1', labels(a));
  ok('المصدر order_unfulfilled + EXCHANGE_ITEMS_RECOVERED', a.outgoing.source === 'order_unfulfilled' && codes(a).includes('EXCHANGE_ITEMS_RECOVERED'));
}

console.log('\n⑦ fallback بدون معرّفات (استعلام قديم) — بالـ label والكمية');
{
  const noId = (l) => { delete l.node.id; return l; };
  const o = order([noId(line('', 'SD1', 1, 1)), noId(line('', 'NC1', 1, 1))], [{ node: { quantity: 1, lineItems: [{ sku: 'SD1', name: 'SD1' }] } }]);
  ok('NC1 اتضافت وSD1 ماتكررتش', labels(analyze(o)) === 'NC1 x1 | SD1 x1', labels(analyze(o)));
}

console.log('\n⑧ دورة فاضية وأوردر فاضي — لسه حاجب');
ok('EXCHANGE_WITHOUT_ITEMS', analyze(order([line('L1', 'SD1', 0, 0)], [])).info.blockReason?.code === 'EXCHANGE_WITHOUT_ITEMS');

console.log(`\n${pass} ✅  ${fail} ❌`);
process.exit(fail ? 1 : 0);
