// ══════════════════════════════════════════════════════════════
// رحلة الاقتراح الجاهز في النافذة — node tests/zone-picker-flow.test.cjs
//
// 🔴 البند اللي بيحميه: `chooseZone` بتقارن بمدينة **الصف** مش بالمدينة
//    المعروضة في النافذة. الربط بـ dpCityId كان بيسيب الصف من غير تسجيل لو
//    النافذة أصلًا واقفة على المدينة المقترحة — والرفع يمشي على مدينة الجدول
//    الغلط في صمت. الاختبار ده هو اللي كشفه.
// ══════════════════════════════════════════════════════════════
const fs=require('fs');
const src=fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
let listHTML='';
const mk=id=>({id,classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},dataset:{},
  addEventListener(){},querySelectorAll(){return[]},appendChild(){},focus(){},value:'',textContent:'',
  set innerHTML(v){ if(this.id==='dpList') listHTML=v; }, get innerHTML(){return '';}, checked:false});
const els={};
const doc={getElementById:id=>(els[id]||(els[id]=mk(id))),querySelector:()=>mk(),querySelectorAll:()=>[],
  addEventListener(){},body:mk(),contains(){return false},createElement:()=>mk()};
const win={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollY:0,innerWidth:1400,devicePixelRatio:1};
const api=new Function('document','window','localStorage','Chart','ExcelJS', src +
 `\nreturn { renderDistrictList, chooseZone, clearZoneFilter, addrModeInfo,
    setup(rows,districts,cities,orderId,cityId){ allRows=rows; dpDistricts=districts; dpCities=cities;
      dpOrderId=orderId; dpCityId=cityId; dpLoading=false; },
    zf(){ return dpZoneFilter; }, ov(){ return districtOverride; } };`
)(doc,win,{getItem:()=>null,setItem(){},removeItem(){}});

const D=(id,name,nameAr,zone,zoneAr)=>({id,name,nameAr,zone,zoneAr});
const cairo=[
  D('o1',"Ahya'a El Obour El Jadida",'احياء العبور الجديده','Obour','العبور'),
  D('o2','Dar Masr - ElObour','دار مصر - العبور','Obour','العبور'),
  D('o3','District 01 (Obour)','المنطقة 01 (العبور)','Obour','العبور'),
  D('o4','District 02 (Obour)','المنطقة 02 (العبور)','Obour','العبور'),
  D('o5','District 03 (Obour)','المنطقة 03 (العبور)','Obour','العبور'),
  D('o6','District 04 (Obour)','المنطقة 04 (العبور)','Obour','العبور'),
  D('c1','Nasr City','مدينة نصر','Nasr City','مدينة نصر'),
  D('c2','Maadi','المعادي','Maadi','المعادي'),
];
const row={orderId:'B',orderNumber:'#53699',uploadable:true,addressOk:true,mode:'province',
  cityName:'El Kalioubia',cityId:'q',province:'Qalyubia',ambiguous:false,cityDoubt:true,candidates:[],localZones:[],
  address1:'العبور الحي الخامس بلوك ١٦٠٢٧فيلا٢١',address2:'',addressCity:'العبور',
  crossCity:[{kind:'zone',cityId:'c',cityName:'Cairo',zone:'Obour',zoneAr:'العبور',districtCount:6,
              matchedText:'العبور',fieldLabel:'مدينة شوبيفاي'}]};
const cities=[{cityId:'q',cityName:'El Kalioubia',cityAr:'القليوبيه'},{cityId:'c',cityName:'Cairo',cityAr:'القاهره'}];

let p=0,n=0; const chk=(l,ok,extra='')=>{n++;if(ok)p++;console.log(`${ok?'✅':'❌'} ${l}${extra?'  '+extra:''}`);};

console.log('── ① بادج الجدول ──');
api.setup([row],[],cities,'B','q');
const info=api.addrModeInfo(row);
console.log('   ', info.label);
chk('البادج بيسمّي المدينة المقترحة', info.label === '🟠 Cairo؟');
chk('التلميح بيقول عدد المناطق', /6 منطقة/.test(info.hint));

console.log('\n── ② النافذة قبل الضغط (على القليوبية) ──');
api.setup([row],[],cities,'B','q');
api.renderDistrictList();
// القايمة بقت جدول (منطقة · زون · سبب المطابقة) — اسم الزون في شبشة الزون
// كامل من غير قص، مش جوّه سطر النص. الشرط لسه هو هو: الاقتراح بيسمّي الزون.
chk('الاقتراح ظاهر مثبّت', /class="dp-zone[^"]*"[^>]*>[^<]*Obour/.test(listHTML));
chk('مكتوب عدد المناطق', listHTML.includes('6 منطقة'));
chk('مكتوب طابق إيه ومن أنهي خانة', listHTML.includes('طابق "العبور" في مدينة شوبيفاي'));

console.log('\n── ③ بعد الضغط على الاقتراح ──');
api.setup([row],cairo,cities,'B','c');       // كأن loadDpCity حمّلت القاهرة
api.chooseZone('c','Cairo','Obour');
chk('المدينة اتسجّلت كتدخّل يدوي', api.ov()['B']?.cityId === 'c', JSON.stringify(api.ov()['B']));
chk('مفيش منطقة اتختارت تلقائيًا', !api.ov()['B']?.districtId);
chk('القايمة اتقصرت على الزون', api.zf() === 'Obour');
const shown=(listHTML.match(/class="dp-item/g)||[]).length;
chk('٦ مناطق ظاهرة بس (مش ٨)', shown === 6, `ظهر ${shown}`);
chk('مناطق العبور ظاهرة', listHTML.includes('District 01 (Obour)'));
chk('مناطق برّه الزون مخفية', !listHTML.includes('Nasr City') && !listHTML.includes('Maadi'));
chk('زرار شيل القصر موجود', listHTML.includes('dp-clear-zone'));

console.log('\n── ④ شيل القصر ──');
api.clearZoneFilter();
const all=(listHTML.match(/class="dp-item/g)||[]).length;
chk('كل المناطق رجعت', all === 8, `ظهر ${all}`);

console.log(`\n${p}/${n} نجحت`);
process.exit(p===n?0:1);
