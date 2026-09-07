// ══════════════════════════════════════════════════════════════
// EcomModa — Bosta-Orders-Upload (v1.2.0)
// skills: worker-builder v2.1.0 · constants v1.10.0 · bosta-api-helper v1.1.0 ·
//         shopify-graphql-helper v1.1.0 · order-lifecycle v1.3.0 — 07-09-2026
//
// بديل زرار "Send to Bosta" بتاع بلجن بوسطة على شوبيفاي.
// بيعرض الأوردرات المؤهَّلة، بيرفعها جماعيًا على بوسطة بنداءات فردية،
// وبيكتب النتيجة على شوبيفاي وفي D1.
//
// العقد المرجعي الكامل: SPEC.md في نفس الريبو.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// §CONSTANTS
// ══════════════════════════════════════════════════════════════
const TOOL_NAME      = 'bosta_orders_upload';   // ecommoda-constants §7 — لازم يتسجّل قبل أول writeLog
const WORKER_VERSION = '1.2.0';
const API_VERSION    = '2026-01';

// ─── §CONSTANTS::bosta ───
const BOSTA_BASE        = 'https://app.bosta.co/api/v2';
const BOSTA_LOCATION_ID = 'GeZMkbD7o';                          // كلية البنات - مصر الجديدة
const BOSTA_COUNTRY_ID  = '60e4482c7cb7d4bc4849c4d5';           // مصر
const BOSTA_TYPE        = 10;                                   // Package Delivery (Send)
const FLEX_AMOUNT       = 100;                                  // SPEC §٤.٢ — على كل الأوردرات
const COD_MAX           = 30000;                                // موثّق حرفيًا في api.yaml
const ALLOW_OPEN_PKG    = true;                                 // قرار تشغيلي — EGP 7/شحنة، متتشالش

// ─── §CONSTANTS::shopify ───
// القيم الحرفية — فرق حرف واحد = صفر صف من غير أي خطأ (ecommoda-order-lifecycle)
const S1_CONFIRMED      = 'Confirmed';
const S1_CONFIRMED_EDIT = 'Confirmed + Edit';
const ZONE_VALUE        = 'Other_Regions';
const START_DATE        = '2026-08-01';                         // بتوقيت المتجر (القاهرة)
const UPLOAD_TAG        = 'Bosta_Uploaded_S1';
const MF_COURIER        = { key: 'courier',               type: 'single_line_text_field' };
const MF_TRACKING       = { key: 'bosta_tracking_number', type: 'number_integer' };  // 🔴 رقم مش نص

// ─── §CONSTANTS::batch ───
const MAX_BATCH   = 25;   // أقصى عدد أوردرات في نداء upload واحد
const UPLOAD_CONC = 3;    // توازي متحفّظ — حدود استهلاك بوسطة غير موثّقة (SPEC §٦.٣)

// ─── §CONSTANTS::queryCost ───
// 🔴 حجم الصفحة محكوم بسقف تكلفة الاستعلام عند شوبيفاي (1000 نقطة)، مش بالسقف
//    الاسمي 250. تكلفة الصفحة ≈ ORDERS_PAGE × (LINE_ITEMS + 12) + 2، والقيم دي
//    بتدّي ≈925 نقطة. رفع ORDERS_PAGE لـ250 بيدّي عشرات الآلاف من النقاط
//    والاستعلام بيترفض بـ MAX_COST_EXCEEDED — يعني صفر أوردر، مش أبطأ شوية.
const ORDERS_PAGE   = 25;
const LINE_ITEMS    = 25;
const MAX_PAGES     = 80;   // سقف أمان = 2000 أوردر؛ التجاوز بيترجع كتحذير مش بصمت

// ─── §CONSTANTS::provinces ───
// 🔴 مصدره ecommoda-constants §3.5 حرفيًا. ممنوع أي مطابقة نصية تقريبية على
//    اسم المحافظة كخطة بديلة — province مش في الجدول = خطأ صريح يتعرض.
//    (فروق الإملاء بين المنصتين متوثّقة صف بصف — Beheira/Behira · Qalyubia/El Kalioubia …)
const PROVINCE_TABLE = [
  { province: 'Cairo',          code: 'C',   cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo' },
  { province: 'Alexandria',     code: 'ALX', cityId: 'Jrb6X6ucjiYgMP4T7', cityName: 'Alexandria' },
  { province: 'Giza',           code: 'GZ',  cityId: '0064Qb0OgcA',       cityName: 'Giza' },
  { province: 'Qalyubia',       code: 'KB',  cityId: 'yp3atroeTwnyiBNKE', cityName: 'El Kalioubia' },
  { province: 'Port Said',      code: 'PTS', cityId: 'skFtf6ZmKo8kBEBDK', cityName: 'Port Said' },
  { province: 'Suez',           code: 'SUZ', cityId: 'PickurJ5uJZ9rDTHW', cityName: 'Suez' },
  { province: 'Dakahlia',       code: 'DK',  cityId: 'RrDhS8YYsXAwZ9Zfo', cityName: 'Dakahlia' },
  { province: 'Al Sharqia',     code: 'SHR', cityId: '6ExcoGbpYHnggP8JD', cityName: 'Sharqia' },
  { province: 'Monufia',        code: 'MNF', cityId: 'ruBSjGBDX9wpRa3cc', cityName: 'Monufia' },
  { province: 'Gharbia',        code: 'GH',  cityId: 'K3RwC677J8kJytdZD', cityName: 'Gharbia' },
  { province: 'Beheira',        code: 'BH',  cityId: 'g3GchTSmCgR2JynsJ', cityName: 'Behira' },
  { province: 'Ismailia',       code: 'IS',  cityId: 'PJqNriLtFtx2cfkKP', cityName: 'Ismailia' },
  { province: 'Kafr el-Sheikh', code: 'KFS', cityId: 'ByP7rFCjL6XzF6j4S', cityName: 'Kafr Alsheikh' },
  { province: 'Damietta',       code: 'DT',  cityId: 'qoZvYcZ8Cqji4pGp5', cityName: 'Damietta' },
  { province: 'Aswan',          code: 'ASN', cityId: 'kLvZ5JY6LJPL5chzN', cityName: 'Aswan' },
  { province: 'Luxor',          code: 'LX',  cityId: 'wgYEdH2WMzxGE2Ztp', cityName: 'Luxor' },
  { province: 'Red Sea',        code: 'BA',  cityId: 'r5TscLCNSjR2GimxQ', cityName: 'Red Sea' },
  { province: 'Beni Suef',      code: 'BNS', cityId: 'LzbbvTzZ7D2CgE2PL', cityName: 'Bani Suif' },
  { province: 'Faiyum',         code: 'FYM', cityId: 'BW5MiNxEirB7tuz2y', cityName: 'Fayoum' },
  { province: 'Minya',          code: 'MN',  cityId: 'si6eLnKjXqTFTMBj9', cityName: 'Menya' },
  { province: 'Asyut',          code: 'AST', cityId: '7mDPAohM3ArSZmWTm', cityName: 'Assuit' },
  { province: 'Sohag',          code: 'SHG', cityId: 'n3EENg2adhuR9xBZK', cityName: 'Sohag' },
  { province: 'Qena',           code: 'KN',  cityId: 'vfTHTes3uGjAszgtg', cityName: 'Qena' },
  { province: 'North Sinai',    code: 'SIN', cityId: 'ZuCaDAVQlPT',       cityName: 'North Sinai' },
  { province: 'South Sinai',    code: 'JS',  cityId: 'nG_c44vHQht',       cityName: 'South Sinai' },
  { province: 'Matrouh',        code: 'MT',  cityId: 'KBpGiRZJMIx',       cityName: 'Matrouh' },
  { province: 'New Valley',     code: 'WAD', cityId: 'w4yDVHVJWqa4HpbzA', cityName: 'New Valley' },
  // حالتان خاصتان — محافظات شوبيفاي اتلغت إداريًا 2011، وبوسطة ماشية على 28 مدينة.
  // مفيش city منفصل عندها — دول zones جوه city تانية (ecommoda-constants §3.5).
  { province: '6th of October', code: 'SU',  cityId: '0064Qb0OgcA',       cityName: 'Giza',
    zoneOnly: { en: '6 October', ar: '٦ اكتوبر' } },
  { province: 'Helwan',         code: 'HU',  cityId: 'FceDyHXwpSYYF9zGW', cityName: 'Cairo',
    zoneOnly: { en: 'Helwan',    ar: 'حلوان' } },
];
// مدينة بوسطة مالهاش مقابل في شوبيفاي — تتطابق كمدينة منفصلة لو نص العنوان ذكرها
const NORTH_COAST = { cityId: '2hGtNLfRgqGrJjnW9', cityName: 'North Coast',
                      hints: ['الساحل الشمالي', 'north coast', 'الساحل الشمالى'] };

const PROVINCE_BY_NAME = new Map(PROVINCE_TABLE.map(r => [r.province.toLowerCase(), r]));
const PROVINCE_BY_CODE = new Map(PROVINCE_TABLE.map(r => [r.code.toUpperCase(), r]));

// ══════════════════════════════════════════════════════════════
// §CORS — Option B (الأداة بتكتب على شوبيفاي وبتنشئ شحنات بفلوس حقيقية)
// ══════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = [
  'https://ecommoda-dev.github.io',
];
function getCORS(request) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// ══════════════════════════════════════════════════════════════
// §HELPERS
// ══════════════════════════════════════════════════════════════
function json(data, status = 200, request = null) {
  const headers = { 'Content-Type': 'application/json' };
  Object.assign(headers, request ? getCORS(request) : { 'Access-Control-Allow-Origin': '*' });
  return new Response(JSON.stringify(data), { status, headers });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── §HELPERS::assertEnv ───
// متغير ناقص لازم يوقف العملية برسالة باسمه — مش يفشل بصمت جوه نداء.
const ENV_REQUIRED = {
  shopify: ['SHOP_DOMAIN', 'CLIENT_ID', 'CLIENT_SECRET'],
  bosta:   ['BOSTA_API_KEY'],
};
function assertEnv(env, ...groups) {
  const missing = [];
  for (const g of groups) {
    for (const key of (ENV_REQUIRED[g] || [])) {
      if (env[key] === undefined || env[key] === null || String(env[key]).trim() === '') missing.push(key);
    }
  }
  if (!env.DB) missing.push('DB (D1 binding)');
  if (missing.length) {
    throw new Error(
      `متغيرات ناقصة في الـ Worker: ${missing.join('، ')} — ضِفها من ` +
      `Dashboard → Settings → Variables ثم Promote النسخة. (شغّل ?action=diag)`
    );
  }
}

// ─── §HELPERS::secretFingerprint ───
async function secretFingerprint(secret) {
  if (!secret) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(buf)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── §HELPERS::normPhone ───
// 🔴 المتجر فيه الشكلين مع بعض ("01009619555" و "+201033337575").
//    من غير التطبيع، الرقمين بيتحسبوا مختلفين وبنبعت نفس الرقم في phone و secondPhone.
const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');

// ─── §HELPERS::normText ───
// تطبيع نص عربي/إنجليزي للمطابقة: تشكيل، ألف/ياء/تاء مربوطة، ترقيم، مسافات.
function normText(s) {
  return String(s || '')
    .replace(/[ً-ْٰـ]/g, '')   // تشكيل + تطويل
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

// ══════════════════════════════════════════════════════════════
// §SHARED — copy verbatim — never modify
// ══════════════════════════════════════════════════════════════

/**
 * Verify employee and return display_name if correct.
 */
async function verifyEmployee(db, username, pin) {
  const row = await db.prepare(
    'SELECT display_name, is_active FROM employees WHERE username = ? AND pin = ?'
  ).bind(username, pin).first();

  if (!row) return null;

  if (!row.is_active) {
    throw new Error('الحساب موقوف — تواصل مع المسؤول');
  }

  db.prepare('UPDATE employees SET last_login = ? WHERE username = ?')
    .bind(new Date().toISOString(), username)
    .run()
    .catch(() => {});

  return row.display_name;
}

async function checkEmployee(db, username) {
  const row = await db.prepare(
    'SELECT is_active, pin FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row) return { exists: false, hasPin: false, isActive: false };
  return {
    exists:   true,
    hasPin:   !!row.pin,
    isActive: !!row.is_active,
  };
}

async function registerPin(db, username, pin) {
  const row = await db.prepare(
    'SELECT pin, is_active FROM employees WHERE username = ?'
  ).bind(username).first();

  if (!row)           throw new Error('اسم المستخدم غير موجود');
  if (!row.is_active) throw new Error('الحساب موقوف — تواصل مع المسؤول');
  if (row.pin)        throw new Error('هذا المستخدم مسجّل بالفعل — تواصل مع المسؤول لإعادة الضبط');

  await db.prepare('UPDATE employees SET pin = ? WHERE username = ?')
    .bind(pin, username)
    .run();

  return true;
}

async function writeLog(db, entry) {
  await db.prepare(`
    INSERT INTO logs
      (timestamp, tool, type, employee, order_id, order_name,
       sku, product_title, delta, value_before, value_after, notes, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    entry.timestamp    ?? new Date().toISOString(),
    entry.tool,
    entry.type,
    entry.employee     ?? null,
    entry.orderId      ?? null,
    entry.orderName    ?? null,
    entry.sku          ?? null,
    entry.productTitle ?? null,
    entry.delta        ?? null,
    entry.valueBefore  ?? null,
    entry.valueAfter   ?? null,
    entry.notes        ?? null,
    entry.extra ? JSON.stringify(entry.extra) : null
  ).run();
}

const LOG_EXPORT_MAX = 2000;   // سقف التصدير — بيرجع للواجهة كـ `cap`

function buildLogFilterSQL(select, {
  tool      = null,
  employee  = null, employees = null,
  type      = null, types     = null,
  search    = null,
  dateFrom  = null, dateTo    = null,
} = {}) {
  let sql = `${select} FROM logs WHERE type NOT IN ('login','logout')`;
  const b = [];

  const emps = Array.isArray(employees) && employees.length ? employees : (employee ? [employee] : []);
  const typs = Array.isArray(types)     && types.length     ? types     : (type     ? [type]     : []);

  if (tool) { sql += ' AND tool = ?'; b.push(tool); }
  if (emps.length) {
    sql += ` AND employee IN (${emps.map(() => '?').join(',')})`; b.push(...emps);
  }
  if (typs.length) {
    sql += ` AND type IN (${typs.map(() => '?').join(',')})`; b.push(...typs);
  }
  if (search) {
    sql += ' AND (order_name LIKE ? OR notes LIKE ?)';
    b.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) { sql += ' AND substr(timestamp, 1, 10) >= ?'; b.push(dateFrom); }
  if (dateTo)   { sql += ' AND substr(timestamp, 1, 10) <= ?'; b.push(dateTo); }

  return { sql, b };
}

async function getLogs(db, { limit = 100, offset = 0, ...filters } = {}) {
  const { sql, b } = buildLogFilterSQL('SELECT *', filters);
  const q = sql + ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  return (await db.prepare(q)
    .bind(...b, Math.min(limit, 100), Math.max(offset, 0)).all()).results;
}

async function getLogsCount(db, filters = {}) {
  const { sql, b } = buildLogFilterSQL('SELECT COUNT(*) as total', filters);
  const row = await db.prepare(sql).bind(...b).first();
  return row?.total ?? 0;
}

async function getLogsExport(db, filters = {}) {
  const { sql, b } = buildLogFilterSQL('SELECT *', filters);
  const q = sql + ' ORDER BY timestamp DESC LIMIT ?';
  return (await db.prepare(q).bind(...b, LOG_EXPORT_MAX).all()).results;
}

function logParamsFrom(url, tool) {
  const csv = (k) => (url.searchParams.get(k) || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const employees = csv('employees'), types = csv('types');
  return {
    tool,
    employees: employees.length ? employees : null,
    employee:  url.searchParams.get('employee') || null,
    types:     types.length ? types : null,
    type:      url.searchParams.get('type')     || null,
    search:    url.searchParams.get('search')   || null,
    dateFrom:  url.searchParams.get('dateFrom') || null,
    dateTo:    url.searchParams.get('dateTo')   || null,
  };
}

// ─── §SHARED::AUTH_APPS ───
// قايمة بيضاء مقفولة — appId جاي من العميل وجدول logs مشترك بين كل أدوات الستاك.
const AUTH_APPS = new Set([TOOL_NAME]);
function resolveAuthTool(appId) { return AUTH_APPS.has(appId) ? appId : TOOL_NAME; }

// ══════════════════════════════════════════════════════════════
// §SHOPIFY
// ══════════════════════════════════════════════════════════════
async function getAccessToken(env) {
  const resp = await fetch(
    `https://${env.SHOP_DOMAIN}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        grant_type:    'client_credentials',
      }),
    }
  );
  if (!resp.ok) throw new Error(`OAuth failed: ${resp.status}`);
  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token;
}

// ─── §SHOPIFY::shopifyGQL — العقد الإلزامي، منسوخة كما هي ───
// أي فشل بيترمي. مفيش رد بيعدّي وهو فاشل:
//   ① فشل شبكة  ② HTTP status  ③ رد مش JSON  ④ data.errors  ⑤ data فاضية
// ④ هو الخطير: ميوتيشن مترفوضة على مستوى الحقل بترجّع {"errors":[…],"data":null}
// والـ userErrors بتبقى [] لأن مفيش payload أصلاً — كود بيفحص userErrors بس بيقرا ده نجاح.
async function shopifyGQL(env, token, query, variables = {}, opName = 'shopify') {
  const MAX_ATTEMPTS = 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let resp, text;
    try {
      resp = await fetch(`https://${env.SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body:    JSON.stringify({ query, variables }),
      });
      text = await resp.text();
    } catch (e) {
      lastErr = new Error(`${opName}: فشل الاتصال بشوبيفاي — ${e.message}`);
      if (attempt < MAX_ATTEMPTS) { await sleep(400 * attempt); continue; }
      throw lastErr;
    }

    if (!resp.ok) {
      const retriable = resp.status === 429 || resp.status >= 500;
      lastErr = new Error(`${opName}: شوبيفاي ردّت HTTP ${resp.status} — ${text.slice(0, 180)}`);
      if (retriable && attempt < MAX_ATTEMPTS) { await sleep(700 * attempt); continue; }
      throw lastErr;
    }

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`${opName}: رد شوبيفاي مش JSON صالح — ${text.slice(0, 180)}`); }

    if (Array.isArray(data.errors) && data.errors.length) {
      const codes = data.errors.map(e => e?.extensions?.code).filter(Boolean);
      lastErr = new Error(
        `${opName}: ${data.errors.map(e => e.message).join(' | ')}` +
        (codes.length ? ` [${codes.join(',')}]` : '')
      );
      if (codes.includes('THROTTLED') && attempt < MAX_ATTEMPTS) {
        await sleep(1200 * attempt); continue;
      }
      throw lastErr;
    }

    if (!data.data) throw new Error(`${opName}: رد شوبيفاي بدون data — ${text.slice(0, 180)}`);
    return data;
  }
  throw lastErr || new Error(`${opName}: فشل غير معروف`);
}

// ─── §SHOPIFY::orderFields ───
const ORDER_FIELDS = `
  id
  legacyResourceId
  name
  createdAt
  note
  phone
  tags
  displayFinancialStatus
  displayFulfillmentStatus
  totalOutstandingSet      { presentmentMoney { amount currencyCode } }
  currentSubtotalPriceSet  { presentmentMoney { amount currencyCode } }
  shippingAddress { name firstName lastName phone address1 address2 city province provinceCode zip }
  mfStatus:   metafield(namespace: "custom", key: "manual_status")         { value }
  mfZone:     metafield(namespace: "custom", key: "zone")                  { value }
  mfCourier:  metafield(namespace: "custom", key: "courier")               { value }
  mfTracking: metafield(namespace: "custom", key: "bosta_tracking_number") { value }
  lineItems(first: ${LINE_ITEMS}) {
    nodes { currentQuantity sku title variantTitle }
  }
`;

// ─── §SHOPIFY::buildOrdersQuery ───
// 🔴 القيم حرفية: Other_Regions بـ _ ، و "Confirmed + Edit" بمسافات حوالين الـ +
//    و metafields. بنقطة مش نقطتين — النقطتين بتتحوّل بصمت لبحث نصي كامل.
function ordersQueryString() {
  return `metafields.custom.zone:'${ZONE_VALUE}' AND created_at:>=${START_DATE} ` +
         `AND (metafields.custom.manual_status:'${S1_CONFIRMED}' ` +
         `OR metafields.custom.manual_status:'${S1_CONFIRMED_EDIT}')`;
}
function ordersQuerySingle(status) {
  return `metafields.custom.zone:'${ZONE_VALUE}' AND created_at:>=${START_DATE} ` +
         `AND metafields.custom.manual_status:'${status}'`;
}

// ─── §SHOPIFY::fetchEligibleOrders ───
// الترقيم تسلسلي — أقصى صفحة 250، مفيش جلب متوازي.
async function fetchEligibleOrders(env, token) {
  const QUERY = `
    query EligibleOrders($cursor: String, $q: String!) {
      orders(first: ${ORDERS_PAGE}, after: $cursor, query: $q, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_FIELDS} }
      }
    }
  `;
  const q = ordersQueryString();
  const out = [];
  let cursor = null, hasNext = true, pages = 0;

  while (hasNext && pages < MAX_PAGES) {
    const data = await shopifyGQL(env, token, QUERY, { cursor, q }, 'fetchEligibleOrders');
    const conn = data.data?.orders;
    if (!conn) throw new Error('fetchEligibleOrders: شوبيفاي ردّت من غير orders');
    out.push(...(conn.nodes || []));
    hasNext = !!conn.pageInfo?.hasNextPage;
    cursor  = conn.pageInfo?.endCursor || null;
    pages++;
  }
  // الوصول للسقف مش حالة طبيعية — بيترجع للواجهة كتحذير بدل ما القايمة تبان كاملة وهي ناقصة
  return { orders: out, truncated: hasNext, pages };
}

// ─── §SHOPIFY::fetchOrdersByGid ───
async function fetchOrdersByGid(env, token, gids) {
  if (!gids.length) return [];
  const QUERY = `query OrdersByGid($ids: [ID!]!) { nodes(ids: $ids) { ... on Order { ${ORDER_FIELDS} } } }`;
  const out = [];
  for (let i = 0; i < gids.length; i += ORDERS_PAGE) {
    const data = await shopifyGQL(env, token, QUERY, { ids: gids.slice(i, i + ORDERS_PAGE) }, 'fetchOrdersByGid');
    out.push(...(data.data?.nodes || []).filter(Boolean));
  }
  return out;
}

// ─── §SHOPIFY::filterGuard ───
// حارس وقت التشغيل بدل اختبار يدوي مرة واحدة (SPEC §٣.٤).
// 'Confirmed + Edit' فيه مسافة و + مع بعض، والاتنين اتأكدوا منفصلين بس.
// لو a + b !== combined فالفلتر مش متسق — الواجهة بتعرض بانر أحمر وبتفضل شغالة.
async function filterGuard(env, token) {
  const Q = `query CountOrders($q: String!) { ordersCount(query: $q, limit: 10000) { count precision } }`;
  try {
    const [c, a, b] = await Promise.all([
      shopifyGQL(env, token, Q, { q: ordersQueryString() },              'guardCombined'),
      shopifyGQL(env, token, Q, { q: ordersQuerySingle(S1_CONFIRMED) },  'guardConfirmed'),
      shopifyGQL(env, token, Q, { q: ordersQuerySingle(S1_CONFIRMED_EDIT) }, 'guardConfirmedEdit'),
    ]);
    const combined = c.data?.ordersCount?.count ?? null;
    const only     = a.data?.ordersCount?.count ?? null;
    const edit     = b.data?.ordersCount?.count ?? null;
    if (combined == null || only == null || edit == null) {
      return { checked: false, reason: 'ordersCount رجّع قيمة فاضية' };
    }
    return { checked: true, consistent: (only + edit) === combined, combined, confirmed: only, confirmedEdit: edit };
  } catch (e) {
    // الحارس استشاري — فشله مايوقفش الأداة، بس بيتعرض
    return { checked: false, reason: e.message };
  }
}

// ─── §SHOPIFY::writeBackToShopify ───
// بعد كل نجاح رفع فقط. تلات أكشنز على نفس الأوردر.
// 🔴 bosta_tracking_number نوعه number_integer — أي type تاني بيسقّط النداء كله
//    بما فيه كتابة courier اللي في نفس النداء.
async function writeBackToShopify(env, token, order, trackingNumber, actions) {
  const warnings = [];
  const tn = String(trackingNumber ?? '').trim();
  const numericTracking = /^\d+$/.test(tn);

  const metafields = [{
    ownerId: order.id, namespace: 'custom', key: MF_COURIER.key,
    type: MF_COURIER.type, value: 'Bosta',
  }];
  if (numericTracking) {
    metafields.push({
      ownerId: order.id, namespace: 'custom', key: MF_TRACKING.key,
      type: MF_TRACKING.type, value: tn,     // metafieldsSet بياخد value نص دايمًا
    });
  } else {
    warnings.push(`رقم التتبع "${tn}" مش أرقام بس — الميتافيلد نوعه number_integer فما اتكتبش`);
  }

  const MUT_MF = `
    mutation SetMf($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key value namespace owner { ... on Order { id } } }
        userErrors { field message }
      }
    }
  `;
  const mfData = await shopifyGQL(env, token, MUT_MF, { metafields }, 'metafieldsSet');
  const mfRes  = mfData.data?.metafieldsSet;
  const mfErrs = mfRes?.userErrors || [];
  if (mfErrs.length) throw new Error('metafieldsSet: ' + mfErrs.map(e => e.message).join(' | '));

  // ③ تأكيد الـ payload — userErrors:[] معناها "مفيش اعتراض" مش "اتنفّذت"
  const written = mfRes?.metafields || [];
  const byKey   = new Map(written.map(m => [m.key, m]));
  const courierOk = byKey.get(MF_COURIER.key)?.value === 'Bosta'
                 && byKey.get(MF_COURIER.key)?.owner?.id === order.id;
  if (!courierOk) throw new Error('metafieldsSet: شوبيفاي ما أكدتش كتابة custom.courier');
  actions.push('كتابة custom.courier = Bosta');

  if (numericTracking) {
    const trackOk = byKey.get(MF_TRACKING.key)?.value === tn;
    if (!trackOk) throw new Error('metafieldsSet: شوبيفاي ما أكدتش كتابة custom.bosta_tracking_number');
    actions.push(`كتابة custom.bosta_tracking_number = ${tn}`);
  }

  // التاج — tagsAdd بيمنع التكرار تلقائيًا، والتاجات حساسة لحالة الحروف
  const MUT_TAG = `
    mutation AddTag($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) { node { id } userErrors { field message } }
    }
  `;
  const tagData = await shopifyGQL(env, token, MUT_TAG, { id: order.id, tags: [UPLOAD_TAG] }, 'tagsAdd');
  const tagRes  = tagData.data?.tagsAdd;
  const tagErrs = tagRes?.userErrors || [];
  if (tagErrs.length) throw new Error('tagsAdd: ' + tagErrs.map(e => e.message).join(' | '));
  if (!tagRes?.node?.id) throw new Error('tagsAdd: شوبيفاي ما أكدتش إضافة التاج');
  actions.push(`إضافة التاج ${UPLOAD_TAG}`);

  return warnings;
}

// ══════════════════════════════════════════════════════════════
// §BOSTA
// ══════════════════════════════════════════════════════════════
// ⚠️ Authorization = مفتاح خام بدون "Bearer" — الـ Bearer بيدّي 401 من غير رسالة واضحة.
function bostaHeaders(env) {
  return { 'Authorization': env.BOSTA_API_KEY, 'Content-Type': 'application/json' };
}

// ─── §BOSTA::catalog ───
// كتالوج المدن ثابت نسبيًا → يتكاش. بيفضّل KV لو الـ binding موجود،
// وإلا بيستخدم Cache API (مفيش binding مطلوب). نداء لكل أوردر ممنوع.
const CATALOG_TTL_SECONDS = 24 * 3600;
const CATALOG_CACHE_URL   = 'https://bosta-orders-upload.internal/catalog/districts-v1';
let   catalogMemo = null;   // كاش في ذاكرة الـ isolate — بيموت مع الـ isolate

async function readCatalogCache(env) {
  if (catalogMemo && (Date.now() - catalogMemo.at) < CATALOG_TTL_SECONDS * 1000) return catalogMemo.value;
  try {
    if (env.CATALOG_KV) {
      const raw = await env.CATALOG_KV.get('bosta_districts_v1', 'json');
      if (raw) { catalogMemo = { at: Date.now(), value: raw }; return raw; }
    } else {
      const hit = await caches.default.match(CATALOG_CACHE_URL);
      if (hit) { const v = await hit.json(); catalogMemo = { at: Date.now(), value: v }; return v; }
    }
  } catch { /* الكاش مش مصدر حقيقة — الفشل هنا بيعيد الجلب بس */ }
  return null;
}

async function writeCatalogCache(env, value) {
  catalogMemo = { at: Date.now(), value };
  try {
    if (env.CATALOG_KV) {
      await env.CATALOG_KV.put('bosta_districts_v1', JSON.stringify(value), { expirationTtl: CATALOG_TTL_SECONDS });
    } else {
      await caches.default.put(CATALOG_CACHE_URL, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CATALOG_TTL_SECONDS}` },
      }));
    }
  } catch { /* نفس السبب */ }
}

// ─── §BOSTA::normalizeCatalog ───
// شكل الرد مش موثّق بدقة، فالتطبيع بيتعامل مع أكتر من شكل بدل ما يفترض واحد.
function normalizeCatalog(raw) {
  const cities = Array.isArray(raw?.data) ? raw.data
               : Array.isArray(raw?.cities) ? raw.cities
               : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const c of cities) {
    const cityId   = c?._id || c?.cityId || c?.id || null;
    const cityName = c?.name || c?.cityName || '';
    const cityAr   = c?.nameAr || c?.otherName || c?.cityOtherName || '';
    const rawDistricts = Array.isArray(c?.districts) ? c.districts
                       : Array.isArray(c?.zones) ? c.zones.flatMap(z => (z?.districts || []).map(d => ({ ...d, zoneName: z?.name, zoneOtherName: z?.otherName || z?.nameAr })))
                       : [];
    const districts = [];
    for (const d of rawDistricts) {
      const id = d?._id || d?.districtId || d?.id || null;
      if (!id) continue;
      districts.push({
        id,
        name:   d?.districtName || d?.name || '',
        nameAr: d?.districtOtherName || d?.otherName || d?.nameAr || '',
        zone:   d?.zoneName || d?.zone?.name || '',
        zoneAr: d?.zoneOtherName || d?.zone?.otherName || '',
        dropOff: d?.dropOffAvailability,
      });
    }
    if (cityId) out.push({ cityId, cityName, cityAr, districts });
  }
  return { fetchedAt: new Date().toISOString(), cities: out };
}

// ─── §BOSTA::getCatalog ───
async function getCatalog(env, { force = false } = {}) {
  if (!force) {
    const cached = await readCatalogCache(env);
    if (cached) return cached;
  }
  const url = `${BOSTA_BASE}/cities/getAllDistricts?countryId=${BOSTA_COUNTRY_ID}`;
  let resp, text;
  try {
    resp = await fetch(url, { headers: bostaHeaders(env) });
    text = await resp.text();
  } catch (e) {
    // ❌ ممنوع catch(_){} — الفشل هنا لازم يبان، مش يتحوّل لـ"مفيش مناطق"
    throw new Error(`كتالوج بوسطة: فشل الاتصال — ${e.message}`);
  }
  if (!resp.ok) throw new Error(`كتالوج بوسطة: HTTP ${resp.status} — ${text.slice(0, 180)}`);
  let raw;
  try { raw = JSON.parse(text); }
  catch { throw new Error(`كتالوج بوسطة: رد مش JSON — ${text.slice(0, 180)}`); }

  const cat = normalizeCatalog(raw);
  if (!cat.cities.length) throw new Error('كتالوج بوسطة: الرد مفيهوش أي مدينة — شكل الرد اتغيّر');
  await writeCatalogCache(env, cat);
  return cat;
}

// ─── §BOSTA::availableDistricts ───
// الفلترة على dropOffAvailability === true إلزامية.
// ⚠️ لو الحقل غايب من الكتالوج كله، الفلترة هتفضّي القايمة — والحالة دي بتتبلّغ
//    في diag وفي رد get_orders بدل ما تتحول لـ"مفيش مطابقة" صامتة.
function availableDistricts(city) {
  if (!city) return { list: [], fieldMissing: false };
  const withField = city.districts.filter(d => d.dropOff !== undefined);
  const fieldMissing = city.districts.length > 0 && withField.length === 0;
  const list = fieldMissing ? [] : city.districts.filter(d => d.dropOff === true);
  return { list, fieldMissing };
}

// ─── §BOSTA::ensureNormalized ───
// الأسماء المطبَّعة بتتحسب مرة واحدة على الكتالوج بدل مرة لكل أوردر. الكتالوج
// بييجي أحيانًا من كاش قديم اتكتب قبل الحقول دي — فالتعبئة كسولة، مش مفترضة.
function ensureNormalized(catalog) {
  if (!catalog || catalog._normalized) return catalog;
  for (const c of catalog.cities) {
    c.cityNameN = normText(c.cityName);
    c.cityArN   = normText(c.cityAr);
    for (const d of c.districts) {
      d.nameN   = normText(d.name);
      d.nameArN = normText(d.nameAr);
      // 🔴 «عامّة» = اسم المنطقة هو اسم المدينة/المحافظة نفسها. العميل بيكتب اسم
      //    محافظته في العنوان كعادة، فالمطابقة دي بتحمل معلومة شبه صفرية —
      //    وهي اللي كانت بتكسب بالطول وتبعت الشحنة لفرع غلط (#53834 · #53818).
      d.generic = (!!d.nameN   && (d.nameN   === c.cityNameN || d.nameN   === c.cityArN))
               || (!!d.nameArN && (d.nameArN === c.cityNameN || d.nameArN === c.cityArN));
    }
  }
  catalog._normalized = true;
  return catalog;
}

// ─── §BOSTA::addressFields ───
// خانات العنوان **منفصلة ومرتّبة بالأخصّية** — مش نص واحد ملزوق.
// 🔴 اللزق كان بيلغي المعلومة اللي بتحسم المطابقة: `city` = "سيدي سالم" أخصّ
//    بمراحل من ذكر "كفر الشيخ" وسط `address1`. من غير الترتيب ده الترجيح
//    بيرجع للطول، والطول بيكسب للمحافظة على المركز.
function addressFields(sa) {
  // ⚠️ `textN` بتتحسب هنا مرة واحدة عن قصد — `findCrossCity` بيلف على ٢٨ مدينة،
  //    وتطبيع النص جوّه اللفة كان بيتكرر ٢٨ مرة لكل أوردر بلا داعي.
  return [
    { key: 'city',     label: 'مدينة شوبيفاي', text: sa.city     || '' },
    { key: 'address1', label: 'العنوان',        text: sa.address1 || '' },
    { key: 'address2', label: 'العنوان ٢',      text: sa.address2 || '' },
  ].filter(f => f.text).map((f, i) => ({ ...f, tier: i, textN: normText(f.text) }));
}

// ─── §BOSTA::rankHits ───
// ترتيب الأولوية (الأقوى أولًا) — كل بند اتكتب لأنه صحّح حالة حقيقية:
//   ① غير عامّة تغلب العامّة  — "مصر الجديدة" تغلب "القاهرة"
//   ② الخانة الأخصّ تغلب      — `city` تغلب `address1` تغلب `address2`
//   ③ التطابق الكامل يغلب الجزئي داخل نفس الخانة
//   ④ الأطول يغلب **بس لو الأقصر جوّه الأطول** — "مدينة نصر" تغلب "نصر"
// ⚠️ الطول لوحده **مش** فاصل: "المنصورة" و"اجا" في نفس العنوان مطابقتين
//    منفصلتين، والأطول فيهم مش الأصح. الحالة دي بترجع **غامضة** عمدًا —
//    ضغطة زيادة من الموظف أرخص من شحنة في فرع غلط.
const HIT_KEY = h => [h.generic ? 1 : 0, h.tier, h.exact ? 0 : 1];

function betterHit(a, b) {
  const ka = HIT_KEY(a), kb = HIT_KEY(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return b.matched.length - a.matched.length;   // الأطول أولًا داخل نفس الطبقة
}
// b مهزومة حسمًا قدام a؟ (مش مجرد أقل ترتيبًا — لازم فرق في طبقة، أو احتواء)
function dominates(a, b) {
  const ka = HIT_KEY(a), kb = HIT_KEY(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i];
  // الأقصر **جوّه** الأطول = احتواء. الشرط على الطول مقصود: اسمين متطابقين
  // لمنطقتين مختلفتين غموض حقيقي، مش حسم عشوائي لأول واحدة في الترتيب.
  return a.matched.length > b.matched.length && a.matched.includes(b.matched);
}

// ─── §BOSTA::matchDistrictsIn ───
// مطابقة مناطق مدينة واحدة على خانات العنوان. بترجّع كل الإصابات مرتّبة.
function matchDistrictsIn(city, fields, zoneOnly) {
  const { list, fieldMissing } = availableDistricts(city);
  if (!list.length || !fields.length) return { hits: [], fieldMissing };

  let pool = list;
  if (zoneOnly) {
    const zEn = normText(zoneOnly.en), zAr = normText(zoneOnly.ar);
    pool = list.filter(d => {
      const dz = normText(d.zone), dza = normText(d.zoneAr);
      return (zEn && (dz === zEn || dza === zEn)) || (zAr && (dz === zAr || dza === zAr));
    });
  }

  const best = new Map();   // districtId → أحسن إصابة ليها
  for (const f of fields) {
    const ftext = f.textN;
    if (!ftext) continue;
    for (const d of pool) {
      for (const n of [d.nameN, d.nameArN]) {
        if (!n || n.length < 3 || !ftext.includes(n)) continue;
        const hit = {
          id: d.id, name: d.name, nameAr: d.nameAr, zone: d.zone,
          tier: f.tier, field: f.key, fieldLabel: f.label,
          matched: n, matchedText: n === d.nameArN ? d.nameAr : d.name,
          exact: ftext === n, generic: !!d.generic,
        };
        const prev = best.get(d.id);
        if (!prev || betterHit(hit, prev) < 0) best.set(d.id, hit);
        break;
      }
    }
  }
  return { hits: [...best.values()].sort(betterHit), fieldMissing };
}

// ─── §BOSTA::matchDistrict ───
// بترجّع المرشحين المتنافسين: واحد = حسم · أكتر من واحد = غموض معلَن.
function matchDistrict(city, fields, zoneOnly) {
  const { hits, fieldMissing } = matchDistrictsIn(city, fields, zoneOnly);
  if (!hits.length) return { matches: [], fieldMissing };
  const top = hits[0];
  const matches = hits.filter(h => h === top || !dominates(top, h));
  return { matches, fieldMissing };
}

// ─── §BOSTA::findCrossCity ───
// 🟠 كاشف «المدينة مشكوك فيها» — بيشتغل **بس** لما مفيش مطابقة جوّه المدينة
//    المحسوبة من الجدول. بيدوّر على اسم المنطقة في كتالوج بوسطة كله.
//
// ليه أصلًا: تصنيف بوسطة مش التقسيم الإداري (العبور إداريًا القليوبية وعند
// بوسطة تحت القاهرة)، وكمان العميل بيغلط في اختيار المحافظة (شبين الكوم على
// الغربية · دمياط الجديدة على القاهرة). الحالتين بيدّوا نفس العرض، والنتيجة
// **مش** «منطقة ناقصة» — دي **مدينة غلط**، يعني فرع وتسعيرة غلط.
//
// 🔴 اقتراح بس — **ممنوع** التطبيق التلقائي. أسماء المناطق بتتكرر بين
//    المحافظات، وتحويل مدينة الشحنة تلقائيًا على مطابقة نصية = نفس الفخ اللي
//    جدول المحافظات المقفول اتكتب عشان يمنعه.
const CROSS_MIN_LEN      = 4;   // أقصر من كده بيلقّط ضوضاء
const CROSS_MAX_HITS     = 8;
const CROSS_MAX_PER_CITY = 3;   // ٨ اقتراحات كلها من مدينة واحدة ضوضاء مش مساعدة

function findCrossCity(catalog, fields, skipCityId) {
  const out = [];
  for (const c of catalog.cities) {
    if (c.cityId === skipCityId) continue;
    const { hits } = matchDistrictsIn(c, fields, null);
    let taken = 0;
    for (const h of hits) {
      if (h.matched.length < CROSS_MIN_LEN || h.generic) continue;
      if (++taken > CROSS_MAX_PER_CITY) break;
      out.push({
        cityId: c.cityId, cityName: c.cityName,
        districtId: h.id, districtName: h.name, districtNameAr: h.nameAr, zone: h.zone,
        matchedText: h.matchedText, fieldLabel: h.fieldLabel,
        _rank: [h.tier, h.exact ? 0 : 1, -h.matched.length],
      });
    }
  }
  out.sort((a, b) => {
    for (let i = 0; i < 3; i++) if (a._rank[i] !== b._rank[i]) return a._rank[i] - b._rank[i];
    return 0;
  });
  return out.slice(0, CROSS_MAX_HITS).map(({ _rank, ...rest }) => rest);
}

// ─── §BOSTA::resolveAddress ───
// خوارزمية اختيار شكل العنوان لكل أوردر (SPEC §٥.٤):
//   province → cityId حتميًا من الجدول المقفول (ممنوع مطابقة نصية بديلة)
//   مطابقة منطقة واحدة  → الشكل (أ): { city, districtId, firstLine }        · موثّق
//   محافظة خاصة بلا مطابقة → الشكل (ب): { city, cityId, districtName, … }   · موثّق
//   أكتر من مطابقة أو مفيش → الشكل (ج): { city, firstLine }                 · غير موثّق
function resolveAddress(order, catalog) {
  ensureNormalized(catalog);
  const sa = order.shippingAddress || {};
  const provinceRaw = sa.province || '';
  const codeRaw     = sa.provinceCode || '';

  let row = PROVINCE_BY_CODE.get(String(codeRaw).toUpperCase())
         || PROVINCE_BY_NAME.get(String(provinceRaw).toLowerCase())
         || null;

  const fields = addressFields(sa);

  // North Coast — مدينة بوسطة مالهاش مقابل في شوبيفاي
  const normAddr = fields.map(f => f.textN).join(' ');
  const isNorthCoast = NORTH_COAST.hints.some(h => normAddr.includes(normText(h)));
  if (isNorthCoast && (row?.province === 'Matrouh' || row?.province === 'Alexandria')) {
    row = { province: row.province, code: row.code, cityId: NORTH_COAST.cityId, cityName: NORTH_COAST.cityName };
  }

  if (!row) {
    return {
      ok: false,
      error: `المحافظة "${provinceRaw || codeRaw || '—'}" مش في جدول ecommoda-constants §3.5 — ` +
             `تتسجّل هناك الأول، ممنوع التخمين`,
    };
  }

  const city = catalog.cities.find(c => c.cityId === row.cityId) || null;
  const { matches, fieldMissing } = matchDistrict(city, fields, row.zoneOnly);

  const base = {
    ok: true,
    province: row.province,
    cityId: row.cityId,
    cityName: row.cityName,
    catalogWarning: fieldMissing ? 'dropOffAvailability غايب من كتالوج بوسطة — المطابقة اتعطّلت' : null,
    candidates: matches.map(m => ({
      id: m.id, name: m.name, nameAr: m.nameAr, zone: m.zone,
      matchedText: m.matchedText, fieldLabel: m.fieldLabel,
    })),
    crossCity: [],
  };

  if (matches.length === 1) {
    return { ...base, mode: 'district', districtId: matches[0].id, districtName: matches[0].name };
  }
  if (matches.length === 0 && row.zoneOnly) {
    // §٥.٥ — محافظة اتلغت إداريًا، بتتبعت كزون جوه مدينة تانية
    return { ...base, mode: 'zoneName', districtName: row.zoneOnly.en };
  }
  if (matches.length === 0) {
    // مفيش مطابقة جوّه المدينة — هنا بس بندوّر بره (اقتراح، مش تطبيق)
    const crossCity = findCrossCity(catalog, fields, row.cityId);
    return { ...base, mode: 'province', ambiguous: false, crossCity, cityDoubt: crossCity.length > 0 };
  }
  return { ...base, mode: 'province', ambiguous: true };
}

// ─── §BOSTA::buildDeliveryPayload ───
function buildDeliveryPayload(order, plan, mode) {
  const sa = order.shippingAddress || {};
  const orderNumber = String(order.name || '').replace(/^#/, '');

  const fullName  = (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim();
  const parts     = fullName.split(/\s+/).filter(Boolean);
  const firstName = sa.firstName || parts[0] || '';
  const lastName  = sa.lastName  || parts.slice(1).join(' ');

  const phone   = String(sa.phone || '').trim();
  const second  = String(order.phone || '').trim();
  const sendSecond = second && normPhone(second) !== normPhone(phone);

  const cod = Math.abs(Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0));
  const goods = Math.abs(Number(order.currentSubtotalPriceSet?.presentmentMoney?.amount || 0));

  const lines = (order.lineItems?.nodes || []).filter(li => (li.currentQuantity || 0) > 0);
  const itemsCount = lines.reduce((s, li) => s + (li.currentQuantity || 0), 0);
  const description = lines
    .map(li => `${li.sku || li.title || '-'} / ${li.variantTitle || '-'} x${li.currentQuantity}`)
    .join(' + ').slice(0, 900);

  const firstLine = [
    [sa.address1, sa.address2].filter(Boolean).join(' - '),
    `${sa.city || ''}- ${sa.province || ''}`,
  ].filter(Boolean).join(', ').trim();

  // 🔴 الحقل الصح `city` — مش `cityName`. الڤاليديتور مش شايف cityName أصلاً
  //    وبيتجاهله بصمت، فأي نسخ حرفي من داشبورد بوسطة بيقع في الفخ ده.
  const dropOffAddress = { city: plan.cityName, firstLine };
  if (mode === 'district')  { dropOffAddress.districtId = plan.districtId; }
  if (mode === 'zoneName')  { dropOffAddress.cityId = plan.cityId; dropOffAddress.districtName = plan.districtName; }

  const receiver = { firstName, phone };              // الإلزامي الموثّق
  if (lastName)   receiver.lastName  = lastName;
  if (fullName)   receiver.fullName  = fullName;      // اختياري — يتبعت **مع** firstName مش بدلها
  if (sendSecond) receiver.secondPhone = second;      // بيقلّل فشل التوصيل (~3% من الأوردرات)

  const payload = {
    type: BOSTA_TYPE,
    cod,
    goodsInfo: { amount: goods },                     // قيمة البضاعة — مش الفلوس المحصّلة
    receiver,
    dropOffAddress,
    specs: {
      packageType: 'Parcel',                          // 🔴 "Small" مش قيمة موثّقة في أي حقل
      size: 'SMALL',                                  // 🔴 حقل منفصل، بالكابيتال
      packageDetails: { itemsCount, description },
    },
    businessLocationId: BOSTA_LOCATION_ID,
    businessReference:       '#' + orderNumber,       // 🔴 بالهاش — من غيره كل أدوات EcomModa مش هتلاقي الشحنة
    uniqueBusinessReference: orderNumber,             // بدون هاش — حماية بوسطة من التكرار (11000)
    allowToOpenPackage: ALLOW_OPEN_PKG,
    flexShippingInfo: { isOrderEligible: true, amountToBeCollected: FLEX_AMOUNT },
  };
  if (order.note) payload.notes = String(order.note).slice(0, 500);   // الاسم الرسمي `notes`
  return payload;
}

// ─── §BOSTA::validateOrder ───
// اللي بيمنع الرفع أصلاً — بيتعرض للموظف قبل ما يضغط، مش بعد الفشل.
function validateOrder(order, plan) {
  const problems = [];
  const sa = order.shippingAddress || {};
  if (!plan.ok) { problems.push(plan.error); return problems; }
  if (!sa.phone || normPhone(sa.phone).length < 8) problems.push('رقم تليفون الشحن ناقص أو غير صالح');
  const fullName = (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim();
  if (!fullName) problems.push('اسم المستلم فاضي — firstName إلزامي عند بوسطة');
  const firstLineLen = [sa.address1, sa.address2, sa.city, sa.province].filter(Boolean).join(' ').length;
  if (firstLineLen <= 5) problems.push('العنوان أقصر من الحد الأدنى (أكتر من ٥ حروف)');
  const cod = Math.abs(Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0));
  if (cod > COD_MAX) problems.push(`قيمة التحصيل ${cod.toLocaleString('en-US')} أعلى من الحد الموثّق ${COD_MAX.toLocaleString('en-US')}`);
  return problems;
}

// ─── §BOSTA::createDelivery ───
// النجاح = res.ok && body.success — **ممنوع** التحقق بـ === 201.
// التوثيق بيقول 200 والتجربة الحية رجّعت 201؛ التحقق برقم صريح معناه شحنة
// اترفعت فعلًا واتحسبت فشل، والموظف يعيد الرفع → شحنة مكررة بفلوس حقيقية.
async function createDelivery(env, payload, documented) {
  const url = documented ? `${BOSTA_BASE}/deliveries?apiVersion=1` : `${BOSTA_BASE}/deliveries`;
  let resp, text;
  try {
    resp = await fetch(url, { method: 'POST', headers: bostaHeaders(env), body: JSON.stringify(payload) });
    text = await resp.text();
  } catch (e) {
    throw new Error(`بوسطة: فشل الاتصال — ${e.message}`);
  }
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* الرد مش JSON — بيتعرض كنص خام تحت */ }

  if (resp.ok && body?.success) {
    const d = body.data && typeof body.data === 'object' ? body.data : body;
    return {
      ok: true,
      status: resp.status,
      trackingNumber: d?.trackingNumber != null ? String(d.trackingNumber) : null,
      bostaId: d?._id || d?.id || null,
      raw: d,
    };
  }
  return {
    ok: false,
    status: resp.status,
    errorCode: body?.errorCode != null ? String(body.errorCode) : null,   // 🔴 نص مش رقم
    message: body?.message || body?.error || text.slice(0, 300) || `HTTP ${resp.status}`,
  };
}

// ─── §BOSTA::humanizeBostaError ───
function humanizeBostaError(res) {
  const code = res.errorCode;
  if (code === '11000') return 'بوسطة رافضة: رقم الأوردر ده مرفوع عندها قبل كده (uniqueBusinessReference مكرر)';
  if (code === '3003')  return 'بوسطة رافضة: المنطقة غير موجودة عندها (District Not Found)';
  if (code === '3002')  return 'بوسطة رافضة: المدينة غير موجودة عندها';
  if (code === '1028')  return 'بوسطة رافضة: مفتاح الـ API غير صالح — راجع BOSTA_API_KEY';
  return `بوسطة رافضة (HTTP ${res.status}${code ? ` · كود ${code}` : ''}): ${res.message}`;
}

// ══════════════════════════════════════════════════════════════
// §UPLOAD — منطق الأداة
// ══════════════════════════════════════════════════════════════

// ─── §UPLOAD::buildRow ───
// صف واحد للواجهة — بيانات العرض + خطة العنوان + حالة الرفع السابق.
function buildRow(order, catalog) {
  const sa = order.shippingAddress || {};
  const plan = resolveAddress(order, catalog);
  const problems = validateOrder(order, plan);

  const trackingBefore = order.mfTracking?.value || null;
  const tags = Array.isArray(order.tags) ? order.tags : [];
  const hasTag = tags.includes(UPLOAD_TAG);

  const lines = (order.lineItems?.nodes || []).filter(li => (li.currentQuantity || 0) > 0);

  return {
    orderId:     String(order.legacyResourceId || String(order.id).split('/').pop()),
    orderGid:    order.id,
    orderNumber: order.name,
    createdAt:   order.createdAt,
    customer:    (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim(),
    phone:       sa.phone || '',
    secondPhone: (order.phone && normPhone(order.phone) !== normPhone(sa.phone)) ? order.phone : '',
    province:    sa.province || '',
    provinceCode: sa.provinceCode || '',
    addressCity: sa.city || '',
    address1:    sa.address1 || '',
    address2:    sa.address2 || '',
    s1:          order.mfStatus?.value || '',
    courier:     order.mfCourier?.value || '',
    cod:         Math.abs(Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0)),
    goodsValue:  Math.abs(Number(order.currentSubtotalPriceSet?.presentmentMoney?.amount || 0)),
    itemsCount:  lines.reduce((s, li) => s + (li.currentQuantity || 0), 0),
    note:        order.note || '',
    // حالة الرفع السابق — الصف بيفضل ظاهر ومعاه تنبيه، مش بيتشال
    alreadyUploaded: !!(trackingBefore || hasTag),
    previousTracking: trackingBefore,
    hasUploadTag: hasTag,
    // خطة العنوان
    addressOk:   plan.ok,
    addressError: plan.ok ? null : plan.error,
    cityName:    plan.ok ? plan.cityName : '',
    cityId:      plan.ok ? plan.cityId : '',
    mode:        plan.ok ? plan.mode : 'blocked',
    districtId:  plan.ok ? (plan.districtId || null) : null,
    districtName: plan.ok ? (plan.districtName || null) : null,
    ambiguous:   plan.ok ? !!plan.ambiguous : false,
    candidates:  plan.ok ? (plan.candidates || []) : [],
    // 🟠 المدينة مشكوك فيها — العنوان طابق منطقة في **مدينة تانية** غير اللي
    //    الجدول وصل لها. اقتراح للموظف، مش قرار: ممنوع التطبيق التلقائي.
    cityDoubt:   plan.ok ? !!plan.cityDoubt : false,
    crossCity:   plan.ok ? (plan.crossCity || []) : [],
    catalogWarning: plan.ok ? plan.catalogWarning : null,
    problems,
    uploadable:  problems.length === 0,
  };
}

// ─── §UPLOAD::uploadOne ───
// النتيجة تلات حالات مش اتنين: success · warning · error.
// warning = الشحنة اترفعت فعلًا على بوسطة بس فيه حاجة بعدها ما تمّتش —
// لازم يبان بحالته الحقيقية عشان محدش يعيد الرفع ويعمل شحنة مكررة.
async function uploadOne(env, token, order, catalog, override) {
  const actions = [];
  const row = {
    orderId:     String(order.legacyResourceId || String(order.id).split('/').pop()),
    orderNumber: order.name,
    status:      'error',
    actions,
    trackingNumber: null,
    bostaId: null,
    contractUsed: null,
    districtSent: null,
    citySent: null,
    cityAuto: null,          // المدينة اللي المطابقة التلقائية وصلت لها
    cityOverridden: false,   // الموظف غيّر المدينة يدويًا؟
    error: null,
    warnings: [],
    logged: true,
  };

  const plan = resolveAddress(order, catalog);
  const problems = validateOrder(order, plan);
  if (problems.length) {
    row.status = 'error';
    row.error  = problems.join(' · ');
    return row;
  }

  // ─── تعديل الموظف اليدوي — بيغلب المطابقة التلقائية ───
  // 🔴 التعديل ممكن يشمل **المدينة** كمان مش المنطقة بس. تصنيف بوسطة مش
  //    التقسيم الإداري (العبور إداريًا القليوبية وعند بوسطة تحت القاهرة)،
  //    وكمان العميل بيغلط في اختيار المحافظة. من غير ده الحالة دي مالهاش حل
  //    يدوي أصلًا — الشحنة بتروح فرع غلط، وده مش fallback محايد زي المنطقة
  //    الناقصة: المدينة بتحدد الفرع والتسعيرة.
  // ⚠️ التعديل بيتكتب في `planUsed` نفسه عن قصد — كل اللي بعده (بناء الـ
  //    payload · `row.citySent` · **ورجوع 3003 لمسار المحافظة**) بيقرا منه،
  //    فالرجوع بيفضل ماسك المدينة المعدّلة. لو اتكتب في متغير جنبي، الرجوع
  //    كان هيبعت المدينة الأصلية الغلط في صمت.
  let mode = plan.mode;
  let planUsed = { ...plan };

  const ovCityId = override?.cityId || null;
  if (ovCityId && ovCityId !== plan.cityId) {
    const ovCity = catalog.cities.find(c => c.cityId === ovCityId);
    if (!ovCity) {
      row.status = 'error';
      row.error  = `المدينة المختارة يدويًا (${ovCityId}) مش موجودة في كتالوج بوسطة — ` +
                   `الرفع اتوقف بدل ما يتبعت على المدينة الأصلية`;
      return row;
    }
    planUsed.cityId   = ovCity.cityId;
    planUsed.cityName = ovCity.cityName;
    row.cityOverridden = true;
  }

  if (override?.districtId) {
    const city = catalog.cities.find(c => c.cityId === planUsed.cityId);
    const { list } = availableDistricts(city);
    const d = list.find(x => x.id === override.districtId);
    // 🔴 مش لاقيينها = **وقف**، مش رجوع صامت للمطابقة التلقائية. الموظف اختار
    //    منطقة صراحةً؛ الرفع على حاجة تانية من غير ما يعرف = شحنة بفلوس على
    //    عنوان مش اللي وافق عليه.
    if (!d) {
      row.status = 'error';
      row.error  = `المنطقة المختارة يدويًا مش موجودة (أو مش متاحة للتسليم) في ` +
                   `مدينة ${planUsed.cityName} عند بوسطة — الرفع اتوقف. افتح النافذة واختر من الأول.`;
      return row;
    }
    mode = 'district';
    planUsed.districtId = d.id;
    planUsed.districtName = d.name;
  } else if (override?.forceProvince || row.cityOverridden) {
    // مدينة متعدّلة من غير منطقة = رفع على مستوى المدينة الجديدة (أفضل بكتير
    // من المدينة الغلط، وبيدخل مسار العناوين غير الواضحة عند بوسطة عادي)
    mode = 'province';
  }

  const documented = mode === 'district' || mode === 'zoneName';
  let payload = buildDeliveryPayload(order, planUsed, mode);
  let res = await createDelivery(env, payload, documented);
  row.contractUsed = documented ? 'documented' : 'undocumented';
  row.citySent     = planUsed.cityName;
  row.cityAuto     = plan.cityName;
  row.districtSent = mode === 'district' ? planUsed.districtName : (mode === 'zoneName' ? planUsed.districtName : null);

  // 🔴 errorCode نص مش رقم — المقارنة بالرقم معناها إن الرجوع التلقائي عمره ما هيشتغل
  if (!res.ok && String(res.errorCode) === '3003' && documented) {
    row.warnings.push(`بوسطة رفضت المنطقة "${row.districtSent}" — اترفعت على مستوى المحافظة بدلها`);
    mode = 'province';
    payload = buildDeliveryPayload(order, planUsed, 'province');
    res = await createDelivery(env, payload, false);
    row.contractUsed = 'undocumented';
    row.districtSent = null;
  }

  if (!res.ok) {
    row.status = 'error';
    row.error  = humanizeBostaError(res);
    return row;
  }

  actions.push(`رفع الشحنة على بوسطة (${row.contractUsed === 'documented' ? 'بالمنطقة' : 'بالمحافظة'})`);
  row.trackingNumber = res.trackingNumber;
  row.bostaId        = res.bostaId;

  if (!res.trackingNumber) {
    row.status = 'warning';
    row.warnings.push('بوسطة قبلت الشحنة بس ما رجّعتش رقم تتبع — الكتابة على شوبيفاي اتوقفت');
    return row;
  }

  // الرفع نجح فعلًا — أي فشل بعد كده warning مش error
  try {
    const w = await writeBackToShopify(env, token, order, res.trackingNumber, actions);
    row.warnings.push(...w);
    row.status = row.warnings.length ? 'warning' : 'success';
  } catch (e) {
    row.status = 'warning';
    row.warnings.push(`الشحنة اترفعت (${res.trackingNumber}) لكن الكتابة على شوبيفاي فشلت: ${e.message}`);
    row.shopifyWriteFailed = true;
  }
  return row;
}

// ─── §UPLOAD::logRow ───
async function logRow(env, row, employee) {
  // ⚠️ الترتيب مقصود: `skipped` قبل `error`، و`shopify_write_failed` منفصلة عن
  //    `upload_failed` عمدًا — الأولى معناها الشحنة **موجودة فعلًا** عند بوسطة
  //    والأوردر لسه مش عارف بيها؛ خلطهم بيخلي أي إعادة محاولة تعمل شحنة مكررة.
  const type = row.skipped                     ? 'skipped'
             : row.shopifyWriteFailed          ? 'shopify_write_failed'
             : row.status === 'error'          ? (row.trackingNumber ? 'shopify_write_failed' : 'upload_failed')
             :                                   'uploaded';
  try {
    await writeLog(env.DB, {
      tool: TOOL_NAME,
      type,
      employee,
      orderId:   row.orderId,
      orderName: row.orderNumber,
      notes:     row.error || row.warnings.join(' · ') || `رقم التتبع ${row.trackingNumber || '—'}`,
      extra: {
        result: row.status,
        contract_used:   row.contractUsed,
        tracking_number: row.trackingNumber,
        bosta_id:        row.bostaId,
        district_sent:   row.districtSent,
        city_sent:       row.citySent,
        // تدخّل المدينة يتسجّل عشان نقيس تكراره — الحالات اللي بتتكرر هي
        // المرشحة تتحوّل لصف في جدول المحافظات بدل تدخّل يدوي كل مرة
        city_auto:       row.cityAuto,
        city_overridden: !!row.cityOverridden,
        actions:         row.actions,
        warnings:        row.warnings,
      },
    });
  } catch (e) {
    row.logged = false;   // العملية حصلت — بس مفيش سجل. الواجهة بتحذّر.
  }
}

// ─── §UPLOAD::runBatch ───
// توازي متحفّظ — حدود استهلاك بوسطة مش موثّقة في أي مصدر رسمي.
async function runBatch(items, worker, concurrency) {
  const out = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

// ══════════════════════════════════════════════════════════════
// §HANDLER
// ══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    // ALWAYS first: CORS preflight
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: getCORS(request) });

    // ALWAYS second: WORKER_SECRET check
    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: getCORS(request),
      });

    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || '';

    try {

      // ─── §AUTH ────────────────────────────────────────────────────
      if (action === 'check_employee') {
        const username = url.searchParams.get('username');
        if (!username) return json({ ok: false, error: 'username مطلوب' }, 400, request);
        const result = await checkEmployee(env.DB, username);
        return json({ ok: true, ...result }, 200, request);
      }

      if (action === 'register_pin') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);
        await registerPin(env.DB, username, pin);
        return json({ ok: true }, 200, request);
      }

      if (action === 'verify_employee') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const { username, pin, appId } = await request.json().catch(() => ({}));
        if (!username || !pin) return json({ ok: false, error: 'username و pin مطلوبان' }, 400, request);

        const displayName = await verifyEmployee(env.DB, username, pin);
        if (!displayName) return json({ ok: false, error: 'PIN خطأ أو المستخدم غير موجود' }, 401, request);

        // الدخول نفسه نجح فعلاً — فشل D1 بعد كده يرجع logged:false مش 500
        let logged = true;
        try {
          await writeLog(env.DB, {
            tool: resolveAuthTool(appId), type: 'login', employee: username,
            notes: `دخول: ${displayName}`,
          });
        } catch (e) { logged = false; }
        return json({ ok: true, displayName, logged }, 200, request);
      }

      if (action === 'log_logout') {
        const username = url.searchParams.get('username');
        const appId    = url.searchParams.get('appId');
        let logged = true;
        if (username) {
          try {
            await writeLog(env.DB, {
              tool: resolveAuthTool(appId), type: 'logout', employee: username,
              notes: `خروج: ${username.replace(/_/g, ' ')}`,
            });
          } catch (e) { logged = false; }
        }
        return json({ ok: true, logged }, 200, request);
      }

      if (action === 'get_employees') {
        const { results } = await env.DB.prepare(
          'SELECT username, display_name FROM employees WHERE is_active = 1 ORDER BY display_name'
        ).all();
        return json({ ok: true, employees: results }, 200, request);
      }
      // ──────────────────────────────────────────────────────────────

      // ─── §UPLOAD-ENDPOINTS ────────────────────────────────────────
      if (action === 'get_config') {
        return json({ ok: true, version: WORKER_VERSION, tool: TOOL_NAME }, 200, request);
      }

      if (action === 'diag') {
        const checks = [];
        const envKeys = Object.keys(env).map(k => {
          const v = env[k];
          return `${k}(${typeof v === 'string' ? v.length : typeof v})`;
        }).sort().join(' · ');
        checks.push({ ok: true, label: 'متغيرات الـ Worker', detail: envKeys });
        checks.push({
          ok: !!env.WORKER_SECRET,
          label: 'WORKER_SECRET',
          detail: env.WORKER_SECRET
            ? `مضبوط (${env.WORKER_SECRET.length} حرف) · بصمة ${await secretFingerprint(env.WORKER_SECRET)}`
            : 'ناقص',
        });
        checks.push({ ok: !!env.SHOP_DOMAIN, label: 'SHOP_DOMAIN', detail: env.SHOP_DOMAIN || 'ناقص — من [vars] في wrangler.toml' });
        checks.push({ ok: !!env.BOSTA_API_KEY, label: 'BOSTA_API_KEY', detail: env.BOSTA_API_KEY ? `مضبوط (${env.BOSTA_API_KEY.length} حرف)` : 'ناقص' });

        // D1
        try {
          const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM employees').first();
          checks.push({ ok: true, label: 'D1 (DB)', detail: `متصل · ${r?.n ?? 0} موظف` });
        } catch (e) { checks.push({ ok: false, label: 'D1 (DB)', detail: e.message }); }

        // شوبيفاي + الصلاحيات
        try {
          const token = await getAccessToken(env);
          const d = await shopifyGQL(env, token,
            `{ currentAppInstallation { accessScopes { handle } } }`, {}, 'diagScopes');
          const scopes = (d.data?.currentAppInstallation?.accessScopes || []).map(s => s.handle);
          checks.push({ ok: true, label: 'شوبيفاي OAuth', detail: `نجح · API ${API_VERSION}` });
          checks.push({
            ok: scopes.includes('write_orders'),
            label: 'صلاحية write_orders',
            detail: scopes.includes('write_orders') ? 'موجودة' : `ناقصة! الصلاحيات: ${scopes.join(', ') || '—'}`,
          });
          checks.push({ ok: true, label: 'صلاحيات التطبيق (معلومة)', detail: scopes.join(', ') || '—' });

          // أنواع الميتافيلدات الحية — التطابق الحرفي شرط لنجاح metafieldsSet
          const md = await shopifyGQL(env, token, `
            query { metafieldDefinitions(first: 50, ownerType: ORDER, namespace: "custom") {
              nodes { key type { name } } } }`, {}, 'diagMfDefs');
          const defs = new Map((md.data?.metafieldDefinitions?.nodes || []).map(n => [n.key, n.type?.name]));
          for (const mf of [MF_COURIER, MF_TRACKING]) {
            const live = defs.get(mf.key) || null;
            checks.push({
              ok: live === mf.type,
              label: `نوع custom.${mf.key}`,
              detail: live ? `الحي: ${live} · المتوقع: ${mf.type}` : 'التعريف مش موجود على المتجر',
            });
          }
        } catch (e) { checks.push({ ok: false, label: 'شوبيفاي', detail: e.message }); }

        // بوسطة — الكتالوج
        try {
          const cat = await getCatalog(env, { force: url.searchParams.get('refresh') === '1' });
          const totalD = cat.cities.reduce((s, c) => s + c.districts.length, 0);
          const availD = cat.cities.reduce((s, c) => s + availableDistricts(c).list.length, 0);
          const missing = cat.cities.filter(c => availableDistricts(c).fieldMissing).length;
          checks.push({
            ok: availD > 0,
            label: 'كتالوج بوسطة',
            detail: `${cat.cities.length} مدينة · ${totalD} منطقة · ${availD} متاحة للتسليم` +
                    (missing ? ` · ⚠️ ${missing} مدينة من غير dropOffAvailability` : ''),
          });
        } catch (e) { checks.push({ ok: false, label: 'كتالوج بوسطة', detail: e.message }); }

        // تغطية الزون — الفرق بين «مفيش زون في الكتالوج» و«المنطقة دي بلا زون»
        // لازم يبان. من غير الفحص ده، عمود زون فاضي في النافذة بيبقى غامض.
        try {
          const cat = await getCatalog(env);
          let withZone = 0, totalD = 0;
          const zones = new Set();
          for (const c of cat.cities) {
            for (const d of availableDistricts(c).list) {
              totalD++;
              const z = d.zone || d.zoneAr;
              if (z) { withZone++; zones.add(`${c.cityName}/${z}`); }
            }
          }
          const sample = [...zones].slice(0, 4).join(' · ');
          checks.push({
            ok: withZone > 0,
            label: 'تغطية الزون في الكتالوج',
            detail: withZone
              ? `${withZone} من ${totalD} منطقة ليها زون · ${zones.size} زون مختلف` +
                (sample ? ` · عيّنة: ${sample}` : '')
              : `صفر — الكتالوج مابيرجّعش zoneName. الزون هيبان فاضي في نافذة الاختيار، ` +
                `وده معناه إن الحقل مش موجود مش إن المناطق بلا زون.`,
          });
        } catch { /* الكتالوج فشل فوق وبيتعرض هناك */ }

        // جدول المحافظات مقابل الكتالوج
        try {
          const cat = await getCatalog(env);
          const missing = PROVINCE_TABLE.filter(r => !cat.cities.some(c => c.cityId === r.cityId));
          checks.push({
            ok: missing.length === 0,
            label: 'جدول المحافظات ↔ كتالوج بوسطة',
            detail: missing.length ? `cityId مش موجود عند بوسطة: ${missing.map(m => m.province).join(', ')}`
                                   : `${PROVINCE_TABLE.length} محافظة كلها متطابقة`,
          });
        } catch { /* الكتالوج فشل فوق وبيتعرض هناك */ }

        checks.push({ ok: true, label: 'الـ Origin', detail: request.headers.get('Origin') || '—' });
        checks.push({ ok: true, label: 'نسخة الـ Worker', detail: WORKER_VERSION });

        return json({ ok: true, version: WORKER_VERSION, checks }, 200, request);
      }

      if (action === 'get_districts') {
        assertEnv(env, 'bosta');
        const cityId = url.searchParams.get('cityId') || '';
        const cat = await getCatalog(env, { force: url.searchParams.get('refresh') === '1' });
        // من غير cityId = قايمة المدن — بتغذّي منتقي المدينة جوّه نافذة الاختيار،
        // اللي هو الحل اليدوي الوحيد لحالة «المدينة مشكوك فيها»
        if (!cityId) {
          return json({
            ok: true,
            cities: cat.cities.map(c => ({
              cityId: c.cityId, cityName: c.cityName, cityAr: c.cityAr || '',
              districtCount: availableDistricts(c).list.length,
            })).sort((a, b) => a.cityName.localeCompare(b.cityName)),
          }, 200, request);
        }
        const city = cat.cities.find(c => c.cityId === cityId);
        const { list, fieldMissing } = availableDistricts(city);
        return json({
          ok: true, cityId, cityName: city?.cityName || '', cityAr: city?.cityAr || '',
          fieldMissing,
          // الزون بيترجع بالاسمين — الواجهة بتعرضه في نافذة الاختيار. الزون هو
          // المستوى فوق المنطقة عند بوسطة (مدينة ← زون ← منطقة)، ولحد دلوقتي
          // **مش داخل في المطابقة** — بيتعرض للتشخيص بس.
          districts: list.map(d => ({ id: d.id, name: d.name, nameAr: d.nameAr,
                                      zone: d.zone, zoneAr: d.zoneAr })),
        }, 200, request);
      }

      if (action === 'get_orders') {
        assertEnv(env, 'shopify', 'bosta');
        const token = await getAccessToken(env);
        const [fetched, catalog, guard] = await Promise.all([
          fetchEligibleOrders(env, token),
          getCatalog(env, { force: url.searchParams.get('refresh') === '1' }),
          filterGuard(env, token),
        ]);
        const rows = fetched.orders.map(o => buildRow(o, catalog));
        return json({
          ok: true,
          version: WORKER_VERSION,
          fetchedAt: new Date().toISOString(),
          query: ordersQueryString(),
          filterGuard: guard,
          catalogFetchedAt: catalog.fetchedAt,
          truncated: fetched.truncated,
          pages: fetched.pages,
          rows,
        }, 200, request);
      }

      if (action === 'upload') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify', 'bosta');
        const body = await request.json().catch(() => ({}));
        const employee = body.employee || null;
        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length)  return json({ ok: false, error: 'مفيش أوردرات محددة' }, 400, request);
        if (items.length > MAX_BATCH)
          return json({ ok: false, error: `أقصى عدد في الدفعة ${MAX_BATCH} أوردر — قسّم الرفع` }, 400, request);

        const token   = await getAccessToken(env);
        const catalog = await getCatalog(env);
        const gids    = items.map(i => `gid://shopify/Order/${String(i.orderId).replace(/\D/g, '')}`);
        const orders  = await fetchOrdersByGid(env, token, gids);
        const byGid   = new Map(orders.map(o => [o.id, o]));

        const results = await runBatch(items, async (item) => {
          const gid = `gid://shopify/Order/${String(item.orderId).replace(/\D/g, '')}`;
          const order = byGid.get(gid);
          if (!order) {
            const row = { orderId: String(item.orderId), orderNumber: item.orderNumber || '—',
                          status: 'error', actions: [], warnings: [], trackingNumber: null,
                          error: 'الأوردر مش موجود على شوبيفاي (اتحذف أو الـ ID غلط)', logged: true };
            await logRow(env, row, employee);
            return row;
          }

          // 🔴 الرفع المكرر: تحذير + تأكيد صريح من الموظف، والمنع الفعلي عند بوسطة
          //    عبر uniqueBusinessReference. المنع الكامل من عندنا بيقفل حالات
          //    حقيقية (شحنة اتلغت عند بوسطة والأوردر لسه شايل رقم قديم).
          const prevTracking = order.mfTracking?.value || null;
          const hasTag = (order.tags || []).includes(UPLOAD_TAG);
          if ((prevTracking || hasTag) && !item.allowDuplicate) {
            const row = {
              orderId: String(order.legacyResourceId), orderNumber: order.name,
              status: 'skipped', skipped: true, actions: [], warnings: [], trackingNumber: null,
              error: `الأوردر مرفوع قبل كده${prevTracking ? ` (رقم تتبع ${prevTracking})` : ''} — ` +
                     `محتاج تأكيد صريح قبل إعادة الرفع`,
              logged: true,
            };
            await logRow(env, row, employee);
            return row;
          }

          let row;
          try {
            row = await uploadOne(env, token, order, catalog, item);
          } catch (e) {
            row = { orderId: String(order.legacyResourceId), orderNumber: order.name,
                    status: 'error', actions: [], warnings: [], trackingNumber: null,
                    error: e.message, logged: true };
          }
          await logRow(env, row, employee);
          return row;
        }, UPLOAD_CONC);

        // تلات حالات + اتخطّى (SPEC §٦.٢) — "نجح/فشل" لوحدهم بيخفوا الحالة التالتة
        const summary = {
          success: results.filter(r => r.status === 'success').length,
          warning: results.filter(r => r.status === 'warning').length,
          error:   results.filter(r => r.status === 'error').length,
          skipped: results.filter(r => r.status === 'skipped').length,
        };
        return json({ ok: true, version: WORKER_VERSION, summary, results }, 200, request);
      }
      // ──────────────────────────────────────────────────────────────

      // ─── §LOG-ENDPOINTS ───────────────────────────────────────────
      if (action === 'get_logs') {
        const p      = logParamsFrom(url, TOOL_NAME);
        const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '100'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'),    0);
        const entries = await getLogs(env.DB, { ...p, limit, offset });
        return json({ ok: true, entries }, 200, request);
      }

      if (action === 'get_logs_count') {
        const total = await getLogsCount(env.DB, logParamsFrom(url, TOOL_NAME));
        return json({ ok: true, total }, 200, request);
      }

      if (action === 'get_logs_export') {
        const p = logParamsFrom(url, TOOL_NAME);
        const [entries, total] = await Promise.all([
          getLogsExport(env.DB, p),
          getLogsCount(env.DB, p),
        ]);
        return json({ ok: true, entries, cap: LOG_EXPORT_MAX, total,
                      truncated: total > LOG_EXPORT_MAX }, 200, request);
      }
      // ──────────────────────────────────────────────────────────────

      return json({ error: 'Unknown action' }, 404, request);
    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500, request);
    }
  },
};
