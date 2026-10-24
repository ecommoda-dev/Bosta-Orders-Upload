// ══════════════════════════════════════════════════════════════
// مسار 2150 — node tests/open-package-images.test.cjs
// بوسطة رجّعت 400 · 2150 «Product images are required when allowToOpenPackage
// is enabled» → رفع صورة المنتج وإعادة الإرسال مرة واحدة (`bosta-api-helper` 8.13).
// ⛔ ومفيش تحويل صامت لـ allowToOpenPackage:false على الشحن العادي والاستبدال.
// 🔴 CRP (25) مسار تاني (v2.25.0): من غير allowToOpenPackage + رفع صورة الراجع **قبل**
//    الإنشاء في extraData.businessProofOfReturnedPackages (مقيس 24-10-2026) — الصورة
//    تظهر تحت «Returned shipment details» بس. 2150 بقى احتياطي نادر.
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
    // 🔴 بوسطة بترفض الطلب من غير type (400 · 777 · type is required) — مقيس 22-10-2026
    if (u.split('?')[0].endsWith('/deliveries/signedUrl') && !/[?&]type=businessProofOfReturnedPackages(&|$)/.test(u)) return reply(400, { success: false, errorCode: 777, message: 'type is required' });
    if (u.split('?')[0].endsWith('/deliveries/signedUrl')) return reply(200, { data: { signedUrl: `https://storage.googleapis.com/bosta-files/default/BIZ/${++seq}.png?X-Goog-Signature=abc` } });
    if (u.startsWith('https://storage.googleapis.com/')) return reply(putStatus, {});
    if (u.includes('/deliveries')) {
      const b = JSON.parse(opts.body);
      // 🔴 سلوك بوسطة المقيس 24-10-2026: CRP + allowToOpenPackage:true من غير deliveryImages = 2150،
      //    والفلاج false/غايب = 201 (الصورة في extraData.businessProofOfReturnedPackages بتتقبل).
      //    `proofNotEnough` = بوسطة غيّرت السلوك وبقت تطلب deliveryImages على CRP كمان.
      const needsDI = b.type === 25 ? (b.allowToOpenPackage === true || proofNotEnough) : true;
      if ((needsDI && !b.deliveryImages) || retryFails) return reply(400, { success: false, errorCode: 2150, message: 'Product images are required when allowToOpenPackage is enabled.' });
      return reply(201, { success: true, data: { trackingNumber: '777', _id: 'b1' } });
    }
    return reply(200, {});
  };
  return { f, log };
}
const posts = (log) => log.filter(c => c.u.includes('/deliveries') && !c.u.includes('delivery-images') && c.method === 'POST');

(async () => {
  console.log('\n① CRP: الصورة بتترفع قبل الإنشاء، من غير allowToOpenPackage، ونداء إنشاء واحد');
  { const { f, log } = mk(); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    const p = posts(log);
    ok('الرفع نجح وفيه رقم تتبع', row.status === 'success' && row.trackingNumber === '777', row);
    ok('نداء إنشاء واحد بس (مفيش 2150 ولا إعادة)', p.length === 1, p.length);
    const b1 = JSON.parse(p[0].body);
    ok('أوردر بمنتجين → صورتين في extraData.businessProofOfReturnedPackages', b1.extraData?.businessProofOfReturnedPackages?.length === 2, b1.extraData);
    ok('imageUrl = المسار بعد bosta-files/default/ (من غير الرابط ولا التوقيع)', /^BIZ\/\d+\.png$/.test(b1.extraData.businessProofOfReturnedPackages[0].imageUrl), b1.extraData);
    ok('⛔ مفيش deliveryImages على CRP (دي بتظهر في New shipment details)', b1.deliveryImages === undefined, b1.deliveryImages);
    ok('🔴 مفيش allowToOpenPackage في جسم CRP خالص (زي الداشبورد)', !('allowToOpenPackage' in b1), Object.keys(b1));
    ok('الرفع بـ GET /deliveries/signedUrl مش POST delivery-images/signed-url', log.some(c => c.u.split('?')[0].endsWith('/deliveries/signedUrl') && c.method === 'GET') && !log.some(c => c.u.includes('delivery-images')));
    const put = log.find(c => c.u.startsWith('https://storage.googleapis.com/'));
    ok('PUT على الرابط الموقّع', put && put.method === 'PUT');
    ok('الرفع الاستباقي قبل الإنشاء', log.findIndex(c => c.u.startsWith('https://storage.googleapis.com/')) < log.findIndex(c => c.u.includes('/deliveries') && c.method === 'POST' && !c.u.includes('signed')));
    ok('proofImage = proof (بيتسجّل في D1)', row.proofImage === 'proof', row.proofImage);
    ok('مفيش ملحوظة صورة', !(row.advisories || []).some(a => /صورة/.test(a)), row.advisories); }

  console.log('\n② CRP: مفيش صورة على شوبيفاي → الشحنة بتتعمل من غير صورة + ملحوظة (قرار أحمد 24-10-2026)');
  { const { f, log } = mk({ withImage: false }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order([null]), catalog, JOB, null);
    ok('success وفيه رقم تتبع', row.status === 'success' && row.trackingNumber === '777', row);
    ok('نداء إنشاء واحد بس', posts(log).length === 1);
    ok('من غير extraData', JSON.parse(posts(log)[0].body).extraData === undefined);
    ok('ملحوظة (advisory) مش تحذير', (row.advisories || []).some(a => /من غير صورة الراجع/.test(a) && /مفيش صورة/.test(a)) && !(row.warnings || []).length, { adv: row.advisories, warn: row.warnings });
    ok('proofImage = none', row.proofImage === 'none', row.proofImage); }

  console.log('\n③ CRP: PUT الصورة فشل → ما يتبعتش path وهمي، والشحنة تتعمل بملحوظة');
  { const { f, log } = mk({ putStatus: 403 }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('success', row.status === 'success', row);
    ok('نداء إنشاء واحد بس', posts(log).length === 1, posts(log).length);
    ok('⛔ ما اتبعتش path وهمي (من غير extraData)', JSON.parse(posts(log)[0].body).extraData === undefined);
    ok('الملحوظة بتقول رفع الصورة فشل (HTTP 403)', (row.advisories || []).some(a => /رفع الصورة لبوسطة فشل/.test(a) && /403/.test(a)), row.advisories);
    ok('proofImage = none', row.proofImage === 'none'); }

  console.log('\n④ CRP: بوسطة لسه 2150 دايمًا → إعادة واحدة بالاتنين وبس، مفيش حلقة');
  { const { f, log } = mk({ retryFails: true }); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('error', row.status === 'error', row);
    ok('نداءين بالظبط (بالإثبات ← بالاتنين)، مفيش حلقة', posts(log).length === 2, posts(log).length); }

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
    ok('صورة واحدة في businessProofOfReturnedPackages', JSON.parse(posts(log)[0].body).extraData.businessProofOfReturnedPackages.length === 1); }

  console.log('\n⑥ type 30/10 لسه على deliveryImages والفلاج true (مفيش تغيير)');
  for (const t of [10, 30]) {
    const { f, log } = mk(); const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: t, allowToOpenPackage: true }, true, ['https://cdn.shopify.com/p.png']);
    const p = posts(log);
    ok(`type ${t}: نجح بعد نداءين`, r.ok && p.length === 2, { ok: r.ok, n: p.length });
    ok(`type ${t}: deliveryImages من غير extraData`, JSON.parse(p[1].body).deliveryImages?.[0]?.images?.length === 1 && !JSON.parse(p[1].body).extraData);
    ok(`type ${t}: allowToOpenPackage فضلت true`, JSON.parse(p[1].body).allowToOpenPackage === true);
    ok(`type ${t}: استخدم delivery-images/signed-url`, log.some(c => c.u.endsWith('/delivery-images/signed-url'))); }

  console.log('\n⑦ CRP: بوسطة بقت تطلب deliveryImages حتى من غير الفلاج → مرة أخيرة بالاتنين + imageFallback');
  { const { f, log } = mk({ proofNotEnough: true }); const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25 }, true, ['https://cdn.shopify.com/p.png']);
    const p = posts(log);
    ok('نجح', r.ok, r);
    ok('نداءين (بالإثبات ← بالاتنين)', p.length === 2, p.length);
    const b2 = JSON.parse(p[1].body);
    ok('الأخير فيه الاتنين', !!b2.deliveryImages && b2.extraData.businessProofOfReturnedPackages.length === 1);
    ok('imageFallback ظاهر', r.imageFallback === 'deliveryImages', r.imageFallback);
    ok('⛔ ومفيش allowToOpenPackage اتضاف', !('allowToOpenPackage' in b2)); }

  console.log('\n⑦ب CRP بفلاج true (شحنة A في تجربة 24-10) → 2150 ثم الاحتياطي، ملحوظة بتبان في الصف');
  { const { f, log } = mk({ proofNotEnough: true }); const api = load(f); api.ensureNormalized(catalog);
    const o = order();
    // بنحاكي بوسطة اللي بقت تطلب deliveryImages: الصف لازم يطلع ملحوظة imageFallback
    const row = await api.uploadOneRE(env, 'tok', o, catalog, JOB, null);
    ok('success', row.status === 'success', row);
    ok('proofImage = both', row.proofImage === 'both', row.proofImage);
    ok('ملحوظة إن الصورة في المكانين', (row.advisories || []).some(a => /New shipment details/.test(a) && /Returned shipment details/.test(a)), row.advisories);
    ok('والصف لسه أخضر (مفيش warnings)', !(row.warnings || []).length, row.warnings); }

  console.log('\n⑧ CRP: رابط signedUrl بشكل مختلف → ما يتبعتش path وهمي، والشحنة تتعمل بملحوظة واضحة');
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).split('?')[0].endsWith('/deliveries/signedUrl') ? reply(200, { data: { signedUrl: 'https://storage.googleapis.com/other-bucket/x.png?s=1' } }) : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25 }, true, ['https://cdn.shopify.com/p.png']);
    ok('الشحنة اتعملت من غير صورة', r.ok && /مسار الملف/.test(r.imageNote || ''), r); }

  console.log('\n⑨ CRP: signedUrl رجّع 400 → ملحوظة فيها errorCode وسبب بوسطة (v2.24.1)');
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).split('?')[0].endsWith('/deliveries/signedUrl') ? reply(400, { success: false, errorCode: 1234, message: 'fileType is required' }) : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25 }, true, ['https://cdn.shopify.com/p.png']);
    ok('الشحنة اتعملت', r.ok, r);
    ok('الملحوظة فيها HTTP 400 وerrorCode والسبب', /HTTP 400/.test(r.imageNote || '') && /1234/.test(r.imageNote) && /fileType is required/.test(r.imageNote), r.imageNote); }
  { const f0 = mk().f; const f = async (url, o = {}) => String(url).split('?')[0].endsWith('/deliveries/signedUrl') ? { ok: false, status: 502, json: async () => { throw new Error('not json'); } } : f0(url, o);
    const api = load(f);
    const r = await api.createDeliveryWithImages(env, 'tok', { id: 'gid://shopify/Order/1' }, { type: 25 }, true, ['https://cdn.shopify.com/p.png']);
    ok('رد مش JSON → الملحوظة لسه سليمة بالـ HTTP بس', /HTTP 502\)/.test(r.imageNote || ''), r.imageNote); }

  console.log('\n⑩ signedUrl بيتنده بـ ?type=businessProofOfReturnedPackages (نفس قيمة الداشبورد — مقيس 24-10)');
  { const { f, log } = mk(); const api = load(f); api.ensureNormalized(catalog);
    const row = await api.uploadOneRE(env, 'tok', order(), catalog, JOB, null);
    ok('نجح', row.status === 'success', row.error);
    ok('الطلب فيه type=businessProofOfReturnedPackages', log.some(c => /\/deliveries\/signedUrl\?type=businessProofOfReturnedPackages$/.test(c.u)), log.map(c => c.u));
    ok('⛔ مفيش return_prf', !log.some(c => /return_prf/.test(c.u))); }

  // ─── الاستبدال (v2.26.0) ───
  const exOrder = () => { const o = order(['https://cdn.shopify.com/ret1.png', 'https://cdn.shopify.com/ret2.png']);
    o.outgoingItems = [{ label: 'SKU-B', qty: 1, unitPrice: 2400, imageUrl: 'https://cdn.shopify.com/out1.png' }];
    return o; };

  console.log('\n⑪ الاستبدال: صورة الراجع قبل الإنشاء (proof) + الفلاج true + صورة الخارج على 2150');
  { const { f, log } = mk(); const api = load(f); api.ensureNormalized(catalog);
    const JOBX = api.getJob('exchange');
    const row = await api.uploadOneRE(env, 'tok', exOrder(), catalog, JOBX, null);
    const p = posts(log);
    ok('نجح', row.status === 'success' && row.trackingNumber === '777', row);
    ok('نداءين إنشاء (الأول 2150 ثم بـ deliveryImages)', p.length === 2, p.length);
    const b1 = JSON.parse(p[0].body), b2 = JSON.parse(p[1].body);
    ok('الأول: الراجع في extraData (صورتين) ومن غير deliveryImages', b1.extraData?.businessProofOfReturnedPackages?.length === 2 && b1.deliveryImages === undefined, b1);
    ok('⛔ الفلاج true زي ما هو (قرار 13-09)', b1.allowToOpenPackage === true && b2.allowToOpenPackage === true);
    ok('التاني: deliveryImages (الخارج) + الراجع لسه موجود', b2.deliveryImages?.[0]?.images?.length === 1 && b2.extraData?.businessProofOfReturnedPackages?.length === 2, b2);
    const dl = log.filter(c => c.u.startsWith('https://cdn.shopify.com/')).map(c => c.u);
    ok('deliveryImages من صورة الخارج، وproof من الراجع', dl.some(u => u.includes('out1')) && dl.filter(u => u.includes('ret')).length === 2, dl);
    ok('proof اتجاب بـ ?type=businessProofOfReturnedPackages', log.some(c => /\/deliveries\/signedUrl\?type=businessProofOfReturnedPackages$/.test(c.u)));
    ok('proofImage = proof ومفيش ملحوظة', row.proofImage === 'proof' && !(row.advisories || []).some(a => /صورة/.test(a)), { pi: row.proofImage, adv: row.advisories }); }

  console.log('\n⑫ الاستبدال: رفع صورة الراجع فشل → الشحنة تتعمل بصورة الخارج بس + ملحوظة');
  { const { f, log } = mk();
    const f2 = async (url, o = {}) => String(url).split('?')[0].endsWith('/deliveries/signedUrl') ? reply(400, { success: false, errorCode: 1234, message: 'boom' }) : f(url, o);
    const api2 = load(f2); api2.ensureNormalized(catalog);
    const row = await api2.uploadOneRE(env, 'tok', exOrder(), catalog, api2.getJob('exchange'), null);
    const p = posts(log);
    ok('success (الشحنة مش بتقع بسبب صورة الراجع)', row.status === 'success', row);
    ok('⛔ من غير extraData في أي طلب (ما اتبعتش path وهمي)', p.length > 0 && p.every(c => JSON.parse(c.body).extraData === undefined), p.map(c => JSON.parse(c.body).extraData));
    ok('صورة الخارج اتبعتت (deliveryImages)', JSON.parse(p[p.length - 1].body).deliveryImages?.[0]?.images?.length === 1);
    ok('ملحوظة advisory فيها السبب', (row.advisories || []).some(a => /من غير صورة الراجع/.test(a) && /boom/.test(a)), row.advisories);
    ok('proofImage = none', row.proofImage === 'none'); }

  console.log(`\n${pass} عدّى · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();
