// ══════════════════════════════════════════════════════════════
// اختبار منطق حالة الصف في الواجهة — يتشغّل بـ:  node tests/row-state.test.cjs
//
// بيحمّل الـ <script> بتاع index.html في sandbox بـ DOM مزيّف وبيتأكد من:
//   · تصنيف الصف (district · ambiguous · cityDoubt · cityFixed)
//   · 🟠 صف «المدينة مشكوك فيها» مستثنى من «تحديد الكل» — والاستثناء بيروح
//     بمجرد ما الموظف يراجع المدينة
//   · نص الحالة بيقول المدينة المعدّلة صراحةً
//   · 🔴 (قرار أحمد 15-09-2026) ❓ أكتر من مطابقة · 🟠 المحافظة مشكوك فيها ·
//     و🏙️ المحافظة فقط (من غير تثبيت) بيفضلوا موقوفين تمامًا — مش بس مستثنيين
//     من «تحديد الكل» — لحد ما الموظف ياخد قرار صريح
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

const tail = '\nreturn { rowAddrMode, rowNeedsCityDecision, rowNeedsManualAddressConfirm,' +
             ' isAutoSelectable, addrModeInfo, effCity,' +
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
 // 🔴 مطابقة تلقائية خالص — مفيش منطقة ولا غموض ولا شك مدينة، بس مفيش تثبيت
 {orderId:'H',uploadable:true,addressOk:true,mode:'province',cityName:'Giza',cityId:'g',ambiguous:false,cityDoubt:false,crossCity:[]},
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
chk('D موقوف مستثنى',            api.isAutoSelectable(rows[3]), false);

// ─── 🔴 حارس التأكيد اليدوي الإضافي (قرار أحمد 15-09-2026) ─────
// ❓ أكتر من مطابقة · 🟠 المحافظة مشكوك فيها · و🏙️ المحافظة فقط (من غير
// تثبيت) بيفضلوا موقوفين — الشيك بوكس مقفول ومستحيلين في «تحديد الكل»/
// «رفع الكل»/«رفع المحدد» — لحد ما الموظف ياخد قرار صريح.
console.log('\n— حارس التأكيد اليدوي: أكتر من مطابقة · محافظة مشكوك فيها · محافظة فقط —');
chk('C (غامضة) موقوفة تمامًا لحد ما تتحل',  api.rowUploadable(rows[2]), false);
chk('C (غامضة) بره تحديد الكل',            api.isAutoSelectable(rows[2]), false);
chk('H (المحافظة فقط من غير تثبيت) موقوفة', api.rowUploadable(rows[4]), false);
chk('H محتاجة تأكيد يدوي',                  api.rowNeedsManualAddressConfirm(rows[4]), true);

// اختيار منطقة بيحل الغموض فعلًا
api.ov['C'] = { districtId:'1', districtName:'Mansoura', cityId:'d', cityName:'Dakahlia' };
chk('C بعد اختيار منطقة بقت district',      api.rowAddrMode(rows[2]), 'district');
chk('وبقت تترفع',                           api.rowUploadable(rows[2]), true);
delete api.ov['C'];

// «ارفع على المحافظة فقط» (forceProvince) بيحل الغموض والمحافظة فقط الاتنين
api.ov['C'] = { forceProvince: true };
chk('C بعد التثبيت على المحافظة بقت تترفع', api.rowUploadable(rows[2]), true);
delete api.ov['C'];

chk('H قبل التثبيت لسه موقوفة',             api.rowUploadable(rows[4]), false);
api.ov['H'] = { forceProvince: true };
chk('H بعد التثبيت على المحافظة بقت تترفع', api.rowUploadable(rows[4]), true);
chk('ومابقتش محتاجة تأكيد يدوي',            api.rowNeedsManualAddressConfirm(rows[4]), false);
delete api.ov['H'];

api.ov['B'] = { cityId:'c', cityName:'Cairo' };
chk('B بعد تعديل المدينة',        api.rowAddrMode(rows[1]),      'cityFixed');
chk('B بقى داخل تحديد الكل',      api.isAutoSelectable(rows[1]), true);
// 🔤 `effCity` بترجّع الاسمين — العمود بيعرض العربي واللي بيتبعت هو الإنجليزي.
//    الاسم العربي الفاضي بيفضل سلسلة فاضية عشان `displayName` ترجع للإنجليزي.
chk('B المدينة الفعلية',          api.effCity(rows[1]),
    {cityId:'c',cityName:'Cairo',cityNameAr:'',changed:true});
api.ov['B'] = { cityId:'c', cityName:'Cairo', cityNameAr:'القاهرة' };
chk('B الاسم العربي بيعدّي مع التعديل اليدوي', api.effCity(rows[1]).cityNameAr, 'القاهرة');

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

// 🔴 (v2.19.3 · طلب أحمد 22-09-2026) الدرجة الأقل بقت بتحرّر كمان — الموظف
//    بياخد تأكيد صريح في `coverageBlocksDegree` قبل التثبيت
api.ov['E'] = { forceProvince: true };
chk('«ارفع على المحافظة بس» بقت بتحرّر (بعد تأكيد صريح)', api.rowUploadable(cov),   true);
api.ov['E'] = { forceZone: true, zoneId:'z-dahab', zoneName:'Dahab' };
chk('و«ارفع على الزون بس» بقت بتحرّر (بعد تأكيد صريح)',   api.rowUploadable(cov),   true);

// ⚠️ وصف موقوف لسبب تاني (مش التغطية) مابيتحرّرش بالتعديل — `coverageOnly`
//    بتيجي `false` من الـ Worker لما يكون فيه مانع تاني، فالتعديل مالوش أثر.
api.ov['D'] = { cityId:'c', cityName:'Cairo', districtId:'d9', districtName:'X' };
chk('D (تليفون ناقص) بيفضل موقوف', api.rowUploadable(rows[3]),    false);
delete api.ov['D']; delete api.ov['E'];

// ─── الصف المرفوع فعلًا — «مرفوع» أسبق من «موقوف» ─────────────
// 🔴 الرفع **مابيحركش حالة الأوردر**، فالصف بيرجع في القايمة بعد التحديث
//    (ده مقصود). و`districtOverride` بيتمسح مع كل تحميل، فالصف اللي كان خارج
//    التغطية بيرجع موقوف — وساعتها كان بيقرا «⛔ موقوف» **ورقم التتبع يختفي**،
//    يعني الصف يبان «لسه ما اترفعش» وهو مرفوع فعلًا بشحنة بفلوس. وبادج
//    «🔁 مرفوع» هو الحارس المرئي الوحيد ضد إعادة الرفع.
console.log('\n— الصف المرفوع قبل كده —');
const upBlocked = { ...cov, orderId:'F', alreadyUploaded:true, previousTracking:'8464592804' };
api.setRows([...rows, upBlocked]);

chk('مرفوع وموقوف: البادج بيقول «مرفوع»', api.rowUpState(upBlocked),  'uploaded');
chk('والتسمية «مرفوع قبل كده»',          api.rowUpLabel(upBlocked),  'مرفوع قبل كده');
// 🔴 والمنع **ما ضعفش** — عايش في rowUploadable مش في البادج
chk('والرفع لسه موقوف',                  api.rowUploadable(upBlocked), false);
chk('ومستبعد من «تحديد الكل»',            api.isAutoSelectable(upBlocked), false);

// ⚠️ والضابط: صف مرفوع ومفيهوش أي مانع لسه بيقرا «مرفوع» زي ما هو
const upOk = { ...rows[0], orderId:'G', alreadyUploaded:true, previousTracking:'111' };
api.setRows([...rows, upBlocked, upOk]);
chk('وصف مرفوع سليم زي ما هو',           api.rowUpState(upOk),        'uploaded');
chk('وصف موقوف مش مرفوع لسه «موقوف»',     api.rowUpState(rows[3]),     'blocked');
chk('وصف سليم مش مرفوع «جاهز»',           api.rowUpState(rows[0]),     'ready');

console.log(`\n${p}/${n} نجحت`);
process.exit(p === n ? 0 : 1);
