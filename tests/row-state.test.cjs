// ══════════════════════════════════════════════════════════════
// اختبار منطق حالة الصف في الواجهة — يتشغّل بـ:  node tests/row-state.test.cjs
//
// بيحمّل الـ <script> بتاع index.html في sandbox بـ DOM مزيّف وبيتأكد من:
//   · تصنيف الصف (district · ambiguous · cityDoubt · cityFixed)
//   · 🟠 صف «المدينة مشكوك فيها» مستثنى من «تحديد الكل» — والاستثناء بيروح
//     بمجرد ما الموظف يراجع المدينة
//   · نص الحالة بيقول المدينة المعدّلة صراحةً
// ══════════════════════════════════════════════════════════════
// اختبار منطق الواجهة: حالة الصف · استثناء تحديد الكل · نص الحالة
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const src  = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const el = { classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{}, dataset:{},
  addEventListener(){}, querySelectorAll(){return []}, appendChild(){}, focus(){},
  value:'', textContent:'', innerHTML:'', checked:false };
const doc = { getElementById:()=>el, querySelector:()=>el, querySelectorAll:()=>[],
  addEventListener(){}, body:el, contains(){return false}, createElement:()=>el };
const win = { addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}),
  scrollY:0, innerWidth:1400, devicePixelRatio:1 };
const ls  = { getItem:()=>null, setItem(){}, removeItem(){} };

const tail = '\nreturn { rowAddrMode, rowNeedsCityDecision, isAutoSelectable, addrModeInfo, effCity,' +
             ' rowUploadable, rowUpState, rowUpLabel, rowCoverageOverridden,' +
             ' ov: districtOverride, setRows(r){ allRows = r; } };';
const api = new Function('document','window','localStorage','Chart','ExcelJS', src + tail)(doc, win, ls, undefined, undefined);

const rows = [
 {orderId:'A',uploadable:true,addressOk:true,mode:'district',districtName:'Qalin',cityName:'Kafr Alsheikh',cityId:'k',ambiguous:false,cityDoubt:false,crossCity:[]},
 {orderId:'B',uploadable:true,addressOk:true,mode:'province',cityName:'El Kalioubia',cityId:'q',ambiguous:false,cityDoubt:true,
  crossCity:[{cityId:'c',cityName:'Cairo',districtId:'d1',districtName:'Obour',matchedText:'العبور',fieldLabel:'العنوان'}]},
 {orderId:'C',uploadable:true,addressOk:true,mode:'province',cityName:'Dakahlia',cityId:'d',ambiguous:true,cityDoubt:false,
  candidates:[{id:'1',name:'Mansoura'},{id:'2',name:'Aga'}],crossCity:[]},
 {orderId:'D',uploadable:false,addressOk:true,mode:'province',cityName:'Cairo',cityId:'c',ambiguous:false,cityDoubt:false,crossCity:[],problems:['تليفون ناقص']},
];
api.setRows(rows);

let p = 0, n = 0;
const chk = (label, got, want) => {
  n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (ok) p++;
  console.log(`${ok?'✅':'❌'} ${label} → ${JSON.stringify(got)}${ok?'':'  (متوقع '+JSON.stringify(want)+')'}`);
};

chk('A مطابقة مؤكدة',            api.rowAddrMode(rows[0]),      'district');
chk('B المدينة مشكوك فيها',       api.rowAddrMode(rows[1]),      'cityDoubt');
chk('C غامضة',                   api.rowAddrMode(rows[2]),      'ambiguous');
chk('B مستثنى من تحديد الكل',     api.isAutoSelectable(rows[1]), false);
chk('A داخل تحديد الكل',          api.isAutoSelectable(rows[0]), true);
chk('C (غامضة) داخل تحديد الكل',  api.isAutoSelectable(rows[2]), true);
chk('D موقوف مستثنى',            api.isAutoSelectable(rows[3]), false);

api.ov['B'] = { cityId:'c', cityName:'Cairo' };
chk('B بعد تعديل المدينة',        api.rowAddrMode(rows[1]),      'cityFixed');
chk('B بقى داخل تحديد الكل',      api.isAutoSelectable(rows[1]), true);
chk('B المدينة الفعلية',          api.effCity(rows[1]),          {cityId:'c',cityName:'Cairo',changed:true});

api.ov['B'] = { cityId:'c', cityName:'Cairo', districtId:'d1', districtName:'Obour' };
chk('B بعد اختيار المنطقة',       api.rowAddrMode(rows[1]),      'district');
chk('B نص الحالة',               api.addrModeInfo(rows[1]).label, '📍 Obour (مدينة Cairo)');

delete api.ov['B'];
chk('B رجع للتلقائي',            api.rowAddrMode(rows[1]),      'cityDoubt');

// ─── الصف الموقوف على التغطية — التعديل اليدوي بيحرّره ────────
// 🔴 `r.uploadable` قيمة السيرفر وقت التحميل، محسوبة على المطابقة **التلقائية**.
//    التدخّل اليدوي بيحصل بعد كده في الصفحة ومفيش حاجة بترجع تحسبها، فأي مكان
//    بيقرا `r.uploadable` خام كان بيقرا رقم بايت: البادج بيخضرّ («عنوان مظبوط»)
//    والصف يفضل ⛔ موقوف والشيك بوكس متقفول — من غير أي رسالة تقول ليه.
console.log('\n— الصف خارج التغطية —');
const cov = { orderId:'E', uploadable:false, coverageOnly:true, addressOk:true,
  mode:'coverageBlocked', cityName:'South Sinai', cityId:'s', ambiguous:false, cityDoubt:false,
  crossCity:[], problems:[], blockedDistricts:[{ id:'d-taba', name:'Taba' }] };
api.setRows([...rows, cov]);

chk('E موقوف قبل أي تعديل',       api.rowUploadable(cov),        false);
chk('وحالة الرفع «موقوف»',        api.rowUpLabel(cov),           'موقوف');
chk('ومستثنى من تحديد الكل',      api.isAutoSelectable(cov),     false);

api.ov['E'] = { cityId:'s', cityName:'South Sinai', districtId:'d-dahab', districtName:'Dahab' };
chk('بعد اختيار منطقة: بقى يترفع', api.rowUploadable(cov),        true);
chk('وحالة الرفع بقت «جاهز»',      api.rowUpLabel(cov),           'جاهز');
chk('ودخل تحديد الكل',            api.isAutoSelectable(cov),     true);
// ⚠️ القرار ده لازم يفضل **باين**: البادج بقى 📍 زي أي اختيار يدوي، فالتلميح
//    هو الأثر الوحيد الباقي على إن العنوان ده كان خارج التغطية.
chk('والقرار لسه متعلّم',          api.rowCoverageOverridden(cov), true);
chk('والتلميح بيقول إنه كان خارج التغطية',
    /كان خارج التغطية/.test(api.addrModeInfo(cov).hint), true);

// 🔴 الضابط — الدرجة الأقل مابتحرّرش: بتغيّر درجة العنوان مش العنوان نفسه
api.ov['E'] = { forceProvince: true };
chk('«ارفع على المحافظة بس» مابيحرّرش', api.rowUploadable(cov),   false);
api.ov['E'] = { forceZone: true, zoneId:'z-dahab', zoneName:'Dahab' };
chk('و«ارفع على الزون بس» مابيحرّرش',   api.rowUploadable(cov),   false);

// ⚠️ وصف موقوف لسبب تاني (مش التغطية) مابيتحرّرش بالتعديل — `coverageOnly`
//    بتيجي `false` من الـ Worker لما يكون فيه مانع تاني، فالتعديل مالوش أثر.
api.ov['D'] = { cityId:'c', cityName:'Cairo', districtId:'d9', districtName:'X' };
chk('D (تليفون ناقص) بيفضل موقوف', api.rowUploadable(rows[3]),    false);
delete api.ov['D']; delete api.ov['E'];

console.log(`\n${p}/${n} نجحت`);
process.exit(p === n ? 0 : 1);
