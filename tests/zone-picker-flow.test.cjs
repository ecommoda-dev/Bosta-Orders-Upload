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
    chooseDistrict, setSearch(q){ document.getElementById('dpSearch').value = q; },
    pinDistrictToZone, pinDistrictToProvince, dpEffectiveZone, dpChosenDistrictId,
    renderDpControls, confirmDistrictPick, el(id){ return document.getElementById(id); },
    orderId(){ return dpOrderId; },
    rowAddrMode, addrModeInfo, ADDR_MODE_LABEL,
    districtCell, addrModeCell, rowUploadable, rowNeedsManualAddressConfirm,
    dpTableHead, listHTML(){ return null; },
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
// ⑨ اللوحة بعرض الصف — مابتوسّعش النافذة ومابتضغطش الأسماء (v2.6.2)
// 🔴 اللوحة كانت محبوسة في عرض الخانة (تُلت النافذة)، فـ:
//      ① أسماء المناطق («B1 Factories (10th of Ramadan) — B1 مصانع…») كانت
//        بتتلف على **تلات سطور** والقراءة تبقى تخمين
//      ② وخانة المنطقة (أقصى الشمال في RTL) لوحتها كانت بتمتد لبرّه حافة
//        النافذة فتطلّع **شريط تمرير أفقي**
//    الاتنين اتحلّوا بحاجة واحدة: الحاوية الموضعية بقت **الصف** (`.dp-src`)
//    واللوحة `inset-inline:0` — يعني عرضها = عرض الصف بالظبط، مهما كانت
//    الخانة فين. باج بصري بحت، فالحارس على الـ CSS.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑨ اللوحة بعرض الصف ──');
{
  const page = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8');
  chk('الصف هو الحاوية الموضعية', /\.dp-src\{position:relative;\}/.test(page));
  chk('والخانة `static` مش `relative`', /\.dp-pick\{position:static;/.test(page));
  chk('واللوحة بعرض الصف كله', /\.dp-pick-panel\{[^}]*inset-inline:0;/.test(page));
  // 🔴 لو الخانة رجعت `relative` تاني، اللوحة بترجع لعرض الخانة **من غير أي
  //    خطأ** — والأسماء ترجع تتلف والشريط الأفقي يرجع.
  chk('ومفيش عرض ثابت بيقيّدها', !/\.dp-pick-panel\{[^}]*width:max\(/.test(page));
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

// ══════════════════════════════════════════════════════════════
// ⑪ خانة الزون بتتحدّث من المنطقة المختارة (واجهة v2.6.1)
// 🔴 المنطقة جوّه زون **واحد بالظبط**، فأول ما منطقة تتحدد الزون بقى محسوم.
//    قبل كده كانت الخانة بتقرا `dpZoneFilter` بس، فالموظف يختار منطقة
//    والزون يفضل «الكل» — والتلات خانات تقرا كأن العنوان ناقص درجة وهو كامل.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑪ الزون بيتحدّث من المنطقة ──');
{
  api.setup([row],cairo,cities,'B','q');
  api.setZf(null);
  delete api.ov()['B'];
  chk('من غير منطقة → «الكل»', api.dpPickCurrent('zone').text === 'الكل',
      api.dpPickCurrent('zone').text);

  // الموظف اختار منطقة جوّه زون العبور
  api.chooseDistrict('o3','District 01 (Obour)');
  const z = api.dpPickCurrent('zone');
  chk('بعد اختيار المنطقة الزون بقى زونها', /Obour/.test(z.text), z.text);
  // 🔴 🟢 مش 🔵: الزون هنا **جزء من العنوان اللي هيتسجّل**، مش ترشيح عرض
  chk('ولونه 🟢 مش 🔵 ترشيح', z.cls === 'set', z.cls);
  chk('والشرح بيقول إنه مشتقّ من المنطقة', /المنطقة المختارة/.test(z.hint || ''), z.hint);

  // ⚠️ والمطابقة التلقائية زي اليدوية بالظبط — مش محتاجة الموظف يضغط
  delete api.ov()['B'];
  api.setup([{ ...row, mode:'district', districtId:'c1', districtName:'Nasr City', cityId:'q' }],
            cairo,cities,'B','q');
  chk('والمطابقة التلقائية كمان بتحدّث الزون',
      /Nasr City/.test(api.dpPickCurrent('zone').text), api.dpPickCurrent('zone').text);

  // ⚠️ «بلا مدينة» حالة حقيقية في الكتالوج — تتقال صريحة مش «الكل»
  api.setup([row],[{id:'n1',name:'NoZone',nameAr:'بلا',zone:'',zoneAr:''}],cities,'B','q');
  api.chooseDistrict('n1','NoZone');
  const nz = api.dpPickCurrent('zone');
  chk('ومنطقة بلا مدينة بتقول «بلا مدينة» مش «الكل»', nz.text === 'بلا مدينة', nz.text);
}

// ══════════════════════════════════════════════════════════════
// ⑫ البحث بيلغي قصر الزون (واجهة v2.6.1)
// 🔴 القصر أداة **تصفّح** والبحث أداة **وصول**. قبل كده البحث كان بيتطبّق
//    **بعد** القصر، فالموظف يكتب اسم منطقة موجودة فعلًا في المدينة ويقرا
//    «مفيش مناطق مطابقة» — طريق مسدود من غير أي خطأ. والفخ بقى أقرب من
//    v2.6.0 لأن القصر بقى بيتطبّق **لوحده** على صف الزون أول ما النافذة تفتح.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑫ البحث بيخرج برّه القصر ──');
{
  api.setup([row],cairo,cities,'B','q');
  delete api.ov()['B'];
  api.setZf('Obour');          // القايمة مقصورة على ٦ مناطق العبور
  api.renderDistrictList();
  const narrowed = (listHTML.match(/class="dp-item/g)||[]).length;
  chk('القصر شغّال من غير بحث', narrowed === 6, `ظهر ${narrowed}`);
  chk('و«مدينة نصر» (برّه القصر) مخفية', !/Nasr City/.test(listHTML));

  // 🔴 دي النقطة: البحث على منطقة **برّه** القصر لازم يلاقيها
  api.setSearch('nasr');
  api.renderDistrictList();
  chk('البحث بيلاقي منطقة برّه القصر', /Nasr City/.test(listHTML), listHTML.slice(0,200));
  chk('والبانر بيقول إن البحث خرج برّه القصر',
      /كل مناطق المحافظة/.test(listHTML));
  chk('والقصر لسه متسجّل (مش اتمسح)', api.zf() === 'Obour', api.zf());

  // وأول ما البحث يفضى، القصر يرجع زي ما هو
  api.setSearch('');
  api.renderDistrictList();
  const back = (listHTML.match(/class="dp-item/g)||[]).length;
  chk('وبيرجع بعد ما البحث يفضى', back === 6, `ظهر ${back}`);
}

// ══════════════════════════════════════════════════════════════
// ⑬ «ارفع على الزون بس» — الدرجة الوسطى بقت قرار الموظف (v2.6.2)
// 🔴 درجة الزون كانت **تلقائية بس** (مفيش مطابقة منطقة + زون واحد + مفيش شك
//    مدينة). يعني الموظف اللي شايف المطابقة مش مظبوطة **بس عارف الزون**
//    ماكانش قدامه غير «المحافظة بس» — وهي بتاخد هب افتراضي والزون بياخد هب
//    محدد، فكان بينزل درجتين بدل واحدة.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑬ ارفع على الزون بس ──');
{
  const zc = cairo.map(d => ({ ...d, zoneId: `z-${d.zone}` }));   // الكتالوج بيدّي zoneId
  api.setup([row],zc,cities,'B','q');
  api.setZf(null);
  delete api.ov()['B'];

  chk('من غير زون متحدد، مفيش زون سارية', api.dpEffectiveZone(row) === null);
  api.pinDistrictToZone();
  chk('والضغط من غير زون مابيثبّتش حاجة', !api.ov()['B']);

  // الموظف قصّر على زون وبعدين ثبّت عليه
  api.setZf('Obour');
  chk('الزون السارية بقت العبور', api.dpEffectiveZone(row)?.id === 'Obour');
  api.pinDistrictToZone();
  const ov = api.ov()['B'];
  chk('اتثبّت على الزون', ov?.forceZone === true, JSON.stringify(ov));
  // 🔴 بالـ id مش بالاسم — الاسم بيتكرر بين المدن
  chk('وبالـ zoneId مش بالاسم', ov?.zoneId === 'z-Obour', ov?.zoneId);
  chk('ومفيش منطقة اتبعتت معاه', !ov?.districtId);
  chk('وحالة العنوان بقت «بالزون»', api.rowAddrMode(row) === 'zone', api.rowAddrMode(row));
  chk('والبادج بيقول إنه مثبّت', /مثبّت/.test(api.addrModeInfo(row).label), api.addrModeInfo(row).label);
  // 🔴 (قرار أحمد 15-09-2026) التثبيت الناجح بيقفل النافذة على طول —
  //    فحص الخانات محتاج يفتحها تاني (زي ما الموظف هيعمل فعليًا).
  api.setup([row],zc,cities,'B','q');
  // 🔴 الخانة لازم تعكس التثبيت — 🟢 لأنه اللي هيتبعت فعلًا
  const zbox = api.dpPickCurrent('zone');
  chk('وخانة الزون 🟢 ومعاها اسمه', zbox.cls === 'set' && /Obour/.test(zbox.text), JSON.stringify(zbox));
  // 🔴 والمنطقة لازم تبقى فاضية — درجة واحدة بتتبعت، والخانتين مايتناقضوش
  chk('وخانة المنطقة بقت «لا توجد منطقة محددة»',
      /لا توجد منطقة محددة/.test(api.dpPickCurrent('district').text),
      api.dpPickCurrent('district').text);
  chk('والمنطقة السارية اتلغت فعلًا', api.dpChosenDistrictId(row) === null);

  // ⚠️ التثبيت على المحافظة بيلغي المنطقة برضه — نفس القاعدة
  api.pinDistrictToProvince();
  api.setup([row],zc,cities,'B','q');   // النافذة اتقفلت تاني — نفتحها للفحص
  chk('وتثبيت المحافظة بيلغي المنطقة كمان', api.dpChosenDistrictId(row) === null);
}
{
  // 🔴 زون بلا zoneId في الكتالوج **مايترفعش عليه** — الزرار بيرفض بدل ما
  //    يبعت مفتاح مخترع.
  api.setup([row],cairo,cities,'B','q');   // cairo من غير zoneId
  api.setZf('Obour');
  delete api.ov()['B'];
  api.pinDistrictToZone();
  chk('وزون بلا zoneId مابيتثبّتش', !api.ov()['B'], JSON.stringify(api.ov()['B']));
}

// ══════════════════════════════════════════════════════════════
// ⑬ تلميحات النافذة — التلاتة الباقية والباقي مشال (v2.8.0)
//
// 🔴 البند اللي بيحميه: قرار أحمد كان **يشيل كل tooltips النافذة ما عدا
//    شروح الخانات التلاتة**. الشروح التلاتة دي هي الحاجة الوحيدة اللي
//    بتفرّق بين «القيمة دي هتتبعت لبوسطة» (🟢) و«دي ترشيح عرض بس» (🔵) —
//    الخانة بتعرض نفس النص في الحالتين واللون لوحده مابيكفيش.
//    ⚠️ ومن الناحية التانية: أي `title=` بيرجع على صفوف القايمة أو البادج
//    معناه إن حد رجّع التلميحات المشالة من غير قصد.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑬ تلميحات النافذة ──');
{
  api.setup([row],cairo,cities,'B','c');
  delete api.ov()['B'];
  api.renderDistrictList();

  // الباقية: التلات خانات
  for (const k of ['city','zone','district']) {
    chk(`خانة ${k} لسه ليها شرح`, !!(api.dpPickCurrent(k).hint || '').trim());
  }
  // المشالة: صفوف القايمة
  chk('ومفيش أي title على صفوف القايمة', !/title=/.test(listHTML),
      (listHTML.match(/title="[^"]*"/) || [''])[0]);
}

// ══════════════════════════════════════════════════════════════
// ⑭ بانر التغطية اتشال — **والمنع فضل** (v2.8.0 · بند ٧)
//
// 🔴 ده أخطر حارس في الملف ده. الرسالة اتشالت بطلب صريح، بس المنع نفسه
//    (`mode = coverageBlocked` → الصف مايترفعش) **مالوش أي علاقة بيها** —
//    عايش في الـ Worker ومتغطّى في `coverage-and-degree` ⑥ب.
//    الاختبار ده بيمسك الحالة العكسية: إن حد «ينضّف» فيشيل المنع مع الرسالة.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑭ بانر التغطية اتشال والمنع فضل ──');
{
  const blockedRow = { ...row, mode: 'coverageBlocked',
                       blockedDistricts: [{ id: 'tb', name: 'Taba', nameAr: 'طابا' }] };
  api.setup([blockedRow],cairo,cities,'B','c');
  delete api.ov()['B'];
  api.renderDistrictList();
  chk('مفيش بانر تغطية في النافذة', !/خارج تغطية بوسطة/.test(listHTML));
  // والحالة لسه باينة في عنوان النافذة — المعلومة ما ضاعتش، الرسالة بس هي اللي اتشالت
  chk('وبادج «خارج التغطية» لسه هو تسمية الحالة',
      api.ADDR_MODE_LABEL?.coverageBlocked === '🚫 خارج التغطية',
      api.ADDR_MODE_LABEL?.coverageBlocked);
}

// ══════════════════════════════════════════════════════════════
// ⑮ زرارين الدرجة الأقل بيترفضوا على صف خارج التغطية — **بصوت**
//
// 🔴 المنطقة بتحرّر الصف، والزون والمحافظة لأ (دول بيغيّروا درجة العنوان مش
//    العنوان — الشحنة بتفضل رايحة نفس المكان اللي بوسطة مش بتسلّم فيه).
//    بس تسجيل الاختيار وسيبان الصف موقوف بيدّي **بالظبط** نفس الحيرة اللي
//    v2.10.0 اتعملت عشانها: توست أخضر «اتثبّت» · بادج أخضر · وصف ⛔ موقوف
//    من غير أي سبب ظاهر. فالرفض لازم يبقى رفض معلن، والـ override مايتكتبش.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑮ الدرجة الأقل بترفض على صف خارج التغطية ──');
{
  const blockedRow = { ...row, mode: 'coverageBlocked', coverageOnly: true,
                       blockedDistricts: [{ id: 'tb', name: 'Taba', nameAr: 'طابا' }] };
  api.setup([blockedRow],cairo,cities,'B','c');
  delete api.ov()['B'];

  api.pinDistrictToProvince();
  chk('«ارفع على المحافظة بس» مابيسجّلش تثبيت', !api.ov()['B'], JSON.stringify(api.ov()['B']));
  api.pinDistrictToZone();
  chk('و«ارفع على الزون بس» مابيسجّلش تثبيت', !api.ov()['B'], JSON.stringify(api.ov()['B']));

  // ✅ والمسار الشغّال لسه مفتوح — المنطقة بتتسجّل عادي
  api.chooseDistrict('c1', 'Nasr City');
  chk('واختيار المنطقة لسه بيعدّي', api.ov()['B']?.districtId === 'c1', JSON.stringify(api.ov()['B']));
  delete api.ov()['B'];

  // ⚠️ الضابط — الزرارين لسه شغّالين على الصفوف العادية
  api.setup([row],cairo,cities,'B','c');
  api.pinDistrictToProvince();
  chk('والصف العادي لسه بيتثبّت على المحافظة', api.ov()['B']?.forceProvince === true);
  delete api.ov()['B'];
}

// ══════════════════════════════════════════════════════════════
// ⑯ «تأكيد العنوان مظبوط» — شغّال فقط على عنوان كامل (v2.15.0)
//
// 🔴 البند اللي بيحميه: الزرار ده هو **المخرج الإيجابي** من النافذة، والشرط
//    إن العنوان كامل بالتلات خانات — يعني فيه `districtId` هيتبعت لبوسطة
//    فعلًا. لو اتفتح على صف لسه محتاج قرار (❓ أكتر من مطابقة · 🏙️ المحافظة
//    فقط · 🟠 محافظة مشكوك فيها)، الموظف بيقفل النافذة وهو فاكر إنه أكّد
//    عنوان — والصف بيفضل موقوف من غير سبب ظاهر، وهي نفس الحيرة اللي حارس
//    التأكيد اليدوي اتعمل عشانها.
// ⚠️ والتثبيت على المدينة/المحافظة **مش** عنوان كامل: دول بيبعتوا درجة أقل
//    (`zoneId` أو المحافظة لوحدها) ومفيش `districtId` خالص.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑯ تأكيد العنوان مظبوط ──');
{
  const zc = cairo.map(d => ({ ...d, zoneId: `z-${d.zone}` }));

  // ① صف «المحافظة فقط» من غير أي اختيار — العنوان ناقص
  api.setup([row],zc,cities,'B','q');
  delete api.ov()['B'];
  api.setZf(null);
  api.renderDpControls();
  chk('مقفول على صف من غير منطقة', api.el('dpConfirm').disabled === true);
  api.confirmDistrictPick();
  chk('والضغط عليه مابيقفلش النافذة', api.orderId() === 'B', String(api.orderId()));

  // ② الموظف اختار منطقة → التلات خانات مليانة
  api.chooseDistrict('o3','District 01 (Obour)');
  api.renderDpControls();
  chk('بيفتح بعد اختيار المنطقة', api.el('dpConfirm').disabled === false);
  // والتلات خانات فعلًا مليانة — ده تعريف «كامل»
  chk('وخانة المنطقة فيها الاختيار', /District 01/.test(api.dpPickCurrent('district').text));
  chk('وخانة المدينة محسومة من المنطقة', /Obour/.test(api.dpPickCurrent('zone').text));
  chk('وخانة المحافظة فيها قيمة', !!api.dpPickCurrent('city').text.trim());
  api.confirmDistrictPick();
  chk('والضغط بيقفل النافذة', api.orderId() === null, String(api.orderId()));

  // ③ المطابقة التلقائية كمان عنوان كامل — مش لازم الموظف يضغط منطقة
  const auto = { ...row, mode:'district', districtId:'c1', districtName:'Nasr City',
                 cityDoubt:false, crossCity:[] };
  api.setup([auto],zc,cities,'B','q');
  delete api.ov()['B'];
  api.renderDpControls();
  chk('مفتوح على المطابقة التلقائية', api.el('dpConfirm').disabled === false);

  // ④ 🔴 التثبيت على المدينة أو المحافظة **مش** عنوان كامل — درجة أقل بتتبعت
  api.setup([row],zc,cities,'B','q');
  api.setZf('Obour');
  delete api.ov()['B'];
  api.pinDistrictToZone();
  api.setup([row],zc,cities,'B','q');       // التثبيت قفل النافذة — نفتحها للفحص
  api.renderDpControls();
  chk('مقفول بعد التثبيت على المدينة', api.el('dpConfirm').disabled === true,
      JSON.stringify(api.ov()['B']));
  api.pinDistrictToProvince();
  api.setup([row],zc,cities,'B','q');
  api.renderDpControls();
  chk('ومقفول بعد التثبيت على المحافظة', api.el('dpConfirm').disabled === true,
      JSON.stringify(api.ov()['B']));
  delete api.ov()['B'];

  // ⑤ وحالة «مقفول» لازم تبان — من غير CSS الزرار بيبان شغّال والضغط
  //    مابيعملش حاجة في صمت (نفس فخ «ارفع على المدينة فقط»).
  const page = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8');
  chk('وفيه CSS بيوضّح حالة المقفول',
      /\.btn-green:disabled[^{]*\{[^}]*opacity/.test(page)
      && /btn-ghost:disabled/.test(page));
}

// ══════════════════════════════════════════════════════════════
// ⑰ 🔍 المرشّح التلقائي (Worker v2.6.0 · واجهة v2.17.0 · قرار أحمد)
//
// 🔴 المرساة بقت **بتترفع**. الحارس الوحيد الباقي هو إنها تفضل **متميّزة عن
//    المطابقة الحقيقية**: مطابقة اسم منطقة كامل ومنطقة مخمّنة من كلمة واحدة
//    مش نفس الثقة، وتوحيد البادج بيخلي الموظف يعدّي على تخمين وهو فاكره حقيقة.
// ⚠️ **وهي قابلة للرفع وداخلة «رفع الكل» عن قصد** (طلب أحمد صراحةً) — فأي
//    إضافة لها في `rowNeedsManualAddressConfirm` بتلغي القرار ده.
// ══════════════════════════════════════════════════════════════
console.log('\n── ⑰ المرشّح التلقائي ──');
{
  const alx = [
    D('k1','King Maryout','كنج مريوط','King Maryout','كنج مريوط'),
    D('s1','Sidi Bishr','سيدي بشر','Sidi Bishr','سيدي بشر'),
  ];
  const arow = { orderId:'A', orderNumber:'#55065', uploadable:true, addressOk:true,
    mode:'district', districtId:'k1', districtName:'King Maryout', districtFromAnchor:true,
    cityName:'Alexandria', cityId:'alx', province:'Alexandria',
    ambiguous:false, cityDoubt:false, candidates:[], localZones:[], crossCity:[],
    address1:'الكينج مريوط قبلي السكه فيلا وليد الحو', address2:'', addressCity:'الاسكندرية',
    addressAnchor:{ text:'مريوط', token:'مريوط', fieldLabel:'العنوان',
                    districtId:'k1', districtName:'King Maryout', districtNameAr:'كنج مريوط' } };
  const acities = [{cityId:'alx',cityName:'Alexandria',cityAr:'الاسكندريه'},
                   {cityId:'c',cityName:'Cairo',cityAr:'القاهره'}];

  api.setup([arow],alx,acities,'A','alx');
  delete api.ov()['A'];

  // ① الحالة المعروضة — **مش** `district`
  chk('🔴 حالة العنوان «anchor» مش «district»', api.rowAddrMode(arow) === 'anchor',
      api.rowAddrMode(arow));
  chk('وليها تسمية خاصة في المصدر الواحد',
      /مرشّح تلقائي/.test(api.ADDR_MODE_LABEL['anchor'] || ''));
  const info = api.addrModeInfo(arow);
  chk('والبادج بيسمّي المنطقة بعلامة 🔍', info.label === '🔍 King Maryout', info.label);
  chk('والتلميح بيقول الكلمة اللي وصلت لها', /مريوط/.test(info.hint));
  chk('وبيقول إنها كلمة واحدة مش اسم كامل', /كلمة واحدة|منطقة واحدة بس/.test(info.hint));
  chk('و`set` شغّال — فيه districtId هيتبعت فعلًا', info.set === true);

  // ② اللون — تالت مختلف عن الأخضر والأصفر
  chk('🔴 عمود المنطقة بياخد كلاس `cand` مش `set`',
      / cand/.test(api.districtCell(arow)) && !/ set/.test(api.districtCell(arow)),
      api.districtCell(arow).slice(0,90));
  chk('وبادج حالة العنوان `badge-info` مش `badge-success`',
      /badge-info/.test(api.addrModeCell(arow)) && !/badge-success/.test(api.addrModeCell(arow)));

  // ③ 🔴 قابل للرفع وداخل «رفع الكل» — قرار أحمد صراحةً
  chk('🔴 مش محتاج تأكيد يدوي', api.rowNeedsManualAddressConfirm(arow) === false);
  chk('🔴 وقابل للرفع', api.rowUploadable(arow) === true);

  // ④ الاختيار اليدوي بيغلبه — بيرجع مطابقة عادية
  api.ov()['A'] = { districtId:'s1', districtName:'Sidi Bishr' };
  chk('اختيار يدوي بيرجّعه district', api.rowAddrMode(arow) === 'district');
  chk('وبادجه بيرجع 📍', api.addrModeInfo(arow).label.startsWith('📍'));
  delete api.ov()['A'];

  // ⑤ النافذة — مثبّت فوق القايمة بسبب مكتوب، ومش بشريط «المطابقة التلقائية»
  api.setSearch('');
  api.renderDistrictList();
  chk('النافذة بتثبّته فوق القايمة', /King Maryout/.test(listHTML));
  chk('🔴 وبيقول «مرشّح تلقائي» مش «المطابقة التلقائية»',
      /مرشّح تلقائي/.test(listHTML) && !/المطابقة التلقائية/.test(listHTML));
  chk('والسبب مكتوب — الكلمة نفسها', /كلمة «مريوط»/.test(listHTML));
  chk('ومفيش بحث جاهز في الخانة', api.el('dpSearch').value === '');

  // ⑥ 🔴 ترتيب أعمدة القايمة = ترتيب جدول السياق فوقها (طلب أحمد v2.17.0)
  //    المحافظة │ المدينة │ المنطقة — يمين لشمال. القايمة عمودين: المدينة
  //    يمين (أول عنصر في RTL) والمنطقة شمال.
  const thead = api.dpTableHead();
  chk('🔴 ترويسة القايمة: المدينة قبل المنطقة',
      thead.indexOf('المدينة') < thead.indexOf('المنطقة'), thead);
  const rowHTML = listHTML.slice(listHTML.indexOf('King Maryout') - 400);
  chk('🔴 وخانة المدينة قبل خانة المنطقة في الصف نفسه',
      rowHTML.indexOf('dp-cell') < rowHTML.indexOf('dp-main'));
  const page = fs.readFileSync('/home/user/Bosta-Orders-Upload/index.html','utf8');
  // ⚠️ العمود العريض لازم يمشي مع اسم المنطقة — قلب الترتيب من غير قلب العرض
  //    بيلفّ الاسم الطويل على تلات سطور من غير أي خطأ
  chk('والعمود العريض بقى التاني (اسم المنطقة)',
      /grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.6fr\)/.test(page));
  // ⚠️ كل صفوف القايمة لازم تتقلب مع بعض — صف اقتراح بترتيب مختلف بيخلي
  //    عمود يقع تحت ترويسة مش بتاعته في صمت
  chk('🔴 وكل صفوف القايمة متقلوبة مع بعض',
      page.split('class="dp-item').slice(1)
          .every(chunk => { const c = chunk.indexOf('dp-cell'), m = chunk.indexOf('dp-main');
                            return c === -1 || m === -1 || c < m; }));

  // ⑦ 🔴 والخانة بتتفضّى مع كل تحميل محافظة
  chk('🔴 الخانة بتتفضّى مع كل تحميل محافظة',
      /const searchBox = document\.getElementById\('dpSearch'\);\s*\n\s*searchBox\.value = '';/.test(page));
}

console.log(`\n${p}/${n} نجحت`);
process.exit(p===n?0:1);
