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

console.log(`\n${p}/${n} نجحت`);
process.exit(p === n ? 0 : 1);
