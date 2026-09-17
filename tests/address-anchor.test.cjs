// ══════════════════════════════════════════════════════════════
// المرساة — نص البحث الجاهز لنافذة اختيار المنطقة
//   node tests/address-anchor.test.cjs
//
// 🔴 البند اللي بيحميه: المرساة **نص بحث، مش قرار**. لو حد حوّلها لمطابقة
//    (كتب `districtId` بتاعها في الخطة أو خلّى الصف `uploadable`) الصف بياخد
//    علامة خضرا على منطقة **مخمّنة من كلمة واحدة** — وده بالظبط الفخ اللي
//    جدول المحافظات المقفول وقاعدة «اقتراح مش قرار» اتكتبوا عشانه.
// 🔴 والبند التاني: النص المرجوع لازم يبقى كلمة من الاسم **الخام** زي ما هو
//    في الكتالوج. بحث الواجهة بيقارن على النص الخام، و`normText` بتحوّل ة→ه —
//    فكلمة مطبَّعة كانت هترجّع «مفيش مناطق مطابقة» على منطقة موجودة فعلًا.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname,'..','index.js'),'utf8').replace(/export default \{[\s\S]*$/,'');
const api = new Function(src + `
 return { normText, ensureNormalized, addressFields, resolveAddress, findAddressAnchor };`)();

const D = (id,name,nameAr,zone='Z') => ({ id, name, nameAr, zone, zoneAr:'', dropOff:true });

// كتالوج مصغّر بأسماء حقيقية من بوسطة
const catalog = { cities: [
  { cityId:'Jrb6X6ucjiYgMP4T7', cityName:'Alexandria', cityAr:'الاسكندرية', districts:[
      D('a1','King Maryout','كنج مريوط'),
      D('a2','El Agamy','العجمي'),
      D('a3','Sidi Bishr','سيدي بشر'),
      D('a4','Smouha','سموحة'),
      // «الجديدة» متكررة عن قصد — الفرادة لازم تسقّطها
      D('a5','El Manshia El Gedida','المنشية الجديدة'),
      D('a6','El Max El Gedida','المكس الجديدة'),
      // اسم المحافظة جوّه اسم منطقة — الحارس العامّ لازم يسقّطه
      D('a7','Alexandria Port','ميناء الاسكندرية'),
  ]},
  { cityId:'ruBSjGBDX9wpRa3cc', cityName:'Monufia', cityAr:'المنوفية', districts:[
      D('m1','ElBagour','الباجور'), D('m2','Ashmoun','اشمون'),
  ]},
]};
api.ensureNormalized(catalog);

const alx = catalog.cities[0];
const SA  = (city,address1) => ({ city, address1, province:'Alexandria', provinceCode:'ALX' });
const plan = sa => api.resolveAddress({ shippingAddress: sa }, catalog);
const anchorOf = sa => api.findAddressAnchor(alx, api.addressFields(sa));

let p=0,n=0; const chk=(l,ok,extra='')=>{n++;if(ok)p++;console.log(`${ok?'✅':'❌'} ${l}${extra?'\n     '+extra:''}`);};

console.log('── ① #55065 — الحالة اللي المرساة اتكتبت عشانها ──');
// العميل كتب «الكينج» والمنطقة «كنج» — فرق حرف واحد أسقط المطابقة الكاملة
const sa55065 = SA('الاسكندرية','الكينج مريوط قبلي السكه فيلا وليد الحو بجوار فيلا تواضرس');
const p55065  = plan(sa55065);
chk('المطابقة لسه فاشلة — الدرجة ما اتغيّرتش', p55065.mode === 'province' && !p55065.ambiguous,
    `mode=${p55065.mode}`);
chk('والمرساة لقت «مريوط»', p55065.addressAnchor?.text === 'مريوط',
    JSON.stringify(p55065.addressAnchor));
chk('وواصلة لمنطقة كنج مريوط (للقياس فقط)', p55065.addressAnchor?.districtId === 'a1');
// 🔴 ده هو البند: المرساة **مش** بتحسم العنوان
chk('🔴 ومافيش districtId في الخطة — الصف لسه محتاج قرار', !p55065.districtId);

console.log('\n── ② الفرادة هي الحارس ──');
// «الجديدة» في منطقتين — بتسقط، والمرساة بتنزل للكلمة اللي بعدها
// «الجديده» أول كلمة عن قصد — لو الفرادة اتشالت، هي اللي كانت هتكسب
const saM = SA('الاسكندرية','الجديده المنشيه شارع البحر');
const aM  = anchorOf(saM);
chk('كلمة في أكتر من منطقة مابتترسيش', aM?.token !== 'الجديده', JSON.stringify(aM));
chk('والكلمة الفريدة هي اللي كسبت', aM?.districtId === 'a5', JSON.stringify(aM));
// عنوان مالوش أي كلمة فريدة في الكتالوج = مفيش مرساة، مش مرساة ضعيفة
chk('عنوان بلا أي كلمة فريدة = مفيش مرساة',
    anchorOf(SA('الاسكندرية','شارع الجديدة الجديده رقم 12')) === null);

console.log('\n── ③ 🔴 النص كلمة من الاسم الخام مش المطبَّع ──');
// `normText` بتحوّل ة→ه — والواجهة بتبحث على الخام. لو رجعنا المطبَّع، الموظف
// بيقرا «مفيش مناطق مطابقة» على منطقة موجودة قدامه.
chk('«المنشية» بالتاء المربوطة زي الكتالوج', aM?.text === 'المنشية',
    `المطبَّع: ${aM?.token}  ·  المرجوع: ${aM?.text}`);
const raw = alx.districts.find(d => d.id === aM?.districtId);
chk('🔴 والنص المرجوع جوّه الاسم الخام فعلًا (ضابط بحث الواجهة)',
    `${raw.name} ${raw.nameAr}`.toLowerCase().includes((aM?.text||'').toLowerCase()));
chk('ونفس الضابط على #55065',
    `${alx.districts[0].name} ${alx.districts[0].nameAr}`.includes(p55065.addressAnchor.text));

console.log('\n── ④ الفروع اللي مابتاخدش مرساة ──');
// مطابقة كاملة — المنطقة مثبّتة أول القايمة، وبحث جاهز بيخفيها
const pDist = plan(SA('الاسكندرية','سيدي بشر بحري شارع خالد بن الوليد'));
chk('مطابقة كاملة (district) بلا مرساة', pDist.mode === 'district' && !pDist.addressAnchor,
    `mode=${pDist.mode}`);
// غموض — المرشحين مثبّتين فوق
const amb = plan(SA('الاسكندرية','العجمي بجوار سموحة'));
chk('❓ الغموض بلا مرساة', !amb.addressAnchor, `mode=${amb.mode} ambiguous=${amb.ambiguous}`);
// 🟠 المدينة مشكوك فيها — اقتراح المحافظة التانية أقوى، والبحث بيخفيه
const doubt = plan(SA('الاسكندرية','الباجور المنوفيه امام مركز الشرطة'));
chk('🟠 المحافظة المشكوك فيها بلا مرساة', doubt.cityDoubt && !doubt.addressAnchor,
    `cityDoubt=${doubt.cityDoubt}`);

console.log('\n── ⑤ حراس الكلمة نفسها ──');
chk('اسم المحافظة نفسه مابيترسيش (عامّ)',
    anchorOf(SA('الاسكندرية','الاسكندرية شارع فؤاد')) === null);
chk('كلمة أقصر من 4 حروف مابترسيش',
    anchorOf(SA('حي','سمو 12')) === null);

console.log('\n── ⑥ حارس المدينة الفاضية ──');
// 🔴 نفس حارس `findLocalZones`: مدينة `null` كانت هتوقّع `get_orders` كلها
let threw = false;
try { api.findAddressAnchor(null, api.addressFields(sa55065)); } catch { threw = true; }
chk('findAddressAnchor(null) مابترميش', !threw);

console.log(`\n${p}/${n} نجحت`);
process.exit(p===n?0:1);
