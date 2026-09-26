// ══════════════════════════════════════════════════════════════
// اختبار ترجيح مطابقة المنطقة — يتشغّل بـ:  node tests/address-matching.test.cjs
//
// كل حالة هنا **أوردر حقيقي** من المتجر (أو حالة احتواء موثّقة)، وكلها كانت
// بتطلع غلط أو غامضة قبل ترجيح v1.1.0. الملف ده هو اللي بيمنع رجوع الباج.
// 🔴 الكتالوج هنا مصغّر ومكتوب بالإيد — مش بديل عن الكتالوج الحي، هو بس
//    بيثبّت **قواعد الترجيح** على أسماء حقيقية من بوسطة.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.js'),'utf8').replace(/export default \{[\s\S]*$/,'');
const api = new Function(src + `
 return { normText, ensureNormalized, matchDistrict, addressFields, resolveAddress, findCrossCity };`)();

const D = (id,name,nameAr,zone='Z') => ({ id, name, nameAr, zone, zoneAr:'', dropOff:true });

// كتالوج مصغّر بأسماء حقيقية من بوسطة
const catalog = { cities: [
  { cityId:'ByP7rFCjL6XzF6j4S', cityName:'Kafr Alsheikh', cityAr:'كفر الشيخ', districts:[
      D('k1','Kafr ElSheikh','كفر الشيخ'), D('k2','Sidi Salem','سيدي سالم'),
      D('k3','Qalin','قلين'), D('k4','Desouk','دسوق'), D('k5','Balteem','بلطيم') ]},
  { cityId:'RrDhS8YYsXAwZ9Zfo', cityName:'Dakahlia', cityAr:'الدقهلية', districts:[
      D('d1','Mansoura','المنصورة'), D('d2','Aga','اجا'), D('d3','Mit Ghamr','ميت غمر'),
      // #55191 — منطقتين تابعتين لنفس مدينة بوسطة «بلقاس»، وواحدة منهم اسمها
      // == اسم المدينة نفسها (المنطقة دي بتترفع في كتالوج بوسطة الحقيقي بنفس
      // اسم مدينتها كتير — «مركز المدينة»). دي حالة الاستبعاد التلقائي.
      D('bk1','ElShawami','الشوامي','Belkas'), D('bk2','Belkas','بلقاس','Belkas'),
      // ٣ احتمالات في نفس المدينة (طلخا)، واحد منهم بس بيكرر اسمها — لازم
      // يفضل غموض (شرط أحمد: العدد لازم يبقى ٢ بالظبط عشان الاستبعاد
      // التلقائي يشتغل). أسماء مالهاش علاقة ببعض نصيًا عشان مايحصلش احتواء
      // (`dominates`) يقلّل العدد لاتنين قبل ما قاعدة التعادل تتفحّص أصلًا.
      D('tk1','Talkha','طلخا','Talkha'), D('tk2','Kafr Saad','كفر سعد','Talkha'),
      D('tk3','Sherbin','شربين','Talkha') ]},
  { cityId:'FceDyHXwpSYYF9zGW', cityName:'Cairo', cityAr:'القاهرة', districts:[
      D('c1','Nasr City','مدينة نصر'), D('c2','Nasr','نصر'), D('c3','Heliopolis','مصر الجديدة'),
      D('c4','Obour','العبور'), D('c5','Obour District 05','العبور - المنطقة 05'),
      D('c6','Gesr El Suez','جسر السويس'), D('c7','Maadi','المعادي') ]},
  { cityId:'yp3atroeTwnyiBNKE', cityName:'El Kalioubia', cityAr:'القليوبية', districts:[
      D('q1','Banha','بنها'), D('q2','Qalyub','قليوب'), D('q3','Shubra El Kheima','شبرا الخيمة') ]},
  { cityId:'ruBSjGBDX9wpRa3cc', cityName:'Monufia', cityAr:'المنوفية', districts:[
      D('m1','Shebin El Kom','شبين الكوم') ]},
  { cityId:'K3RwC677J8kJytdZD', cityName:'Gharbia', cityAr:'الغربية', districts:[
      D('g1','Tanta','طنطا'), D('g2','El Santa','السنطة') ]},
  { cityId:'qoZvYcZ8Cqji4pGp5', cityName:'Damietta', cityAr:'دمياط', districts:[
      D('t1','New Damietta','دمياط الجديدة') ]},
  // اسمين **متطابقين** لمنطقتين مختلفتين — لازم يفضلوا غموض، مش حسم عشوائي
  { cityId:'PJqNriLtFtx2cfkKP', cityName:'Ismailia', cityAr:'الإسماعيلية', districts:[
      D('i1','El Manshia A','المنشية'), D('i2','El Manshia B','المنشية') ]},
]};
api.ensureNormalized(catalog);

const cases = [
  ['#53774 كفر الشيخ/سيدي سالم', {city:'سيدي سالم', address1:'كفر الشيخ سيدي سالم بجوار بنك مصر', province:'Kafr el-Sheikh', provinceCode:'KFS'}, 'Sidi Salem'],
  ['#53834 قلين',               {city:'قلين', address1:'كفر الشيخ مركز قلين', province:'Kafr el-Sheikh', provinceCode:'KFS'}, 'Qalin'],
  ['#53818 المنصورة/اجا',        {city:'Al Daqahliya', address1:'المنصورة / اجا/ طنامل', province:'Dakahlia', provinceCode:'DK'}, 'ambiguous'],
  ['#53821 القاهرة/مصر الجديدة', {city:'القاهرة', address1:'١٣ ش القناطر ميدان صلاح الدين مصر الجديدة', province:'Cairo', provinceCode:'C'}, 'Heliopolis'],
  ['#53832 القاهرة/جسر السويس',  {city:'القاهرة', address1:'جسر السويس القاهره خلف مبنى ايه بي سي', province:'Cairo', provinceCode:'C'}, 'Gesr El Suez'],
  ['مدينة نصر (احتواء)',          {city:'مدينة نصر', address1:'١ إسكان شباب المهندسين طريق النصر مدينة نصر', province:'Cairo', provinceCode:'C'}, 'Nasr City'],
  ['محافظة بس — كفر الشيخ',      {city:'كفر الشيخ', address1:'كفر الشيخ شارع الجيش', province:'Kafr el-Sheikh', provinceCode:'KFS'}, 'Kafr ElSheikh'],
  ['#53698 العبور (عبر مدينة)',  {city:'العبور ', address1:'العبور شارع الشباب الجامع الكبير ٥٦٢ شقه ٨', province:'Qalyubia', provinceCode:'KB'}, 'cityDoubt'],
  ['#53800 شبين الكوم/الغربية',  {city:'شبين الكوم', address1:'شبين الكوم', province:'Gharbia', provinceCode:'GH'}, 'cityDoubt'],
  ['#53814 دمياط الجديدة/القاهرة',{city:'Cairo', address1:'دمياط الجديدة بن الزعيم المركزية مقابل البنك الاهلي', province:'Cairo', provinceCode:'C'}, 'cityDoubt'],
  // اسمين متطابقين لمنطقتين ≠ حسم — لو الاحتواء ما اشترطش طول أكبر، دي كانت
  // هتترفع على أول منطقة في الترتيب في صمت
  ['اسمين متطابقين = غموض',      {city:'المنشية', address1:'المنشية شارع الجيش', province:'Ismailia', provinceCode:'IS'}, 'ambiguous'],
  // #55191 — احتمالين بالظبط، وواحد منهم بس اسمه == اسم مدينة بوسطة (بلقاس).
  // 🔴 **`city` هنا لازم يفضل مش مطابق لاسم أي منطقة** — لو اتحط `بلقاس` في
  //    خانة `city` هي نفسها، فرق الطبقة (`tier`) بيخلّي بوسطة تحسمها لوحدها
  //    من غير ما توصل للغموض أصلًا (خانة `city` أخصّ من `address1`)، فالاختبار
  //    ما كانش هيقيس تعادل حقيقي. الاسمين هنا بيتطابقوا من `address1` بس.
  ['#55191 بلقاس/الشوامي — استبعاد تكرار الاسم', {city:'الدقهلية', address1:'الشوامي بجوار كوبري البلد مركز بلقاس', province:'Dakahlia', provinceCode:'DK'}, 'ElShawami'],
  // احتمالين تانيين في نفس المدينة، ولا واحد فيهم بيكرر اسم المدينة نفسه —
  // القاعدة **ما بتطبّقش** والحسم مش واضح، لازم يفضل غموض زي ما هو.
  ['كفر سعد/شربين — ولا واحد بيكرر اسم المدينة = غموض', {city:'الدقهلية', address1:'كفر سعد وشربين', province:'Dakahlia', provinceCode:'DK'}, 'ambiguous'],
  // تلات احتمالات، واحد منهم بيكرر اسم المدينة — العدد أكتر من ٢، فالاستبعاد
  // التلقائي **مايتطبّقش** والصف لازم يفضل غموض (شرط أحمد 26-09-2026).
  ['طلخا/كفر سعد/شربين (٣ احتمالات) = غموض', {city:'الدقهلية', address1:'طلخا كفر سعد شربين', province:'Dakahlia', provinceCode:'DK'}, 'ambiguous'],
  // محافظة مش في الجدول = وقف صريح، مش تخمين
  ['محافظة مش في الجدول',        {city:'مكان', address1:'عنوان', province:'Nowhere', provinceCode:'ZZ'}, 'BLOCKED'],
];

let pass = 0;
for (const [label, sa, want] of cases) {
  const p = api.resolveAddress({ shippingAddress: sa }, catalog);
  let got;
  if (!p.ok) got = 'BLOCKED:' + p.error;
  else if (p.mode === 'district') got = p.districtName;
  else if (p.ambiguous) got = 'ambiguous';
  else if (p.cityDoubt) got = 'cityDoubt';
  else got = 'province-only';
  const ok = want === 'BLOCKED' ? got.startsWith('BLOCKED:') : got === want;
  if (ok) pass++;
  console.log(`${ok?'✅':'❌'} ${label}\n     المتوقع: ${want}  ·  الناتج: ${got}`);
  if (p.ok && p.candidates.length > 1)
    console.log(`     الاحتمالات: ${p.candidates.map(c=>`${c.name} (${c.matchedText} من ${c.fieldLabel})`).join(' | ')}`);
  if (p.ok && p.crossCity?.length)
    console.log(`     اقتراح مدينة: ${p.crossCity.slice(0,3).map(c=>`${c.cityName} → ${c.districtName} (${c.matchedText})`).join(' | ')}`);
}
console.log(`\n${pass}/${cases.length} نجحت`);

process.exit(pass === cases.length ? 0 : 1);
