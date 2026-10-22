// ════════════════════════════════════════════════════════════════
// سرّين مقبولين + `extra.via` (v2.23.0) — node tests/two-secrets.test.cjs
//
// الـ Worker عضو في مجموعتين: `WORKER_SECRET` (delivery_cod_ops · هب الشحن) و`WORKER_SECRET_WAREHOUSE`
// (warehouse_ops · هب المخزن). بيشغّل الـ handler نفسه على D1 مزيّف:
//   ① السرّين بيعدّوا · سر غلط/غايب = 401 · ② سر المخزن الفاضي/المسافات مابيفتحش الباب (`Bearer ` ≠ ضيف)
//   ③ غياب السر التاني = السلوك القديم · ④ `extra.via` بيتكتب باسم الهب اللي جه منه الطلب
//   ⑤ طلبين من هبّين مختلفين في نفس الوقت مابيتلخبطوش (الغلاف لكل طلب مش متغيّر عام)
// ════════════════════════════════════════════════════════════════
const fs=require('fs'), vm=require('vm'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.js'),'utf8').replace(/export default/,'globalThis.__w =');

const rows=[];
const stmt=(sql)=>({bind:(...b)=>({_sql:sql,_b:b,run:async()=>{ if(/INSERT INTO logs/.test(sql)) rows.push(b); return {}; },
    first:async()=>null, all:async()=>({results:[]})}),
  run:async()=>({}), first:async()=>null, all:async()=>({results:[]})});
const mkEnv=(extra)=>({ SHOP_DOMAIN:'shop', CLIENT_ID:'c', CLIENT_SECRET:'x', BOSTA_API_KEY:'k', ...extra,
  DB:{prepare:stmt, batch:async(list)=>{ for(const s of list) if(/INSERT INTO logs/.test(s._sql)) rows.push(s._b); return []; }} });
const ctx={console,fetch:async()=>({ok:false,status:404,text:async()=>'{}',json:async()=>({})}),
  crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},TextEncoder,caches:{default:{match:async()=>null,put:async()=>{}}},
  Intl,Date,Math,JSON,Map,Set,Promise,Array,Number,String,Object,RegExp,Error,parseInt,parseFloat,setTimeout,URL,URLSearchParams,
  Response:class{constructor(b,i){this.body=b;this.status=i?.status??200;this.headers=i?.headers??{}}},globalThis:null};
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(src,ctx);

const req=(action,auth,body)=>({method:body?'POST':'GET',url:`https://w/?action=${action}`,
  headers:{get:(k)=>k==='Authorization'?auth:k==='Origin'?'https://ecommoda-dev.github.io':null},json:async()=>body});
const exportBody={jobType:'return',employee:'ahmed',orders:[{id:'gid://shopify/Order/1',name:'#1',s2Status:'Confirmed + RETURN',cycleName:'#1-R1'}]};

(async()=>{
  let fails=0; const ok=(l,c,e)=>{ if(c) console.log('  ✅ '+l); else {fails++; console.log('  ❌ '+l+(e!==undefined?'  → '+JSON.stringify(e):''));} };
  const status=async(auth,e)=>(await ctx.__w.fetch(req('check_employee',auth),e)).status;
  const E2=mkEnv({WORKER_SECRET:'ship-secret',WORKER_SECRET_WAREHOUSE:'wh-secret'});

  console.log('① السرّين');
  ok('سر الشحن مقبول (مش 401)', await status('Bearer ship-secret',E2)!==401);
  ok('سر المخزن مقبول (مش 401)', await status('Bearer wh-secret',E2)!==401);
  ok('سر غلط = 401', await status('Bearer nope',E2)===401);
  ok('من غير هيدر = 401', await status(null,E2)===401);
  ok('سر المخزن لوحده على Worker ملوش سر الشحن = مقبول', await status('Bearer wh-secret',mkEnv({WORKER_SECRET_WAREHOUSE:'wh-secret'}))!==401);

  console.log('② الفاضي مابيفتحش الباب');
  const E3=mkEnv({WORKER_SECRET:'ship-secret',WORKER_SECRET_WAREHOUSE:'   '});
  ok('WORKER_SECRET_WAREHOUSE مسافات + `Bearer ` = 401', await status('Bearer ',E3)===401 && await status('Bearer    ',E3)===401);
  ok('وسر الشحن لسه شغّال', await status('Bearer ship-secret',E3)!==401);
  ok('`Bearer undefined` = 401', await status('Bearer undefined',E3)===401);

  console.log('③ السلوك القديم لو السر التاني غايب');
  const E1=mkEnv({WORKER_SECRET:'ship-secret'});
  ok('سر الشحن مقبول وغيره 401', await status('Bearer ship-secret',E1)!==401 && await status('Bearer wh-secret',E1)===401);
  const E0=mkEnv({});
  ok('بلا أي سر = 500 (مش فتح)', await status('Bearer x',E0)===500);
  ok('و`get_config` بيعدّي', (await ctx.__w.fetch(req('get_config',null),E0)).status===200);

  console.log('④ extra.via');
  rows.length=0;
  let r=await ctx.__w.fetch(req('record_export','Bearer wh-secret',exportBody),E2);
  ok('record_export نجح بسر المخزن', r.status===200, r.body);
  ok('الصف اتكتب و`extra.via = warehouse_ops`', rows.length>=1 && JSON.parse(rows[0][12]).via==='warehouse_ops', rows[0]&&rows[0][12]);
  rows.length=0;
  r=await ctx.__w.fetch(req('record_export','Bearer ship-secret',{...exportBody,orders:[{...exportBody.orders[0],id:'gid://shopify/Order/2',name:'#2',cycleName:'#2-R1'}]}),E2);
  ok('وبسر الشحن: `extra.via = delivery_cod_ops`', rows.length>=1 && JSON.parse(rows[0][12]).via==='delivery_cod_ops', rows[0]&&rows[0][12]);
  ok('والباقي في extra مابيتمسحش (ولا يتدهس)', JSON.parse(rows[0][12]).via && Object.keys(JSON.parse(rows[0][12])).length>=1);

  console.log('⑤ طلبين مختلفين في نفس الوقت');
  rows.length=0;
  const mk=(n)=>({...exportBody,orders:[{...exportBody.orders[0],id:'gid://shopify/Order/'+(10+n),name:'#'+(10+n),cycleName:'#'+(10+n)+'-R1'}]});
  await Promise.all([ctx.__w.fetch(req('record_export','Bearer wh-secret',mk(1)),E2), ctx.__w.fetch(req('record_export','Bearer ship-secret',mk(2)),E2),
                     ctx.__w.fetch(req('record_export','Bearer wh-secret',mk(3)),E2)]);
  const byOrder=Object.fromEntries(rows.map(b=>[b[5],JSON.parse(b[12]).via]));
  ok('كل صف بهبّه هو (#11 مخزن · #12 شحن · #13 مخزن)', byOrder['#11']==='warehouse_ops' && byOrder['#12']==='delivery_cod_ops' && byOrder['#13']==='warehouse_ops', byOrder);

  console.log('\n'+(fails?'❌':'✅')+' '+(fails?fails+' فشل':'كله عدّى'));
  process.exit(fails?1:0);
})();
