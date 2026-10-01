// ══════════════════════════════════════════════════════════════
// دورة اتفتحت تاني (R1 بنفس الرقم) — node tests/reopened-cycle-ref.test.cjs
// `#54549`: استبدال تاني على نفس الدورة → المرجع `#54549-EX1` محجوز (11000).
// القاعدة: لاحقة `-2` · `-3` **بس لو الأوردر عليه رفع سابق** (تاج/ميتافيلد S2).
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8').replace(/export default \{[\s\S]*$/, '');
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}  →  ${JSON.stringify(e)}`); } };
const reply = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
const load = (f) => new Function('fetch', 'caches', src + '\nreturn { uploadOneRE, ensureNormalized, getJob };')(
  f, { default: { match: async () => null, put: async () => {} } });
const D = (id, name, nameAr) => ({ id, name, nameAr, zone: 'Z', zoneAr: '', dropOff: true });
const catalog = { cities: [{ cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo', cityAr: 'القاهرة', districts: [D('c1', 'Nasr City', 'مدينة نصر')] }] };
const line = (sku) => ({ node: { quantity: 1, fulfillmentLineItem: { lineItem: { sku, name: sku, originalUnitPriceSet: { shopMoney: { amount: '500' } } } } } });
const order = (over = {}) => ({
  id: 'gid://shopify/Order/1', name: '#54549', note: null,
  shippingAddress: { name: 'Ahmed Ali', firstName: 'Ahmed', lastName: 'Ali', phone: '01019191915',
    address1: 'مدينة نصر شارع مصطفى النحاس', city: 'مدينة نصر', province: 'Cairo', provinceCode: 'C' },
  customer: { phone: '01019191915' }, totalOutstandingSet: { shopMoney: { amount: '100' } },
  outgoingItems: [{ label: 'SKU-B', qty: 1, unitPrice: 500 }], cycleName: '#54549-R1',
  currentCycle: { name: '#54549-R1', returnLineItems: { edges: [line('SKU-A')] } }, ...over });
const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 's.myshopify.com' };
const shop = (q, v) => reply(200, { data: /tagsAdd/.test(q)
  ? { tagsAdd: { node: { id: v.id }, userErrors: [] } }
  : { metafieldsSet: { metafields: (v.metafields || []).map((m) => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })), userErrors: [] } } });
const router = (bosta) => async (url, opts) => String(url).includes('/admin/api/') ? shop(JSON.parse(opts.body).query, JSON.parse(opts.body).variables) : bosta(url, opts);
const taken = new Set(['#54549-EX1']);                   // الشحنة القديمة عايشة
const mkBosta = (urefs) => async (url, opts) => {
  const b = JSON.parse(opts.body); urefs.push(b.uniqueBusinessReference);
  return taken.has(b.uniqueBusinessReference)
    ? reply(400, { success: false, errorCode: '11000', message: 'dup' })
    : reply(201, { success: true, data: { trackingNumber: '777', _id: 'x' } });
};

(async () => {
  console.log('\n① أوردر عليه تاج S2 → لاحقة -2');
  let urefs = [], api = load(router(mkBosta(urefs))); api.ensureNormalized(catalog);
  const job = api.getJob('exchange');
  let row = await api.uploadOneRE(env, 't', order({ tags: [job.tag] }), catalog, job, null);
  ok('نجح', row.status === 'success', row);
  ok('المحاولات: EX1 ثم EX1-2', urefs.join() === '#54549-EX1,#54549-EX1-2', urefs);
  ok('row.uref = #54549-EX1-2', row.uref === '#54549-EX1-2', row.uref);
  ok('ملحوظة (advisory) مش تحذير', row.advisories.some((a) => a.includes('#54549-EX1-2')) && !row.warnings.length, [row.advisories, row.warnings]);

  console.log('\n② ميتافيلد _s2 بدل التاج + -2 محجوز كمان → -3');
  taken.add('#54549-EX1-2'); urefs = []; api = load(router(mkBosta(urefs))); api.ensureNormalized(catalog);
  row = await api.uploadOneRE(env, 't', order({ mfTrackS2: { value: '9597453471' } }), catalog, api.getJob('exchange'), null);
  ok('وصل -3', row.uref === '#54549-EX1-3' && row.status === 'success', [row.uref, row.status]);

  console.log('\n③ بلا دليل رفع سابق → 11000 يفضل خطأ، مفيش إعادة محاولة');
  urefs = []; api = load(router(mkBosta(urefs))); api.ensureNormalized(catalog);
  row = await api.uploadOneRE(env, 't', order(), catalog, api.getJob('exchange'), null);
  ok('نداء واحد بس', urefs.length === 1, urefs);
  ok('error + رسالة الدورة المرفوعة', row.status === 'error' && /الدورة دي مرفوعة/.test(row.error), row);

  console.log('\n④ السقف: كله محجوز → يقف ومايعملش شحنة');
  for (let i = 2; i <= 9; i++) taken.add(`#54549-EX1-${i}`);
  urefs = []; api = load(router(mkBosta(urefs))); api.ensureNormalized(catalog);
  row = await api.uploadOneRE(env, 't', order({ tags: [job.tag] }), catalog, api.getJob('exchange'), null);
  ok('error وعدد النداءات = السقف (5)', row.status === 'error' && urefs.length === 5, [row.status, urefs.length]);
  console.log(`\nنجح ${pass} · فشل ${fail}`); process.exit(fail ? 1 : 0);
})();
