// ══════════════════════════════════════════════════════════════
// تغطية بوسطة · درجة العنوان · حراس القيمة — node tests/coverage-and-degree.test.cjs
//
// الملف ده بيقفل البنود اللي `bosta-api-helper` v3.0.0 → v5.0.0 جابتها، وكل
// واحد فيهم كان بيكلّف فلوس حقيقية أو بيخفي معلومة عن الموظف:
//   ① المنطقة المقفولة للتسليم كانت بتتشال **بصمت** — فالموظف يرفع على
//      المحافظة فاكرها احتياطي، والشحنة تتشحن وترجع (8.11)
//   ② درجة الزون ماكانتش موجودة أصلًا — الكتالوج كان بيرمي `zoneId`، فالأوردر
//      بينزل للمحافظة وياخد **هب افتراضي** بدل هب الزون (8.5 درجة ٤ · 8.10)
//   ③ مفيش حارس على `goodsInfo.amount` — خارج `100`–`50000` بيرجّع 400 ·
//      `41591` برسالة عن «قيمة الطرد» مش عن حد (8.4)
//   ④ `Math.abs` على cod الشحن العادي كان بيحوّل «دفع زيادة» لـ«حصّل منه»
//   ⑤ الإلغاء المكرر (404 · 1066) كان بيتعرض «فشل» على شحنة اتلغت فعلًا (8.7)
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
  .replace(/export default \{[\s\S]*$/, '');
const api = new Function(src + `
 return { normalizeCatalog, availableDistricts, ensureNormalized, resolveAddress,
          buildAddressObject, addressDegree, nextAddressDegree, goodsProblems,
          coverageProblems, validateOrder, buildDeliveryPayload, humanizeBostaError,
          terminateDelivery, buildRow, resolveZoneOverride, uploadOne, logRow,
          GOODS_MIN, GOODS_MAX, COD_MAX, COD_REFUND_MIN };`)();

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? `  →  ${JSON.stringify(extra)}` : ''}`); }
}
function eq(label, got, want) { ok(label, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

// ─── كتالوج مزيّف بشكل الرد الحقيقي (`bosta-api-helper` 8.6) ───
// جنوب سيناء: ٩ مناطق منها ٢ مقفولين — نفس القياس الحي 14-09-2026.
const RAW = {
  data: [
    {
      _id: 'nG_c44vHQht', name: 'South Sinai', nameAr: 'جنوب سيناء',
      dropOffAvailability: true,
      districts: [
        { _id: 'd-dahab',  districtName: 'Dahab',  districtOtherName: 'دهب',
          zoneId: 'z-dahab', zoneName: 'Dahab', zoneOtherName: 'دهب',
          dropOffAvailability: true, notAllowedBulkyOrders: false },
        { _id: 'd-nuweiba', districtName: 'Nuweiba', districtOtherName: 'نويبع',
          zoneId: 'z-nuweiba', zoneName: 'Nuweiba', zoneOtherName: 'نويبع',
          dropOffAvailability: true, notAllowedBulkyOrders: true },
        { _id: 'd-taba', districtName: 'Taba', districtOtherName: 'طابا',
          zoneId: 'z-taba', zoneName: 'Taba', zoneOtherName: 'طابا',
          dropOffAvailability: false },
        { _id: 'd-cat', districtName: 'Saint Catherine', districtOtherName: 'سانت كاترين',
          zoneId: 'z-cat', zoneName: 'Saint Catherine', zoneOtherName: 'سانت كاترين',
          dropOffAvailability: false },
      ],
    },
    {
      _id: '0064Qb0OgcA', name: 'Giza', nameAr: 'الجيزة', dropOffAvailability: true,
      districts: [
        // زون ٦ أكتوبر فيه أكتر من منطقة — واحدة منهم بس هي اللي هتطابق بالاسم
        { _id: 'd-abu-rawash', districtName: 'Abu Rawash', districtOtherName: 'ابو رواش',
          zoneId: 'QoHN-zG2tF', zoneName: '6 October', zoneOtherName: '٦ اكتوبر',
          dropOffAvailability: true },
        { _id: 'd-hadaba', districtName: 'Hadabet ElAhram', districtOtherName: 'هضبة الاهرام',
          zoneId: 'QoHN-zG2tF', zoneName: '6 October', zoneOtherName: '٦ اكتوبر',
          dropOffAvailability: true },
      ],
    },
  ],
};
const CAT = api.ensureNormalized(api.normalizeCatalog(RAW));

function order(sa, { outstanding = 500, subtotal = 500 } = {}) {
  return {
    id: 'gid://shopify/Order/1', legacyResourceId: '1', name: '#12345',
    shippingAddress: { name: 'Ahmed Tester', phone: '01019191915',
                       address1: 'building 7 apartment 3', address2: null, ...sa },
    totalOutstandingSet:     { presentmentMoney: { amount: String(outstanding) } },
    currentSubtotalPriceSet: { presentmentMoney: { amount: String(subtotal) } },
    lineItems: { nodes: [{ currentQuantity: 1, sku: 'SKU-A', title: 'T', variantTitle: '40' }] },
  };
}

// ─── ① التغطية المقفولة ───────────────────────────────────────
console.log('\n① المنطقة المقفولة للتسليم — بتتعرض ومابتتبعتش');
{
  const city = CAT.cities.find(c => c.cityId === 'nG_c44vHQht');
  const { list, blocked } = api.availableDistricts(city);
  eq('المتاحة للتسليم اتنين', list.map(d => d.name).sort(), ['Dahab', 'Nuweiba']);
  // 🔴 دي النقطة كلها: المقفولة **راجعة**، مش متشالة. لو رجعت [] تبقى الأداة
  //    رجعت للفلترة الصامتة اللي المهارة سمّت الأداة دي بالاسم عليها.
  eq('والمقفولة راجعة بالاسم مش متشالة', blocked.map(d => d.name).sort(),
     ['Saint Catherine', 'Taba']);
  ok('حقل notAllowedBulkyOrders اتخزّن', list.find(d => d.name === 'Nuweiba').bulkyBlocked === true);
  ok('dropOffAvailability بتاع المدينة اتخزّن', city.cityDropOff === true);
}
{
  // عنوان في طابا — المطابقة مش لاقية حاجة متاحة، لكن اللي طابق **مقفول**
  const plan = api.resolveAddress(
    order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' }), CAT);
  eq('العنوان اللي طابق منطقة مقفولة → mode = coverageBlocked', plan.mode, 'coverageBlocked');
  eq('والمنطقة المقفولة بتترجع بالاسم', (plan.blockedDistricts || []).map(d => d.name), ['Taba']);
  const problems = api.coverageProblems(plan);
  ok('والصف بيتوقف — مش بينزل للمحافظة', problems.length === 1);
  ok('والرسالة بتقول إن المحافظة مش بديل',
     /المحافظة مش بديل|الرفع على المحافظة/.test(problems[0]), problems[0]);
}
{
  // ضابط: عنوان في دهب (متاحة) لازم يفضل مطابقة عادية
  const plan = api.resolveAddress(
    order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' }), CAT);
  eq('الضابط — منطقة متاحة لسه بتطابق عادي', plan.mode, 'district');
  eq('ومفيش أي توقيف تغطية عليها', api.coverageProblems(plan).length, 0);
}

// ─── ② درجة الزون ────────────────────────────────────────────
console.log('\n② درجة الزون — منطقة ← زون ← محافظة');
{
  // العنوان فيه اسم الزون (٦ اكتوبر) ومفيش اسم منطقة — الحالة اللي كانت
  // بتنزل للمحافظة قبل v2.1.0
  const plan = api.resolveAddress(
    order({ city: '٦ اكتوبر', province: 'Giza', provinceCode: 'GZ',
            address1: 'الحي المتميز عمارة 7' }), CAT);
  eq('زون واحد بلا مطابقة منطقة → mode = zone', plan.mode, 'zone');
  eq('ومعاه zoneId من الكتالوج', plan.zoneId, 'QoHN-zG2tF');
  // 🔴 الشكل ده هو اللي بيفرق: `zoneId` **لوحده** على العقد غير الموثّق.
  //    بعت `city` معاه مالوش أثر، وبعت `districtName` بيرجّع 400 · 3002.
  const addr = api.buildAddressObject(plan, 'zone', 'building 7');
  eq('العنوان بيتبعت بـ zoneId لوحده', Object.keys(addr).sort(), ['firstLine', 'zoneId']);
  ok('ومفيش districtName خالص (بيرجّع 3002 على العقد ده)', addr.districtName === undefined);
  eq('الدرجة المسجّلة في D1', api.addressDegree('zone'), 'zone');
  // العقد: الزون على غير الموثّق — نفس المحافظة
  const payload = api.buildDeliveryPayload(
    order({ city: '٦ اكتوبر', province: 'Giza', provinceCode: 'GZ' }), plan, 'zone');
  eq('والـ payload بيحمل نفس شكل العنوان', Object.keys(payload.dropOffAddress).sort(),
     ['firstLine', 'zoneId']);
}
{
  // الضابط المقابل: نفس النص من غير zoneId في الكتالوج ماينفعش يرفع بالزون
  const noZone = api.ensureNormalized(api.normalizeCatalog({
    data: [{ _id: '0064Qb0OgcA', name: 'Giza', districts: [
      { _id: 'd-x', districtName: 'Abu Rawash', zoneName: '6 October',
        zoneOtherName: '٦ اكتوبر', dropOffAvailability: true },
    ] }],
  }));
  const plan = api.resolveAddress(
    order({ city: '٦ اكتوبر', province: 'Giza', provinceCode: 'GZ',
            address1: 'الحي المتميز عمارة 7' }), noZone);
  // 🔴 اسم زون من غير id **مايترفعش عليه** — التخمين هنا بيبعت مفتاح مخترع
  eq('زون بلا zoneId → بينزل للمحافظة مش بيخمّن', plan.mode, 'province');
}
{
  // أكتر من زون = غموض، والغموض مابيتحسمش تلقائيًا
  const twoZones = api.ensureNormalized(api.normalizeCatalog({
    data: [{ _id: '0064Qb0OgcA', name: 'Giza', districts: [
      { _id: 'd-1', districtName: 'Abu Rawash', zoneId: 'z1', zoneName: '6 October',
        zoneOtherName: '٦ اكتوبر', dropOffAvailability: true },
      { _id: 'd-2', districtName: 'Kerdasa', zoneId: 'z2', zoneName: 'Sheikh Zayed',
        zoneOtherName: 'الشيخ زايد', dropOffAvailability: true },
    ] }],
  }));
  const plan = api.resolveAddress(
    order({ city: 'الجيزة', province: 'Giza', provinceCode: 'GZ',
            address1: '٦ اكتوبر والشيخ زايد' }), twoZones);
  eq('زونين مطابقين → غموض، بينزل للمحافظة', plan.mode, 'province');
  ok('والاتنين بيتعرضوا للموظف كاقتراح', (plan.localZones || []).length === 2);
}

// ─── سلّم النزول ──────────────────────────────────────────────
console.log('\n③ سلّم النزول — بيتحرك بـ errorCode بس');
{
  // 🔴 `errorCode` **نص** — المقارنة بالرقم معناها إن الرجوع عمره ما يشتغل
  eq('منطقة + 3003 ومعاها زون → زون', api.nextAddressDegree('district', '3003', 'z1'), 'zone');
  eq('منطقة + 3003 من غير زون → محافظة', api.nextAddressDegree('district', '3003', null), 'province');
  eq('زون + 3002 → محافظة', api.nextAddressDegree('zone', '3002', 'z1'), 'province');
  eq('زون + 3000 → محافظة', api.nextAddressDegree('zone', '3000', 'z1'), 'province');
  eq('محافظة مالهاش نزول', api.nextAddressDegree('province', '3003', 'z1'), null);
  // 🔴 كود تاني مالوش علاقة بالعنوان مابينزلش درجة — النزول عليه بيخفي السبب
  //    الحقيقي (مثلاً 11000 = مرفوع قبل كده) ويطلّع شحنة على عنوان أقل دقة.
  eq('11000 مابينزلش درجة', api.nextAddressDegree('district', '11000', 'z1'), null);
  eq('41591 مابينزلش درجة', api.nextAddressDegree('district', '41591', 'z1'), null);
}

// ─── ④ حارس قيمة البضاعة ─────────────────────────────────────
console.log('\n④ حارس goodsInfo.amount — الحد مش موثّق في الـ spec');
{
  eq('الحدود من ecommoda/bosta المقيسة', [api.GOODS_MIN, api.GOODS_MAX], [100, 50000]);
  ok('99 بتتوقف',    api.goodsProblems(99).length === 1);
  ok('0 بتتوقف',     api.goodsProblems(0).length === 1);
  ok('100 بتعدّي',   api.goodsProblems(100).length === 0);
  ok('50000 بتعدّي', api.goodsProblems(50000).length === 0);
  ok('50001 بتتوقف', api.goodsProblems(50001).length === 1);
  ok('والرسالة بتسمّي errorCode عشان الموظف يربطها برد بوسطة',
     /41591/.test(api.goodsProblems(50).join('')), api.goodsProblems(50));
  // الحارس داخل فعلًا في مسار الرفع مش دالة معلّقة لوحدها
  const o = order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' }, { subtotal: 50 });
  const plan = api.resolveAddress(o, CAT);
  ok('و`validateOrder` بتوقف الصف قبل أي نداء لبوسطة',
     api.validateOrder(o, plan).some(p => /قيمة البضاعة/.test(p)), api.validateOrder(o, plan));
}

// ─── ⑤ cod الشحن العادي ──────────────────────────────────────
console.log('\n⑤ الشحن العادي — السالب معناه «مفيش تحصيل» مش «حصّل بالمقلوب»');
{
  const plan = api.resolveAddress(
    order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' }), CAT);
  const over = order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' },
                     { outstanding: -200, subtotal: 500 });
  const p = api.buildDeliveryPayload(over, plan, 'district');
  // 🔴 لو رجعت 200 يبقى `Math.abs` رجع — وده تحصيل من عميل دافع زيادة
  eq('عميل دافع زيادة → cod = 0 مش 200', p.cod, 0);
  const normal = order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' },
                       { outstanding: 750, subtotal: 750 });
  eq('والموجب بيعدّي زي ما هو', api.buildDeliveryPayload(normal, plan, 'district').cod, 750);
}

// ─── ⑥ ترجمة أخطاء بوسطة ─────────────────────────────────────
console.log('\n⑥ humanizeBostaError — الأكواد اللي v5.0.0 وثّقتها');
{
  const h = (res) => api.humanizeBostaError(res, null);
  ok('41591 بقى ليه رسالة بالعربي',
     /قيمة البضاعة/.test(h({ status: 400, errorCode: '41591', message: 'x' })));
  ok('3007 (حد التحصيل)', /تحصيل/.test(h({ status: 400, errorCode: '3007', message: 'x' })));
  ok('1066 (الشحنة مش موجودة)', /اتلغت|مش لاقية/.test(h({ status: 400, errorCode: '1066', message: 'x' })));
  ok('3009 (عنوان بلا مفتاح درجة)', /districtId|zoneId|درجة/.test(h({ status: 400, errorCode: '3009', message: 'x' })));
  // 🔴 الفرع العام لأي 500 — ده شكل فشل اتجاه العنوان في R/E، ومفيهوش errorCode
  ok('500 بلا كود ليه فرع عام مش رسالة فاضية',
     h({ status: 500, errorCode: null, message: "Cannot read properties of undefined" }).length > 30);
  // 🔴 403 = حقل برّه الـ whitelist، والنداء **كله** بيتلغي
  ok('403 بيقول إن مفيش أي جزء اتنفّذ',
     /مفيش أي جزء/.test(h({ status: 403, errorCode: null, message: " x can't be updated" })));
}

// ─── ⑥ب الصف الموقوف في الجدول ───────────────────────────────
// 🔴 الرسالة الطويلة اتشالت من **العرض** بس (v2.1.1، بطلب أحمد) — الجدول بيقول
//    نفس المعلومة تلات مرات تانية (بادج الحالة · عمود المنطقة · حالة الرفع).
//    والخطر إن اللي شايل الرسالة يشيل **المنع** معاها من غير ما ياخد باله،
//    فالأوردر اللي خارج التغطية يبقى قابل للرفع. الجزء ده بيقفل ده.
console.log('\n⑥ب الصف الموقوف — الرسالة اتشالت والمنع فضل');
{
  const blockedOrder = order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' });
  const r = api.buildRow(blockedOrder, CAT);
  eq('الصف اتعلّم coverageBlocked', r.mode, 'coverageBlocked');
  // 🔴 دي النقطة كلها — شيل الرسالة **مايشيلش** المنع
  ok('والرفع لسه موقوف', r.uploadable === false, r.uploadable);
  ok('والرسالة الطويلة مش في العرض',
     !r.problems.some(p => /خارج التغطية|مش بتسلّم فيها/.test(p)), r.problems);
  // والمعلومة نفسها لسه واصلة بطريقتين تانيتين
  eq('واسم المنطقة المقفولة لسه واصل للواجهة',
     (r.blockedDistricts || []).map(d => d.name), ['Taba']);

  // ⚠️ الضابط: أي سبب منع **تاني** لازم يفضل ظاهر في الجدول زي ما هو
  const cheap = order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' },
                      { subtotal: 50 });
  const rc = api.buildRow(cheap, CAT);
  ok('وسبب منع تاني (قيمة البضاعة) لسه ظاهر',
     rc.problems.some(p => /قيمة البضاعة/.test(p)), rc.problems);
  ok('وموقوف برضه', rc.uploadable === false);
}

// ─── ⑥د المنطقة اللي الموظف اختارها بتحرّر الوقف ──────────────
// 🔴 الوقف قايم على نتيجة **المطابقة التلقائية**. الموظف اللي فتح النافذة
//    وحدد منطقة تانية بدّل النتيجة دي بالكامل — والـ payload بيبعت الـ
//    `districtId` بتاعه. من غير الاستثناء ده الصف بيفضل ⛔ موقوف للأبد:
//    البادج بيخضرّ («عنوان مظبوط») والرفع مايعدّيش، والموظف مالوش أي طريق
//    يكمّل بيه غير إنه يسيب الأوردر.
// ⚠️ والضابط أهم من الحالة نفسها: الدرجة الأقل (زون/محافظة) **مابتحرّرش**،
//    لأنها بتغيّر درجة العنوان مش العنوان — الشحنة بتفضل رايحة نفس المكان.
console.log('\n⑥د التعديل اليدوي — المنطقة بتحرّر الوقف، الدرجة الأقل لأ');
{
  const blocked = order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' });
  const plan = api.resolveAddress(blocked, CAT);
  eq('نقطة البداية — الخطة موقوفة على التغطية', plan.mode, 'coverageBlocked');

  eq('من غير تعديل: الوقف قايم', api.coverageProblems(plan).length, 1);
  eq('منطقة مختارة يدويًا بتحرّر الوقف',
     api.coverageProblems(plan, { districtId: 'd-dahab', cityId: 'nG_c44vHQht' }).length, 0);
  // 🔴 الضابط — دول بيغيّروا الدرجة مش العنوان
  eq('«ارفع على الزون بس» مابيحرّرش',
     api.coverageProblems(plan, { forceZone: true, zoneId: 'z-dahab' }).length, 1);
  eq('و«ارفع على المحافظة بس» مابيحرّرش',
     api.coverageProblems(plan, { forceProvince: true }).length, 1);
  eq('وتعديل المدينة لوحده من غير منطقة مابيحرّرش',
     api.coverageProblems(plan, { cityId: '0064Qb0OgcA' }).length, 1);

  // نفس القاعدة من فوق — `validateOrder` هي الباب اللي `uploadOne` بيعدّي منه
  eq('validateOrder من غير تعديل بتوقف', api.validateOrder(blocked, plan).length, 1);
  eq('ومع المنطقة المختارة بتعدّي',
     api.validateOrder(blocked, plan, { districtId: 'd-dahab' }).length, 0);

  // ⚠️ وسبب منع تاني **مابيتحرّرش** بالتعديل — التعديل بيخص التغطية وبس
  const cheap = order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' },
                      { subtotal: 50 });
  ok('وسبب منع تاني بيفضل واقف حتى مع المنطقة المختارة',
     api.validateOrder(cheap, api.resolveAddress(cheap, CAT), { districtId: 'd-dahab' })
        .some(p => /قيمة البضاعة/.test(p)));
}
{
  // 🔴 العلم اللي الواجهة بتقرا منه. من غيره الواجهة بتضطر تخمّن من `problems`
  //    أنهي رسالة بتاعة التغطية — يعني نسخة تانية من `validateOrder` في
  //    الفرونت إند بتفترق عنها في صمت.
  const r = api.buildRow(order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' }), CAT);
  ok('الصف الموقوف على التغطية وبس متعلّم coverageOnly', r.coverageOnly === true, r);
  ok('والرفع لسه موقوف — العلم مش إذن رفع', r.uploadable === false);

  const rc = api.buildRow(order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' },
                                { subtotal: 50 }), CAT);
  ok('وصف عليه سبب منع تاني **مش** متعلّم', rc.coverageOnly === false, rc.problems);

  const rok = api.buildRow(order({ city: 'دهب', province: 'South Sinai', provinceCode: 'JS' }), CAT);
  ok('وصف سليم مش متعلّم', rok.coverageOnly === false);
}

// ─── ⑥ج حارس الزون المختار يدويًا ────────────────────────────
// 🔴 «ارفع على الزون بس» (v2.1.2) بيدّي الموظف درجة وسطى يختارها بنفسه — بس
//    الزون اللي بييجي من الواجهة **مايتصدّقش**: لازم يكون في **مدينة الرفع**
//    ومن مناطق متاحة للتسليم. اسم الزون بيتكرر بين المدن، والموظف ممكن يكون
//    غيّر المدينة بعد ما اختار الزون — فرفع من غير تحقق = شحنة على زون مدينة
//    تانية خالص.
console.log('\n⑥ج حارس الزون المختار يدويًا');
{
  const giza = CAT.cities.find(c => c.cityId === '0064Qb0OgcA');
  eq('زون موجود في المدينة بيعدّي',
     api.resolveZoneOverride(CAT, '0064Qb0OgcA', 'QoHN-zG2tF'),
     { zoneId: 'QoHN-zG2tF', zoneName: '6 October' });
  // 🔴 نفس الـ id بس في مدينة تانية = **وقف**
  ok('ونفس الزون في مدينة تانية بيترفض',
     api.resolveZoneOverride(CAT, 'nG_c44vHQht', 'QoHN-zG2tF') === null);
  ok('وزون مخترع بيترفض', api.resolveZoneOverride(CAT, '0064Qb0OgcA', 'z-fake') === null);
  ok('ومدينة مش في الكتالوج بترفض', api.resolveZoneOverride(CAT, 'no-such-city', 'QoHN-zG2tF') === null);
  // ⚠️ والزون اللي كل مناطقه مقفولة للتسليم مالوش معنى — `Taba` منطقته الوحيدة
  //    مقفولة، فالزون كله مقفول (`bosta-api-helper` 8.11).
  ok('وزون كل مناطقه مقفولة بيترفض',
     api.resolveZoneOverride(CAT, 'nG_c44vHQht', 'z-taba') === null);
  ok('وزون متاح في نفس المدينة بيعدّي',
     api.resolveZoneOverride(CAT, 'nG_c44vHQht', 'z-dahab')?.zoneName === 'Dahab');
  ok('والمرجوع فيه الـ id مش الاسم بس',
     !!api.resolveZoneOverride(CAT, 'nG_c44vHQht', 'z-dahab')?.zoneId);
}

// ─── ⑦ الإلغاء المكرر ────────────────────────────────────────
console.log('\n⑦ terminate — الإلغاء المكرر نجاح مش فشل');
(async () => {
  const realFetch = globalThis.fetch;
  const reply = (status, body) => async () => ({
    ok: status >= 200 && status < 300, status,
    text: async () => JSON.stringify(body),
  });

  globalThis.fetch = reply(200, {});
  const first = await api.terminateDelivery({ BOSTA_API_KEY: 'k' }, '226230854');
  ok('الإلغاء الأول نجاح', first.ok === true, first);
  ok('ومش متعلّم إنها كانت ملغية', first.alreadyGone === false, first);

  // 🔴 مقيس 14-09-2026: `terminate` تاني مرة بيرجّع **404** بينما `GET`/`PUT`
  //    على نفس الشحنة بيرجّعوا **400** — كلهم بـ`errorCode 1066`. الـ 404
  //    مميَّز، فينفع يتعامل معاه كنجاح.
  globalThis.fetch = reply(404, { errorCode: 1066, message: 'Delivery not found.' });
  const again = await api.terminateDelivery({ BOSTA_API_KEY: 'k' }, '226230854');
  ok('الإلغاء المكرر (404 · 1066) بيترد نجاح', again.ok === true, again);
  ok('ومتعلّم إنها كانت ملغية خلاص', again.alreadyGone === true, again);

  // ⚠️ الضابط: نفس الكود بـ**400** مش إلغاء مكرر — ده `GET`/`PUT` على شحنة
  //    ملغية. خلطهم بيخلي أي فشل حقيقي يتعرض كنجاح.
  globalThis.fetch = reply(400, { errorCode: 1066, message: 'Delivery not found.' });
  const four00 = await api.terminateDelivery({ BOSTA_API_KEY: 'k' }, '226230854');
  ok('و400 · 1066 **مش** بيترد نجاح', four00.ok === false, four00);

  globalThis.fetch = reply(500, { message: 'boom' });
  const boom = await api.terminateDelivery({ BOSTA_API_KEY: 'k' }, '226230854');
  ok('وأي فشل تاني بيفضل فشل', boom.ok === false, boom);

  // ─── ⑧ الوصلة نفسها — `uploadOne` من الطلب لنداء بوسطة ─────
  // 🔴 ⑥د بتجرّب `coverageProblems` و`validateOrder` كدوال. الجزء ده بيجرّب
  //    **الترتيب جوّه `uploadOne`** — وهو اللي كان مكسور فعلًا: الڤاليديشن
  //    بيتنده وبيرجع **قبل** السطور اللي بتقرا `override` أصلًا، فاختيار
  //    الموظف كان بيتبلع في صمت مهما كانت الدالة سليمة.
  // ⚠️ والعدّاد مقصود: الادعاء «مفيش ولا شحنة اتعملت» على الصف المرفوض لازم
  //    يتقاس بعدد نداءات بوسطة الفعلية — لو غلط، الموظف يسيب شحنة مدفوعة وراه.
  console.log('\n⑧ uploadOne — التعديل اليدوي بيوصل قبل حارس التغطية');
  {
    const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 'shop.myshopify.com' };
    const blocked = order({ city: 'طابا', province: 'South Sinai', provinceCode: 'JS' });

    // راوتر: بيعدّ نداءات بوسطة، وبيخلي كتابة شوبيفاي تنجح
    const run = async (override) => {
      const bosta = [];
      globalThis.fetch = async (url, opts) => {
        const u = String(url);
        if (u.includes('/admin/api/')) {
          const body = JSON.parse(opts.body);
          const vars = body.variables || {};
          if (/metafieldsSet/.test(body.query)) {
            return { ok: true, status: 200, text: async () => JSON.stringify({ data: { metafieldsSet: {
              metafields: (vars.metafields || []).map(m => ({
                key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
              userErrors: [] } } }) };
          }
          if (/tagsAdd/.test(body.query)) {
            return { ok: true, status: 200, text: async () => JSON.stringify({
              data: { tagsAdd: { node: { id: vars.id }, userErrors: [] } } }) };
          }
          return { ok: true, status: 200, text: async () => JSON.stringify({ data: {} }) };
        }
        bosta.push({ url: u, body: JSON.parse(opts.body) });
        return { ok: true, status: 201, text: async () => JSON.stringify({
          success: true, data: { trackingNumber: '999', _id: 'x1' } }) };
      };
      const row = await api.uploadOne(env, 'tok', blocked, CAT, override);
      return { row, bosta };
    };

    const chosen = await run({ districtId: 'd-dahab' });
    ok('المنطقة المختارة بتعدّي لبوسطة فعلًا', chosen.bosta.length === 1, chosen.row);
    ok('ومش error', chosen.row.status !== 'error', chosen.row.error);
    eq('والـ payload بعت districtId بتاع الموظف',
       chosen.bosta[0]?.body?.dropOffAddress?.districtId, 'd-dahab');
    ok('وعلى العقد الموثّق (درجة المنطقة)', chosen.bosta[0]?.url.includes('apiVersion=1'));
    eq('ودرجة العنوان المسجّلة district', chosen.row.addressDegree, 'district');

    // 🔴 الضابط الأول — من غير تعديل الوقف قايم و**مفيش ولا نداء**
    const none = await run(null);
    eq('من غير تعديل: صفر نداء لبوسطة', none.bosta.length, 0);
    ok('والرسالة بتقول خارج التغطية', /خارج التغطية/.test(none.row.error || ''), none.row.error);

    // 🔴 الضابط التاني — منطقة **مقفولة** مالهاش طريق تعدّي حتى لو الموظف
    //    اختارها: `availableDistricts` مابترجّعهاش، فالصف بيقف برسالة صريحة
    //    من غير أي نداء. ده اللي بيمنع «التعديل اليدوي» يبقى باب خلفي.
    const taba = await run({ districtId: 'd-taba' });
    eq('منطقة مقفولة مختارة يدويًا: صفر نداء', taba.bosta.length, 0);
    ok('وبتقف برسالة صريحة', /مش موجودة|مش متاحة للتسليم/.test(taba.row.error || ''), taba.row.error);

    // 🔴 والضابط التالت — الدرجة الأقل مابتفتحش الطريق
    const prov = await run({ forceProvince: true });
    eq('«ارفع على المحافظة بس»: صفر نداء', prov.bosta.length, 0);
    const zone = await run({ forceZone: true, zoneId: 'z-dahab' });
    eq('و«ارفع على الزون بس»: صفر نداء', zone.bosta.length, 0);
  }

  // ─── ⑨ قياس التدخّل اليدوي — السجل لازم يفرّق (v2.5.0) ─────
  // 🔴 البند: `district_sent` بيتكتب **سواء** المطابقة نجحت أو الموظف صلّحها
  //    بإيده — يعني نسبة نجاح المطابقة **مش قابلة للقراءة من السجل أصلًا**،
  //    وأي قرار عن تحسين المطابقة بيتاخد على تقدير. الأربع حقول دي هي القياس.
  // 🎯 و`anchor_hit` تحديدًا هو اللي هيقول لو المرساة تستاهل تبقى اقتراح قابل
  //    للضغط بعدين — القرار ده **مايتاخدش بالتخمين** (نفس قاعدة بند ١٣).
  console.log('\n⑨ السجل بيفرّق بين مطابقة نجحت وموظف صلّحها');
  {
    const env = { BOSTA_API_KEY: 'k', SHOP_DOMAIN: 'shop.myshopify.com' };
    // «الهرم» مش اسم منطقة، و«هضبه» جوّه اسم منطقة **واحدة** — نفس شكل #55065
    const near = order({ city: 'الهرم', address1: 'هضبه الهرم شارع 9',
                         province: 'Giza', provinceCode: 'GZ' });
    const plan = api.resolveAddress(near, CAT);
    eq('والمرساة لقت «هضبة»', plan.addressAnchor?.text, 'هضبة');
    eq('واتطبّقت على هضبة الاهرام', plan.districtId, 'd-hadaba');
    ok('والعلم راجع مع الخطة', plan.districtFromAnchor === true);

    const run = async (override) => {
      globalThis.fetch = async (url, opts) => {
        if (String(url).includes('/admin/api/')) {
          const body = JSON.parse(opts.body);
          const vars = body.variables || {};
          if (/metafieldsSet/.test(body.query)) {
            return { ok: true, status: 200, text: async () => JSON.stringify({ data: { metafieldsSet: {
              metafields: (vars.metafields || []).map(m => ({
                key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
              userErrors: [] } } }) };
          }
          return { ok: true, status: 200, text: async () => JSON.stringify({
            data: { tagsAdd: { node: { id: vars.id }, userErrors: [] } } }) };
        }
        return { ok: true, status: 201, text: async () => JSON.stringify({
          success: true, data: { trackingNumber: '999', _id: 'x1' } }) };
      };
      return api.uploadOne(env, 'tok', near, CAT, override);
    };

    const auto = await run(null);
    eq('من غير تدخّل: الشحنة اتعملت على منطقة المرساة', auto.anchorApplied, true);
    eq('ودرجة العنوان district', auto.addressDegree, 'district');
    eq('والمنطقة المبعوتة هي هضبة الاهرام', auto.districtSent, 'Hadabet ElAhram');
    eq('ومفيش تعديل منطقة', auto.districtOverridden, false);
    eq('و anchorHit فاضي — الموظف ما لمسش (موافق ضمنيًا)', auto.anchorHit, null);
    eq('والمرساة نفسها متسجّلة', auto.addressAnchor, 'هضبة');

    const hit = await run({ districtId: 'd-hadaba' });
    eq('أكّد نفس المنطقة بإيده → hit', hit.anchorHit, true);
    eq('والتعديل متسجّل', hit.districtOverridden, true);
    eq('🔴 والاختيار اليدوي بيلغي نسبة المرساة للشحنة', hit.anchorApplied, false);

    // 🔴 دي **إشارة الخطأ**: الموظف شاف المرشّح التلقائي وغيّره
    const miss = await run({ districtId: 'd-abu-rawash' });
    eq('اختار منطقة تانية → miss (مش null)', miss.anchorHit, false);
    eq('والشحنة راحت على اختياره هو', miss.districtSent, 'Abu Rawash');

    const prov = await run({ forceProvince: true });
    eq('التثبيت على المحافظة متسجّل كدرجة', prov.degreeForced, 'province');
    eq('و anchorHit فاضي — ما اختارش منطقة', prov.anchorHit, null);
    eq('و anchorApplied مطفي — الشحنة راحت على المحافظة', prov.anchorApplied, false);

    // 🔴 وسلّم النزول بيلغيها كمان — الشحنة اللي موجودة عند بوسطة دلوقتي
    //    **مش** على منطقة المرساة، فصف سجل بيقول إنها عليها بيكدب على القياس.
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/admin/api/')) {
        const body = JSON.parse(opts.body);
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: { metafieldsSet: {
          metafields: (body.variables?.metafields || []).map(m => ({
            key: m.key, value: m.value, namespace: m.namespace, owner: { id: m.ownerId } })),
          userErrors: [] }, tagsAdd: { node: { id: '1' }, userErrors: [] } } }) };
      }
      // بوسطة بترفض المنطقة (3003) وبتقبل المحافظة
      if (u.includes('apiVersion=1')) {
        return { ok: false, status: 400, text: async () => JSON.stringify({
          success: false, errorCode: '3003', message: 'District Not Found' }) };
      }
      return { ok: true, status: 201, text: async () => JSON.stringify({
        success: true, data: { trackingNumber: '999', _id: 'x1' } }) };
    };
    const fell = await api.uploadOne(env, 'tok', near, CAT, null);
    eq('بوسطة رفضت المنطقة → نزلنا للمحافظة', fell.addressDegree, 'province');
    eq('🔴 و anchorApplied مطفي — القياس بيقرا الدرجة اللي اتبعتت فعلًا',
       fell.anchorApplied, false);
    ok('والشحنة اتعملت برضه', !!fell.trackingNumber, fell);

    // 🔴 والحقول لازم توصل **للسجل** مش للصف بس — إضافتها في `uploadOne`
    //    ونسيانها في `logRow` معناها قياس شكله موجود ومفيش منه ولا صف في D1.
    let extra = null;
    const db = { prepare: () => ({ bind: (...a) => ({ run: async () => { extra = JSON.parse(a[12]); } }) }) };
    await api.logRow({ DB: db }, hit, 'tester');
    eq('district_overridden في extra', extra.district_overridden, true);
    eq('anchor_hit في extra', extra.anchor_hit, true);
    eq('address_anchor في extra', extra.address_anchor, 'هضبة');
    await api.logRow({ DB: db }, auto, 'tester');
    eq('anchor_applied في extra', extra.anchor_applied, true);
    await api.logRow({ DB: db }, prov, 'tester');
    eq('degree_forced في extra', extra.degree_forced, 'province');
  }

  globalThis.fetch = realFetch;

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`نجح ${pass} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

