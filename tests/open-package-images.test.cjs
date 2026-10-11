// ══════════════════════════════════════════════════════════════
// مسار 2150 — node tests/open-package-images.test.cjs
// بوسطة رجّعت 400 · 2150 «Product images are required when allowToOpenPackage
// is enabled» → رفع صورة المنتج وإعادة الإرسال مرة واحدة (`bosta-api-helper` 8.13).
// ⛔ ومفيش تحويل صامت لـ allowToOpenPackage:false.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8').replace(/export default \{[\s\S]*$/, '');
let pass = 0, fail = 0;
const ok = (l, c, x) => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}  →  ${JSON.stringify(x)}`); } };
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body,
  headers: { get: () => 'image/png' }, arrayBuffer: async () => new ArrayBuffer(8) });
const load = (f) => new Function('fetch', 'caches', src + '\nreturn { uploadOneRE, ensureNormalized, getJob };')(f, { default: { match: async () => null, put: async () => {} } });

const D = (id, name, nameAr) => ({ id, name, nameAr, zone: 'Z', zoneAr: '', dropOff: true });
const catalog = { cities: [{ cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo', cityAr: 'القاهرة', districts: [D('c1', 'Nasr City', 'مدينة نصر')] }] };
const order = () => ({ id: 'gid://shopify/Order/1', name: '#53517', note: null,
  shippingAddress: { name: 'Ahmed Ali', firstName: 'Ahmed', lastName: 'Ali', phone: '01019191915', address1: 'مدينة نصر شارع النحاس', city: 'مدينة نصر', province: 'Cairo', provinceCode: 'C' },
  customer: { phone: '01019191915' }, totalOutstandingSet: { shopMoney: { amount: '-1650' } }, outgoingItems: [],
  currentCycle: { name: '#53517-R1', returnLineItems: { edges: [{ node: { quantity: 1, fulfillmentLineItem: { lineItem: { sku: 'A', name: 'A', originalUnitPriceSet: { shopMoney: { amount: '1650' } } } } } }] } } });
const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 's.myshopify.com' };
const JOB = load(async () => reply(200, {})).getJob('return');

let seq = 0;
function mk({ withImage = true, putStatus = 200, retryFails = false } = {}) {
  const log = [];
  const f = async (url, opts = {}) => {
    const u = String(url); log.push({ u, method: opts.method, body: opts.body });
    if (u.includes('/admin/api/')) {
      const q = JSON.parse(opts.body).query;
      if (/OrderImages/.test(q)) return reply(200, { data: { node: { lineItems: { nodes: [{ currentQuantity: 1, image: withImage ? { url: 'https://cdn.shopify.com/p.png' } : null }, { currentQuantity: 1, image: withImage ? { url: 'https://cdn.shopify.com/p2.png' } : null }] } } } });
      const v = JSON.parse(opts.body).variables;
      if (/metafieldsSet/.test(q)) return reply(200, { data: { metafieldsSet: { metafields: (v.metafields || []).map(m => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })), userErrors: [] } } });
      if (/tagsAdd/.test(q)) return reply(200, { data: { tagsAdd: { node: { id: v.id }, userErrors: [] } } });
      return reply(200, { data: {} });
    }
    if (u.startsWith('https://cdn.shopify.com/p')) return reply(200, {});
    if (u.endsWith('/delivery-images/signed-url')) return reply(200, { data: { signedUrl: 'https://storage.googleapis.com/x?sig=1', path: 'imgs/' + (++seq) } });
    if (u.startsWith('https://storage.googleapis.com/')) return reply(putStatus, {});
    if (u.includes('/deliveries')) {
      const b = JSON.parse(opts.body);
      if (!b.deliveryImages || retryFails) return reply(400, { success: false, errorCode: 2150, message: 'Product images are required when allowToOpenPackage is enabled.' });
      return reply(201, { success: true, data: { trackingNumber: '777', _id: 'b1' } });
    }
    return reply(200, {});
  };
  return { f, log };
}
const posts = (log) => log.filter(c => c.u.includes('/deliveries') && !c.u.includes('delivery-images') && c.method === 'POST');

(async () => {
  console.log('\n① 2150 ← صورة ← إعادة إرسال ناجحة');
  { const { f, log } = mk(); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    const p = posts(log);
    ok('الرفع نجح وفيه رقم تتبع', row.status === 'success' && row.trackingNumber === '777', row);
    ok('نداءين إنشاء بس (الأول رفضه 2150 والتاني بالصورة)', p.length === 2, p.length);
    ok('أوردر بمنتجين → صورتين في deliveryImages (مش واحدة)', JSON.parse(p[1].body).deliveryImages?.[0]?.images?.length === 2, JSON.parse(p[1].body).deliveryImages);
    ok('النوع ALLOW_TO_OPEN_THE_PACKAGE', JSON.parse(p[1].body).deliveryImages[0].type === 'ALLOW_TO_OPEN_THE_PACKAGE');
    ok('⛔ allowToOpenPackage فضلت true', JSON.parse(p[1].body).allowToOpenPackage === true);
    ok('الأول من غير صور (مفيش رفع استباقي)', !JSON.parse(p[0].body).deliveryImages);
    const put = log.find(c => c.u.startsWith('https://storage.googleapis.com/'));
    ok('PUT على الرابط الموقّع', put && put.method === 'PUT'); }

  console.log('\n② مفيش صورة على شوبيفاي → خطأ واضح، ومفيش إعادة إرسال');
  { const { f, log } = mk({ withImage: false }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('error', row.status === 'error' && !row.trackingNumber, row);
    ok('الرسالة بتقول 2150 وسبب الصورة', /صورة للمنتج/.test(row.error) && /مفيش صورة/.test(row.error), row.error);
    ok('نداء إنشاء واحد بس', posts(log).length === 1); }

  console.log('\n③ PUT الصورة فشل → ما يتبعتش path وهمي');
  { const { f, log } = mk({ putStatus: 403 }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('error', row.status === 'error', row);
    ok('نداء إنشاء واحد بس — ما اتبعتش path من غير رفع ناجح', posts(log).length === 1, posts(log).length); }

  console.log('\n④ إعادة المحاولة مرة واحدة بس');
  { const { f, log } = mk({ retryFails: true }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('error', row.status === 'error', row);
    ok('نداءين بالظبط، مفيش حلقة', posts(log).length === 2, posts(log).length); }

  console.log(`\n${pass} عدّى · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
