// ══════════════════════════════════════════════════════════════
// مطابقة الزون عبر المدن — node tests/zone-cross-city.test.cjs
//
// 🔴 البند اللي بيحميه: أوردر العبور لازم يطلّع **اقتراح جاهز** (زون العبور
//    تحت القاهرة)، مش يقع على «المحافظة بس» صامتة. أسماء المناطق والزونات هنا
//    منسوخة حرفيًا من كتالوج بوسطة الحي (07-09-2026).
// ══════════════════════════════════════════════════════════════
const fs=require('fs');
const src=fs.readFileSync('/home/user/Bosta-Orders-Upload/index.js','utf8').replace(/export default \{[\s\S]*$/,'');
const api=new Function(src+' return { ensureNormalized, resolveAddress };')();
// D(id, name, nameAr, zone, zoneAr) — أسماء حقيقية من سكرين شوت النافذة
const D=(id,name,nameAr,zone,zoneAr)=>({id,name,nameAr,zone,zoneAr,dropOff:true});
const catalog={cities:[
 {cityId:'FceDyHXwpSYYF9zGW',cityName:'Cairo',cityAr:'القاهره',districts:[
   D('o0','Obour Buildings (Masr ElGedida)','عمارات العبور (مصر الجديده)','Masr ElGedida','مصر الجديده'),
   D('o1',"Ahya'a El Obour El Jadida",'احياء العبور الجديده','Obour','العبور'),
   D('o2','Dar Masr - ElObour','دار مصر - العبور','Obour','العبور'),
   D('o3','District 01 (Obour)','المنطقة 01 (العبور)','Obour','العبور'),
   D('o4','District 02 (Obour)','المنطقة 02 (العبور)','Obour','العبور'),
   D('o5','District 03 (Obour)','المنطقة 03 (العبور)','Obour','العبور'),
   D('o6','District 04 (Obour)','المنطقة 04 (العبور)','Obour','العبور'),
   D('c1','Nasr City','مدينة نصر','Nasr City','مدينة نصر'),
   D('c2','Maadi','المعادي','Maadi','المعادي'),
 ]},
 {cityId:'yp3atroeTwnyiBNKE',cityName:'El Kalioubia',cityAr:'القليوبيه',districts:[
   D('q1','Benha','بنها','Benha','بنها'), D('q2','Baqirah','بقيره','Benha','بنها'),
   D('q3','Bata','بطا','Benha','بنها'), D('q4','Qalyub','قليوب','Qalyub','قليوب'),
 ]},
 {cityId:'ByP7rFCjL6XzF6j4S',cityName:'Kafr Alsheikh',cityAr:'كفر الشيخ',districts:[
   D('k1','Kafr ElSheikh','كفر الشيخ','Kafr ElSheikh','كفر الشيخ'),
   D('k2','Sidi Salem','سيدي سالم','Sidi Salem','سيدي سالم'),
   D('k3','Qalin','قلين','Qalin','قلين'),
 ]},
]};
api.ensureNormalized(catalog);

const cases=[
 ['#53699 العبور',{city:'العبور',address1:'العبور الحي الخامس بلوك ١٦٠٢٧فيلا٢١',province:'Qalyubia',provinceCode:'KB'}],
 ['#53698 العبور',{city:'العبور ',address1:'العبور شارع الشباب الجامع الكبير ٥٦٢ شقه ٨',province:'Qalyubia',provinceCode:'KB'}],
 ['عبور بمحافظة صح',{city:'العبور',address1:'العبور المنطقة الاولى',province:'Cairo',provinceCode:'C'}],
 ['#53774 سيدي سالم (مايتأثرش)',{city:'سيدي سالم',address1:'كفر الشيخ سيدي سالم بجوار بنك مصر',province:'Kafr el-Sheikh',provinceCode:'KFS'}],
];
for(const [label,sa] of cases){
  const p=api.resolveAddress({shippingAddress:sa},catalog);
  console.log(`\n── ${label} ──`);
  console.log(`  الوضع: ${p.mode}${p.cityDoubt?' · 🟠 cityDoubt':''}${p.districtName?' · '+p.districtName:''}`);
  (p.crossCity||[]).forEach(c=>console.log(`  🟠 اقتراح [${c.kind}]: ${c.cityName}${c.kind==='zone'?` ← زون ${c.zone} — ${c.zoneAr} (${c.districtCount} منطقة)`:` ← ${c.districtName}`}  ← طابق "${c.matchedText}" في ${c.fieldLabel}`));
  (p.localZones||[]).forEach(z=>console.log(`  🗺️ زون محلي: ${z.zone} — ${z.zoneAr} (${z.districtCount} منطقة) ← طابق "${z.matchedText}" في ${z.fieldLabel}`));
}

// تأكيد آلي بدل القراءة بالعين
const t=(l,c)=>{ if(!c){ console.error('❌ '+l); process.exitCode=1; } else console.log('✅ '+l); };
const P=sa=>api.resolveAddress({shippingAddress:sa},catalog);
const obour=P({city:'العبور',address1:'العبور الحي الخامس بلوك ١٦٠٢٧فيلا٢١',province:'Qalyubia',provinceCode:'KB'});
t('العبور بتدّي 🟠 cityDoubt', obour.cityDoubt === true);
t('الاقتراح زون مش منطقة',     obour.crossCity[0]?.kind === 'zone');
t('الاقتراح على القاهرة',      obour.crossCity[0]?.cityName === 'Cairo');
t('الاقتراح مالوش districtId', !obour.crossCity[0]?.districtId);
t('طابق من خانة city',         obour.crossCity[0]?.fieldLabel === 'مدينة شوبيفاي');
const ok=P({city:'سيدي سالم',address1:'كفر الشيخ سيدي سالم بجوار بنك مصر',province:'Kafr el-Sheikh',provinceCode:'KFS'});
t('مطابقة المنطقة ما اتأثرتش', ok.mode === 'district' && ok.districtName === 'Sidi Salem');
