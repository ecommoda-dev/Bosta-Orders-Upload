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
    dpPickOptions, dpPickCurrent, dpPickZone, dpPickToggle, dpPickFilter, renderDistrictList,
    zf(){ return dpZoneFilter; }, ov(){ return districtOverride; },
    setZf(z){ dpZoneFilter = z; }, open(){ return dpPickOpen; } };`
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

// ══════════════════════════════════════════════════════════════
// ⑤ القوايم التلاتة في صف بوسطة (واجهة v2.5.0)
// 🔴 القاعدة اللي الجزء ده بيحميها: **الزون بيقصّر القايمة، مابيختارش منطقة.**
//    الزون جواه مناطق كتير (زون العبور = ٦)، واختيار واحدة منها تلقائيًا تخمين
//    (`bosta-api-helper` 8.10). أي تعديل بيخلي اختيار الزون يسجّل `districtId`
//    بيحوّل الاقتراح لقرار، والشحنة بتروح منطقة محدش اختارها.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑤ القوايم التلاتة ──');
api.setup([row],cairo,cities,'B','c');
delete api.ov()['B'];
api.setZf(null);

const zones = api.dpPickOptions('zone');
chk('قايمة الزون بتتبني من مناطق المدينة', zones.length === 3, JSON.stringify(zones.map(z=>z.id)));
chk('وبتقول كل زون فيه كام منطقة',
    zones.find(z=>z.id==='Obour')?.sub === '6 منطقة', zones.find(z=>z.id==='Obour')?.sub);

api.dpPickZone('Obour');
chk('اختيار زون بيقصّر القايمة', api.zf() === 'Obour');
// 🔴 دي النقطة كلها
chk('ومابيختارش منطقة خالص', !api.ov()['B']?.districtId, JSON.stringify(api.ov()['B']));
const dOpts = api.dpPickOptions('district');
chk('وقايمة المنطقة بتتقصر مع القصر', dOpts.length === 6, `${dOpts.length}`);

api.dpPickZone('Obour');
chk('نفس الزون تاني = شيل القصر', api.zf() === null);
api.dpPickZone('Obour'); api.dpPickZone('');
chk('و«الكل» بتشيل القصر كـ null صريح مش نص فاضي', api.zf() === null, JSON.stringify(api.zf()));

// المقفولة للتسليم بتبان في القايمة المنسدلة كمان، معلّمة ومش قابلة للضغط
api.setup([row],[...cairo,{id:'x1',name:'Taba',nameAr:'طابا',zone:'Taba',zoneAr:'طابا',blocked:true}],
          cities,'B','c');
api.setZf(null);
const withBlocked = api.dpPickOptions('district');
const taba = withBlocked.find(o => o.id === 'x1');
chk('المنطقة المقفولة ظاهرة في القايمة المنسدلة', !!taba);
chk('ومعلّمة إنها مقفولة', taba?.blocked === true && /مقفولة/.test(taba?.sub || ''), JSON.stringify(taba));
// 🔴 ومابتظهرش في قايمة الزون — زون كل مناطقه مقفولة مالوش معنى كمُرشِّح،
//    القايمة تحته هتفضل فاضية.
chk('وزونها مش في قايمة الزون', !api.dpPickOptions('zone').some(z => z.id === 'Taba'));

// ══════════════════════════════════════════════════════════════
// ⑥ لغة ألوان القوايم (واجهة v2.5.1)
// 🔴 تلات ألوان بتلات معاني، والخلط بينهم بيغلط في **إيه اللي هيتبعت**:
//      🟢 set    = قيمة هتتبعت لبوسطة فعلًا
//      🟠 changed = تدخّل يدوي غيّر اللي كان هيتبعت
//      🔵 filter  = ترشيح عرض بس — مابيتبعتش ومابيغيّرش حاجة
//    الزون كان بياخد 🟠 لما يتقصر عليه، والموظف يفتكر إنه عدّل الشحنة.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑥ ألوان القوايم ──');
api.setup([row],cairo,cities,'B','q');   // المدينة زي ما هي (مفيش تعديل)
api.setZf(null);
delete api.ov()['B'];

chk('المدينة من غير تعديل = بلا لون', api.dpPickCurrent('city').cls === '',
    api.dpPickCurrent('city').cls);
chk('الزون من غير قصر = رمادي «الكل»',
    api.dpPickCurrent('zone').cls === 'muted' && api.dpPickCurrent('zone').text === 'الكل');

api.setZf('Obour');
// 🔴 دي النقطة: القصر **ترشيح** مش تعديل — أزرق مش برتقالي
const zf = api.dpPickCurrent('zone');
chk('القصر على زون = 🔵 ترشيح مش 🟠 تعديل', zf.cls === 'filter', zf.cls);
chk('والشرح بيقول صراحةً إنه مابيتبعتش', /مابيتبعتش/.test(zf.hint || ''), zf.hint);

// الشحنة نفسها هتترفع بالزون → القيمة بقت حقيقية، فاللون 🟢
const zoneRow = { ...row, mode:'zone', zoneName:'Obour', cityId:'q' };
api.setup([zoneRow],cairo,cities,'B','q');
api.setZf(null);
const zs = api.dpPickCurrent('zone');
chk('الشحنة هترفع بالزون = 🟢 قيمة بتتبعت', zs.cls === 'set', zs.cls);
chk('وشرحه بيقول zoneId', /zoneId/.test(zs.hint || ''), zs.hint);

// المدينة المعدّلة يدويًا = 🟠
api.setup([row],cairo,cities,'B','c');
chk('المدينة المعدّلة يدويًا = 🟠 تدخّل', api.dpPickCurrent('city').cls === 'changed',
    api.dpPickCurrent('city').cls);

// ⚠️ كل خانة لازم يبقى ليها شرح — اللون لوحده مابيكفيش
for (const k of ['city','zone','district']) {
  chk(`خانة ${k} ليها شرح على الـ hover`, !!(api.dpPickCurrent(k).hint || '').trim());
}

// ══════════════════════════════════════════════════════════════
// ⑦ القص — `overflow:hidden` على الجدول كان بياكل نُص اللوحة
// 🔴 الحارس ده على الـ CSS مباشرةً لأن الباج **بصري بحت**: مفيش خطأ، ومفيش
//    سلوك بيتغيّر — الموظف بيفتح القايمة ويشوف صفين ونُص وخلاص. أي «تنضيف»
//    بيرجّع `overflow:hidden` على `.dp-tbl` بيخفي القوايم تاني في صمت.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑦ اللوحة مش مقصوصة ──');
const css = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8')
  .match(/\.dp-tbl\{[^}]*\}/)[0];
chk('.dp-tbl مش عليها overflow:hidden', !/overflow:\s*hidden/.test(css), css);
chk('وعليها overflow:visible صريح', /overflow:\s*visible/.test(css), css);
// وتقويس الأركان اتنقل للخانات الطرفية — من غيره الجدول بيبان بأركان حادّة
const full = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8');
chk('وتقويس الأركان اتنقل للخانات الطرفية',
    /\.dp-tbl > :first-child > :first-child\{border-start-start-radius/.test(full));

// ══════════════════════════════════════════════════════════════
// ⑧ الزون: مكان واحد للمعلومة (واجهة v2.6.0)
// 🔴 كان فيه **تلات أماكن** بيقولوا نفس الحاجة: خانة الزون في صف بوسطة ·
//    بانر «الشحنة هتترفع على زون …» · وصف «اضغط عشان تشوف مناطقه بس».
//    التكرار ده بيخلّي الموظف يدوّر على الفرق بينهم. اتساب **الخانة بس**،
//    والقايمة تحت بتتقصر عليها تلقائيًا.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑧ الزون مكان واحد ──');
{
  const zr = { ...row, mode:'zone', zoneName:'Obour', zoneDistrictCount:6, cityId:'q',
               cityDoubt:false, crossCity:[],
               localZones:[{kind:'zone',cityId:'q',cityName:'El Kalioubia',zone:'Obour',
                            zoneAr:'العبور',zoneId:'z1',districtCount:6,
                            matchedText:'العبور',fieldLabel:'مدينة شوبيفاي'}] };
  api.setup([zr],cairo,cities,'B','q');
  api.setZf(null);
  api.renderDistrictList();
  chk('بانر «الشحنة هتترفع على زون» اتشال', !/الشحنة هتترفع على زون/.test(listHTML));
  chk('وصف «اضغط عشان تشوف مناطقه بس» اتشال',
      !/اضغط عشان تشوف مناطقه بس/.test(listHTML));
}
{
  // ⚠️ اقتراح **المدينة التانية** حاجة مختلفة — بيغيّر المدينة، ومش معروض
  //    في أي مكان تاني. لازم يفضل.
  api.setup([row],cairo,cities,'B','q');   // row.crossCity فيه اقتراح القاهرة
  api.setZf(null);
  api.renderDistrictList();
  chk('واقتراح المدينة التانية لسه موجود', /مدن تانية/.test(listHTML));
}

// ══════════════════════════════════════════════════════════════
// ⑨ اللوحة مابتوسّعش النافذة (واجهة v2.6.0)
// 🔴 الخانة الأخيرة (المنطقة) أقصى الشمال في RTL، ولوحتها كانت بتمتد لبرّه
//    حافة النافذة — فـ`.eco-modal-body` كانت بتطلّع **شريط تمرير أفقي**
//    والمحتوى يزحف. باج بصري بحت تاني، فالحارس على الـ CSS.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑨ اللوحة جوّه النافذة ──');
{
  const page = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8');
  chk('آخر خانة لوحتها متثبّتة من ناحية النهاية',
      /\.dp-f:last-child \.dp-pick-panel\{inset-inline-start:auto;inset-inline-end:0;\}/.test(page));
}

// ══════════════════════════════════════════════════════════════
// ⑩ عدد المناطق المقفولة مش معروض (v2.6.0 — بطلب أحمد)
// الرقم مالوش أثر على أي قرار: اللي بيفرق إن **المنطقة دي بالذات** مقفولة،
// وده باين عليها في القايمة نفسها.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑩ مفيش عدّاد مقفولة ──');
{
  api.setup([row],cairo,[{cityId:'q',cityName:'El Kalioubia',cityAr:'القليوبيه',blockedCount:12}],
            'B','q');
  const cityOpts = api.dpPickOptions('city');
  chk('قايمة المدن من غير عدّاد مقفولة',
      cityOpts.every(o => !/مقفولة/.test(o.sub || '')), JSON.stringify(cityOpts.map(o=>o.sub)));
  // ⚠️ والمنطقة المقفولة نفسها **لسه معلّمة** — ده اللي بيفرق فعلًا
  api.setup([row],[...cairo,{id:'x1',name:'Taba',nameAr:'طابا',zone:'Taba',zoneAr:'طابا',blocked:true}],
            cities,'B','q');
  api.setZf(null);
  chk('والمنطقة المقفولة نفسها لسه معلّمة',
      /مقفولة/.test(api.dpPickOptions('district').find(o=>o.id==='x1')?.sub || ''));
}

console.log(`\n${p}/${n} نجحت`);
process.exit(p===n?0:1);
