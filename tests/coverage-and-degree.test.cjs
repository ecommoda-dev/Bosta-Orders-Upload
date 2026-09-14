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
          terminateDelivery, buildRow,
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

  globalThis.fetch = realFetch;

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`نجح ${pass} · فشل ${fail}`);
  process.exit(fail ? 1 : 0);
})();

