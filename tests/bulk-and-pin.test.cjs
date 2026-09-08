// ══════════════════════════════════════════════════════════════
// «رفع الكل» + تثبيت المنطقة المطابقة — node tests/bulk-and-pin.test.cjs
//
// البنود اللي بيحميها:
//   🔴 «رفع الكل» بيشتغل على `visibleRows` (الفلتر الحالي) مش على `allRows` —
//      الربط بـ allRows معناه رفع أوردرات مش ظاهرة على الشاشة أصلًا.
//   🟠 صفوف «المدينة مشكوك فيها» مستثناة من «رفع الكل» زيها زي «تحديد الكل».
//   🔴 المنطقة المطابقة بتتثبّت **أول** القايمة بعلامة بصرية صريحة — قبل كده
//      كانت في مكانها الأبجدي وسط ٤٠٠ صف بلون أزرق باهت، فالموظف كان بيدوّر
//      بالبحث على الحاجة اللي المطابقة لقتها له أصلًا.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const src  = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let listHTML = '';
const mk = id => ({ id, classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{}, dataset:{},
  addEventListener(){}, querySelectorAll(){return []}, appendChild(){}, focus(){},
  value:'', textContent:'', checked:false,
  set innerHTML(v){ if (this.id === 'dpList') listHTML = v; }, get innerHTML(){ return ''; } });
const els = {};
const doc = { getElementById:id=>(els[id]||(els[id]=mk(id))), querySelector:()=>mk(), querySelectorAll:()=>[],
  addEventListener(){}, body:mk(), contains(){return false}, createElement:()=>mk() };
const win = { addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}),
  scrollY:0, innerWidth:1400, devicePixelRatio:1 };

const api = new Function('document','window','localStorage','Chart','ExcelJS', src +
 `\nreturn { isAutoSelectable, renderDistrictList,
    setVisible(r){ visibleRows = r; }, allSel(){ return visibleRows.filter(isAutoSelectable).map(r => r.orderId); },
    setDp(rows, districts, orderId, cityId){ allRows = rows; dpDistricts = districts;
      dpCities = [{cityId, cityName:'Behira'}]; dpOrderId = orderId; dpCityId = cityId;
      dpLoading = false; dpZoneFilter = null; districtOverride = {}; },
    setOv(o){ districtOverride = o; } };`
)(doc, win, {getItem:()=>null,setItem(){},removeItem(){}}, undefined, undefined);

let p = 0, n = 0;
const chk = (label, got, want) => {
  n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (ok) p++;
  console.log(`${ok?'✅':'❌'} ${label} → ${JSON.stringify(got)}${ok?'':'  (متوقع '+JSON.stringify(want)+')'}`);
};

// ─── ① «رفع الكل» = المعروض حسب الفلتر، من غير 🟠 ومن غير الموقوف ───
console.log('\n── ① رفع الكل ──');
const R = (id, extra) => Object.assign({ orderId:id, uploadable:true, addressOk:true, mode:'district',
  districtName:'X', cityName:'Behira', cityId:'beh', ambiguous:false, cityDoubt:false, crossCity:[] }, extra);
const all = [ R('A'), R('B', {mode:'province', cityDoubt:true,
                crossCity:[{cityId:'c',cityName:'Cairo',districtId:'d1',districtName:'Obour',matchedText:'العبور'}]}),
              R('C', {uploadable:false, problems:['تليفون ناقص']}), R('D') ];

api.setVisible(all);
chk('كل المعروض — 🟠 والموقوف بره', api.allSel(), ['A','D']);

api.setVisible([ all[0] ]);          // الفلتر ضيّق المعروض لصف واحد
chk('الفلتر بيقصّر «رفع الكل»',      api.allSel(), ['A']);

api.setVisible([]);
chk('مفيش معروض → مفيش رفع',        api.allSel(), []);

// ─── ② المنطقة المطابقة مثبّتة أول القايمة ───
console.log('\n── ② تثبيت المنطقة المطابقة ──');
const D = (id, name) => ({ id, name, nameAr:name, zone:'Z', zoneAr:'ز' });
// الكتالوج مترتّب بحيث «Rashid» تيجي **آخر** واحدة أبجديًا
const districts = [ D('d1','Abu ElMatamir'), D('d2','ElDelingat'), D('r1','Rashid'), D('d3','Zomr ElNakhl') ];
const row = R('A', { districtId:'r1', districtName:'Rashid',
  candidates:[{ id:'r1', name:'Rashid', matchedText:'رشيد', fieldLabel:'المدينة (شوبيفاي)' }] });

api.setDp([row], districts, 'A', 'beh');
api.renderDistrictList();

const firstItem = listHTML.slice(listHTML.indexOf('dp-item'), listHTML.indexOf('dp-item') + 400);
chk('أول صف في القايمة هو المطابق', /Rashid/.test(firstItem), true);
chk('عليه علامة is-match',          /is-match/.test(firstItem), true);
chk('وبادج مكتوبة',                 listHTML.includes('✅ المطابقة الحالية'), true);
chk('وسبب المطابقة تحته',           listHTML.includes('طابق &quot;رشيد&quot; في المدينة (شوبيفاي)'), true);
chk('ترويسة المطابقة التلقائية',    listHTML.includes('dp-group-hdr match'), true);
// 🔴 عمود «سبب المطابقة» اتشال — كان بيعرض «—» في كل الصفوف
chk('مفيش عمود سبب مطابقة',         listHTML.includes('dp-cell-why'), false);
chk('الترويسة عمودين بس',           (listHTML.match(/dp-thead/g) || []).length, 1);
// وبتفضل موجودة في مكانها الأبجدي كمان
chk('موجودة مرتين (مثبّتة + أبجدي)', (listHTML.match(/chooseDistrict\('r1'/g) || []).length, 2);

// اختيار يدوي → البادج بتتغيّر
api.setOv({ A: { districtId:'d2', districtName:'ElDelingat', cityId:'beh', cityName:'Behira' } });
api.renderDistrictList();
chk('الاختيار اليدوي هو المثبّت',   listHTML.slice(listHTML.indexOf('dp-item')).startsWith('dp-item is-match') ||
                                     /dp-item is-match[\s\S]{0,300}ElDelingat/.test(listHTML), true);
chk('بادج «اختيارك»',               listHTML.includes('✅ اختيارك'), true);

console.log(`\n${p}/${n} نجحت`);
process.exit(p === n ? 0 : 1);
