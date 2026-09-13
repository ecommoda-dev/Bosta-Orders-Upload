// ══════════════════════════════════════════════════════════════
// مسار الاسترجاع/الاستبدال من الـ endpoint للنهاية — node tests/re-endpoints.test.cjs
//
// الملف ده الوحيد اللي بيشغّل **الـ handler نفسه** (`fetch(request, env)`) مش
// دالة جوّاه — على شوبيفاي وبوسطة و D1 مزيّفين. موجود لأن `upload_re`
// **ما اشتغلش حي ولا مرة**: كل حاجة تحته اتجربت كدوال منفصلة بس، والوصلات
// بينها (الـ routing · الحارس · الترتيب · الرد) ما حدش شغّلها من الأول للآخر.
//
// بيغطي التلات حاجات اللي لو اتكسروا مايظهروش كخطأ:
//   ① اتجاه العنوان وإشارة الفلوس في الـ payload اللي **اتبعت فعلًا** لبوسطة
//   ② الحارس بيرفض **قبل** أي نداء لبوسطة — «مفيش ولا شحنة اتعملت» ادعاء
//      لازم يتحقق منه، مش يتكتب في رسالة
//   ③ الكتابة الرجعية بتروح على الميتافيلد والتاج الصح لكل نوع
// ══════════════════════════════════════════════════════════════
const fs=require('fs'), vm=require('vm'), path=require('path');
let src=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8')
  .replace(/export default/,'globalThis.__w =');

const ORDER_GID='gid://shopify/Order/999';
const li=(sku,q,uq,price)=>({node:{sku,name:sku,currentQuantity:q,unfulfilledQuantity:uq,
  originalUnitPriceSet:{shopMoney:{amount:String(price)}}}});
const detailOrder={
  id:ORDER_GID, legacyResourceId:'999', name:'#53517', phone:'01019191915', note:'ملاحظة\nسطرين',
  createdAt:'2026-09-01T10:00:00Z', tags:[],
  totalOutstandingSet:{shopMoney:{amount:'-1650'}},
  shippingAddress:{name:'Ahmed Ali',firstName:'Ahmed',lastName:'Ali',phone:'+20 12 71043044',
    address1:'مدينة نصر شارع مصطفى النحاس',address2:null,city:'مدينة نصر',province:'Cairo',provinceCode:'C'},
  customer:{phone:'01019191915'},
  s2Status:{value:'Confirmed + RETURN'}, courier:{value:'Bosta'}, mfTrackS2:null,
  lineItems:{edges:[li('SKU-A',1,0,1650)]},
  returns:{pageInfo:{hasNextPage:false},edges:[{node:{name:'#53517-R1',status:'OPEN',
    createdAt:'2026-09-02T10:00:00Z',closedAt:null,
    returnLineItems:{edges:[{node:{quantity:1,fulfillmentLineItem:{lineItem:{sku:'SKU-A',name:'SKU-A',
      originalUnitPriceSet:{shopMoney:{amount:'1650'}}}}}}]},
    exchangeLineItems:{edges:[]}}}]},
};

const bostaCalls=[], gqlOps=[], dbRows=[];
async function fakeFetch(url,opts){
  const u=String(url);
  if(u.includes('/admin/oauth/')) return jr(200,{access_token:'tok'});
  if(u.includes('/admin/api/')){
    const {query,variables}=JSON.parse(opts.body);
    const op=(query.match(/(?:query|mutation)\s+(\w+)/)||[])[1]||'anon';
    gqlOps.push(op);
    if(/FetchReCandidateIds/.test(query)) return jr(200,{data:{orders:{pageInfo:{hasNextPage:false,endCursor:null},
      edges:[{node:{id:ORDER_GID,name:'#53517',s2Status:{value:'Confirmed + RETURN'},courier:{value:'Bosta'}}}]}}});
    if(/FetchReDetails|FetchReCycleGuard/.test(query)) return jr(200,{data:{nodes:[detailOrder]}});
    if(/metafieldsSet/.test(query)){
      const pt=(variables.metafields||[]).find(m=>m.key==='printing_time_s2');
      if(pt) lastPrinting=pt.value;
      return jr(200,{data:{metafieldsSet:{
      metafields:(variables.metafields||[]).map(m=>({key:m.key,value:m.value,namespace:m.namespace,owner:{id:m.ownerId}})),userErrors:[]}}});
    }
    if(/tagsAdd/.test(query)) return jr(200,{data:{tagsAdd:{node:{id:variables.id},userErrors:[]}}});
    if(/VerifyS2AndPrintingTime/.test(query)) return jr(200,{data:{nodes:[{id:ORDER_GID,name:'#53517',
      s2Status:{value:'In-Return'},printingTimeS2:{value:lastPrinting}}]}});
    return jr(200,{data:{}});
  }
  if(u.includes('/cities/getAllDistricts')||u.includes('bosta.co/api/v2/cities')){
    return jr(200,{data:[{_id:'FceDyHXwpSYYF9zGW',name:'Cairo',nameAr:'القاهرة',
      districts:[{districtId:'c1',districtName:'Nasr City',districtOtherName:'مدينة نصر',dropOffAvailability:true,zoneName:'Z',zoneOtherName:'ز'}]}]});
  }
  if(u.includes('/deliveries')){ bostaCalls.push({url:u,body:JSON.parse(opts.body)});
    return jr(201,{success:true,data:{trackingNumber:'77889900',_id:'bid1'}}); }
  return jr(404,{});
}
let lastPrinting=null;
const jr=(status,body)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body),json:async()=>body});

const stmt=(sql)=>({bind:(...b)=>({run:async()=>{dbRows.push({sql,b});return{}},
  first:async()=>sql.includes('COUNT')?{n:1,total:0}:null, all:async()=>({results:[]})}),
  run:async()=>({}), first:async()=>null, all:async()=>({results:[]})});
const env={ WORKER_SECRET:'s', SHOP_DOMAIN:'shop', CLIENT_ID:'c', CLIENT_SECRET:'x', BOSTA_API_KEY:'k',
  DB:{prepare:stmt, batch:async(list)=>{ for(const _ of list){} dbRows.push({batch:list.length}); return []; }} };

const ctx={console,fetch:fakeFetch,crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},TextEncoder,
  caches:{default:{match:async()=>null,put:async()=>{}}},Intl,Date,Math,JSON,Map,Set,Promise,Array,Number,
  String,Object,RegExp,Error,parseInt,parseFloat,setTimeout,URL,URLSearchParams,Response:class{
    constructor(b,i){this.body=b;this.status=i?.status??200;this.headers=i?.headers??{}}},globalThis:null};
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(src,ctx);

const req=(action,body)=>({method:body?'POST':'GET',url:`https://w/?action=${action}`,
  headers:{get:(k)=>k==='Authorization'?'Bearer s':k==='Origin'?'https://ecommoda-dev.github.io':null},
  json:async()=>body});

(async()=>{
  let fails=0;
  const ok=(l,c,e)=>{ if(c) console.log('  ✅ '+l); else {fails++; console.log('  ❌ '+l+(e!==undefined?'  → '+JSON.stringify(e):''));} };

  console.log('\n① fetch_candidates (استرجاع)');
  let r = await ctx.__w.fetch(req('fetch_candidates',{jobType:'return',employee:'ahmed'}), env);
  let d = JSON.parse(r.body);
  ok('رد ناجح', d.ok===true, d.error);
  ok('صف واحد', (d.rows||[]).length===1, d.rows&&d.rows.length);
  const row=d.rows[0];
  ok('المبلغ بإشارته السالبة', row.cod===-1650, row.cod);
  ok('الدورة المفتوحة اتحددت', row.cycleName==='#53517-R1', row.cycleName);
  ok('المرجع الفريد', row.uref==='#53517-R1', row.uref);
  ok('القطع الراجعة', row.returnDescription==='SKU-A x1', row.returnDescription);
  ok('خطة العنوان لقت المنطقة', row.mode==='district' && row.districtName==='Nasr City', {m:row.mode,d:row.districtName});
  ok('الصف قابل للرفع', row.uploadable===true, row.problems);
  ok('مابيرجعش returns الخام للواجهة', row.returns===undefined && row.lineItems===undefined);

  console.log('\n② upload_re (استرجاع)');
  lastPrinting=null;
  bostaCalls.length=0; gqlOps.length=0;
  r = await ctx.__w.fetch(req('upload_re',{jobType:'return',employee:'ahmed',
    orders:[{id:ORDER_GID,name:'#53517',s2Status:'Confirmed + RETURN',courier:'Bosta',cycleName:'#53517-R1'}]}), env);
  d = JSON.parse(r.body);
  ok('رد ناجح', d.ok===true, d.error||d);
  const res=(d.results||[])[0]||{};
  ok('الصف نجح', res.status==='success', res);
  ok('رقم التتبع', res.trackingNumber==='77889900', res.trackingNumber);
  const p=(bostaCalls[0]||{}).body||{};
  ok('نوع بوسطة 25', p.type===25, p.type);
  ok('🔴 عنوان العميل في pickupAddress', !!p.pickupAddress && !p.dropOffAddress, Object.keys(p));
  ok('🔴 الـ cod سالب زي ما هو', p.cod===-1650, p.cod);
  ok('businessReference = اسم الأوردر', p.businessReference==='#53517', p.businessReference);
  ok('uniqueBusinessReference لكل دورة', p.uniqueBusinessReference==='#53517-R1', p.uniqueBusinessReference);
  ok('التليفون اتظبّط قبل الإرسال', p.receiver.phone==='01271043044', p.receiver.phone);
  ok('الملاحظة بقت سطر واحد', !/\n/.test(p.notes||''), p.notes);
  ok('returnSpecs موجودة و specs لأ (CRP)', !!p.returnSpecs && p.specs===undefined);
  ok('الحالة اتحدّثت', d.s2Written===true, d.s2Error);
  ok('واتسجّل في D1', dbRows.some(x=>x.batch), dbRows.length);

  console.log('\n③ حارس الكوريَر — طلب أحمد');
  detailOrder.courier={value:'Aramex'};
  r = await ctx.__w.fetch(req('upload_re',{jobType:'return',employee:'ahmed',
    orders:[{id:ORDER_GID,name:'#53517',s2Status:'Confirmed + RETURN',courier:'Bosta'}]}), env);
  d = JSON.parse(r.body);
  ok('اترفض بـ 409', r.status===409, r.status);
  ok('والكود COURIER_NOT_BOSTA', (d.blocked||[]).some(b=>b.code==='COURIER_NOT_BOSTA'), d.blocked);
  const before=bostaCalls.length;
  ok('🔴 ومفيش ولا نداء راح لبوسطة', bostaCalls.length===before, bostaCalls.length);
  detailOrder.courier={value:'Bosta'};

  console.log('\n④ الكتابة الرجعية راحت على الصح');
  {
    const mfCalls=[]; const tagCalls=[];
    // نعيد الرفع ونراقب متغيّرات شوبيفاي
    const origFetch=ctx.fetch;
    ctx.fetch=async(url,opts)=>{
      if(String(url).includes('/admin/api/')){
        const {query,variables}=JSON.parse(opts.body);
        if(/metafieldsSet/.test(query)) mfCalls.push(variables.metafields||[]);
        if(/tagsAdd/.test(query)) tagCalls.push(variables.tags||[]);
      }
      return origFetch(url,opts);
    };
    await ctx.__w.fetch(req('upload_re',{jobType:'return',employee:'ahmed',
      orders:[{id:ORDER_GID,name:'#53517',s2Status:'Confirmed + RETURN',courier:'Bosta'}]}), env);
    const keys=mfCalls.flat().map(m=>m.key);
    ok('رقم التتبع في custom.bosta_tracking_number_s2', keys.includes('bosta_tracking_number_s2'), keys);
    ok('🔴 ومش في المفتاح القديم ولا بتاع S1',
       !keys.includes('bosta_tracking_number') && !keys.includes('bosta_tracking_number_s1'), keys);
    // 🔴 طلب أحمد: في R/E بنتحقق من الكوريَر مش بنكتبه
    ok('🔴 و custom.courier مااتكتبش', !keys.includes('courier'), keys);
    ok('وحالة S2 اتكتبت', keys.includes('status_2_r_e') && keys.includes('printing_time_s2'), keys);
    ok('التاج Bosta_Uploaded_S2 مش S1',
       tagCalls.flat().includes('Bosta_Uploaded_S2') && !tagCalls.flat().includes('Bosta_Uploaded_S1'), tagCalls);
    ctx.fetch=origFetch;
  }

  console.log('\n⑤ الاستبدال — الاتجاه بيتقلب والطرد الخارج بيتبعت');
  {
    detailOrder.s2Status={value:'Confirmed + EXCHANGE'};
    detailOrder.lineItems={edges:[li('SKU-A',1,0,1650), li('SKU-B',1,1,2400)]};
    detailOrder.returns.edges[0].node.exchangeLineItems={edges:[{node:{quantity:1,
      lineItems:[{sku:'SKU-B',name:'SKU-B',originalUnitPriceSet:{shopMoney:{amount:'2400'}}}]}}]};
    detailOrder.totalOutstandingSet={shopMoney:{amount:'750'}};
    bostaCalls.length=0;
    const r5 = await ctx.__w.fetch(req('upload_re',{jobType:'exchange',employee:'ahmed',
      orders:[{id:ORDER_GID,name:'#53517',s2Status:'Confirmed + EXCHANGE',courier:'Bosta'}]}), env);
    const d5=JSON.parse(r5.body);
    ok('رد ناجح', d5.ok===true, d5.error);
    const pe=(bostaCalls[0]||{}).body||{};
    ok('نوع بوسطة 30', pe.type===30, pe.type);
    // 🔴 الاتجاه بيتقلب: الاستبدال بيوصّل، فعنوان العميل dropOff مش pickup
    ok('🔴 عنوان العميل في dropOffAddress', !!pe.dropOffAddress && !pe.pickupAddress, Object.keys(pe));
    ok('specs = القطعة الخارجة', pe.specs?.packageDetails?.description==='SKU-B x1', pe.specs);
    ok('returnSpecs = القطعة الراجعة', pe.returnSpecs?.packageDetails?.description==='SKU-A x1', pe.returnSpecs);
    // 🔴 قيمة البضاعة = اللي بيسافر (الخارج) مش الراجع — #53701: 2400 مش 2600
    ok('قيمة البضاعة = الخارج مش الراجع', pe.goodsInfo?.amount===2400, pe.goodsInfo);
    ok('المرجع الفريد بـ -EX', pe.uniqueBusinessReference==='#53517-EX1', pe.uniqueBusinessReference);
    ok('والحالة راحت Ready', d5.nextStatus==='Ready', d5.nextStatus);
  }

  console.log('\n⑥ الاستبدال بلا قطع خارجة — حاجب');
  {
    detailOrder.returns.edges[0].node.exchangeLineItems={edges:[]};
    detailOrder.lineItems={edges:[li('SKU-A',1,0,1650)]};
    bostaCalls.length=0;
    const r6 = await ctx.__w.fetch(req('upload_re',{jobType:'exchange',employee:'ahmed',
      orders:[{id:ORDER_GID,name:'#53517',s2Status:'Confirmed + EXCHANGE',courier:'Bosta'}]}), env);
    const d6=JSON.parse(r6.body);
    ok('اترفض بـ 409', r6.status===409, r6.status);
    ok('بكود EXCHANGE_WITHOUT_ITEMS', (d6.blocked||[]).some(b=>b.code==='EXCHANGE_WITHOUT_ITEMS'), d6.blocked);
    // صف بوسطة من غير ولا قطعة خارجة مش شحنة أصلًا — قرار أحمد 09-09-2026
    ok('🔴 ومفيش ولا نداء راح لبوسطة', bostaCalls.length===0, bostaCalls.length);
  }

  console.log(`\n${'═'.repeat(50)}\n${fails?'فشل '+fails:'كله نجح'}\n`);
  process.exit(fails?1:0);
})();
