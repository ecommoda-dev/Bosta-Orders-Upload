// ══════════════════════════════════════════════════════════════
// مسار الرفع كامل — node tests/upload-flow.test.cjs
//
// بيشغّل `uploadOne` على fetch مزيّف بيقلّد ردود بوسطة الحقيقية المقيسة.
// الملف ده بيغطي اللحظة اللي بتتصرف فيها فلوس، والقاعدة اللي بتحكمها:
// 🔴 بعد ما الشحنة تتعمل، أي فشل بعدها = warning مش error — لأن الأحمر
//    بيخلي الموظف يعيد الرفع، وإعادة الرفع = شحنة تانية بفلوس حقيقية.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/export default \{[\s\S]*$/, '');

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}

// كل تشغيل بياخد fetch مزيّف خاص بيه
function load(fetchImpl) {
  return new Function('fetch', 'caches', src + `
    return { uploadOneRE, ensureNormalized, runUploadBatchRE, getJob };`)(
      fetchImpl, { default: { match: async () => null, put: async () => {} } });
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

// v2.0.0 — الرفع بقى بيكتب على شوبيفاي بعد الشحنة (رقم التتبع S2 + التاج)،
// فالـ fetch المزيّف لازم يفرّق بين المضيفين. نداء شوبيفاي بينجح افتراضيًا؛
// الاختبار اللي عايز يفشّله بيبعت `shopify` خاص بيه.
function router(bosta, shopify) {
  return async (url, opts) => {
    if (String(url).includes('/admin/api/')) {
      const q = JSON.parse(opts.body).query;
      if (shopify) return shopify(q, JSON.parse(opts.body).variables, opts);
      const vars = JSON.parse(opts.body).variables;
      if (/metafieldsSet/.test(q)) {
        return reply(200, { data: { metafieldsSet: {
          metafields: (vars.metafields || []).map((m) => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
          userErrors: [],
        } } });
      }
      if (/tagsAdd/.test(q)) return reply(200, { data: { tagsAdd: { node: { id: vars.id }, userErrors: [] } } });
      return reply(200, { data: {} });
    }
    return bosta(url, opts);
  };
}

const D = (id, name, nameAr, zone = 'Z') => ({ id, name, nameAr, zone, zoneAr: '', dropOff: true });
const catalog = { cities: [
  { cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo', cityAr: 'القاهرة', districts: [
      D('c1', 'Nasr City', 'مدينة نصر'), D('c3', 'Heliopolis', 'مصر الجديدة')] },
  { cityId: 'yp3atroeTwnyiBNKE', cityName: 'El Kalioubia', cityAr: 'القليوبية', districts: [D('q1', 'Banha', 'بنها')] },
]};

function order(over = {}) {
  return {
    id: 'gid://shopify/Order/1', name: '#53517', note: null,
    shippingAddress: {
      name: 'Ahmed Ali', firstName: 'Ahmed', lastName: 'Ali', phone: '01019191915',
      address1: 'مدينة نصر شارع مصطفى النحاس', address2: null,
      city: 'مدينة نصر', province: 'Cairo', provinceCode: 'C',
    },
    customer: { phone: '01019191915' },
    totalOutstandingSet: { shopMoney: { amount: '-1650' } },
    outgoingItems: [],
    currentCycle: { name: '#53517-R1', returnLineItems: { edges: [
      { node: { quantity: 1, fulfillmentLineItem: { lineItem: { sku: 'SKU-A', name: 'SKU-A', originalUnitPriceSet: { shopMoney: { amount: '1650' } } } } } },
    ]}},
    ...over,
  };
}
// 🔴 الـ job الحقيقي من الـ Worker، مش كائن مكتوب بالإيد — هو اللي بيحمل
//    `trackingMf` و`tag` و`isRE`، وكتابة واحدة منهم غلط هنا كانت هتخلي
//    الاختبار يعدّي على سلوك الأداة مش سلوكها الحقيقي.
const JOB = load(async () => reply(200, {})).getJob('return');
const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 'shop.myshopify.com' };
const TOKEN = 'tok';

// ─── ① نجاح عادي ─────────────────────────────────────────────
console.log('\n① رفع ناجح على العقد الموثّق');
{
  const calls = [];
  const api = load(router(async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return reply(201, { success: true, data: { trackingNumber: '123456789', _id: 'x1' } }); }));
  api.ensureNormalized(catalog);
  return_(api, calls);
}
function return_(api, calls) {
  api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('الحالة success', row.status === 'success', row);
    ok('رقم التتبع اتقرا', row.trackingNumber === '123456789');
    ok('العقد الموثّق (?apiVersion=1) لأن المنطقة اتطابقت', calls[0].url.includes('apiVersion=1'), calls[0].url);
    ok('العنوان راح لـ pickupAddress (CRP)', !!calls[0].body.pickupAddress && !calls[0].body.dropOffAddress);
    ok('الـ cod سالب زي ما هو', calls[0].body.cod === -1650, calls[0].body.cod);
    run2();
  });
}

// ─── ② 3003 → رجوع تلقائي لمسار المحافظة ────────────────────
function run2() {
  console.log('\n② بوسطة رفضت المنطقة (3003) — الرجوع التلقائي');
  const calls = [];
  const api = load(router(async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    if (calls.length === 1) return reply(400, { success: false, errorCode: '3003', message: 'District Not Found' });
    return reply(201, { success: true, data: { trackingNumber: '999', _id: 'x2' } });
  }));
  api.ensureNormalized(catalog);
  api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('نداءين: الموثّق ثم غير الموثّق', calls.length === 2 && calls[0].url.includes('apiVersion=1') && !calls[1].url.includes('apiVersion=1'));
    // 🔴 v2.7.0: النزول درجة **ملحوظة مش تحذير** — الشحنة اتعملت كاملة ومفيش
    //    حاجة ناقصة ولا تدخّل مطلوب، فالصف أخضر والملحوظة جنبه.
    ok('النتيجة success — الشحنة اتعملت وكل حاجة تمّت', row.status === 'success', row.status);
    ok('ومفيش تحذير نقص', row.warnings.length === 0, row.warnings);
    ok('والسبب مكتوب للموظف كملحوظة', (row.advisories[0] || '').includes('المحافظة'), row.advisories);
    ok('النداء التاني بعت المدينة بالاسم بس', calls[1].body.pickupAddress.districtId === undefined);
    // 🔴 المقارنة بالرقم 3003 بدل النص كانت هتخلي الرجوع ده ما يحصلش خالص
    ok('errorCode اتقارن كنص', row.trackingNumber === '999');
    run3();
  });
}

// ─── ③ 11000 — الحاجز ضد الشحنة المكررة ─────────────────────
function run3() {
  console.log('\n③ 11000 — الدورة مرفوعة قبل كده');
  const api = load(router(async () => reply(400, { success: false, errorCode: '11000', message: 'duplicate key' })));
  api.ensureNormalized(catalog);
  api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('error — ومفيش شحنة اتعملت', row.status === 'error' && row.trackingNumber === null);
    ok('والرسالة بتقول للموظف يعمل إيه (يلغي الأول)', row.error.includes('ألغيها') && row.error.includes('مرفوعة'), row.error);
    run4();
  });
}

// ─── ④ 500 من غير errorCode ─────────────────────────────────
function run4() {
  console.log('\n④ 500 من غير errorCode — الشكل اللي بوسطة بترده على عنوان في الحقل الغلط');
  const api = load(router(async () => reply(500, { message: "Cannot read properties of undefined (reading 'city')" })));
  api.ensureNormalized(catalog);
  api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('اتعامل معاه من غير ما يقع', row.status === 'error');
    ok('والرسالة بتقول متعيدش المحاولة', row.error.includes('بلّغ') && row.error.includes('500'), row.error);
    run5();
  });
}

// ─── ⑤ التعديل اليدوي ───────────────────────────────────────
function run5() {
  console.log('\n⑤ التعديل اليدوي — بيوقف مش بيرجع في صمت');
  const api = load(router(async () => reply(201, { success: true, data: { trackingNumber: '1', _id: 'y' } })));
  api.ensureNormalized(catalog);

  api.uploadOneRE(env, TOKEN, order(), catalog, JOB, { districtId: 'NOT-REAL' }).then((row) => {
    // 🔴 لو رجع للمطابقة التلقائية في صمت، الشحنة بتروح لعنوان الموظف ما وافقش عليه
    ok('منطقة مش موجودة = وقف صريح', row.status === 'error' && row.error.includes('اتوقف'), row.error);
    return api.uploadOneRE(env, TOKEN, order(), catalog, JOB, { cityId: 'NOT-REAL' });
  }).then((row) => {
    ok('مدينة مش في الكتالوج = وقف كمان', row.status === 'error' && row.error.includes('الرفع اتوقف'));
    return run6();
  });
}

// ─── ⑥ تغيير المدينة يدويًا ─────────────────────────────────
function run6() {
  console.log('\n⑥ تغيير المدينة يدويًا — الرجوع بيمسك المدينة المعدّلة');
  const calls = [];
  const api = load(router(async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return reply(201, { success: true, data: { trackingNumber: '77', _id: 'z' } }); }));
  api.ensureNormalized(catalog);
  return api.uploadOneRE(env, TOKEN, order(), catalog, JOB, { cityId: 'yp3atroeTwnyiBNKE' }).then((row) => {
    ok('المدينة اللي اتبعتت هي المعدّلة', calls[0].body.pickupAddress.city === 'El Kalioubia', calls[0].body.pickupAddress.city);
    ok('واتسجّل إن الموظف غيّرها (قياس city_overridden)', row.cityOverridden === true);
    ok('والمدينة التلقائية اتسجّلت جنبها للمقارنة', row.cityAuto === 'Cairo');
    // 🔴 v2.7.0: توثيق لفعل الموظف نفسه — بيبان كملحوظة، مش بيصفّر الصف.
    ok('success — التغيير اليدوي مش نقص في العملية', row.status === 'success', row.status);
    ok('وبيبان في الملحوظات', (row.advisories.join(' ')).includes('اتغيّرت يدويًا'), row.advisories);
    ok('واتحوّل لمسار المحافظة (المنطقة القديمة مش تابعة للمدينة الجديدة)', calls[0].body.pickupAddress.districtId === undefined);
    return run7();
  });
}

// ─── ⑦ التوازي بيحافظ على الترتيب ───────────────────────────
function run7() {
  console.log('\n⑦ عقد الترتيب — النتايج بترجع بترتيب الإدخال');
  let n = 0;
  const api = load(router(async () => {
    const i = ++n;
    // ردود بترجع بترتيب مقلوب عمدًا
    await new Promise((r) => setTimeout(r, (6 - i) * 8));
    // 🔴 أرقام حقيقية عن قصد: `custom.bosta_tracking_number_s2` نوعه
    //    `number_integer`، ورقم فيه حروف بيتسقّط بتحذير — ده متغطّى في ⑩.
    return reply(201, { success: true, data: { trackingNumber: `10000${i}`, _id: `i${i}` } });
  }));
  api.ensureNormalized(catalog);
  const orders = [1, 2, 3, 4, 5].map((k) => order({ name: `#${k}`, currentCycle: { name: `#${k}-R1`, returnLineItems: order().currentCycle.returnLineItems } }));
  // ⚠️ v2.0.0: الحقل بقى `orderNumber` مش `orderName` — الصف بقى **بنفس شكل**
  //    صف s1 عشان الجدول ونافذة المنطقة يبقوا كود واحد للتلات أوضاع.
  return api.runUploadBatchRE(env, TOKEN, orders, catalog, JOB, {}).then((rows) => {
    ok('results[i] بتخص orders[i] مهما كان ترتيب الانتهاء',
       rows.map((r) => r.orderNumber).join(',') === '#1,#2,#3,#4,#5', rows.map((r) => r.orderNumber));
    ok('وكلهم نجحوا', rows.every((r) => r.status === 'success'), rows.map((r) => r.status + ':' + (r.error || r.warnings.join('|'))));
    run8();
  });
}

// ─── ⑧ الكتابة الرجعية على شوبيفاي — جديدة في v2.0.0 ─────────
// 🔴 التلات تأكيدات دول هما طلب أحمد مع الدمج بالظبط:
//    رقم التتبع في `_s2` مش في الميتافيلد القديم · التاج S2 مش S1 ·
//    و`custom.courier` **مابيتكتبش** خالص على الاسترجاع/الاستبدال.
function run8() {
  console.log('\n⑧ الكتابة الرجعية بعد الشحنة (v2.0.0)');
  const gql = [];
  const api = load(router(
    async () => reply(201, { success: true, data: { trackingNumber: '556677', _id: 'w1' } }),
    (q, vars) => {
      gql.push({ q, vars });
      if (/metafieldsSet/.test(q)) {
        return reply(200, { data: { metafieldsSet: {
          metafields: (vars.metafields || []).map((m) => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
          userErrors: [],
        } } });
      }
      return reply(200, { data: { tagsAdd: { node: { id: vars.id }, userErrors: [] } } });
    }));
  api.ensureNormalized(catalog);
  return api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    const mf = gql.find((c) => /metafieldsSet/.test(c.q))?.vars.metafields || [];
    const keys = mf.map((m) => m.key);
    ok('رقم التتبع اتكتب في custom.bosta_tracking_number_s2', keys.includes('bosta_tracking_number_s2'));
    ok('ومش في الميتافيلد القديم ولا بتاع S1',
       !keys.includes('bosta_tracking_number') && !keys.includes('bosta_tracking_number_s1'), keys);
    // 🔴 شحنة استرجاع بتسحب من عند العميل — كتابة الكوريَر هنا معناها إننا
    //    بنعيّن مندوب على أوردر مش بتاعنا بدل ما نتأكد إنه بتاعنا.
    ok('و custom.courier مااتكتبش خالص', !keys.includes('courier'), keys);
    ok('النوع المبعوت number_integer (تطابق حرفي وإلا النداء كله بيسقط)',
       mf.find((m) => m.key === 'bosta_tracking_number_s2')?.type === 'number_integer');
    const tag = gql.find((c) => /tagsAdd/.test(c.q))?.vars.tags || [];
    ok('التاج Bosta_Uploaded_S2 مش S1', tag.includes('Bosta_Uploaded_S2') && !tag.includes('Bosta_Uploaded_S1'), tag);
    ok('والصف فضل success', row.status === 'success', row);
    return run9();
  });
}

// ─── ⑨ الكتابة الرجعية فشلت — الشحنة موجودة ─────────────────
// 🔴 القاعدة اللي الملف ده كله موجود عشانها: بعد ما الشحنة تتعمل، أي فشل
//    بعدها **warning مش error**. الأحمر بيخلي الموظف يرفع تاني = شحنة تانية بفلوس.
function run9() {
  console.log('\n⑨ فشل الكتابة على شوبيفاي بعد نجاح الشحنة');
  const api = load(router(
    async () => reply(201, { success: true, data: { trackingNumber: '889900', _id: 'w2' } }),
    () => reply(500, { errors: [{ message: 'Shopify down' }] })));
  api.ensureNormalized(catalog);
  return api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('warning مش error — الشحنة موجودة عند بوسطة', row.status === 'warning', row.status);
    ok('ورقم التتبع محفوظ في الصف عشان الموظف يلاقيه', row.trackingNumber === '889900');
    ok('واتعلّم إنها كتابة رجعية فشلت مش رفع فشل', row.shopifyWriteFailed === true);
    ok('والتحذير بيقول صراحةً متعيدش الرفع', (row.warnings.join(' ')).includes('متعيدش الرفع'), row.warnings);
    return run10();
  });
}

// ─── ⑩ رقم تتبع مش أرقام بس ─────────────────────────────────
// 🔴 `metafieldsSet` بيطلب تطابق النوع بالحرف مع التعريف الحي، واختلافه بيسقّط
//    **النداء كله**. الأداة بتسقّط الحقل لوحده بتحذير بدل ما تخسر النداء —
//    والتاج بيتحط برضه، فالصف مايبانش «مش مرفوع» في الفحص الجاي.
function run10() {
  console.log('\n⑩ رقم تتبع فيه حروف — الحقل بيتسقّط لوحده مش النداء كله');
  const gql = [];
  const api = load(router(
    async () => reply(201, { success: true, data: { trackingNumber: 'TN-77', _id: 'w3' } }),
    (q, vars) => {
      gql.push({ q, vars });
      if (/metafieldsSet/.test(q)) {
        return reply(200, { data: { metafieldsSet: {
          metafields: (vars.metafields || []).map((m) => ({ key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
          userErrors: [],
        } } });
      }
      return reply(200, { data: { tagsAdd: { node: { id: vars.id }, userErrors: [] } } });
    }));
  api.ensureNormalized(catalog);
  return api.uploadOneRE(env, TOKEN, order(), catalog, JOB, null).then((row) => {
    ok('warning مش error — الشحنة موجودة', row.status === 'warning', row.status);
    ok('التحذير بيسمّي السبب', (row.warnings.join(' ')).includes('number_integer'), row.warnings);
    ok('والتاج اتحط برضه — الصف مش هيبان «مش مرفوع» تاني',
       (gql.find((c) => /tagsAdd/.test(c.q))?.vars.tags || []).includes('Bosta_Uploaded_S2'));
    return run11();
  });
}

// ─── ⑪ قص المبلغ عند حد بوسطة — ملحوظة مش تحذير (v2.7.0) ─────
// 🔴 الحالة اللي التعديل ده اتعمل عشانها بالظبط (`#54618`): الشحنة اتعملت،
//    رقم التتبع اتكتب، الحالة اتحدّثت، التاج اتحط — **كل حاجة تمّت** — والصف
//    كان بياخد «⚠ تم جزئيًا» لمجرد إن مستحق العميل 2,700 اتقص عند حد بوسطة
//    2,000. الأصفر في الأداة دي معناه «شحنة بفلوس وحاجة ناقصة — متعيدش
//    الرفع»، فالأصفر الكذّاب بيعلّم الموظف يعدّي على الأصفر الحقيقي.
function run11() {
  console.log('\n⑪ القص عند حد بوسطة — الصف أخضر والملحوظة باقية');
  const calls = [];
  const api = load(router(async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return reply(201, { success: true, data: { trackingNumber: '1513632634', _id: 'c1' } });
  }));
  api.ensureNormalized(catalog);
  const clipped = order({ totalOutstandingSet: { shopMoney: { amount: '-2700' } },
    currentCycle: { name: '#54618-R1', returnLineItems: order().currentCycle.returnLineItems } });
  return api.uploadOneRE(env, TOKEN, clipped, catalog, JOB, null).then((row) => {
    ok('المبلغ اتقص عند -2000 (حد بوسطة 3008)', calls[0].cod === -2000, calls[0].cod);
    ok('واتعلّم في الصف', row.codClipped === true && row.codRemainder === 700, row.codRemainder);
    ok('🔴 الحالة success — مفيش حاجة ناقصة', row.status === 'success', row.status);
    ok('ومفيش تحذير خالص', row.warnings.length === 0, row.warnings);
    // ⚠️ الملحوظة **مش بتتشال** — الباقي 700 فلوس بيتسوّى مكتبيًا، والرقم
    //    لازم يفضل قدام الموظف. الفرق في اللون بس.
    ok('والملحوظة فيها الرقمين', (row.advisories.join(' ')).includes('2,700')
       && (row.advisories.join(' ')).includes('700'), row.advisories);
    return run12();
  });
}

// ─── ⑫ قص + فشل كتابة مع بعض — التحذير هو اللي بيحكم ────────
// 🔴 الفصل مش «ملحوظة بدل تحذير» — ده **قايمتين مستقلتين**. صف عليه الاتنين
//    لازم يفضل أصفر: فيه حاجة ناقصة فعلًا، والملحوظة جنبها مش بدالها.
function run12() {
  console.log('\n⑫ قص + فشل الكتابة على شوبيفاي — الأصفر لسه بيكسب');
  const api = load(router(
    async () => reply(201, { success: true, data: { trackingNumber: '445566', _id: 'c2' } }),
    () => reply(500, { errors: [{ message: 'Shopify down' }] })));
  api.ensureNormalized(catalog);
  const clipped = order({ totalOutstandingSet: { shopMoney: { amount: '-2700' } },
    currentCycle: { name: '#54618-R2', returnLineItems: order().currentCycle.returnLineItems } });
  return api.uploadOneRE(env, TOKEN, clipped, catalog, JOB, null).then((row) => {
    ok('warning — الكتابة الرجعية فشلت', row.status === 'warning', row.status);
    ok('والتحذير بيقول متعيدش الرفع', (row.warnings.join(' ')).includes('متعيدش الرفع'), row.warnings);
    ok('والملحوظة موجودة جنبه مش بداله', (row.advisories.join(' ')).includes('حد بوسطة'), row.advisories);
    done();
  });
}

function done() {
  console.log(`\n${'═'.repeat(50)}\nنجح ${pass} · فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
}
