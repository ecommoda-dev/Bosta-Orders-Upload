// ══════════════════════════════════════════════════════════════
// الاسم العربي والإنجليزي — node tests/bilingual-names.test.cjs
//
// 🔴 البند اللي بيحميه: بوسطة بترجّع **حقلين منفصلين** لكل مستوى عنوان
//    (`name` إنجليزي · `otherName`/`nameAr` عربي)، والشكل «EN — AR» **إحنا
//    اللي بنركّبه**. الاختبار ده بيحرس التلات قواعد اللي بتتكسر بصمت:
//      ① النافذة بتلزق الاسمين — بحارس التطابق (مايطلعش «Tanta — Tanta»)
//        وحارس الفاضي (مايطلعش « — المنشية» بشرطة بادئة بلا اسم).
//      ② الجدول والتصدير بيعرضوا **العربي وإلا الإنجليزي** — وممنوع الخانة
//        تفضى لما الكتالوج مالوش اسم عربي.
//      ③ الاسم المخزَّن في `override` بيتقرا من **الكتالوج بالـ id**، مش
//        بفكّ الليبل المعروض على نفس الشرطة اللي اتركّب بيها.
//      ④ البحث مطبَّع على الناحيتين — «المنشيه» بتلاقي «المنشية».
// ══════════════════════════════════════════════════════════════
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8')
            .match(/<script>([\s\S]*?)<\/script>/)[1];
let listHTML='';
const mk=id=>({id,classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},dataset:{},
  addEventListener(){},querySelectorAll(){return[]},appendChild(){},focus(){},value:'',textContent:'',
  set innerHTML(v){ if(this.id==='dpList') listHTML=v; }, get innerHTML(){return '';}, checked:false});
const els={};
const doc={getElementById:id=>(els[id]||(els[id]=mk(id))),querySelector:()=>mk(),querySelectorAll:()=>[],
  addEventListener(){},body:mk(),contains(){return false},createElement:()=>mk()};
const win={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollY:0,innerWidth:1400,devicePixelRatio:1};
const api=new Function('document','window','localStorage','Chart','ExcelJS', src +
 `\nreturn { bilingualName, displayName, normSearch, dpRow, dpPickOptions, dpPickChoose,
    renderDistrictList, chooseDistrict, cityCell, districtCell, addrModeInfo, effCity,
    ADDR_MODE_LABEL, ADDR_MODE_ITEMS,
    setup(rows,districts,cities,orderId,cityId){ allRows=rows; dpDistricts=districts; dpCities=cities;
      dpOrderId=orderId; dpCityId=cityId; dpLoading=false; districtOverride={}; dpZoneFilter=null;
      Object.keys(dpPickSearch).forEach(k=>{ dpPickSearch[k]=''; }); },
    setSearch(q){ document.getElementById('dpSearch').value = q; },
    setPickSearch(k,q){ dpPickSearch[k]=q; },
    ov(){ return districtOverride; } };`
)(doc,win,{getItem:()=>null,setItem(){},removeItem(){}});

let p=0,n=0; const chk=(l,ok,extra='')=>{n++;if(ok)p++;console.log(`${ok?'✅':'❌'} ${l}${extra?'  → '+extra:''}`);};
const dpName = html => (html.match(/class="dp-name">([\s\S]*?)<\/span>/)||[])[1];

const D=(id,name,nameAr,zone,zoneAr)=>({id,name,nameAr,zone,zoneAr});
// 🔴 الحالات دي كلها واردة من الكتالوج الحي — مش حالات متخيّلة:
//    · الحقلين متطابقين (منطقة مالهاش اسم عربي منفصل)
//    · الإنجليزي فاضي (الكتالوج رجّع العربي بس)
//    · الإنجليزي جوّاه نفس الشرطة اللي بنركّب بيها
const districts=[
  D('d1','Qesm ElZohour','قسم الزهور','ElZohour','الزهور'),
  D('d2','Tanta','Tanta','Tanta','Tanta'),
  D('d3','','المنشية','Manshia','المنشيه'),
  D('d4','Sidi Gaber — East','سيدي جابر — شرق','Sidi Gaber','سيدي جابر'),
];
const cities=[{cityId:'ps',cityName:'Port Said',cityAr:'بور سعيد'},
              {cityId:'nc',cityName:'North Coast',cityAr:''}];
const row={orderId:'X',orderNumber:'#55148',uploadable:true,addressOk:true,mode:'district',
  cityId:'ps',cityName:'Port Said',cityNameAr:'بور سعيد',
  districtId:'d1',districtName:'Qesm ElZohour',districtNameAr:'قسم الزهور',
  ambiguous:false,cityDoubt:false,candidates:[],crossCity:[],localZones:[],blockedDistricts:[]};

console.log('── ① حارس التطابق والفاضي في النافذة ──');
api.setup([row],districts,cities,'X','ps');
chk('الاسمين مختلفين → الاتنين', api.bilingualName('Qesm ElZohour','قسم الزهور')==='Qesm ElZohour — قسم الزهور');
chk('🔴 متطابقين → واحد بس (مش «Tanta — Tanta»)', api.bilingualName('Tanta','Tanta')==='Tanta',
    api.bilingualName('Tanta','Tanta'));
chk('🔴 الإنجليزي فاضي → بلا شرطة بادئة', api.bilingualName('','المنشية')==='المنشية',
    JSON.stringify(api.bilingualName('','المنشية')));
chk('صف القايمة: متطابقين مايتكررش', dpName(api.dpRow(districts[1],'',false,''))==='Tanta',
    dpName(api.dpRow(districts[1],'',false,'')));
chk('صف القايمة: الفاضي بلا شرطة بادئة', dpName(api.dpRow(districts[2],'',false,''))==='المنشية',
    dpName(api.dpRow(districts[2],'',false,'')));
const opts=api.dpPickOptions('district');
chk('القايمة المنسدلة بنفس الحارسين',
    opts.find(o=>o.id==='d2').label==='Tanta' && opts.find(o=>o.id==='d3').label==='المنشية');
chk('ومحافظة بلا اسم عربي بترجع للإنجليزي',
    api.dpPickOptions('city').find(o=>o.id==='nc').label==='North Coast');

console.log('\n── ② الجدول بالعربي — والرجوع للإنجليزي مش خانة فاضية ──');
chk('عمود «محافظة بوسطة» عربي', api.cityCell(row)==='بور سعيد', api.cityCell(row));
chk('عمود «المنطقة» عربي', api.addrModeInfo(row).label==='📍 قسم الزهور', api.addrModeInfo(row).label);
const noAr={...row,cityNameAr:'',districtNameAr:''};
chk('🔴 مفيش اسم عربي → الإنجليزي، مش فاضي', api.cityCell(noAr)==='Port Said'
    && api.addrModeInfo(noAr).label==='📍 Qesm ElZohour', api.cityCell(noAr));
// 🔴 الاسمين من **نفس المصدر** — محافظة معدّلة يدويًا مالهاش اسم عربي في
//    الكتالوج ماتاخدش عربي المحافظة الأصلية (كان بيدّي عمود بيقول محافظة
//    والـ payload بيبعت غيرها).
api.setup([row],districts,cities,'X','ps');
api.ov()['X']={cityId:'nc',cityName:'North Coast',cityNameAr:''};
chk('🔴 محافظة معدّلة بلا اسم عربي مابتاخدش عربي الأصلية',
    api.addrModeInfo(row).label==='🏙️ North Coast · مدينة معدّلة', api.addrModeInfo(row).label);
api.setup([row],districts,cities,'X','ps');

chk('درجة المدينة بالعربي',
    api.addrModeInfo({...row,mode:'zone',zoneName:'Obour',zoneNameAr:'العبور'}).label==='🗺️ العبور');
chk('المنطقة المقفولة بالعربي',
    api.addrModeInfo({...row,mode:'coverageBlocked',blockedDistricts:[{id:'t',name:'Taba',nameAr:'طابا'}]})
      .label==='🚫 طابا');

console.log('\n── ③ الاسم المخزَّن من الكتالوج مش من فكّ الليبل ──');
api.setup([row],districts,cities,'X','ps');
api.dpPickChoose('district','d4');
const ov=api.ov()['X'];
chk('🔴 الاسم كامل مش مقصوص على الشرطة', ov.districtName==='Sidi Gaber — East', ov.districtName);
chk('والعربي اتحفظ معاه', ov.districtNameAr==='سيدي جابر — شرق', ov.districtNameAr);
chk('والمحافظة بالاسمين', ov.cityName==='Port Said' && ov.cityNameAr==='بور سعيد');
chk('والعمود بيعرض العربي', api.addrModeInfo(row).label==='📍 سيدي جابر — شرق',
    api.addrModeInfo(row).label);
api.setup([row],districts,cities,'X','ps');
api.chooseDistrict('d1','اسم معروض غلط');
chk('والضغط من القايمة الكبيرة بيدّي نفس النتيجة', api.ov()['X'].districtName==='Qesm ElZohour',
    api.ov()['X'].districtName);

console.log('\n── ④ البحث مطبَّع على الناحيتين ──');
chk('«المنشيه» = «المنشية» بعد التطبيع', api.normSearch('المنشيه')===api.normSearch('المنشية'));
api.setup([row],districts,cities,'X','ps');
api.setSearch('المنشيه');
api.renderDistrictList();
chk('🔴 القايمة الكبيرة بتلاقيها', /المنشية/.test(listHTML) && !/مفيش مناطق مطابقة/.test(listHTML));
api.setPickSearch('district','المنشيه');
chk('والقايمة المنسدلة كمان',
    api.dpPickOptions('district').filter(o=>api.normSearch(`${o.label} ${o.sub}`).includes(api.normSearch('المنشيه'))).length===1);

console.log('\n── ⑤ تسميات «حالة العنوان» ──');
chk('🔍 مرشّح تلقائي', api.ADDR_MODE_LABEL.anchor==='🔍 مرشّح تلقائي', api.ADDR_MODE_LABEL.anchor);
chk('❓ احتمالات متعددة', api.ADDR_MODE_LABEL.ambiguous==='❓ احتمالات متعددة', api.ADDR_MODE_LABEL.ambiguous);
chk('🟠 المحافظة خطأ غالباً', api.ADDR_MODE_LABEL.cityDoubt==='🟠 المحافظة خطأ غالباً', api.ADDR_MODE_LABEL.cityDoubt);
// ⚠️ التسميات دي مصدر واحد لتلات شاشات (الفلتر · العمود · عنوان النافذة) —
//    فأي قيمة من غير تسمية بتخلي واحدة منهم تعرض المفتاح الخام.
chk('وكل قيمة ليها تسمية', api.ADDR_MODE_ITEMS.every(it=>!!api.ADDR_MODE_LABEL[it.value]));

// ══════════════════════════════════════════════════════════════
// ⑥ الـ Worker — الاسم العربي بيترجع **جنب** الإنجليزي، والـ payload زي ما هو
// 🔴 ده الحارس الأهم في الملف: الشحنة بتتعمل بفلوس على `city` و`districtName`
//    الإنجليزية (أو الـ id)، وبوسطة **مش** فاهمة الاسم العربي. لو حد وحّد
//    الحقلين في الواجهة والـ Worker مع بعض، الرفع بيرجّع 400 · `3002` على
//    عنوان سليم ١٠٠٪ — أو أسوأ، شحنة على مدينة تانية.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑥ الـ Worker: الاسمين جنب بعض · الـ payload إنجليزي ──');
const wsrc = fs.readFileSync(require('path').join(__dirname,'..','index.js'),'utf8')
               .replace(/export default \{[\s\S]*$/,'');
const w = new Function(wsrc + `
 return { ensureNormalized, resolveAddress, buildAddressObject };`)();

const wcat = { cities: [
  { cityId:'skFtf6ZmKo8kBEBDK', cityName:'Port Said', cityAr:'بور سعيد', districts:[
      { id:'z1', name:'Qesm ElZohour', nameAr:'قسم الزهور', zone:'ElZohour', zoneAr:'الزهور', dropOff:true },
      { id:'z2', name:'ElDeeba',       nameAr:'الديبه',     zone:'Tani',     zoneAr:'تاني',   dropOff:true } ]},
]};
w.ensureNormalized(wcat);
const plan = w.resolveAddress({ shippingAddress:{
  province:'Port Said', provinceCode:'PTS', city:'بورسعيد',
  address1:'٣٨ الجوهرة حى الزهور — بورسعيد' } }, wcat);

chk('الخطة لقت المنطقة', plan.ok && plan.mode==='district' && plan.districtId==='z1', plan.mode);
chk('🔤 اسم المحافظة العربي راجع من الكتالوج', plan.cityNameAr==='بور سعيد', plan.cityNameAr);
chk('🔤 واسم المنطقة العربي كمان', plan.districtNameAr==='قسم الزهور', plan.districtNameAr);
chk('⚠️ والإنجليزي **ما اتبدلش**', plan.cityName==='Port Said' && plan.districtName==='Qesm ElZohour');
const payload = w.buildAddressObject(plan, 'district', 'س');
chk('🔴 الـ payload فيه `city` الإنجليزي و`districtId` — مفيش عربي خالص',
    payload.city==='Port Said' && payload.districtId==='z1'
    && !JSON.stringify(payload).includes('بور سعيد')
    && !JSON.stringify(payload).includes('قسم الزهور'), JSON.stringify(payload));

console.log(`\n${p}/${n} نجحت`);
process.exit(p===n?0:1);
