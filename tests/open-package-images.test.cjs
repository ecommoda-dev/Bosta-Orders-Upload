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
const load = (f) => new Function('fetch', 'caches', src + '\nreturn { uploadOneRE, ensureNormalized, getJob, createDeliveryWithImages };')(f, { default: { match: async () => null, put: async () => {} } });

const D = (id, name, nameAr) => ({ id, name, nameAr, zone: 'Z', zoneAr: '', dropOff: true });
const catalog = { cities: [{ cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo', cityAr: 'القاهرة', districts: [D('c1', 'Nasr City', 'مدينة نصر')] }] };
const li = (sku, img) => ({ node: { quantity: 1, fulfillmentLineItem: { lineItem: { sku, name: sku, originalUnitPriceSet: { shopMoney: { amount: '1650' } }, image: img ? { url: img } : null } } } });
// 🔴 صور الدورة بتيجي من returnLineItems نفسها — مش من قطع الأوردر (#57833)
const order = (imgs = ['https://cdn.shopify.com/p.png', 'https://cdn.shopify.com/p2.png']) => ({ id: 'gid://shopify/Order/1', name: '#53517', note: null,
  shippingAddress: { name: 'Ahmed Ali', firstName: 'Ahmed', lastName: 'Ali', phone: '01019191915', address1: 'مدينة نصر شارع النحاس', city: 'مدينة نصر', province: 'Cairo', provinceCode: 'C' },
  customer: { phone: '01019191915' }, totalOutstandingSet: { shopMoney: { amount: '-1650' } }, outgoingItems: [],
  currentCycle: { name: '#53517-R1', returnLineItems: { edges: imgs.map((u, i) => li('A' + i, u)) } } });
const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 's.myshopify.com' };
const JOB = load(async () => reply(200, {})).getJob('return');

let seq = 0;
function mk({ withImage = true, putStatus = 200, retryFails = false, proofNotEnough = false } = {}) {
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
    // 🔴 مسار صورة الـ Return الحقيقي (مقيس من الداشبورد 22-10-2026)
    if (u.endsWith('/deliveries/signedUrl')) return reply(200, { data: { signedUrl: `https://storage.googleapis.com/bosta-files/default/BIZ/${++seq}.png?X-Goog-Signature=abc` } });
    if (u.startsWith('https://storage.googleapis.com/')) return reply(putStatus, {});
    if (u.includes('/deliveries')) {
      const b = JSON.parse(opts.body);
      const good = b.type === 25 ? (b.extraData?.businessProofOfReturnedPackages?.length && !proofNotEnough) || b.deliveryImages : b.deliveryImages;
      if (!good || retryFails) return reply(400, { success: false, errorCode: 2150, message: 'Product images are required when allowToOpenPackage is enabled.' });
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
    const b1 = JSON.parse(p[1].body);
    ok('أوردر بمنتجين → صورتين في extraData.businessProofOfReturnedPackages', b1.extraData?.businessProofOfReturnedPackages?.length === 2, b1.extraData);
    ok('imageUrl = المسار بعد bosta-files/default/ (من غير الرابط ولا التوقيع)', /^BIZ\/\d+\.png$/.test(b1.extraData.businessProofOfReturnedPackages[0].imageUrl), b1.extraData);
    ok('⛔ مفيش deliveryImages على CRP (دي بتظهر في New shipment details)', b1.deliveryImages === undefined, b1.deliveryImages);
    ok('الرفع بـ GET /deliveries/signedUrl مش POST delivery-images/signed-url', log.some(c => c.u.endsWith('/deliveries/signedUrl') && c.method === 'GET') && !log.some(c => c.u.includes('delivery-images')));
    ok('⛔ allowToOpenPackage فضلت true', JSON.parse(p[1].body).allowToOpenPackage === true);
    ok('الأول من غير صور (مفيش رفع استباقي)', !JSON.parse(p[0].body).deliveryImages);
    const put = log.find(c => c.u.startsWith('https://storage.googleapis.com/'));
    ok('PUT على الرابط الموقّع', put && put.method === 'PUT'); }

  console.log('\n② مفيش صورة على شوبيفاي → خطأ واضح، ومفيش إعادة إرسال');
  { const { f, log } = mk({ withImage: false }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order([null]), catalog, JOB, null);
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
    ok('تلات نداءات بالظبط (أصلي ← بالإثبات ← بالاتنين)، مفيش حلقة', posts(log).length === 3, posts(log).length); }

  console.log('\n⑤ #57833 — الصورة صورة المرتجع (Salomon) مش القطعة المحتفظ بيها (Columbia)');
  { const { f, log } = mk(); const api = load(f); api.ensureNormalized(catalog);
    const o = order(['https://cdn.shopify.com/p-salomon.png']);
    // قطعة العميل محتفظ بيها على الأوردر (currentQuantity 1) — كانت هي اللي بتتبعت
    o.lineItems = { edges: [{ node: { sku: 'GT1', name: 'Columbia', currentQuantity: 1, unfulfilledQuantity: 0, image: { url: 'https://cdn.shopify.com/p-columbia.png' } } }] };
    const row = await api.uploadOneRE(env, 'tok', o, catalog, JOB, null);
    const dl = log.filter(c => c.u.startsWith('https://cdn.shopify.com/')).map(c => c.u);
    ok('الرفع نجح', row.status === 'success', row.error);
    ok('اتنزّلت صورة Salomon بس', dl.length === 1 && dl[0].includes('p-salomon'), dl);
    ok('⛔ صورة Columbia ما اتنزّلتش', !dl.some(u => u.includes('columbia')), dl);
    ok('ومفيش استعلام صور الأوردر العامة', !log.some(c => c.u.includes('/admin/api/') && /OrderImages/.test(c.body || '')));
    ok('صورة واحدة في businessProofOfReturnedPackages', JSON.parse(posts(log)[1].body).extraData.businessProofOfReturnedPackages.length === 1); }

  console.log('\n⑥ type 30/10 لسه على deliveryImages (مفيش تغيير)');
  for (const t of [10, 30]) {
    const { f, log } = mk(); const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: t, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    const p = posts(log);
    ok(`type ${t}: نجح بعد نداءين`, r.ok && p.length === 2, { ok: r.ok, n: p.length });
    ok(`type ${t}: deliveryImages من غير extraData`, JSON.parse(p[1].body).deliveryImages?.[0]?.images?.length === 1 && !JSON.parse(p[1].body).extraData);
    ok(`type ${t}: استخدم delivery-images/signed-url`, log.some(c => c.u.endsWith('/delivery-images/signed-url'))); }

  console.log('\n⑦ CRP: لو بوسطة لسه رجّعت 2150 بعد الإثبات → مرة أخيرة بالاتنين + علامة imageFallback');
  { const { f, log } = mk({ proofNotEnough: true }); const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    const p = posts(log);
    ok('نجح', r.ok, r);
    ok('تلات نداءات', p.length === 3, p.length);
    const b3 = JSON.parse(p[2].body);
    ok('الأخير فيه الاتنين', !!b3.deliveryImages && b3.extraData.businessProofOfReturnedPackages.length === 1);
    ok('imageFallback ظاهر', r.imageFallback === 'deliveryImages', r.imageFallback);
    ok('⛔ allowToOpenPackage فضلت true', b3.allowToOpenPackage === true); }

  console.log('\n⑧ CRP: رابط signedUrl بشكل مختلف → خطأ واضح مش path وهمي');
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).endsWith('/deliveries/signedUrl') ? reply(200, { data: { signedUrl: 'https://storage.googleapis.com/other-bucket/x.png?s=1' } }) : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    ok('فشل برسالة واضحة', !r.ok && /مسار الملف/.test(r.imageError || ''), r.imageError); }

  console.log('\n⑨ CRP: signedUrl رجّع 400 → رسالة الخطأ فيها errorCode وسبب بوسطة');
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).endsWith('/deliveries/signedUrl') ? reply(400, { success: false, errorCode: 1234, message: 'fileType is required' }) : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    ok('فشل', !r.ok, r);
    ok('الرسالة فيها HTTP 400 وerrorCode والسبب', /HTTP 400/.test(r.imageError || '') && /1234/.test(r.imageError) && /fileType is required/.test(r.imageError), r.imageError); }
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).endsWith('/deliveries/signedUrl') ? { ok: false, status: 502, json: async () => { throw new Error('not json'); } } : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    ok('رد مش JSON → الرسالة لسه سليمة بالـ HTTP بس', /HTTP 502\)/.test(r.imageError || ''), r.imageError); }

  console.log(`\n${pass} عدّى · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
