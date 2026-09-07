// ══════════════════════════════════════════════════════════════
// اختبار عرض الزون في نافذة اختيار المنطقة — node tests/zone-label.test.cjs
//
// 🔴 البند اللي بيحميه: المنطقة اللي مالهاش زون لازم تتكتب «بلا زون» صريحة.
//    الخانة الفاضية بتخلط بين «المنطقة دي بلا زون» و«الكتالوج مابيرجّعش
//    الحقل أصلًا» — وده بالظبط الغموض اللي بيوقف التشخيص.
// ══════════════════════════════════════════════════════════════
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const el={classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},dataset:{},addEventListener(){},
  querySelectorAll(){return[]},appendChild(){},focus(){},value:'',textContent:'',innerHTML:'',checked:false};
const doc={getElementById:()=>el,querySelector:()=>el,querySelectorAll:()=>[],addEventListener(){},body:el,contains(){return false},createElement:()=>el};
const win={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),scrollY:0,innerWidth:1400,devicePixelRatio:1};
const api=new Function('document','window','localStorage','Chart','ExcelJS',
  src+'\nreturn { zoneLabel, dpRow };')(doc,win,{getItem:()=>null,setItem(){},removeItem(){}});

const cases=[
 ['الاسمين موجودين', {id:'a',name:'Obour District 05',nameAr:'العبور - المنطقة 05',zone:'Obour',zoneAr:'العبور'}],
 ['إنجليزي بس',      {id:'b',name:'Balteem',nameAr:'بلطيم',zone:'Balteem',zoneAr:''}],
 ['عربي بس',         {id:'c',name:'Qalin',nameAr:'قلين',zone:'',zoneAr:'قلين'}],
 ['متطابقين',        {id:'d',name:'Tanta',nameAr:'طنطا',zone:'Tanta',zoneAr:'Tanta'}],
 ['بلا زون',         {id:'e',name:'Somewhere',nameAr:'مكان',zone:'',zoneAr:''}],
 ['الحقل مش موجود',  {id:'f',name:'Old',nameAr:'قديم'}],
];
let p=0;
for(const [label,d] of cases){
  const z=api.zoneLabel(d);
  const html=api.dpRow(d,'',false,'');
  const chip=(html.match(/<span class="dp-zone[^"]*"[^>]*>([^<]*)</)||[])[1];
  const cls=(html.match(/class="(dp-zone[^"]*)"/)||[])[1];
  const ok = z.none ? (z.text==='بلا زون' && cls.includes('none')) : (!!z.text && !cls.includes('none'));
  if(ok)p++;
  console.log(`${ok?'✅':'❌'} ${label.padEnd(16)} → شبشة: "${chip.trim()}"   [${cls}]`);
}
console.log(`\n${p}/${cases.length} نجحت`);
process.exit(p===cases.length?0:1);
