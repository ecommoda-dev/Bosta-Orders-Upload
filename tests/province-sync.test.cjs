// ══════════════════════════════════════════════════════════════
// مزامنة محافظة الأوردر على شوبيفاي — node tests/province-sync.test.cjs
// (v2.20.0 · طلب أحمد 13-10-2026)
// لما الموظف يغيّر محافظة بوسطة يدويًا، محافظة عنوان الشحن على شوبيفاي بتتعدّل
// تلقائيًا (المحافظة بس) — بعد التحقق من قايمة شوبيفاي الحية. والفشل مش بيوقف
// الشحنة ولا بيلوّن الصف.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8').replace(/export default \{[\s\S]*$/, '');
let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
function load(fetchImpl) {
  return new Function('fetch', 'caches', src + `\n return { uploadOneRE, ensureNormalized, getJob };`)(
    fetchImpl, { default: { match: async () => null, put: async () => {} } });
}
const LIVE = [{ name: 'Cairo', code: 'C' }, { name: 'Giza', code: 'GZ' }, { name: 'Qalyubia', code: 'KB' }];
function make({ provinces = LIVE, profilesFail = false, updateErrors = [], confirmCode } = {}) {
  const log = { gql: [] };
  const impl = async (url, opts) => {
    if (String(url).includes('/admin/api/')) {
      const { query: q, variables: v } = JSON.parse(opts.body);
      log.gql.push({ q, v });
      if (/deliveryProfiles/.test(q)) {
        if (profilesFail) return reply(200, { errors: [{ message: 'Access denied for deliveryProfiles' }] });
        return reply(200, { data: { deliveryProfiles: { nodes: [{ profileLocationGroups: [{ locationGroupZones: { nodes: [
          { zone: { countries: [{ code: { countryCode: 'EG' }, provinces }] } }] } }] }] } } });
      }
      if (/orderUpdate/.test(q)) {
        const code = confirmCode ?? v.input.shippingAddress.provinceCode;
        return reply(200, { data: { orderUpdate: { order: { id: v.input.id, shippingAddress: { province: 'x', provinceCode: code } }, userErrors: updateErrors } } });
      }
      if (/metafieldsSet/.test(q)) return reply(200, { data: { metafieldsSet: { metafields: (v.metafields || []).map(m => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })), userErrors: [] } } });
      if (/tagsAdd/.test(q)) return reply(200, { data: { tagsAdd: { node: { id: v.id }, userErrors: [] } } });
      return reply(200, { data: {} });
    }
    return reply(201, { success: true, data: { trackingNumber: '555', _id: 'b1' } });
  };
  return { api: load(impl), log };
}
const D = (id, name, nameAr) => ({ id, name, nameAr, zone: 'Z', zoneAr: '', dropOff: true });
const catalog = { cities: [
  { cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo', cityAr: 'القاهرة', districts: [D('c1', 'Nasr City', 'مدينة نصر')] },
  { cityId: 'yp3atroeTwnyiBNKE', cityName: 'El Kalioubia', cityAr: 'القليوبية', districts: [D('q1', 'Banha', 'بنها')] },
]};
const order = () => ({
  id: 'gid://shopify/Order/1', name: '#59908', note: null,
  shippingAddress: { name: 'A B', firstName: 'A', lastName: 'B', phone: '01019191915', company: null,
    address1: 'مدينة نصر شارع مصطفى النحاس', address2: null, city: 'مدينة نصر', province: 'Cairo', provinceCode: 'C', countryCodeV2: 'EG', zip: '11765' },
  customer: { phone: '01019191915' }, totalOutstandingSet: { shopMoney: { amount: '-1650' } }, outgoingItems: [],
  currentCycle: { name: '#59908-R1', returnLineItems: { edges: [{ node: { quantity: 1, fulfillmentLineItem: { lineItem: { sku: 'S', name: 'S', originalUnitPriceSet: { shopMoney: { amount: '1650' } } } } } }] } },
});
const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 'shop.myshopify.com' };
const run = async (opts, override) => {
  const { api, log } = make(opts);
  api.ensureNormalized(catalog);
  const job = api.getJob('return');
  const row = await api.uploadOneRE(env, 'tok', order(), catalog, job, override);
  return { row, log };
};
const updates = (log) => log.gql.filter(c => /orderUpdate/.test(c.q));

(async () => {
  console.log('\n① محافظة بوسطة اتغيّرت → المحافظة على شوبيفاي اتعدّلت');
  { const { row, log } = await run({}, { cityId: 'yp3atroeTwnyiBNKE' });
    const u = updates(log);
    ok('orderUpdate اتبعت مرة واحدة', u.length === 1, u.length);
    ok('provinceCode = KB (نفس المحافظة بالظبط: El Kalioubia ← Qalyubia)', u[0]?.v.input.shippingAddress.provinceCode === 'KB');
    ok('باقي العنوان اتبعت كامل (مايتفضّاش)', u[0]?.v.input.shippingAddress.address1 === 'مدينة نصر شارع مصطفى النحاس' && u[0].v.input.shippingAddress.phone === '01019191915' && u[0].v.input.shippingAddress.zip === '11765' && u[0].v.input.shippingAddress.countryCode === 'EG', u[0]?.v.input.shippingAddress);
    ok('التحقق من قايمة شوبيفاي حصل قبل الكتابة', log.gql.findIndex(c => /deliveryProfiles/.test(c.q)) < log.gql.findIndex(c => /orderUpdate/.test(c.q)));
    ok('الصف success والمزامنة synced', row.status === 'success' && row.provinceSync === 'synced', [row.status, row.provinceSync]);
    ok('الملحوظة والـ action مكتوبين', row.advisories.join(' ').includes('Qalyubia') && row.actions.join(' ').includes('Cairo'), [row.advisories, row.actions]);
  }
  console.log('\n② من غير تغيير يدوي → صفر مزامنة');
  { const { row, log } = await run({}, null);
    ok('مفيش orderUpdate ولا deliveryProfiles', !updates(log).length && !log.gql.some(c => /deliveryProfiles/.test(c.q)));
    ok('provinceSync فاضي', !row.provinceSync);
  }
  console.log('\n③ المحافظة مش في قايمة شوبيفاي → مفيش كتابة');
  { const { row, log } = await run({ provinces: [{ name: 'Cairo', code: 'C' }] }, { cityId: 'yp3atroeTwnyiBNKE' });
    ok('مفيش orderUpdate', !updates(log).length);
    ok('الصف لسه success + ملحوظة بالسبب', row.status === 'success' && row.advisories.join(' ').includes('مش في قايمة'), [row.status, row.advisories]);
    ok('provinceSync = skipped', row.provinceSync === 'skipped');
  }
  console.log('\n④ القايمة ماجتش (صلاحية) → مفيش كتابة والشحنة سليمة');
  { const { row, log } = await run({ profilesFail: true }, { cityId: 'yp3atroeTwnyiBNKE' });
    ok('مفيش orderUpdate', !updates(log).length);
    ok('success والرقم اتحفظ', row.status === 'success' && row.trackingNumber === '555');
    ok('failed + الملحوظة بتقول تعذّر', row.provinceSync === 'failed' && row.advisories.join(' ').includes('تعذّر'), row.advisories);
  }
  console.log('\n⑤ orderUpdate رجّع userErrors → ملحوظة مش تحذير');
  { const { row } = await run({ updateErrors: [{ field: ['input'], message: 'nope' }] }, { cityId: 'yp3atroeTwnyiBNKE' });
    ok('الصف success (مفيش تحذير ولا إعادة رفع)', row.status === 'success' && row.warnings.length === 0, [row.status, row.warnings]);
    ok('failed + نص الخطأ ظاهر', row.provinceSync === 'failed' && row.advisories.join(' ').includes('nope'), row.advisories);
  }
  console.log('\n⑥ شوبيفاي ما أكدتش المحافظة الجديدة → failed');
  { const { row } = await run({ confirmCode: 'C' }, { cityId: 'yp3atroeTwnyiBNKE' });
    ok('failed مش synced', row.provinceSync === 'failed', row.provinceSync);
  }
  console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
