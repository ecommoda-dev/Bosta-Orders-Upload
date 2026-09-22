// ══════════════════════════════════════════════════════════════
// EcomModa — Bosta-Orders-Upload (v2.0.0)
// skills: worker-builder v3.6.0 · html-builder v7.2.0 · constants v3.1.0 ·
//         bosta-api-helper v5.0.0 · shopify-graphql-helper v2.2.0 ·
//         order-lifecycle v1.6.0 — 22-09-2026
// ⚠️ اللي اتراجع بندًا بندًا في v2.7.0: `worker-builder` 5A ④ (حالات النتيجة)
//    و⑭ (`type` بالأثر الخارجي) و`html-builder` Step 3C. الباقي متوارث.
// ⚠️ وv2.8.1: `worker-builder` Step 7-ج بس (الحارس الديناميكي لقيم اللوج —
//    الطبقة ٥) — `LOG_REGISTRY` مبني من `log-values.json` بعد تحديثه بكل
//    قيم `type` الفعلية (كان فيه ٥ بس مسجّلة من ١٧ مستخدمة فعليًا في الكود؛
//    الـ ١٢ الباقية فاتت `check-log-values.mjs` لأنها بتتبعت بصيغة
//    shorthand `type,` مش `type: '...'`، والتحقق الساكن عمره ما شافها).
//
// v2.0.0 — **الدمج**: الأداة بقت بترفع كل شحنات بوسطة، مش الشحن العادي فقط.
// `Bosta-Return-Exchange-Exporter` v6.0.0 اتنقلت هنا بالكامل (MERGE-BRIEF.md).
//
// تلات أوضاع في Worker واحد:
//   s1        → شحنة عادية   (type 10) — كانت الأداة دي
//   return    → استرجاع CRP  (type 25) — كانت الأداة التانية
//   exchange  → استبدال      (type 30) — كانت الأداة التانية
//
// 🔴 أخطر أربع نقاط في الدمج — الأربعة دول السبب إن البلوكات فضلت **منفصلة**
//    بدل ما تتدمج في دالة واحدة بـ if:
//
// ① `Math.abs` على الـ `cod`: صح في s1 (السالب = العميل دفع زيادة)، **كارثة**
//    في R/E (السالب = بوسطة بتدفع للعميل عند الباب). الدالتين
//    `buildDeliveryPayload` و`buildRePayload` ما بيشاركوش سطر حساب الفلوس، و
//    `resolveCod` بتعيش في §RE-UPLOAD لوحدها. من ٤ أوردرات R/E مقيسة ٣ سالبين.
// ② اتجاه العنوان بيتقلب: 10 و30 → `dropOffAddress` · 25 → `pickupAddress`.
//    الغلط فيه بيرجّع **500 بلا `errorCode`**، مش 400 واضح.
// ③ `uniqueBusinessReference` قاعدتين: s1 → `12345` · R/E → `#12345-R{n}`.
//    الفرادة عند بوسطة على الحساب كله وعبر كل الأنواع — نفس القيمة = 400/11000.
// ④ فلترين ومكنتين حالة — مش استعلام واحد مدموج. كل وضع ليه استعلامه.
//
// 🔴 التغييرات اللي طلبها أحمد مع الدمج (13-09-2026):
// - `custom.bosta_tracking_number` **اتوقف**. بدله ميتافيلدين جداد اتعملوا على
//   المتجر: `custom.bosta_tracking_number_s1` (الشحنة العادية) و
//   `custom.bosta_tracking_number_s2` (الاسترجاع/الاستبدال). الاتنين
//   `number_integer` وعليهم **Unique values only**. القديم لسه **بيتقرا** في
//   حارس الرفع المكرر عشان الـ ٣٥٦ شحنة اللي اترفعت قبل كده — لكن مابيتكتبش.
//   ✅ وده بيقفل ق-٥ المؤجَّل: رقم تتبع الـ S2 بقى له ميتافيلد فعلًا.
// - التاج بقى حسب النوع: `Bosta_Uploaded_S1` · `Bosta_Uploaded_S2`.
// - 🔴 في R/E **مابنكتبش** `custom.courier = Bosta` — بنتحقق إنه **بالفعل**
//   Bosta قبل الشحنة. شحنة استرجاع على أوردر كوريره حاجة تانية معناها إننا
//   بنسحب من عند مندوب مش بتاعنا. الكتابة بتخص s1 لوحدها (هي اللي بتختار
//   الكوريَر أصلًا).
//
// ⚠️ قيمة `tool` في D1 فضلت **مقسومة** (اختيار «أ» في MERGE-BRIEF §٥) — قرار
//    أحمد: يتأجّل لحد ما التجربة تكتمل. s1 → `bosta_orders_upload` ·
//    R/E → `bosta_exchange_export`. صفر هجرة، والـ ٥٦٦ صف التاريخية ما اتيتّمتش،
//    وتاب السجل بيقرا **الاتنين** فالموظف بيشوف تاريخ متصل. تغييرها بعدين =
//    سطر واحد + `ecommoda-tool-rename`.
//
// ⚠️ تصدير Excel **اتساب** (قرار أحمد، MERGE-BRIEF §٦ بند ٢) كخطة بديلة:
//    عقد بوسطة يتغيّر · المفتاح مش متاح · أوردر الـ API رافضه.
//
// 🔴 مسار `upload_re` **ما اشتغلش حي ولا مرة** لحد 13-09 (صفر صف في D1).
//    الدمج مايتحسبش تشغيل حي — أول شحنة استرجاع حقيقية تتعمل **مراقَبة**.
//
// v2.0.1 (13-09-2026) — **الرفع مابيحركش حالة الأوردر.**
// أول شحنة استبدال حية طلّعت إن `upload_re` بيكتب `status_2_r_e → Ready`
// و`custom.printing_time_s2` على طول بعد الشحنة. الاتنين اتشالوا بقرار أحمد.
// السبب هو **نفس قاعدة الشحن العادي** اللي الأداة دي ماشية عليها من أول يوم:
// الانتقال بيحصل عند **الطباعة** مش عند الرفع، وتقديم الحالة من هنا بيكسر
// بوابة الطباعة. و`printing_time_s2` **وقت طباعة** — كتابته وقت الرفع بتخلي
// أي تقرير مبني عليه يقول إن البوليصة اتطبعت وهي ما اتطبعتش.
// اللي بيتكتب بعد الشحنة بقى: رقم التتبع والتاج. فقط. زي S1 بالحرف.
// ⚠️ مسار الإكسيل (`confirm_upload`) **ما اتغيّرش** — هناك الشحنة بتتعمل من
//    داشبورد بوسطة بالإيد، فتحديث الحالة خطوة يدوية منفصلة بمودال وchecklist،
//    مش أثر جانبي للرفع.
//
// v2.3.0 (15-09-2026) — **الاسترجاع بيحرّك الحالة وقت الرفع.**
// طلب أحمد: رفع شحنة استرجاع ناجحة بيكتب `custom.status_2_r_e = In-Return`.
// 🔴 **السبب (أحمد 15-09-2026): أوردر الاسترجاع مالوش بوليصة بتتطبع** — بوسطة
// بتروح تجيب المرتجع من عند العميل على طول. يعني **مفيش حدث طباعة** بعد الرفع
// يحمل النقلة، والرفع هو **آخر خطوة عندنا** في المسار ده. قاعدة v2.0.1
// («النقلة عند الطباعة») مبنية على وجود طباعة — فهي **مالهاش محل** هنا،
// وتطبيقها كان معناه إن الحالة ماتتحركش أبدًا والأوردر يفضل `Confirmed + RETURN`
// للأبد ما لم يتدخّل حد بإيده.
// ده **استثناء معلن** عن قاعدة v2.0.1 فوق، **للاسترجاع لوحده**:
//   · الاستبدال زي ما هو — فيه طرد **خارج** للعميل، فالبوليصة بتتطبع ونقلة
//     `Ready` لسه بتحصل عند الطباعة.
//   · `printing_time_s2` **لسه مابيتكتبش** في أي وضع — وفي الاسترجاع ده مش
//     تأجيل لحد الطباعة، **مفيش طباعة** أصلًا.
// الكتابة جوّه **نفس** نداء `metafieldsSet` بتاع رقم التتبع (نداء واحد بيعدّي
// كله أو يقع كله)، والسجل بيقرا من `r.s2Written` — حقيقة مؤكَّدة من شوبيفاي،
// مش نيّة. ومعاها رجع صف `metafields_change` لكل نقلة حصلت فعلًا (KPIs زمن
// الدورة بتتقرا من هناك فقط).
// ⚠️ **النتيجة اللي لازم تتوقعها:** أوردر الاسترجاع **بيخرج من القايمة** بعد
//    الرفع والتحديث — فلتر الترشيح بيقرا `Confirmed + RETURN`. ده عكس الشحن
//    العادي والاستبدال، واللي بيحمي من الرفع المكرر فيهم (التاج · رقم التتبع ·
//    حارس `uniqueBusinessReference`) لسه شغّال هنا زي ما هو.
// ⚠️ وأي تقرير بيعدّ «مرتجعات مستنية» بـ`status_2_r_e = Confirmed + RETURN`
//    هيشوف العدد بيقلّ بعد الرفع — معنى العدّاد اتغيّر، مش عطل.
//
// v2.4.0 (15-09-2026) — **المطابقة المحلية أسبق · والفحص مابيتسجّلش.**
// ① 🔴 «المحافظة مشكوك فيها» بقت بتتعلن **فقط لما مفيش أي مطابقة جوّه المحافظة
//    المحسومة من الجدول**. قبل كده الكاشف كان بيلفّ على الكتالوج كله **دايمًا**،
//    فاسم متكرر بين محافظتين كان بيوقف صف سليم: «السادات» مدينة حقيقية في
//    **المنوفية وفي البحيرة** (مدينتين مختلفتين فعلًا)، وأوردر `#54863`
//    (المنوفية · مدينة السادات) أخد 🟠 على اقتراح البحيرة — والأسوأ إن اقتراح
//    «ضغطة واحدة تظبّط المدينة» كان **بينقل الشحنة للمحافظة الغلط**.
//    والمطابقة المحلية كانت موجودة أصلًا (زون `ElSadat` جوّه المنوفية) بس
//    الشك كان بيلغي درجة الزون كمان، فالصف ينزل للمحافظة بدل مدينة محددة.
//    ⚠️ الكاشف **زي ما هو** لما مفيش مطابقة محلية — دي الحالة اللي اتكتب
//    عشانها (العبور تحت القاهرة · شبين الكوم على الغربية · دمياط الجديدة).
// ② `fetch_candidates` بقى **مابيكتبش صف `type: 'scan'`** (طلب أحمد). كان
//    بيتكتب صف مع كل فتحة شاشة وكل تبديل وضع وكل «تحديث» — قراءة مالهاش أي
//    أثر بتغرّق صفوف الرفع الحقيقية. الصفوف التاريخية ما اتمسحتش.
//
// v2.5.0 (17-09-2026) — **المرساة · وقياس التدخّل اليدوي.**
// ① 🔍 `§BOSTA::findAddressAnchor` — كلمة من العنوان موجودة في اسم منطقة
//    **واحدة بس** في المحافظة، بترجع في الصف (`addressAnchor`) والواجهة
//    بتفتح بيها خانة البحث في نافذة اختيار المنطقة. **مش قرار ومش اقتراح
//    منطقة**: الصف بيفضل «🏙️ المحافظة فقط» وموقوف لحد التأكيد اليدوي زي ما
//    هو، والدرجة والـ payload ما اتغيّروش. السبب مقيس على `#55065`: العميل
//    كتب «الكينج مريوط» والمنطقة «كنج مريوط» — فرق حرف واحد أسقط المطابقة،
//    والموظف كتب «مريوط» بإيده ولقى الصف من أول نتيجة.
//    🔴 بتتحسب في فرع «المحافظة فقط» **غير المشكوك في مدينته** وبس — أي فرع
//    تاني بيثبّت حاجة أول القايمة، والنافذة بتخفيها لما البحث يتملا.
// ② 📊 السجل بقى بيفرّق بين مطابقة نجحت وموظف صلّحها: `district_overridden` ·
//    `degree_forced` · `address_anchor` · `anchor_hit`. قبل كده `district_sent`
//    كان بيتكتب في الحالتين، يعني **نسبة نجاح المطابقة مش قابلة للقراءة من
//    السجل أصلًا** — وأي قرار عن تحسين المطابقة بيتاخد على تقدير مش على رقم.
//    `anchor_hit` تحديدًا هو اللي هيقول لو المرساة تستاهل تبقى اقتراح قابل
//    للضغط بعدين (بند ١٩ المفتوح) — مش قرار يتاخد دلوقتي بالتخمين.
//
// v2.6.0 (17-09-2026) — **المرساة بقت بتتطبّق** (قرار أحمد).
// 🔴 الصف اللي المطابقة فشلت فيه ولقيناله مرساة **بيترفع على منطقتها**: كان
//    بينزل «المحافظة فقط» وموقوف لحد تأكيد يدوي، وبقى `mode: 'district'`
//    ومعاه `districtId` وقابل للرفع **وداخل «رفع الكل»** (طلب أحمد صراحةً).
//    السبب: الصف كان محتاج ٣ ضغطات (افتح · اختر · أكّد) على منطقة الأداة
//    عارفاها أصلًا.
// 🔴 **و`mode` فضل `district` عن قصد، والفرق في علم منفصل** —
//    `districtFromAnchor`. قيمة رابعة للـ`mode` كانت هتطلب فرع جديد في
//    `buildAddressObject` و`addressDegree` و`nextAddressDegree` وسلّم النزول،
//    وأي واحدة تنساها = 400 من بوسطة أو درجة غلط في D1 **في صمت**. اللي
//    اتغيّر مصدر الـ`districtId` وعرضه، مش عقد العنوان.
// 🔴 **والواجهة بتعرضها «🔍 مرشّح تلقائي» مش «📍 عنوان مظبوط»** — مطابقة اسم
//    كامل ومرساة كلمة واحدة مش نفس الثقة، وتوحيد البادج بيخلي الموظف يعدّي
//    على تخمين وهو فاكره حقيقة.
// 📊 و`anchor_applied` اتضاف للسجل، و**معنى `anchor_hit` اتقلب**: بقى
//    `false` = الموظف صحّح المرساة (خطأ اتمسك)، و`null` = ما لمسش (موافق
//    ضمنيًا). النسبة دي هي معدّل الخطأ الفعلي — بند ١٩.
// ⚠️ **والمرساة لسه بتتلغي لو المدينة مشكوك فيها** (`cityDoubt`) — اقتراح
//    المحافظة التانية إشارة أقوى، وتطبيق منطقة فوق شك بيثبّت الشك.
//
// v2.7.0 (17-09-2026) — **الملحوظة الإعلامية اتفصلت عن التحذير الناقص**
// (طلب أحمد، على حالة حقيقية: `#54618` اترفع صح بالكامل — شحنة · رقم تتبع ·
// `status_2_r_e = In-Return` · تاج — وظهر **«⚠ تم جزئيًا»** لأن مستحق العميل
// 2,700 اتقص عند حد بوسطة 2,000).
// 🔴 السبب كان سطر واحد: `row.status = row.warnings.length ? 'warning' : 'success'`
//    و`warnings` كانت **قايمة واحدة** بتلمّ نوعين مختلفين تمامًا:
//      · حاجة **ناقصة** — الشحنة موجودة بفلوس وحاجة بعدها ما تمّتش
//        (مفيش رقم تتبع · الكتابة على شوبيفاي فشلت · الميتافيلد اتسقّط)
//      · **ملحوظة** على عملية تمّت بالكامل — قص المبلغ عند حد بوسطة ·
//        الموظف غيّر المحافظة بإيده · بوسطة رفضت الدرجة فنزلنا درجة
// 🔴 القايمة بقت اتنين: `row.warnings` (بتحدد الحالة) و`row.advisories`
//    (مابتغيّرش اللون خالص). الحالة زي ما هي: `warnings.length ? 'warning'`.
// ⚠️ **ومفيش معلومة اتشالت** — الملحوظة بتتعرض في نافذة النتيجة بسطر أزرق
//    ℹ️، وبتفتح التفاصيل لوحدها، وليها عمود في تصدير النتيجة، وبتتكتب في
//    `notes` وفي `extra.advisories` في D1.
// 🔴 **والسبب إن ده يستاهل تعديل أصلًا:** «تم جزئيًا» في الأداة دي معناها
//    **شحنة موجودة بفلوس وحاجة ناقصة — متعيدش الرفع**. أصفر على صف سليم
//    بيعلّم الموظف يعدّي على الأصفر، ولما يحصل ناقص **فعلًا** مفيش إشارة
//    (نفس مرض `already` — `worker-builder` 5A ④).
// ⚠️ **وأثر على القياس:** أي تقرير بيعدّ `extra.warnings` على إنه «صفوف محتاجة
//    مراجعة» كان بيعدّ القص والتعديل اليدوي معاها. الصفوف القديمة زي ما هي —
//    فيها `warnings` بالخلط، ومن v2.7.0 القايمتين منفصلتين.
//
// v2.8.0 (17-09-2026) — 🔤 **الاسم العربي بيترجع جنب الإنجليزي** (طلب أحمد).
// الصف بقى فيه `cityNameAr` · `districtNameAr` · `zoneNameAr` جنب الإنجليزية،
// والواجهة بتعرض العربي في عمودي «محافظة بوسطة» و«المنطقة».
// 🔴 **المصدر كتالوج بوسطة نفسه، مفيش ترجمة عندنا** — `getAllDistricts` بيرجّع
//    لكل مستوى حقلين (`name` · `otherName`/`nameAr`)، والأداة كانت بتقرا
//    الإنجليزي بس وبترمي العربي. جدول المحافظات المقفول (§3.5) إنجليزي بس
//    فاسم المحافظة العربي بيتقرا من **المدينة اللي الجدول وصل لها** في الكتالوج.
// 🔴 **والـ payload ما اتغيّرش ولا حرف**: `buildAddressObject` لسه بتبعت
//    `city: plan.cityName` الإنجليزي و`districtId`/`districtName` الإنجليزي —
//    بوسطة **مش فاهمة** الاسم العربي، و`districtName` عربي على العقد غير
//    الموثّق بيرجّع 400 · `3002` على عنوان سليم ١٠٠٪. العربي **للعرض وبس**،
//    والاختبار `tests/bilingual-names.test.cjs` ⑥ بيتأكد إن مفيش حرف عربي
//    بيدخل الـ payload.
// ⚠️ والحقل بيرجع **سلسلة فاضية** لو الكتالوج مالوش اسم عربي للمستوى ده —
//    الواجهة بترجع للإنجليزي وقتها بدل ما تسيب الخانة فاضية.
//
// العقد المرجعي الكامل: SPEC.md في نفس الريبو.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// §CONSTANTS
// ══════════════════════════════════════════════════════════════
// 🔴 قيمتين `tool` في Worker واحد — استثناء معلن، مش سهو. الأداة واحدة للموظف
//    والسجل بيفضل بيفرّق بين **عمليتين مختلفتين بطبيعتهم** (مكنتين حالة
//    مختلفتين، وفلترين مختلفين). القرار ده مؤقت لحد ما التجربة تكتمل
//    (MERGE-BRIEF §٥، اختيار «أ») — تغييره سطر واحد + `ecommoda-tool-rename`.
//    ⚠️ لازم يتسجّل كاستثناء في `ecommoda-constants` §7.
const TOOL_NAME      = 'bosta_orders_upload';    // s1 — الشحن العادي
const TOOL_NAME_RE   = 'bosta_exchange_export';  // الاسترجاع/الاستبدال — القيمة التاريخية، ٥٦٦ صف من 05-05-2026
// تاب السجل بيقرا الاتنين — من غير ده الدمج بيقطع تاريخ الموظف نُصّين.
const LOG_TOOLS      = [TOOL_NAME, TOOL_NAME_RE];
const WORKER_VERSION = '2.8.1';
const API_VERSION    = '2026-01';

// ─── §CONSTANTS::jobs ───
// الوضع هو اللي بيحدد: استعلام شوبيفاي · نوع شحنة بوسطة · اتجاه العنوان ·
// معاملة الـ cod · شكل المرجع الفريد · الميتافيلد اللي بيتكتب · التاج · نوع
// صف السجل. مفيش حاجة من دول بتتشارك بين s1 و R/E.
const JOB_S1       = 's1';
const JOB_RETURN   = 'return';
const JOB_EXCHANGE = 'exchange';
const RE_JOBS      = new Set([JOB_RETURN, JOB_EXCHANGE]);
const ALL_JOBS     = new Set([JOB_S1, JOB_RETURN, JOB_EXCHANGE]);

// ─── §CONSTANTS::bosta ───
const BOSTA_BASE        = 'https://app.bosta.co/api/v2';
const BOSTA_LOCATION_ID = 'GeZMkbD7o';                          // كلية البنات - مصر الجديدة
const BOSTA_COUNTRY_ID  = '60e4482c7cb7d4bc4849c4d5';           // مصر
// `ecommoda-constants` §3.2 — من SDK بوسطة نفسها. الفلترة على الكود مش النص.
const BOSTA_TYPE_BY_JOB = { [JOB_S1]: 10, [JOB_RETURN]: 25, [JOB_EXCHANGE]: 30 };
const FLEX_AMOUNT       = 100;                                  // SPEC §٤.٢ — على أوردرات s1 فقط
const ALLOW_OPEN_PKG    = true;                                 // قرار تشغيلي — EGP 7/شحنة، متتشالش
// 🔴 حدّين **في اتجاهين متعاكسين**. `COD_MAX` موثّق في api.yaml؛
//    `COD_REFUND_MIN` **مقيس حيًا**: ‎-2700 رجّع 400 · errorCode "3008" ·
//    "The Refund COD amount should be less than or equal -2000 EGP"،
//    **ومفيش شحنة اتعملت**.
const COD_MAX           = 30000;
const COD_REFUND_MIN    = -2000;
// 🔴 `goodsInfo.amount` محبوسة بين `100` و`50000` — **والحد ده مش موثّق في الـ
//    spec خالص** (`bosta-api-helper` 8.4 · مقيس حيًا 14-09-2026: `amount: 1`
//    بيرجّع 400 · `errorCode 41591`). ورسالة بوسطة بتتكلم عن «قيمة الطرد» مش
//    عن حد أدنى، فمن غير حارس عندنا الموظف بيقرا رفض مبهم على أوردر سليم.
//    ⚠️ الحد بيتطبّق **وقت الإنشاء فقط** — `PUT` بيقبل `1` (8d ④). الأداة دي
//    مابتعملش `PUT`، لكن لو اتضاف مسار تعديل يومًا الحارس **يتكرر** هناك، مش يتورّث.
const GOODS_MIN         = 100;
const GOODS_MAX         = 50000;

// ─── §CONSTANTS::shopify ───
// القيم الحرفية — فرق حرف واحد = صفر صف من غير أي خطأ (ecommoda-order-lifecycle)
const S1_CONFIRMED      = 'Confirmed';
const S1_CONFIRMED_EDIT = 'Confirmed + Edit';
const ZONE_VALUE        = 'Other_Regions';
const START_DATE        = '2026-08-01';                         // بتوقيت المتجر (القاهرة)
// مكنة حالة S2 — منفصلة تمامًا عن S1 (`ecommoda-order-lifecycle` Rule 15)
const S2_STATUS_BY_JOB  = { [JOB_RETURN]: 'Confirmed + RETURN', [JOB_EXCHANGE]: 'Confirmed + EXCHANGE' };
const S2_NEXT_BY_JOB    = { [JOB_RETURN]: 'In-Return',          [JOB_EXCHANGE]: 'Ready' };
// 🔴 الحالة اللي **الرفع المباشر** (`upload_re`) بيكتبها — استثناء معلن عن
//    قاعدة «الرفع مابيحركش الحالة» (v2.3.0 · طلب أحمد 15-09-2026)، و**للاسترجاع
//    لوحده**. السبب مادي مش تفضيل: **مفيش بوليصة بتتطبع لأوردر استرجاع** —
//    بوسطة بتروح تجيب المرتجع من العميل، فمفيش حدث طباعة يحمل النقلة والرفع
//    هو آخر خطوة عندنا. الاستبدال لسه على القاعدة (فيه طرد خارج والبوليصة
//    بتتطبع): نقلة `Ready` بتحصل عند الطباعة.
//    ⚠️ `printing_time_s2` **لسه مابيتكتبش** في التلات أوضاع — في الاستبدال
//    والشحن لأنه وقت طباعة حقيقي مايتكتبش قبلها، وفي الاسترجاع لأن **مفيش
//    طباعة** من أصله.
//    ⚠️ **والنتيجة اللي لازم تتوقعها**: الأوردر **بيخرج من القايمة** بعد الرفع
//    والتحديث (فلتر الترشيح بيقرا `Confirmed + RETURN`) — عكس الاستبدال والشحن
//    العادي اللي الصف بيفضل فيهم ومعاه بادج «🔁 مرفوع».
const S2_UPLOAD_STATUS_BY_JOB = { [JOB_RETURN]: 'In-Return', [JOB_EXCHANGE]: null };
const COURIER_VALUE     = 'Bosta';

// 🔴 التاج بيتقسم بالنوع. تاج واحد للاتنين معناه إن حارس الرفع المكرر بتاع s1
//    بيتلغي أول ما الأوردر يتعمل له استرجاع — والعكس.
const UPLOAD_TAG_BY_JOB = {
  [JOB_S1]:       'Bosta_Uploaded_S1',
  [JOB_RETURN]:   'Bosta_Uploaded_S2',
  [JOB_EXCHANGE]: 'Bosta_Uploaded_S2',
};

// 🔴 الميتافيلدات. النوع `number_integer` **مش نص** — `metafieldsSet` بيطلب
//    تطابق النوع بالحرف مع التعريف الحي، واختلافه بيسقّط **النداء كله** بما
//    فيه أي ميتافيلد تاني في نفس النداء. الأداة بتتحقق `/^\d+$/` قبل الكتابة.
const MF_COURIER      = { key: 'courier',                  type: 'single_line_text_field' };
const MF_TRACKING_S1  = { key: 'bosta_tracking_number_s1', type: 'number_integer' };
const MF_TRACKING_S2  = { key: 'bosta_tracking_number_s2', type: 'number_integer' };
const MF_TRACKING_BY_JOB = {
  [JOB_S1]:       MF_TRACKING_S1,
  [JOB_RETURN]:   MF_TRACKING_S2,
  [JOB_EXCHANGE]: MF_TRACKING_S2,
};
// ⚠️ الميتافيلد القديم — **مابيتكتبش خلاص** (v2.0.0). لسه بيتقرا في حارس الرفع
//    المكرر عشان الـ ٣٥٦ شحنة اللي اترفعت عليه قبل الدمج؛ بدونه كل أوردر قديم
//    هيبان «مش مرفوع». مفيش migration — التاج `Bosta_Uploaded_S1` كان بيتكتب
//    معاه من أول يوم فهو الحارس التاني.
const MF_TRACKING_LEGACY = { key: 'bosta_tracking_number', type: 'number_integer' };
const MF_S2_STATUS       = { key: 'status_2_r_e',     type: 'single_line_text_field' };
const MF_PRINTING_S2     = { key: 'printing_time_s2', type: 'date_time' };

// ─── §CONSTANTS::logTypes ───
// ⚠️ `ecommoda-constants` §7 — القيم دي لازم تتسجّل هناك. `worker-builder`
//    القاعدة ٧ بتقول التسجيل **قبل** أول `writeLog` مش بعده.
// 🔴 الفصل بين «الرفع فشل» و«الكتابة الرجعية فشلت» مش تجميلي في أي نوع:
//    الأولى = مفيش شحنة، فإعادة المحاولة آمنة. التانية = الشحنة **موجودة فعلًا
//    عند بوسطة ومعاها رقم تتبع**، وإعادة الرفع بتشتري شحنة تانية بفلوس حقيقية.
const LOG_TYPE_BY_JOB = {
  [JOB_S1]:       'uploaded',
  [JOB_RETURN]:   'upload_re_return',
  [JOB_EXCHANGE]: 'upload_re_exchange',
};
const UPLOAD_FAILED_BY_JOB = {
  [JOB_S1]:       'upload_failed',
  [JOB_RETURN]:   're_upload_failed',
  [JOB_EXCHANGE]: 're_upload_failed',
};
const WRITE_FAILED_BY_JOB = {
  [JOB_S1]:       'shopify_write_failed',
  [JOB_RETURN]:   're_shopify_write_failed',
  [JOB_EXCHANGE]: 're_shopify_write_failed',
};
const CYCLE_BLOCK_TYPE = 'cycle_block';
const CANCEL_TYPE      = 're_cancelled';
const EXPORT_TYPES     = ['export_return', 'export_exchange'];

// ─── §CONSTANTS::cycles ───
// `ecommoda-order-lifecycle` Rule 15 / state-machines.md §2.4 — دورات
// CANCELED/DECLINED بتتشال **قبل** الترتيب: الـ `closedAt` بتاعهم `null`،
// والـ null بيتقرا «لسه مفتوحة» في فحص التداخل، فسيبانهم بيفبرك تداخل وهمي.
const RETURNS_PAGE_SIZE         = 10;
const IGNORED_RETURN_STATUSES   = ['CANCELED', 'DECLINED'];
const ORDER_LINE_ITEMS_PAGE_SIZE = 25;
const DISCOVERY_PAGE_SIZE       = 100;
const DISCOVERY_MAX_PAGES       = 10;
const DETAILS_BATCH_SIZE        = 25;
// ⚠️ اتنزّل من 50 في v5.5.0: `EXCHANGE_WITHOUT_ITEMS` بقى كود حاجب، فالحارس
//    مابقاش استعلام scalars فقط — بقى بيقرا نفس مصدري القطع الخارجة.
const CYCLE_GUARD_BATCH_SIZE    = 20;

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

// ─── §HELPERS::time — `Africa/Cairo` يتحسب، مايتكتبش ثابت ───
// نسخة **حرفية** من `ecommoda-constants` §13 — ونفس البلوك بالظبط في
// `index.html`. الإزاحة ١٨٠ دقيقة صيفًا و١٢٠ شتاءً، ومصر بتوقف التوقيت الصيفي
// 29-10-2026 — فأي ثابت مكتوب بالإيد بيغلط من غير ما الأداة تشتكي.
const CAIRO_TZ = 'Africa/Cairo';
const _cairoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
function cairoParts(d) {
  const o = {};
  for (const p of _cairoFmt.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return o;
}
function cairoOffsetMinutes(d) {
  const p = cairoParts(d);
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day,
                              +p.hour, +p.minute, +p.second) - d.getTime()) / 60000);
}
// حدود يوم تقويمي بالقاهرة → UTC. الإزاحة بتتقاس عند **ظهر** اليوم: أي تحويل
// توقيت بيحصل فجرًا، فالظهر بيدّي إزاحة اليوم الصحيحة.
function cairoDayBoundsUTC(dateStr) {
  const offMin = cairoOffsetMinutes(new Date(`${dateStr}T12:00:00.000Z`));
  return {
    start: new Date(Date.parse(`${dateStr}T00:00:00.000Z`) - offMin * 60000).toISOString(),
    end:   new Date(Date.parse(`${dateStr}T23:59:59.999Z`) - offMin * 60000).toISOString(),
  };
}

// ─── §HELPERS::clampInt ───
// أي رقم جاي من الـ query string بيعدّي من هنا. `parseInt` لوحدها بترجّع NaN
// على مدخل مش رقم، وNaN بيعدّي Math.min/Math.max من غير ما يتغيّر.
function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// ─── §HELPERS::secretFingerprint ───
async function secretFingerprint(secret) {
  if (!secret) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(buf)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── §HELPERS::normPhone ───
// مفتاح **مقارنة** فقط — مش القيمة اللي بتتبعت. بيرجّع الأرقام المجرّدة عشان
// "01009619555" و"+201033337575" مايتحسبوش رقمين مختلفين فنبعت نفس الرقم في
// `phone` و`secondPhone`.
const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');

// ─── §HELPERS::wirePhone ───
// 🔴 دي القيمة اللي **بتتبعت فعلًا**. المتجر فيه **تلات** أشكال مقيسة:
//    `01…` · `+201…` · و`+20 12 71043044` **بمسافات** (`#53849`, 10-09-2026).
//    تمرير الحقل الخام كان بيحط نص فيه مسافات في `receiver.phone`.
//    الناتج دايمًا الشكل المحلي `01…`.
//    (`shopify-graphql-helper` §2.1 — الحقول الإلزامية لأي رفع شحن.)
const wirePhone = p => { const d = normPhone(p); return d ? '0' + d : ''; };

// ─── §HELPERS::text ───
const cleanText = v => String(v ?? '').trim();

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── §HELPERS::nowToSecond ───
// بتقص للثانية الكاملة عشان القيمة اللي تتكتب دلوقتي وتتقرا بعدين تتقارن
// بالتساوي حتى لو شوبيفاي رمت الكسور من `date_time`.
function nowToSecond() {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
}

function isShopifyCostError(err) {
  return /cost|exceeds the single query max cost limit|maximum cost/i.test(err?.message || String(err));
}

// ─── §HELPERS::job ───
// الوضع بييجي من العميل — قايمة **مقفولة**، وأي قيمة بره القايمة بتوقف النداء
// برسالة، مش بترجع لـ s1 في صمت (رجوع صامت هنا معناه شحنة بالنوع الغلط).
function getJob(raw, { allow = ALL_JOBS } = {}) {
  const jt = cleanText(raw) || JOB_S1;
  if (!allow.has(jt)) {
    const err = new Error(`نوع العملية غير صحيح (${jt || '—'}) — استخدم s1 أو return أو exchange`);
    err.status = 400;
    throw err;
  }
  const isRE = RE_JOBS.has(jt);
  return {
    jobType:        jt,
    isRE,
    bostaType:      BOSTA_TYPE_BY_JOB[jt],
    tool:           isRE ? TOOL_NAME_RE : TOOL_NAME,
    tag:            UPLOAD_TAG_BY_JOB[jt],
    trackingMf:     MF_TRACKING_BY_JOB[jt],
    uploadedType:   LOG_TYPE_BY_JOB[jt],
    uploadFailType: UPLOAD_FAILED_BY_JOB[jt],
    writeFailType:  WRITE_FAILED_BY_JOB[jt],
    expectedStatus: isRE ? S2_STATUS_BY_JOB[jt] : null,
    nextStatus:     isRE ? S2_NEXT_BY_JOB[jt]   : null,
    // 🔴 الحالة اللي بتتكتب **وقت الرفع** — استرجاع فقط، والباقي `null`.
    //    مصدر واحد: الكتابة والسجل وصف `metafields_change` كلهم بيقروا منه،
    //    فمستحيل تتكتب الحالة من غير ما السجل يشوفها (أو العكس).
    uploadStatus:   isRE ? (S2_UPLOAD_STATUS_BY_JOB[jt] || null) : null,
    exportType:     jt === JOB_EXCHANGE ? 'export_exchange' : jt === JOB_RETURN ? 'export_return' : null,
    confirmType:    jt === JOB_EXCHANGE ? 'confirm_exchange' : jt === JOB_RETURN ? 'confirm_return' : null,
    label:          jt === JOB_RETURN ? 'استرجاع' : jt === JOB_EXCHANGE ? 'استبدال' : 'شحن',
  };
}

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

// ════════════════════════════════════════════════════════════
// §LOG-REG — الحارس الديناميكي لقيم اللوج (الطبقة ٥)
// ════════════════════════════════════════════════════════════
// من `log-values.json` جنب الملف ده — بيتحدّث معاه في نفس الـ commit.
// مفتاحه الزوج (tool, type) مش `type` لوحده: الأداة دي بتكتب تحت تلات
// أسماء `tool` (نفسها · `bosta_exchange_export` التاريخية · السجل المشترك
// `metafields_change`)، وقيمة صح تحت `tool` غلط بتولّد تنبيه كاذب.
// ⛔ مفيش رفض كتابة أبدًا هنا — قيمة مش مسجّلة بتتكتب عادي + تعليم
// `extra._unregistered = true` + تنبيه في `log_value_alerts` بعد الكتابة.
const LOG_REGISTRY = {
  [TOOL_NAME]: new Set([
    'login', 'logout', 'uploaded', 'upload_failed', 'shopify_write_failed', 'skipped',
  ]),
  [TOOL_NAME_RE]: new Set([
    'login', 'logout', 'cycle_block', 're_cancelled',
    'upload_re_return', 'upload_re_exchange', 're_upload_failed', 're_shopify_write_failed',
    'export_return', 'export_exchange', 'confirm_return', 'confirm_exchange',
  ]),
  metafields_change: new Set(['update']),
};

const isRegisteredLogValue = (tool, type) => !!LOG_REGISTRY[tool]?.has(type);

// UPSERT على (source_tool, tool, type) — صف واحد لكل قيمة، hits بيعدّ.
// الحدث الكامل مش بيضيع: الصف الأصلي موجود في logs وعليه _unregistered،
// والجدول ده فهرس مش سجل تاني — عشان كده dedupe مش صف لكل حدث.
const LOG_ALERT_SQL = `
  INSERT INTO log_value_alerts
    (source_tool, tool, type, first_seen, last_seen, hits,
     worker_version, sample_order_name, sample_employee, sample_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source_tool, tool, type) DO UPDATE SET
    last_seen         = excluded.last_seen,
    hits              = log_value_alerts.hits + excluded.hits,
    worker_version    = excluded.worker_version,
    sample_order_name = excluded.sample_order_name,
    sample_employee   = excluded.sample_employee,
    sample_notes      = excluded.sample_notes,
    status            = CASE WHEN log_value_alerts.status = 'ignored'
                             THEN 'ignored' ELSE 'open' END
`;

// فشل التنبيه ممنوع يأثر على أي حاجة — try/catch صامت. بتجمّع التكرار
// جوّه نفس الدفعة في صف واحد (hits) قبل ما تكتب.
async function noteUnregisteredLogValues(db, entries) {
  const byPair = new Map();
  for (const e of entries) {
    const key = `${e.tool}\u0000${e.type}`;
    const acc = byPair.get(key);
    if (acc) { acc.hits++; continue; }
    byPair.set(key, { entry: e, hits: 1 });
  }
  const now = new Date().toISOString();
  for (const { entry, hits } of byPair.values()) {
    try {
      await db.prepare(LOG_ALERT_SQL).bind(
        TOOL_NAME, entry.tool ?? '(بدون tool)', entry.type ?? '(بدون type)',
        now, now, hits, WORKER_VERSION ?? null,
        entry.orderName ?? null, entry.employee ?? null,
        entry.notes ? String(entry.notes).slice(0, 200) : null,
      ).run();
    } catch (e) { /* متعمّد: التنبيه فهرس، وفشله أهون من تعطيل الأداة */ }
  }
}

// ⚠️ `writeLog` أصلها من §SHARED — الحارس ده الاستثناء الوحيد المتعمّد على
// «copy verbatim» (`worker-builder` Step 7-ج بيتطلب الحقن هنا بالحرف).
async function writeLog(db, entry) {
  const unregistered = !isRegisteredLogValue(entry.tool, entry.type);
  const extra = unregistered
    ? { ...(entry.extra || {}), _unregistered: true }
    : entry.extra;

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
    extra ? JSON.stringify(extra) : null
  ).run();

  if (unregistered) await noteUnregisteredLogValues(db, [entry]);
}

// إضافة خاصة بالأداة دي (مش من §SHARED) — بتلمّ صفوف بشكل `writeLog` في نداء
// `batch()` واحد. الرفع بيكتب صف لكل أوردر، و٢٥ نداء منفصل على D1 جوّه نفس
// الطلب بيقرّب من سقف الـ subrequests بتاع Cloudflare.
// 🔴 تنبيه القيم الغير مسجّلة (Step 7-ج) بيتبعت **مرة واحدة بعد اللوب كله**
//    بقايمة الصفوف المعلّمة عبر كل الـ chunks — مش جوّه اللوب، ومش تنبيه لكل صف.
async function writeLogsBatch(db, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const unregisteredEntries = [];
  for (const group of chunks(entries, 40)) {
    await db.batch(group.map((entry) => {
      const unregistered = !isRegisteredLogValue(entry.tool, entry.type);
      if (unregistered) unregisteredEntries.push(entry);
      const extra = unregistered
        ? { ...(entry.extra || {}), _unregistered: true }
        : entry.extra;
      return db.prepare(`
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
        extra ? JSON.stringify(extra) : null,
      );
    }));
  }
  if (unregisteredEntries.length) await noteUnregisteredLogValues(db, unregisteredEntries);
}

const LOG_EXPORT_MAX = 2000;   // سقف التصدير — بيرجع للواجهة كـ `cap`

function buildLogFilterSQL(select, {
  tool      = null,  tools     = null,
  employee  = null, employees = null,
  type      = null, types     = null,
  search    = null,
  dateFrom  = null, dateTo    = null,
} = {}) {
  let sql = `${select} FROM logs WHERE type NOT IN ('login','logout')`;
  const b = [];

  // 🔴 الأداة بتكتب تحت **قيمتين** `tool` (الدمج — اختيار «أ» في MERGE-BRIEF §٥)،
  //    فتاب السجل لازم يقرا الاتنين. فلتر على قيمة واحدة هنا كان معناه إن
  //    الموظف يشوف نص تاريخه فقط، والنص التاني يبان كأنه ما حصلش.
  const tls  = Array.isArray(tools) && tools.length ? tools : (tool ? [tool] : []);
  const emps = Array.isArray(employees) && employees.length ? employees : (employee ? [employee] : []);
  const typs = Array.isArray(types)     && types.length     ? types     : (type     ? [type]     : []);

  if (tls.length) {
    sql += ` AND tool IN (${tls.map(() => '?').join(',')})`; b.push(...tls);
  }
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
  // 🔴 الفلتر بيتحوّل لحدود UTC بتاعة **اليوم التقويمي بالقاهرة**، مش
  //    `substr(timestamp,1,10)`. الصفوف متخزّنة UTC، والموظف بيفكّر بتوقيت
  //    القاهرة: رفع الساعة ١:٣٠ بالقاهرة متسجّل ٢٢:٣٠ أو ٢٣:٣٠ UTC **اليوم
  //    اللي فات**، فالمقارنة النصّية كانت بتشيله من فلتر «اليوم» — والصف ده هو
  //    الأثر الوحيد على إن الشحنة اتعملت.
  if (dateFrom) { sql += ' AND timestamp >= ?'; b.push(cairoDayBoundsUTC(dateFrom).start); }
  if (dateTo)   { sql += ' AND timestamp <= ?'; b.push(cairoDayBoundsUTC(dateTo).end); }

  return { sql, b };
}

// ⚠️ قائمة **مقفولة** — القيمة جاية من العميل وبتتلزق في نص SQL مباشرةً
//    (ORDER BY مابيقبلش bind). أي قيمة بره القايمة بترجع للافتراضي بدون خطأ.
// ⚠️ المفاتيح لازم تطابق `data-sort-key` في الواجهة **حرفيًا** — مفتاح مش في
//    القايمة بيرجع للافتراضي في صمت، فالعمود يبان إنه اترتّب وهو مااترتّبش.
// 🔴 `Map` مش object literal: البحث في object بيمشي على سلسلة الـ prototype،
//    فـ`sortBy=constructor` كان بيرجّع دالة `Object` وتتلزق في نص SQL →
//    خطأ من D1 و500 — بالظبط عكس «بترجع للافتراضي بدون خطأ» المكتوب فوق.
//    نفس الكلام على `toString` · `valueOf` · `__proto__` · `hasOwnProperty`.
const LOG_SORT_COLUMNS = new Map([
  ['date', 'timestamp'], ['time', 'timestamp'], ['employee', 'employee'],
  ['orderName', 'order_name'], ['type', 'type'],
  ['result', `json_extract(extra, '$.result')`],
]);

function orderByClause(sortBy, sortDir) {
  const col = LOG_SORT_COLUMNS.get(String(sortBy || '')) || 'timestamp';
  const dir = String(sortDir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  // 🔴 كاسر تعادل إلزامي: من غيره صفوف نفس القيمة بترتيب عشوائي بين الصفحات،
  //    والصف الواحد ممكن يظهر في صفحتين **أو مايظهرش خالص**.
  return col === 'timestamp' ? ` ORDER BY timestamp ${dir}`
                             : ` ORDER BY ${col} ${dir}, timestamp DESC`;
}

async function getLogs(db, { limit = 100, offset = 0, sortBy = null, sortDir = null, ...filters } = {}) {
  const { sql, b } = buildLogFilterSQL('SELECT *', filters);
  const q = sql + orderByClause(sortBy, sortDir) + ' LIMIT ? OFFSET ?';
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
  // ⚠️ التصدير والعدّ **بيتجاهلوا الترتيب عن قصد** — العدّ مالوش ترتيب،
  //    والتصدير بياخد ترتيب السيرفر الافتراضي. تمرير sortBy/sortDir ليهم بيفتح
  //    باب اختلاف مصدر الباراميترات بين النداءات = تصدير مش مطابق للشاشة.
  const q = sql + ' ORDER BY timestamp DESC LIMIT ?';
  return (await db.prepare(q).bind(...b, LOG_EXPORT_MAX).all()).results;
}

function logParamsFrom(url, tools) {
  const csv = (k) => (url.searchParams.get(k) || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const employees = csv('employees'), types = csv('types');
  return {
    tools: Array.isArray(tools) ? tools : [tools],
    employees: employees.length ? employees : null,
    employee:  url.searchParams.get('employee') || null,
    types:     types.length ? types : null,
    type:      url.searchParams.get('type')     || null,
    search:    url.searchParams.get('search')   || null,
    dateFrom:  url.searchParams.get('dateFrom') || null,
    dateTo:    url.searchParams.get('dateTo')   || null,
  };
}

// ─── §SHARED::findExportDuplicateStats — مسار الإكسيل ───
// مفتاح التكرار = اسم الأوردر + **اسم الدورة** (v5.3.0 — قرار أحمد). المفتاح
// بالاسم لوحده كان بيقفل أوردر بدورة تانية **شرعية** كـ«مكرر»، فـ`allowRepeat`
// بقى بيتستخدم روتيني والحماية فقدت معناها.
//
// ⚠️ الصفوف القديمة (قبل v5.3.0، مالهاش `cycleName` في `extra`) لا بتتلغي ولا
// بتتحسب على عماها: بتتطابق مع الدورة الحالية **فقط** لو `timestamp >=
// cycle.createdAt` — تصدير حصل قبل ما الدورة توجد مستحيل يكون تصدير ليها.
// مفيش migration.
async function findExportDuplicateStats(db, orders) {
  const byName = new Map();
  for (const order of orders || []) {
    const name = cleanText(order?.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      name,
      cycleName: cleanText(order?.cycleName) || null,
      cycleCreatedAt: cleanText(order?.cycleCreatedAt) || null,
    });
  }
  if (!byName.size) return {};

  const out = {};
  const exportTypePlaceholders = EXPORT_TYPES.map(() => '?').join(',');

  // ٢٠ أوردر لكل استعلام بتخلي عدد الباراميترات تحت سقف D1 بمسافة مريحة
  // (على الأكثر 20 × 3 + 1 + EXPORT_TYPES).
  for (const group of chunks([...byName.values()], 20)) {
    const clauses = [];
    const params = [];

    for (const order of group) {
      if (order.cycleName && order.cycleCreatedAt) {
        clauses.push(`(order_name = ? AND (
          json_extract(extra, '$.cycleName') = ?
          OR (json_extract(extra, '$.cycleName') IS NULL AND timestamp >= ?)
        ))`);
        params.push(order.name, order.cycleName, order.cycleCreatedAt);
      } else {
        // مفيش هوية دورة في الـ payload — نرجع لسلوك ما قبل v5.3.0 بدل ما
        // نقول «ما اتصدّرش قبل كده» في صمت.
        clauses.push('(order_name = ?)');
        params.push(order.name);
      }
    }

    const sql = `
      SELECT order_name, COUNT(*) AS export_count, MAX(timestamp) AS last_export_at
      FROM logs
      WHERE tool = ?
        AND type IN (${exportTypePlaceholders})
        AND (${clauses.join(' OR ')})
      GROUP BY order_name
      ORDER BY last_export_at DESC
    `;

    // ⚠️ `TOOL_NAME_RE` مش `TOOL_NAME` — صفوف التصدير التاريخية (٨٠ صف
    //    `export_exchange`) كلها تحت القيمة دي، وقراءتها من القيمة التانية كانت
    //    هتقول «مفيش تكرار» على أوردر اتصدّر امبارح.
    const rows = (await db.prepare(sql).bind(TOOL_NAME_RE, ...EXPORT_TYPES, ...params).all()).results || [];
    for (const row of rows) {
      if (!row.order_name) continue;
      out[row.order_name] = {
        orderName: row.order_name,
        cycleName: byName.get(row.order_name)?.cycleName || null,
        exportCount: Number(row.export_count || 0),
        lastExportAt: row.last_export_at || null,
      };
    }
  }

  return out;
}

// ─── §SHARED::AUTH_APPS ───
// قايمة بيضاء مقفولة — appId جاي من العميل وجدول logs مشترك بين كل أدوات الستاك.
// ⚠️ الأداة التانية لسه شغّالة بالتوازي أثناء التصفية (MERGE-BRIEF §٨)، فالـ
//    `appId` بتاعها لازم يفضل مقبول — وإلا صفوف الدخول بتاعتها تروح تحت اسم
//    الأداة دي وتاريخ الدخول يتلغبط في نص التصفية.
const AUTH_APPS = new Set([TOOL_NAME, TOOL_NAME_RE]);
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
// والـ userErrors بتبقى [] لأن مفيش payload أصلاً — كود بيفحص userErrors فقط بيقرا ده نجاح.
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
  mfCourier:  metafield(namespace: "custom", key: "courier")                  { value }
  mfTrackS1:  metafield(namespace: "custom", key: "bosta_tracking_number_s1") { value }
  # ⚠️ الميتافيلد القديم — مابيتكتبش من v2.0.0، لكن لسه بيتقرا: الـ ٣٥٦ شحنة اللي
  #    اترفعت قبل الدمج رقمها عايش هنا، وبدون قراءته كلها هتبان «مش مرفوعة».
  mfTrackOld: metafield(namespace: "custom", key: "bosta_tracking_number")    { value }
  lineItems(first: ${LINE_ITEMS}) {
    nodes { currentQuantity sku title variantTitle }
  }
`;

// ─── §SHOPIFY::previousTrackingS1 ───
// 🔴 الجديد **الأول**، والقديم fallback. الترتيب ده مقصود: أوردر اترفع تاني بعد
//    الدمج بيبقى عنده الاتنين، والقيمة الصح هي الجديدة. عكس الترتيب كان بيعرض
//    رقم شحنة قديمة ملغية على أوردر شحنته الحالية شغّالة.
function previousTrackingS1(order) {
  return cleanText(order?.mfTrackS1?.value) || cleanText(order?.mfTrackOld?.value) || null;
}

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
// 'Confirmed + Edit' فيه مسافة و + مع بعض، والاتنين اتأكدوا منفصلين فقط.
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
    // الحارس استشاري — فشله مايوقفش الأداة، لكن بيتعرض
    return { checked: false, reason: e.message };
  }
}

// ─── §SHOPIFY::writeBackToShopify ───
// بعد كل نجاح رفع فقط — الشحنة **موجودة عند بوسطة** لما الدالة دي بتتنده، فأي
// فشل هنا `warning` مش `error` (اللي بينده بيتعامل مع الرمي).
//
// 🔴 الميتافيلد نوعه `number_integer` — `metafieldsSet` بيطلب تطابق النوع بالحرف
//    مع التعريف الحي، واختلافه بيسقّط **النداء كله** بما فيه أي ميتافيلد تاني في
//    نفس النداء. عشان كده بنتحقق `/^\d+$/` قبل الكتابة وبنسقّط الحقل لوحده.
//
// 🔴 الفرق بين النوعين (طلب أحمد، v2.0.0):
//    s1   → `custom.courier = Bosta` + `custom.bosta_tracking_number_s1` + تاج S1
//    R/E  → `custom.bosta_tracking_number_s2` + تاج S2 **فقط**. الكوريَر
//           **بيتتحقق منه** في حارس الدورات قبل الشحنة، ومابيتكتبش: شحنة استرجاع
//           بتسحب من عند العميل، فكتابة الكوريَر هنا معناها إننا بنعيّن مندوب
//           على أوردر مش بتاعنا بدل ما نتأكد إنه بتاعنا أصلًا.
// 🔴 **والاسترجاع بيكتب كمان `custom.status_2_r_e = In-Return`** (v2.3.0 · طلب
//    أحمد). بيتحط في **نفس** النداء بتاع رقم التتبع عن قصد: `metafieldsSet`
//    نداء واحد بيعدّي كله أو يقع كله، فمستحيل يطلع أوردر حالته اتحركت ورقم
//    تتبعه مش مكتوب — أو العكس، وهو اللي بيخلي الموظف يدوّر على شحنة مش
//    موجودة أو يعيد رفع شحنة موجودة بفلوس.
//    ⚠️ الاستبدال **مستثنى** (`job.uploadStatus === null`) — نقلته `Ready`
//    بتحصل عند الطباعة، وتقديمها من هنا بيكسر بوابة الطباعة.
async function writeBackToShopify(env, token, order, trackingNumber, actions, job) {
  const warnings = [];
  const tn = String(trackingNumber ?? '').trim();
  const numericTracking = /^\d+$/.test(tn);
  const trackMf = job.trackingMf;

  const metafields = [];
  if (!job.isRE) {
    metafields.push({
      ownerId: order.id, namespace: 'custom', key: MF_COURIER.key,
      type: MF_COURIER.type, value: COURIER_VALUE,
    });
  }
  if (numericTracking) {
    metafields.push({
      ownerId: order.id, namespace: 'custom', key: trackMf.key,
      type: trackMf.type, value: tn,     // metafieldsSet بياخد value نص دايمًا
    });
  } else {
    warnings.push(`رقم التتبع "${tn}" مش أرقام فقط — الميتافيلد نوعه ${trackMf.type} فما اتكتبش`);
  }
  // 🔴 حالة S2 — استرجاع فقط. `single_line_text_field` بقيمة من **قايمة
  //    الاختيارات** بتاعة التعريف الحي (`In-Return` حرفيًا) — حرف زيادة =
  //    رفض من شوبيفاي بيسقّط النداء كله بما فيه رقم التتبع.
  if (job.uploadStatus) {
    metafields.push({
      ownerId: order.id, namespace: 'custom', key: MF_S2_STATUS.key,
      type: MF_S2_STATUS.type, value: job.uploadStatus,
    });
  }

  if (metafields.length) {
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

    // ③ تأكيد الـ payload — `userErrors:[]` معناها «مفيش اعتراض» مش «اتنفّذت»
    const written = mfRes?.metafields || [];
    const byKey   = new Map(written.map(m => [m.key, m]));

    if (!job.isRE) {
      const courierOk = byKey.get(MF_COURIER.key)?.value === COURIER_VALUE
                     && byKey.get(MF_COURIER.key)?.owner?.id === order.id;
      if (!courierOk) throw new Error('metafieldsSet: شوبيفاي ما أكدتش كتابة custom.courier');
      actions.push(`كتابة custom.courier = ${COURIER_VALUE}`);
    }

    if (numericTracking) {
      if (byKey.get(trackMf.key)?.value !== tn) {
        throw new Error(`metafieldsSet: شوبيفاي ما أكدتش كتابة custom.${trackMf.key}`);
      }
      actions.push(`كتابة custom.${trackMf.key} = ${tn}`);
    }

    // ⚠️ نفس قاعدة ③: `userErrors:[]` معناها «مفيش اعتراض» مش «اتنفّذت». ومن
    //    غير التأكيد ده السجل بيكتب `valueAfter = In-Return` على نقلة ما حصلتش.
    if (job.uploadStatus) {
      if (byKey.get(MF_S2_STATUS.key)?.value !== job.uploadStatus) {
        throw new Error(`metafieldsSet: شوبيفاي ما أكدتش كتابة custom.${MF_S2_STATUS.key}`);
      }
      actions.push(`تحديث الحالة custom.${MF_S2_STATUS.key} = ${job.uploadStatus}`);
    }
  }

  // التاج — `tagsAdd` بيمنع التكرار تلقائيًا، والتاجات حساسة لحالة الحروف
  const MUT_TAG = `
    mutation AddTag($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) { node { id } userErrors { field message } }
    }
  `;
  const tagData = await shopifyGQL(env, token, MUT_TAG, { id: order.id, tags: [job.tag] }, 'tagsAdd');
  const tagRes  = tagData.data?.tagsAdd;
  const tagErrs = tagRes?.userErrors || [];
  if (tagErrs.length) throw new Error('tagsAdd: ' + tagErrs.map(e => e.message).join(' | '));
  if (!tagRes?.node?.id) throw new Error('tagsAdd: شوبيفاي ما أكدتش إضافة التاج');
  actions.push(`إضافة التاج ${job.tag}`);

  return warnings;
}

// ══════════════════════════════════════════════════════════════
// §SHOPIFY-RE — الاسترجاع/الاستبدال (S2)
// كان في `Bosta-Return-Exchange-Exporter` v6.0.0، واتنقل كما هو في الدمج.
// ⚠️ البلوك ده **مايتدمجش** مع بلوك S1 فوقه: مكنة الحالة تانية، الاستعلام تاني،
//    وحساب الفلوس تاني (MERGE-BRIEF §٤).
// ══════════════════════════════════════════════════════════════

// ─── §SHOPIFY-RE::returnCycles ───
// `ecommoda-order-lifecycle` Rule 15 ② — الدورة اللي بتسافر **دلوقتي** هي أحدث
// دورة **مفتوحة**. ممنوع `.some()`/`.flatMap()` على `returns[]` كلها: ده بيجاوب
// «هل ده حصل على الأوردر ده قبل كده؟» — سؤال تاني، وهو الغلط هنا.
// 🔴 ده كان **الباج الأساسي لحد v5.2.0**، مقيس على `#51656`: تلات دورات طلّعت
//    `Return #Items = 3` و`Goods Value = 6300` بدل قطعة واحدة و`1750` — يعني
//    قطع رجعت المخزن خلاص اتشحنت تاني في ملف بوسطة.
function sortedReturnCycles(order) {
  return (order?.returns?.edges || [])
    .map((edge) => edge?.node)
    .filter(Boolean)
    .filter((cycle) => !IGNORED_RETURN_STATUSES.includes(cycle.status))
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

// state-machines.md §2.4 — دورة اتفتحت واللي قبلها لسه مفتوحة.
// `closedAt === null` على دورة أقدم بتتقرا ∞ (لسه مفتوحة)، وعشان كده
// CANCELED/DECLINED بتتشال قبل ما ده يشتغل.
function hasHistoricalOverlap(cycles) {
  return cycles.some((cycle, i) => i > 0 && (
    cycles[i - 1].closedAt === null ||
    String(cycle.createdAt || '') < String(cycles[i - 1].closedAt || '')
  ));
}

// ─── §SHOPIFY-RE::outgoingItems ───
// اللي بيخرج فعليًا من المخزن على الاستبدال.
//
// ⚠️ `return.exchangeLineItems` هو المصدر الصح فقط **مش الكامل**. مقيس حيًا على
// `#53531` و`#53701` (09-09-2026): لما قطعة الاستبدال اللي شوبيفاي عملتها
// تتشال بتعديل أوردر وتتحط واحدة بالإيد — وده روتين لما المقاس/اللون يتغيّر بعد
// حجز الاستبدال — الـ connection بتفضى **نهائيًا**. وشوبيفاي في الـ Admin لسه
// بتطبع «Exchange item for return #X» على السطر المشال، يعني الشاشة والـ API
// بيتناقضوا. النتيجة كانت صف استبدال من غير وصف ولا عدد قطع، و`Goods Value`
// بيرجع لسعر القطعة **الراجعة** (`#53701`: 2600 بدل 2400 — غلط في الفلوس).
//
// مصدر الاسترداد، متحقَّق منه على ٢٥ أوردر بدورة مفتوحة: سطر
// `currentQuantity > 0 && unfulfilledQuantity > 0` هو بالظبط القطعة المستنية
// تتشحن. فاضي على كل استرجاع صافي، وبيطابق `exchangeLineItems` واحد بواحد على
// استبدال سليم، وهو المكان الوحيد اللي القطعة المضافة بالإيد بتبان فيه.
//
// 🔴 الدورة تفضل **الأساس** والاسترداد **fallback مش merge** — الدمج بيعدّ
// القطعة مرتين على استبدال سليم. والاسترداد بيشتغل على الاستبدال فقط: على
// الاسترجاع السطر غير المشحون غالبًا قطعة من الأوردر الأصلي ما اتشحنتش، و
// `TYPE_MISMATCH` بتاع Rule 8 لازم يفضل بيقرا الدورة لوحدها.
function itemsFromCycle(cycle) {
  return (cycle?.exchangeLineItems?.edges || [])
    .flatMap((edge) => {
      const qty = edge?.node?.quantity || 1;
      return (edge?.node?.lineItems || []).map((li) => ({
        label: cleanText(li?.sku) || cleanText(li?.name) || null,
        qty,
        unitPrice: parseFloat(li?.originalUnitPriceSet?.shopMoney?.amount || 0) || 0,
      }));
    })
    .filter((row) => !!row.label);
}

function itemsFromUnfulfilledLines(order) {
  return (order?.lineItems?.edges || [])
    .map((edge) => edge?.node)
    .filter(Boolean)
    // `currentQuantity > 0` بتشيل السطر اللي التعديل شاله، و`unfulfilledQuantity
    // > 0` بتشيل اللي اتسلّم خلاص. الاتنين مطلوبين: السطر المشال بيحتفظ بـ
    // `quantity` الأصلية، والاتنين دول فقط هما اللي بينزلوا صفر.
    .filter((node) => (node.currentQuantity || 0) > 0 && (node.unfulfilledQuantity || 0) > 0)
    .map((node) => ({
      label: cleanText(node.sku) || cleanText(node.name) || null,
      qty: node.unfulfilledQuantity,
      unitPrice: parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0) || 0,
    }))
    .filter((row) => !!row.label);
}

function resolveOutgoingItems(order, cycle, jobType) {
  const fromCycle = itemsFromCycle(cycle);
  if (fromCycle.length) return { items: fromCycle, source: 'cycle' };
  if (jobType !== JOB_EXCHANGE) return { items: [], source: 'none' };

  const recovered = itemsFromUnfulfilledLines(order);
  if (recovered.length) return { items: recovered, source: 'order_unfulfilled' };
  return { items: [], source: 'none' };
}

// ─── §SHOPIFY-RE::analyzeReturnCycles ───
// Rule 13 / Rule 14 — كل كود شايل: إيه الغلط، القيمة الغلط، والإجراء اللي
// بيحلّها. الأكواد الحاجبة بتوقف الصف؛ الباقي تحذير: بيحرّك صفر صف وبيغيّر
// صفر رقم (flag it, never move it).
function analyzeReturnCycles(order, jobType) {
  const cycles = sortedReturnCycles(order);
  const openCycles = cycles.filter((cycle) => cycle.status !== 'CLOSED');
  const truncated = !!order?.returns?.pageInfo?.hasNextPage;
  const current = openCycles.length ? openCycles[openCycles.length - 1] : null;
  const warnings = [];

  let blockReason = null;
  if (truncated) {
    blockReason = {
      code: 'CYCLES_TRUNCATED',
      value: `> ${RETURNS_PAGE_SIZE} دورة`,
      action: `الأوردر فيه أكتر من ${RETURNS_PAGE_SIZE} دورة إرجاع — مش قادرين نحدد الدورة المفتوحة بثقة. راجعه يدوي في شوبيفاي.`,
    };
  } else if (!openCycles.length) {
    blockReason = {
      code: 'NO_OPEN_CYCLE',
      value: cleanText(order?.s2Status?.value),
      action: 'الـ S2 بيقول فيه طلب استرجاع/استبدال لكن مفيش ولا دورة مفتوحة في شوبيفاي — خدمة العملاء تفتح الدورة أو تصلّح الـ S2.',
    };
  } else if (openCycles.length > 1) {
    blockReason = {
      code: 'CYCLE_OVERLAP_OPEN',
      value: openCycles.map((cycle) => cycle.name).join(' · '),
      action: 'أكتر من دورة مفتوحة في نفس الوقت — مش قادرين نعرف أنهي دورة اللي هتتشحن. خدمة العملاء تقفل الزيادة في شوبيفاي (قاعدة: دورة مفتوحة واحدة فقط).',
    };
  }

  if (!blockReason && hasHistoricalOverlap(cycles)) {
    warnings.push({
      code: 'CYCLE_OVERLAP',
      value: cycles.map((cycle) => cycle.name).join(' · '),
      action: 'دورة اتفتحت قبل ما اللي قبلها تقفل — اتحلّت دلوقتي، لكن تستاهل مراجعة من خدمة العملاء.',
    });
  }

  if (cycles.length > 1) {
    warnings.push({
      code: 'MULTI_CYCLE',
      value: `${cycles.length} دورات`,
      action: 'دورات متتابعة — قانونية. الرفع بيتم من الدورة المفتوحة فقط، والدورات المقفولة مش داخلة.',
    });
  }

  // Rule 8 فاضل متثبّت على **الدورة**: استرجاع-ولا-استبدال بيتجاوب من
  // `exchangeLineItems`، ومصدر الاسترداد بتاع v5.5.0 ممنوع يعيد تصنيف أوردر.
  const outgoing = resolveOutgoingItems(order, current, jobType);

  if (current) {
    const exchangeCount = (current.exchangeLineItems?.edges || []).length;
    if (jobType === JOB_RETURN && exchangeCount > 0) {
      warnings.push({
        code: 'TYPE_MISMATCH',
        value: `S2 = ${cleanText(order?.s2Status?.value)} · الدورة فيها قطع استبدال`,
        action: 'الـ S2 بيقول استرجاع لكن الدورة المفتوحة فيها قطع استبدال — راجع نوع العملية قبل الرفع على بوسطة.',
      });
    }

    if (jobType === JOB_EXCHANGE && outgoing.source === 'order_unfulfilled') {
      warnings.push({
        code: 'EXCHANGE_ITEMS_RECOVERED',
        value: outgoing.items.map((row) => `${row.label} x${row.qty}`).join(' | '),
        action: 'الدورة المفتوحة مالهاش قطع استبدال في شوبيفاي — القطع الخارجة اتقروا من سطور الأوردر اللي لسه ما اتشحنتش (غالبًا اتعدّلت بالإيد بعد فتح الاستبدال). راجع الوصف قبل الرفع، وخدمة العملاء تظبّط الاستبدال في شوبيفاي.',
      });
    }

    // 🔴 حاجب (كان تحذير لحد v5.5.0) — قرار أحمد 09-09-2026. صف بوسطة من غير
    // ولا قطعة خارجة مش شحنة أصلًا: المندوب بيستلم بلا وصف ولا عدد، و
    // `Goods Value` بيتسلّف من القطعة الراجعة.
    if (jobType === JOB_EXCHANGE && !outgoing.items.length && !blockReason) {
      blockReason = {
        code: 'EXCHANGE_WITHOUT_ITEMS',
        value: `S2 = ${cleanText(order?.s2Status?.value)} · مفيش ولا قطعة خارجة`,
        action: 'الـ S2 بيقول استبدال لكن مفيش قطع استبدال في الدورة ولا سطر لسه ما اتشحنش في الأوردر — مش عارفين هيتشحن للعميل إيه. خدمة العملاء تضيف قطعة الاستبدال في شوبيفاي أو تصلّح الـ S2.',
      };
    }
  }

  return {
    current,
    outgoing,
    info: {
      totalCycles: cycles.length,
      openCycles: openCycles.length,
      currentCycleName: current?.name || null,
      truncated,
      blocked: !!blockReason,
      blockReason,
      warnings,
      outgoingSource: outgoing.source,
    },
  };
}

// ─── §SHOPIFY-RE::discoveryAndDetails ───
// استعلام واحد للنوعين: الاسترجاع لسه محتاج `exchangeLineItems` عشان
// `TYPE_MISMATCH` (Rule 8)، والاستبدال لسه محتاج `returnLineItems` للقطع الراجعة.
function buildReDetailsQuery() {
  return `
    query FetchReDetails($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id
          legacyResourceId
          name
          phone
          note
          createdAt
          tags
          displayFinancialStatus
          displayFulfillmentStatus
          totalOutstandingSet { shopMoney { amount currencyCode } }
          shippingAddress {
            name firstName lastName phone
            address1 address2 city province provinceCode zip
          }
          customer { firstName lastName email phone }
          s2Status:  metafield(namespace: "custom", key: "status_2_r_e")             { value }
          courier:   metafield(namespace: "custom", key: "courier")                  { value }
          mfTrackS2: metafield(namespace: "custom", key: "bosta_tracking_number_s2") { value }
          # مصدر استرداد القطع الخارجة — §SHOPIFY-RE::outgoingItems
          lineItems(first: ${ORDER_LINE_ITEMS_PAGE_SIZE}) {
            edges {
              node {
                sku name currentQuantity unfulfilledQuantity
                originalUnitPriceSet { shopMoney { amount } }
              }
            }
          }
          returns(first: ${RETURNS_PAGE_SIZE}) {
            pageInfo { hasNextPage }
            edges {
              node {
                name status createdAt closedAt
                returnLineItems(first: 25) {
                  edges {
                    node {
                      quantity
                      ... on ReturnLineItem {
                        fulfillmentLineItem {
                          lineItem { sku name originalUnitPriceSet { shopMoney { amount } } }
                        }
                      }
                    }
                  }
                }
                exchangeLineItems(first: 25) {
                  edges {
                    node {
                      quantity
                      lineItems { sku name originalUnitPriceSet { shopMoney { amount } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

// 🔴 `metafields.custom.KEY:"value"` بنقطة واحدة. النقطتين بتتحوّل بصمت لبحث
//    نصي كامل على المتجر كله.
function reCandidateQuery(expectedStatus) {
  return `metafields.custom.status_2_r_e:${JSON.stringify(String(expectedStatus))} `
       + `AND metafields.custom.courier:${COURIER_VALUE}`;
}

async function fetchReDiscovery(env, token, job) {
  const candidates = [];
  let cursor = null, hasNextPage = true, page = 0;
  const search = reCandidateQuery(job.expectedStatus);

  const query = `
    query FetchReCandidateIds($search: String!, $cursor: String) {
      orders(first: ${DISCOVERY_PAGE_SIZE}, after: $cursor, query: $search, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id name
            s2Status: metafield(namespace: "custom", key: "status_2_r_e") { value }
            courier:  metafield(namespace: "custom", key: "courier")      { value }
          }
        }
      }
    }
  `;

  while (hasNextPage && page < DISCOVERY_MAX_PAGES) {
    page += 1;
    const data = await shopifyGQL(env, token, query, { search, cursor }, 'fetchReDiscovery');
    const conn = data?.data?.orders;
    if (!conn?.edges) throw new Error('fetchReDiscovery: شوبيفاي ردّت من غير orders');

    for (const edge of conn.edges) {
      const order = edge.node;
      const directStatus = cleanText(order?.s2Status?.value);
      const courier = cleanText(order?.courier?.value);
      // 🔴 إعادة الفحص على القيمة نفسها مقصودة — فلتر `metafields.custom.…`
      //    ممكن يوسّع النتيجة، والقيمة اللي بترجع هي الحقيقة.
      if (directStatus === job.expectedStatus && courier.toLowerCase() === COURIER_VALUE.toLowerCase()) {
        candidates.push({ id: order.id, name: order.name });
      }
    }
    hasNextPage = !!conn.pageInfo?.hasNextPage;
    cursor = conn.pageInfo?.endCursor || null;
  }

  return {
    candidates,
    pageInfo: {
      pagesFetched: page,
      stoppedByLimit: hasNextPage && page >= DISCOVERY_MAX_PAGES,
      searchQuery: search,
      pageSize: DISCOVERY_PAGE_SIZE,
      maxPages: DISCOVERY_MAX_PAGES,
    },
  };
}

// سقف تكلفة الاستعلام عند شوبيفاي بيترفض الدفعة كلها؛ التقسيم نُصّين وإعادة
// المحاولة بترجّع الصفوف بدل ما الشاشة تفضى.
async function fetchNodesWithCostFallback(env, token, query, ids, opName = 'fetchNodes') {
  if (!ids.length) return [];
  try {
    const data = await shopifyGQL(env, token, query, { ids }, opName);
    return (data?.data?.nodes || []).filter(Boolean);
  } catch (err) {
    if (!isShopifyCostError(err) || ids.length === 1) throw err;
    const mid = Math.ceil(ids.length / 2);
    const left  = await fetchNodesWithCostFallback(env, token, query, ids.slice(0, mid), opName);
    const right = await fetchNodesWithCostFallback(env, token, query, ids.slice(mid), opName);
    return [...left, ...right];
  }
}

// ─── §SHOPIFY-RE::assertCyclesConfirmable ───
// `ecommoda-order-lifecycle` Rule 15 ① — «reject + log، مش سماح صامت».
// 🔴 الحارس ده واقف قدام **الشحنة** مش قدام الميتافيلد، وبيتعاد على القراءة
//    الكاملة قبل أول نداء لبوسطة. مودال الواجهة مش البوابة الوحيدة.
async function findBlockedCycleOrders(env, token, orders, jobType) {
  const query = `
    query FetchReCycleGuard($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id name
          s2Status: metafield(namespace: "custom", key: "status_2_r_e") { value }
          courier:  metafield(namespace: "custom", key: "courier")      { value }
          # الأسعار **مش** بتتجاب هنا عن قصد: الحارس بيسأل «فيه حاجة خارجة؟»
          # مش «بتساوي كام». نتيجة resolveOutgoingItems بتتقرا بـ .length وتترمي.
          lineItems(first: ${ORDER_LINE_ITEMS_PAGE_SIZE}) {
            edges { node { sku name currentQuantity unfulfilledQuantity } }
          }
          returns(first: ${RETURNS_PAGE_SIZE}) {
            pageInfo { hasNextPage }
            edges {
              node {
                name status createdAt closedAt
                exchangeLineItems(first: 25) { edges { node { quantity lineItems { sku name } } } }
              }
            }
          }
        }
      }
    }
  `;

  const blocked = [];
  const seen = new Set();

  for (const group of chunks(orders.map((o) => o.id), CYCLE_GUARD_BATCH_SIZE)) {
    for (const order of await fetchNodesWithCostFallback(env, token, query, group, 'cycleGuard')) {
      seen.add(order.id);
      const { info } = analyzeReturnCycles(order, jobType);
      if (info.blocked) {
        blocked.push({
          id: order.id, name: order.name,
          s2Status: cleanText(order?.s2Status?.value) || null,
          code: info.blockReason.code, value: info.blockReason.value, action: info.blockReason.action,
        });
        continue;
      }
      // 🔴 طلب أحمد مع الدمج: في R/E **مابنكتبش** `custom.courier` — بنتأكد إنه
      //    Bosta بالفعل. الفلتر بيعمل ده وقت الفحص، والحارس بيعيده وقت الرفع:
      //    كوريَر اتغيّر بين الاتنين معناه إننا هنبعت مندوب بوسطة يسحب قطعة
      //    مركبة على مندوب تاني.
      const courier = cleanText(order?.courier?.value);
      if (courier.toLowerCase() !== COURIER_VALUE.toLowerCase()) {
        blocked.push({
          id: order.id, name: order.name,
          s2Status: cleanText(order?.s2Status?.value) || null,
          code: 'COURIER_NOT_BOSTA',
          value: courier || '(فاضي)',
          action: `الكوريَر على الأوردر ده مش ${COURIER_VALUE} — الرفع اتوقف. الأداة دي مابتكتبش `
                + `custom.courier على الاسترجاع/الاستبدال، فلازم يكون متظبّط صح قبل الرفع.`,
        });
      }
    }
  }

  // أوردر شوبيفاي ما رجّعتهوش **مش** بيتعامل كأنه تمام — `worker-builder`
  // Step 5A ④: «ما قدرناش نتأكد» عمرها ما تبقى «نجاح».
  for (const order of orders) {
    if (seen.has(order.id)) continue;
    blocked.push({
      id: order.id, name: order.name, s2Status: order.s2Status || null,
      code: 'ORDER_NOT_READABLE', value: order.id,
      action: 'شوبيفاي ما رجّعتش الأوردر ده وقت فحص الدورات — ما قدرناش نتأكد، فاتمنع التحديث. جرّب تاني أو راجعه يدوي.',
    });
  }

  return blocked;
}

// Rule 15 ① / Rule 10 — «reject + log». صف لكل أوردر مرفوض، بيتكتب **قبل** ما
// الـ 409 يرجع. فشل D1 مابيلغيش الرفض، لكن لازم يبان: `logged: false` مش صمت.
async function logCycleBlocks(db, blocked, job, employee, { action = 'الرفع' } = {}) {
  if (!blocked.length) return { logged: true, logError: null };
  const now = new Date().toISOString();
  try {
    await writeLogsBatch(db, blocked.map((row) => ({
      timestamp: now,
      tool: job.tool,
      type: CYCLE_BLOCK_TYPE,
      employee,
      orderId: row.id,
      orderName: row.name,
      // الكتابة اللي **ما حصلتش** — before و after نفس القيمة عن قصد: مفيش حاجة اتحركت.
      valueBefore: row.s2Status || job.expectedStatus,
      valueAfter:  row.s2Status || job.expectedStatus,
      // ⚠️ الحالة التالية بتتكتب **فقط لو فيه نقلة اتمنعت فعلًا**: مسار
      //    الإكسيل (`job.nextStatus`) دايمًا، والرفع **فقط لما الوضع بيحرّك
      //    حالة أصلًا** (الاسترجاع من v2.3.0 → `In-Return`). في الشحن العادي
      //    والاستبدال بتفضل `null`: كتابة «اتمنع التحديث إلى Ready» على وقفة
      //    رفع بتخلي اللي بيقرا السجل يفتكر إن فيه نقلة اتمنعت وهي أصلًا
      //    مابتحصلش في الرفع.
      notes: `اتمنع ${action} — ${row.code}: ${row.value}`,
      extra: {
        jobType: job.jobType,
        expectedStatus: job.expectedStatus,
        blockedAction: action,
        blockedNextStatus: action === 'الرفع' ? (job.uploadStatus || null) : job.nextStatus,
        code: row.code, value: row.value, action: row.action,
      },
    })));
    return { logged: true, logError: null };
  } catch (e) {
    return { logged: false, logError: e.message };
  }
}

// ─── §SHOPIFY-RE::writeAndVerifyS2 ───
// كل أوردر بيكتب ميتافيلدين: `custom.status_2_r_e` و`custom.printing_time_s2`.
// ١٢ أوردر في الدفعة = ٢٤ ميتافيلد — سقف `metafieldsSet` هو ٢٥.
async function setS2Status(env, token, orders, newValue, printingTimeS2) {
  const updated = [];
  const mutation = `
    mutation SetS2AndPrintingTime($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key value owner { ... on Order { id name } } }
        userErrors { field message code }
      }
    }
  `;
  for (const group of chunks(orders, 12)) {
    const variables = {
      metafields: group.flatMap((order) => ([
        { ownerId: order.id, namespace: 'custom', key: MF_S2_STATUS.key,   type: MF_S2_STATUS.type,   value: newValue },
        { ownerId: order.id, namespace: 'custom', key: MF_PRINTING_S2.key, type: MF_PRINTING_S2.type, value: printingTimeS2 },
      ])),
    };
    const data = await shopifyGQL(env, token, mutation, variables, 'setS2Status');
    const result = data?.data?.metafieldsSet;
    if (result?.userErrors?.length) {
      throw new Error('metafieldsSet: ' + result.userErrors
        .map(e => `${e.field?.join('.') || 'field'}: ${e.message}`).join(' | '));
    }
    updated.push(...(result?.metafields || []));
  }
  return updated;
}

// ③ التحقق — `userErrors:[]` معناها «مفيش اعتراض» مش «اتنفّذت».
async function verifyS2Status(env, token, orders, expectedValue, expectedPrintingTimeS2) {
  const query = `
    query VerifyS2AndPrintingTime($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id name
          s2Status:      metafield(namespace: "custom", key: "status_2_r_e")     { value }
          printingTimeS2: metafield(namespace: "custom", key: "printing_time_s2") { value }
        }
      }
    }
  `;
  const mismatches = [];
  const expectedPrintingMs = Date.parse(expectedPrintingTimeS2);

  for (const group of chunks(orders, 100)) {
    const data = await shopifyGQL(env, token, query, { ids: group.map(o => o.id) }, 'verifyS2Status');
    for (const node of (data?.data?.nodes || [])) {
      if (!node?.id) continue;
      const value = cleanText(node?.s2Status?.value);
      const printingTimeS2 = cleanText(node?.printingTimeS2?.value);
      const actualPrintingMs = Date.parse(printingTimeS2);
      const printingTimeMatches =
        Number.isFinite(expectedPrintingMs) &&
        Number.isFinite(actualPrintingMs) &&
        actualPrintingMs === expectedPrintingMs;
      if (value !== expectedValue || !printingTimeMatches) {
        mismatches.push({ id: node.id, name: node.name, value, printingTimeS2 });
      }
    }
  }
  return mismatches;
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
  } catch { /* الكاش مش مصدر حقيقة — الفشل هنا بيعيد الجلب فقط */ }
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
                       : Array.isArray(c?.zones) ? c.zones.flatMap(z => (z?.districts || []).map(d => ({ ...d, zoneId: z?._id || z?.zoneId, zoneName: z?.name, zoneOtherName: z?.otherName || z?.nameAr })))
                       : [];
    const districts = [];
    for (const d of rawDistricts) {
      const id = d?._id || d?.districtId || d?.id || null;
      if (!id) continue;
      districts.push({
        id,
        name:   d?.districtName || d?.name || '',
        nameAr: d?.districtOtherName || d?.otherName || d?.nameAr || '',
        // 🔴 `zoneId` هو **مفتاح درجة الزون** في الرفع (`bosta-api-helper` 8.10.4).
        //    قبل v2.1.0 كان الاسم فقط بيتخزّن، فدرجة الزون كانت مستحيلة أصلًا —
        //    والأوردر اللي مالوش مطابقة منطقة كان بينزل للمحافظة على طول وياخد
        //    **هب افتراضي** بدل هب الزون (مقيس بمقارنة بوليصتين — 8.10.2).
        zoneId: d?.zoneId || d?.zone?._id || null,
        zone:   d?.zoneName || d?.zone?.name || '',
        zoneAr: d?.zoneOtherName || d?.zone?.otherName || '',
        dropOff: d?.dropOffAvailability,
        // 🟡 موثّق في الكتالوج 14-09-2026 · **أثره ما اتجربش حيًا** (السؤال ٩ في
        //    قايمة التجارب المفتوحة). الأداة بتبعت `SMALL` دايمًا فهو مالوش أثر
        //    دلوقتي — بيتخزّن عشان أي أداة بتبعت `Light/Heavy Bulky` تلاقيه.
        bulkyBlocked: d?.notAllowedBulkyOrders === true,
      });
    }
    // 🟡 `dropOffAvailability` موجود على مستوى **المدينة** كمان مش المنطقة فقط
    //    (`bosta-api-helper` 8.6) — فحص أرخص بيقفل حالات كاملة قبل اللفّ على
    //    مناطق المدينة (الجيزة لوحدها ٣٣١ منطقة).
    if (cityId) out.push({ cityId, cityName, cityAr, cityDropOff: c?.dropOffAvailability, districts });
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
// 🔴 القاعدة **طبقتين مش واحدة** (`bosta-api-helper` 8.11، v4.0.0):
//      المطابقة والإرسال → المنطقة المقفولة **متتبعتش أبدًا**  → `list`
//      واجهة الموظف      → **تتعرض ومعلّمة إنها مقفولة**       → `blocked`
//    `dropOffAvailability === false` معناها بوسطة **مش بتسلّم هناك أصلًا** — دي
//    خارج التغطية، مش «مش متاحة دلوقتي». الإخفاء الصامت (اللي كان هنا لحد
//    v2.0.1) بيخلّي الموظف يشوف ٧ مناطق بدل ٩ ويضغط «ارفع على المحافظة فقط» وهو
//    فاكرها مسار احتياطي سليم — والشحنة بتتشحن بفلوس وترجع بعد أيام بـ
//    *outside Bosta's delivery coverage area*. المسار الصح إن الأوردر
//    **مايترفعش** ويتحوّل لخدمة العملاء (عنوان بديل · كوريَر تاني · إلغاء).
// ⚠️ لو الحقل غايب من الكتالوج كله، الفلترة هتفضّي القايمة — والحالة دي بتتبلّغ
//    في diag وفي رد get_orders بدل ما تتحول لـ"مفيش مطابقة" صامتة.
function availableDistricts(city) {
  if (!city) return { list: [], blocked: [], fieldMissing: false };
  const withField = city.districts.filter(d => d.dropOff !== undefined);
  const fieldMissing = city.districts.length > 0 && withField.length === 0;
  const list    = fieldMissing ? [] : city.districts.filter(d => d.dropOff === true);
  const blocked = fieldMissing ? [] : city.districts.filter(d => d.dropOff === false);
  return { list, blocked, fieldMissing };
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
    c.zoneIndex = buildZoneIndex(c);
  }
  catalog._normalized = true;
  return catalog;
}

// ─── §BOSTA::buildZoneIndex ───
// فهرس الزونات لكل مدينة. الزون هو المستوى فوق المنطقة (مدينة ← زون ← منطقة)،
// وهو **الاسم اللي العميل بيكتبه فعلًا** لما اسم المنطقة تسمية إدارية مركّبة:
//   العنوان: "العبور الحي الخامس بلوك ١٦٠٢٧"
//   المناطق: "المنطقة 01 (العبور)" · "دار مصر - العبور" · "احياء العبور الجديده"
//   الزون  : "العبور"  ← ده اللي بيطابق
// متحقَّق حيًا 07-09-2026: تغطية الزون ١٠٠٪ (القاهرة 590/590 · القليوبية 207/207).
function buildZoneIndex(city) {
  const byKey = new Map();
  for (const d of city.districts) {
    if (d.dropOff !== true) continue;          // نفس فلتر availableDistricts
    const en = (d.zone || '').trim(), ar = (d.zoneAr || '').trim();
    if (!en && !ar) continue;
    const key = normText(en) + '|' + normText(ar);
    let z = byKey.get(key);
    if (!z) {
      // 🔴 `zoneId` هو اللي بيترفع فعلًا (8.10.4) — الاسم للعرض فقط. زون من غير
      //    `id` **مايترفعش** عليه (بيفضل اقتراح واجهة)، عشان مانخمّنش مفتاح.
      z = { zone: en, zoneAr: ar, zoneId: d.zoneId || null,
            nameN: normText(en), nameArN: normText(ar), count: 0 };
      // زون اسمه اسم المدينة نفسها = معلومة شبه صفرية، زي المنطقة العامّة
      z.generic = (!!z.nameN   && (z.nameN   === city.cityNameN || z.nameN   === city.cityArN))
               || (!!z.nameArN && (z.nameArN === city.cityNameN || z.nameArN === city.cityArN));
      byKey.set(key, z);
    }
    if (!z.zoneId && d.zoneId) z.zoneId = d.zoneId;
    z.count++;
  }
  return [...byKey.values()];
}

// ─── §BOSTA::matchZonesIn ───
// نفس ترجيح المناطق بالظبط — الفرق إن النتيجة **زون مش منطقة**، يعني بتحسم
// المدينة ومابتحسمش المنطقة. الزون فيه مناطق كتير، فاختيار واحدة منها تخمين.
function matchZonesIn(city, fields) {
  const best = new Map();
  for (const f of fields) {
    const ftext = f.textN;
    if (!ftext) continue;
    for (const z of (city.zoneIndex || [])) {
      for (const n of [z.nameN, z.nameArN]) {
        if (!n || n.length < 3 || !ftext.includes(n)) continue;
        const hit = {
          zone: z.zone, zoneAr: z.zoneAr, zoneId: z.zoneId || null, count: z.count,
          tier: f.tier, field: f.key, fieldLabel: f.label,
          matched: n, matchedText: n === z.nameArN ? z.zoneAr : z.zone,
          exact: ftext === n, generic: !!z.generic,
        };
        const key = z.nameN + '|' + z.nameArN;
        const prev = best.get(key);
        if (!prev || betterHit(hit, prev) < 0) best.set(key, hit);
        break;
      }
    }
  }
  return [...best.values()].sort(betterHit);
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
//   ④ الأطول يغلب **فقط لو الأقصر جوّه الأطول** — "مدينة نصر" تغلب "نصر"
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
// ⚠️ `sourceList` بيسمح بمطابقة **المقفولة** بنفس الترجيح بالظبط (8.11) — من
//    غير ده كنا هنحتاج نسخة تانية من المنطق، ونسختين بيفترقوا = قرار مدينة
//    مختلف في شاشتين (نفس سبب قاعدة «محرك واحد» في 8.6a).
function matchDistrictsIn(city, fields, zoneOnly, sourceList) {
  const { list, fieldMissing } = availableDistricts(city);
  const source = sourceList || list;
  if (!source.length || !fields.length) return { hits: [], fieldMissing };

  let pool = source;
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
function matchDistrict(city, fields, zoneOnly, sourceList) {
  const { hits, fieldMissing } = matchDistrictsIn(city, fields, zoneOnly, sourceList);
  if (!hits.length) return { matches: [], fieldMissing };
  const top = hits[0];
  const matches = hits.filter(h => h === top || !dominates(top, h));
  return { matches, fieldMissing };
}

// ─── §BOSTA::findCrossCity ───
// 🟠 كاشف «المدينة مشكوك فيها» — بيشتغل **فقط** لما مفيش مطابقة جوّه المدينة
//    المحسوبة من الجدول. بيدوّر على اسم المنطقة في كتالوج بوسطة كله.
//
// ليه أصلًا: تصنيف بوسطة مش التقسيم الإداري (العبور إداريًا القليوبية وعند
// بوسطة تحت القاهرة)، وكمان العميل بيغلط في اختيار المحافظة (شبين الكوم على
// الغربية · دمياط الجديدة على القاهرة). الحالتين بيدّوا نفس العرض، والنتيجة
// **مش** «منطقة ناقصة» — دي **مدينة غلط**، يعني فرع وتسعيرة غلط.
//
// 🔴 اقتراح فقط — **ممنوع** التطبيق التلقائي. أسماء المناطق بتتكرر بين
//    المحافظات، وتحويل مدينة الشحنة تلقائيًا على مطابقة نصية = نفس الفخ اللي
//    جدول المحافظات المقفول اتكتب عشان يمنعه.
const CROSS_MIN_LEN      = 4;   // أقصر من كده بيلقّط ضوضاء
const CROSS_MAX_HITS     = 8;
const CROSS_MAX_PER_CITY = 3;   // ٨ اقتراحات كلها من مدينة واحدة ضوضاء مش مساعدة

function findCrossCity(catalog, fields, skipCityId) {
  const out = [];
  for (const c of catalog.cities) {
    if (c.cityId === skipCityId) continue;

    // ① مطابقة منطقة — بتحسم المدينة **والمنطقة** مع بعض
    const { hits } = matchDistrictsIn(c, fields, null);
    let taken = 0;
    for (const h of hits) {
      if (h.matched.length < CROSS_MIN_LEN || h.generic) continue;
      if (++taken > CROSS_MAX_PER_CITY) break;
      out.push({
        kind: 'district',
        // 🔤 الاسم العربي بيترجع جنب الإنجليزي **مش بدله** — الواجهة بتعرض
        //    العربي والـ payload بيبعت الإنجليزي (`districtId` فعليًا)، فالاتنين
        //    لازم يفضلوا موجودين في نفس الصف.
        cityId: c.cityId, cityName: c.cityName, cityNameAr: c.cityAr || '',
        districtId: h.id, districtName: h.name, districtNameAr: h.nameAr, zone: h.zone,
        matchedText: h.matchedText, fieldLabel: h.fieldLabel,
        _rank: [h.tier, h.exact ? 0 : 1, -h.matched.length],
      });
    }

    // ② مطابقة زون — بتحسم **المدينة فقط**. دي اللي بتلقط العبور: اسم المنطقة
    //    عند بوسطة "المنطقة 01 (العبور)" ومحدش بيكتبها، لكن الزون "العبور"
    //    هو نفسه اللي العميل كاتبه.
    let takenZ = 0;
    for (const z of matchZonesIn(c, fields)) {
      if (z.matched.length < CROSS_MIN_LEN || z.generic) continue;
      // الزون اللي مناطقه اتلقطت فوق مايتكررش كاقتراح منفصل
      if (out.some(o => o.cityId === c.cityId && normText(o.zone || '') === normText(z.zone))) continue;
      if (++takenZ > CROSS_MAX_PER_CITY) break;
      out.push({
        kind: 'zone',
        cityId: c.cityId, cityName: c.cityName, cityNameAr: c.cityAr || '',
        zone: z.zone, zoneAr: z.zoneAr, zoneId: z.zoneId || null, districtCount: z.count,
        matchedText: z.matchedText, fieldLabel: z.fieldLabel,
        // الزون بيترتّب جنب المناطق بنفس المفتاح — مافيش أفضلية لنوع على التاني،
        // الأخصّية هي اللي بتحكم
        _rank: [z.tier, z.exact ? 0 : 1, -z.matched.length],
      });
    }
  }
  out.sort((a, b) => {
    for (let i = 0; i < 3; i++) if (a._rank[i] !== b._rank[i]) return a._rank[i] - b._rank[i];
    return 0;
  });
  return out.slice(0, CROSS_MAX_HITS).map(({ _rank, ...rest }) => rest);
}

// ─── §BOSTA::findLocalZones ───
// نفس الفكرة فقط **جوّه المدينة الصح**: العنوان مطابقش أي منطقة، لكن مطابق زون.
// المدينة هنا مش غلط — الفايدة إن الموظف يفتح النافذة ويلاقي القايمة مقصورة
// على مناطق الزون ده (٧ مناطق بدل ٥٩٠) بدل ما يدوّر.
function findLocalZones(city, fields) {
  // 🔴 المدينة ممكن تبقى `null` لو cityId بتاع الجدول مش في الكتالوج الحي.
  //    من غير الحارس ده الدالة بترمي، والاستثناء بيطلع من `get_orders` /
  //    `fetch_candidates` **كله** — أوردر واحد بيوقّع القايمة كلها.
  if (!city) return [];
  return matchZonesIn(city, fields)
    .filter(z => z.matched.length >= CROSS_MIN_LEN && !z.generic)
    .slice(0, CROSS_MAX_PER_CITY)
    .map(z => ({
      kind: 'zone', cityId: city.cityId, cityName: city.cityName, cityNameAr: city.cityAr || '',
      zone: z.zone, zoneAr: z.zoneAr, zoneId: z.zoneId || null, districtCount: z.count,
      matchedText: z.matchedText, fieldLabel: z.fieldLabel,
    }));
}

// ─── §BOSTA::findAddressAnchor ───
// 🔍 «المرساة» — كلمة **واحدة** من العنوان موجودة جوّه اسم منطقة **واحدة بس**
//    في المحافظة دي. دي **مش** مطابقة ومش اقتراح منطقة: دي **نص بحث** الواجهة
//    بتفتح بيه خانة البحث في نافذة اختيار المنطقة، عشان الموظف يلاقي الصف
//    قدامه بدل ما يدوّر في ٢٢١ منطقة (الإسكندرية) أو ٥٩٠ (القاهرة).
//
// 🔴 ليه أصلًا: محرك المطابقة بيسأل «هل العنوان فيه اسم المنطقة **كاملًا**؟»
//    وده حدّه المعروف (SPEC §٥.٤.١). مقيس على `#55065`: العميل كتب
//    «الكينج مريوط» والمنطقة عند بوسطة اسمها «كنج مريوط» — **فرق حرف واحد**
//    (ي)، فالمطابقة فشلت والصف نزل «المحافظة فقط». وكلمة «مريوط» لوحدها
//    موجودة في اسم منطقة **واحدة بالظبط** في الإسكندرية، وهي كل اللي الموظف
//    كان محتاجه عشان يوصل — وهو فعلًا كتبها بإيده.
//
// 🔴 **مابيغيّرش أي حاجة في القرار.** مابيلمسش `mode` ولا `districtId` ولا
//    `uploadable` ولا الـ payload: الصف بيفضل «🏙️ المحافظة فقط» وموقوف لحد
//    التأكيد اليدوي زي ما هو بالظبط، والفرق الوحيد إن خانة البحث بتفتح مليانة.
//    ده مقصود — «ضغطة واحدة تظبّط المكان» على صف سليم هي بالظبط اللي كانت
//    هتنقل `#54863` لمحافظة غلط (v2.4.0)، فالمرساة **بتختصر البحث، مش القرار**.
//
// 🔴 **شرط الفرادة هو الحارس الوحيد، وهو بيصين نفسه.** كلمة موجودة في أكتر من
//    منطقة (`كفر` · `ميت` · `نجع` · `مدينة`) بتسقط لوحدها من غير قايمة استبعاد
//    محتاجة صيانة — وكل ما المحافظة تكبر، الشرط يبقى **أصعب** مش أسهل.
//
// ⚠️ **والنص المرجوع كلمة من اسم المنطقة نفسها زي ما هو مكتوب في الكتالوج، مش
//    الكلمة المطبَّعة.** بحث الواجهة بيقارن على النص **الخام** (`d.name` ·
//    `d.nameAr`)، و`normText` بتحوّل ة→ه وى→ي — فكلمة مطبَّعة زي «المنشيه» كانت
//    هترجّع «مفيش مناطق مطابقة» على منطقة اسمها «المنشية» **من غير أي خطأ**.
const ANCHOR_MIN_LEN       = 4;   // أقصر من كده ضوضاء — نفس عتبة `CROSS_MIN_LEN`
const ANCHOR_MAX_TOKENS    = 16;  // سقف الكلمات المفحوصة لكل خانة
const ANCHOR_MAX_DISTRICTS = 1;   // 🔴 الفرادة. تكبيره بيوسّع التغطية وبيضعّف الإشارة.

// كلمة من الاسم **الخام** بتطابق الكلمة المطبَّعة — مصدر النص اللي الواجهة
// بتبحث بيه. بترجّع `null` لو مفيش، والمرساة ساعتها بتتلغي بدل ما تترجع بنص
// مش هيلاقي حاجة في القايمة.
function rawWordFor(rawName, token) {
  for (const w of String(rawName || '').split(/[^\p{L}\p{N}]+/u)) {
    if (w && normText(w).includes(token)) return w;
  }
  return null;
}

function findAddressAnchor(city, fields) {
  // 🔴 نفس حارس `findLocalZones`: المدينة ممكن تبقى `null` لو الكتالوج اتغيّر،
  //    وأوردر واحد بيرمي هنا بيوقّع `get_orders` / `fetch_candidates` كلها.
  if (!city) return null;
  const { list } = availableDistricts(city);
  if (!list.length) return null;

  const seen = new Set();
  // الخانات مرتّبة بالأخصّية أصلًا (`city` ← `address1` ← `address2`)
  for (const f of fields) {
    // ⚠️ الفلترة **قبل** السقف — السقف للأداء، وتطبيقه على الخام كان بيرمي
    //    كلمات معتبرة عشان أرقام ومسافات قبلها. و`\p{L}` بتشيل أرقام المباني
    //    والشوارع: رقم مالوش أي معنى كمرساة.
    const toks = [...new Set(f.textN.split(' '))]
      .filter(t => t.length >= ANCHOR_MIN_LEN && /\p{L}/u.test(t))
      .slice(0, ANCHOR_MAX_TOKENS)
      .sort((a, b) => b.length - a.length);   // الأطول أولًا — الأخصّ
    for (const t of toks) {
      if (seen.has(t)) continue;
      seen.add(t);
      // اسم المحافظة نفسه معلومة شبه صفرية — نفس منطق `generic` بالظبط
      if (t === city.cityNameN || t === city.cityArN) continue;
      let hit = null, count = 0;
      for (const d of list) {
        if (!(d.nameN || '').includes(t) && !(d.nameArN || '').includes(t)) continue;
        hit = d;
        if (++count > ANCHOR_MAX_DISTRICTS) break;
      }
      if (!hit || count > ANCHOR_MAX_DISTRICTS) continue;
      const text = rawWordFor((hit.nameArN || '').includes(t) ? hit.nameAr : hit.name, t);
      if (!text) continue;
      return {
        text,                       // اللي بيتكتب في خانة البحث — كلمة من اسم المنطقة الخام
        token: t,                   // الكلمة المطبَّعة اللي جت من العنوان (للتشخيص)
        fieldLabel: f.label,
        // 🔴 للقياس فقط (`anchor_hit` في السجل) — **ممنوع** أي تطبيق تلقائي
        //    منه. القرار قرار الموظف، والرقم ده هو اللي هيقول بعدين لو الطبقة
        //    دي تستاهل تتحوّل لاقتراح قابل للضغط (بند ١٩ المفتوح).
        districtId: hit.id,
        districtName: hit.name,
        districtNameAr: hit.nameAr,
      };
    }
  }
  return null;
}

// ─── §BOSTA::resolveAddress ───
// خوارزمية اختيار شكل العنوان لكل أوردر (SPEC §٥.٤):
//   province → cityId حتميًا من الجدول المقفول (ممنوع مطابقة نصية بديلة)
//   مطابقة منطقة واحدة  → الشكل (أ): { city, districtId, firstLine }        · موثّق
//   محافظة خاصة بلا مطابقة → الشكل (ب): { city, cityId, districtName, … }   · موثّق
//   زون واحد بلا مطابقة منطقة → الشكل (د): { zoneId, firstLine }            · غير موثّق
//   أكتر من مطابقة أو مفيش → الشكل (ج): { city, firstLine }                 · غير موثّق
//   طابق منطقة **مقفولة للتسليم** → وقف الصف، مفيش رفع أصلًا (8.11)
// 🔴 السلّم **منطقة ← زون ← محافظة** (8.5) — والعقد بيتغيّر مع الدرجة:
//    المنطقة على العقد الموثّق (②) · الزون والمحافظة على غير الموثّق (①).
//    `zoneId` على ② بيرجّع 400، و`districtName` على ① بيرجّع 400 `3002`.
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
  if (!city) {
    // جدول المحافظات مقفول وحتمي، فالحالة دي معناها **كتالوج بوسطة اتغيّر**.
    // بتتقال بالاسم بدل ما تتدهور لـ«مفيش مطابقة منطقة» صامتة — اللي كانت
    // هتشحن على المدينة الغلط. (اتمسكت في `tests/re-payload.test.cjs` ⑨.)
    return {
      ok: false,
      error: `محافظة بوسطة "${row.cityName}" (${row.cityId}) مش موجودة في الكتالوج الحي — `
           + 'كتالوج بوسطة اتغيّر. راجع الجدول في ecommoda-constants §3.5.',
    };
  }
  const { matches, fieldMissing } = matchDistrict(city, fields, row.zoneOnly);

  const base = {
    ok: true,
    province: row.province,
    cityId: row.cityId,
    cityName: row.cityName,
    // 🔤 اسم المحافظة بالعربي من كتالوج بوسطة نفسه (`otherName`) — **مش ترجمة
    //    عندنا**. جدول المحافظات المقفول (§3.5) إنجليزي بس، والاسم العربي
    //    موجود في الكتالوج الحي، فبيتقرا من المدينة اللي الجدول وصل لها.
    //    ⚠️ بيترجع **جنب** `cityName` مش بدله: العرض بيقرا العربي والـ payload
    //    بيبعت `city: plan.cityName` الإنجليزي — ده هو اللي بوسطة بتفهمه.
    cityNameAr: city.cityAr || '',
    catalogWarning: fieldMissing ? 'dropOffAvailability غايب من كتالوج بوسطة — المطابقة اتعطّلت' : null,
    candidates: matches.map(m => ({
      id: m.id, name: m.name, nameAr: m.nameAr, zone: m.zone,
      matchedText: m.matchedText, fieldLabel: m.fieldLabel,
    })),
    crossCity: [],
    localZones: [],
    blockedDistricts: [],
    // 🔍 المرساة — بتتحسب في فرع «مفيش مطابقة» لوحده (تحت)
    addressAnchor: null,
    // 🔴 الـ`districtId` جه من المرساة (كلمة واحدة) مش من مطابقة اسم كامل؟
    districtFromAnchor: false,
  };

  if (matches.length === 1) {
    return { ...base, mode: 'district', districtId: matches[0].id,
             districtName: matches[0].name, districtNameAr: matches[0].nameAr || '' };
  }
  if (matches.length === 0 && row.zoneOnly) {
    // §٥.٥ — محافظة اتلغت إداريًا، بتتبعت كزون جوه مدينة تانية
    return { ...base, mode: 'zoneName', districtName: row.zoneOnly.en,
             districtNameAr: row.zoneOnly.ar || '' };
  }
  if (matches.length === 0) {
    // 🔴 قبل أي نزول درجة: هل العنوان طابق منطقة **مقفولة للتسليم**؟
    //    (`bosta-api-helper` 8.5 خطوة ٠ · 8.11). لو أيوه، ده **مش** نقص مطابقة —
    //    ده عنوان **برّه تغطية بوسطة**، والنزول للمحافظة بيشتري شحنة هترجع.
    //    الصف بيتوقف باسم المنطقة صريح عشان الموظف يحوّله لخدمة العملاء.
    const { blocked } = availableDistricts(city);
    if (blocked.length) {
      const { matches: blockedHits } = matchDistrict(city, fields, row.zoneOnly, blocked);
      if (blockedHits.length) {
        return {
          ...base,
          mode: 'coverageBlocked',
          ambiguous: false,
          blockedDistricts: blockedHits.map(m => ({
            id: m.id, name: m.name, nameAr: m.nameAr, zone: m.zone,
            matchedText: m.matchedText, fieldLabel: m.fieldLabel,
          })),
        };
      }
    }

    // مفيش مطابقة منطقة جوّه المدينة. بندوّر على:
    //   ① زون جوّه **نفس** المدينة — المدينة صح، والزون بيقصّر القايمة للموظف
    //   ② منطقة أو زون في **مدينة تانية** — دي حالة «المدينة مشكوك فيها»
    const localZones = findLocalZones(city, fields);
    // 🔴 **المطابقة المحلية أسبق — والبحث برّه المحافظة مابيحصلش أصلًا لما تكون
    //    موجودة** (v2.4.0 · قرار أحمد 15-09-2026). الأسماء بتتكرر بين المحافظات:
    //    «السادات» مدينة حقيقية في **المنوفية وفي البحيرة** (مدينتين مختلفتين
    //    فعلًا)، فأوردر المنوفية اللي عنوانه طابق مدينة السادات **جوّه
    //    المنوفية** كان بياخد 🟠 على اقتراح البحيرة ويتوقف عن الرفع — واقتراح
    //    الضغطة الواحدة كان **بينقله للمحافظة الغلط** (#54863، مقيس 15-09-2026).
    //    المحافظة محسومة من الجدول المقفول، فمطابقة جوّاها **دليل مؤكِّد** لها:
    //    مطابقة نفس الاسم في محافظة تانية بقت ضوضاء، مش شك.
    //    ⚠️ الكاشف **لسه شغّال زي ما هو** لما مفيش أي مطابقة محلية — دي الحالة
    //    اللي اتكتب عشانها (العبور تحت القاهرة · شبين الكوم على الغربية ·
    //    دمياط الجديدة على القاهرة) وهي متغطّاة في `tests/zone-cross-city` و
    //    `tests/address-matching`.
    const crossCity = localZones.length ? [] : findCrossCity(catalog, fields, row.cityId);
    // 🟠 الشك في المدينة بيتعلن **فقط** لما فيه اقتراح في مدينة تانية.
    //    زون جوّه نفس المدينة مش شك — دي مساعدة في اختيار المنطقة.
    const cityDoubt = crossCity.length > 0;

    // 🔴 درجة الزون — السلّم **منطقة ← زون ← محافظة** (`bosta-api-helper` 8.5
    //    درجة ٤ · 8.10). مثبتة بالقياس مش نظرية: شحنتان نفس المحافظة ونفس
    //    اليوم ونفس الراسل، الفرق الوحيد الزون → `G-02 · OCTOBER HUB` مقابل
    //    `G-08 · NEW OCTOBER HUB`. «المحافظة فقط» **مش** بلا فرز — بتاخد **هب
    //    افتراضي**، فالفرق هو «هب محدد ضد هب افتراضي»، وتحويلة زيادة على
    //    العنوان اللي زونه بعيد عن الافتراضي.
    // ⚠️ الشرط الإلزامي: **زون واحد بالظبط** — أكتر من زون = غموض، والاختيار
    //    بينهم تخمين. الحالة دي بتفضل `province` والاقتراحات بتتعرض في النافذة.
    // 🔴 وكان فيه شرط تاني **«مفيش شك في المدينة»** (الزون بيحسم المدينة 8.10.1،
    //    فرفعه فوق شك قايم بيثبّت المدينة المشكوك فيها بدل ما الموظف يراجعها).
    //    الشرط ده بقى **مستحيل يتكسر** من v2.4.0 وماعادش مكتوب: `cityDoubt` بقى
    //    مشروط بإن `localZones` فاضية، والسطر ده أصلًا بيطلب زون محلي واحد —
    //    فالحالتين مايتقابلوش. ⚠️ **ولو حد رجّع البحث برّه المحافظة فوق مطابقة
    //    محلية، الشرط ده لازم يرجع معاه** وإلا الزون بيثبّت مدينة مشكوك فيها.
    const zoneTier = (localZones.length === 1 && localZones[0].zoneId)
      ? localZones[0] : null;
    if (zoneTier) {
      return {
        ...base, mode: 'zone', ambiguous: false,
        zoneId: zoneTier.zoneId, zoneName: zoneTier.zone, zoneNameAr: zoneTier.zoneAr,
        zoneDistrictCount: zoneTier.districtCount,
        localZones, crossCity, cityDoubt,
      };
    }

    // 🔍 المرساة — **بقت بتتطبّق فعلًا** (v2.6.0 · قرار أحمد 17-09-2026).
    //    لحد v2.5.0 كانت نص بحث بس والصف بينزل «المحافظة فقط» موقوف؛ دلوقتي
    //    الـ`districtId` بتاعها **بيترفع** والصف قابل للرفع وداخل «رفع الكل».
    // 🔴 و**بتتلغي لو المدينة مشكوك فيها** — اقتراح المحافظة التانية إشارة
    //    أقوى، وتطبيق منطقة جوّه محافظة مشكوك فيها بيثبّت الشك بدل ما يراجعه.
    const addressAnchor = cityDoubt ? null : findAddressAnchor(city, fields);

    if (addressAnchor) {
      // 🔴 **`mode` بيفضل `district` عن قصد — مش قيمة جديدة.** كل اللي تحت
      //    (`buildAddressObject` · `addressDegree` · `nextAddressDegree` ·
      //    سلّم النزول) بيقرا `mode`، وقيمة رابعة كانت معناها فرع جديد في
      //    **أربع** دوال، وأي واحدة تنساها بتدّي 400 من بوسطة أو درجة غلط في
      //    D1 **في صمت**. اللي بيتغيّر هو **مصدر** الـ`districtId` وعرضه —
      //    مش عقد العنوان. والعلم `districtFromAnchor` هو اللي بيحمل الفرق.
      // ⚠️ والـ`localZones` بتتبعت زي ما هي: لو بوسطة رفضت المنطقة بـ`3003`،
      //    سلّم النزول بيروح للمدينة ثم المحافظة زي أي صف منطقة بالظبط.
      return {
        ...base, mode: 'district', ambiguous: false,
        districtId: addressAnchor.districtId,
        districtName: addressAnchor.districtName,
        districtNameAr: addressAnchor.districtNameAr || '',
        // 🔴 الواجهة بتقرا منه عشان تعرض «🔍 مرشّح تلقائي» بدل «📍 عنوان
        //    مظبوط» — مطابقة اسم كامل ومرساة كلمة واحدة **مش نفس الثقة**،
        //    وعرضهم بنفس البادج بيخلي الموظف يعدّي على تخمين وهو فاكره حقيقة.
        districtFromAnchor: true,
        addressAnchor,
        localZones, crossCity, cityDoubt,
      };
    }

    return {
      ...base, mode: 'province', ambiguous: false,
      localZones, crossCity, cityDoubt, addressAnchor,
    };
  }
  // ❓ أكتر من مطابقة — **مفيش مرساة هنا عن قصد**: المرشحين متثبّتين أول
  //    القايمة، وبحث جاهز بيخفيهم بنفس القاعدة اللي فوق.
  return { ...base, mode: 'province', ambiguous: true };
}

// ─── §BOSTA::buildAddressObject ───
// 🔴 شكل العنوان **بيتغيّر بالدرجة، والعقد بيتغيّر معاه** (`bosta-api-helper`
//    8.5 · 8.10.4). الدالة دي هي المصدر الوحيد للشكل ده في الأداة كلها — الشحن
//    العادي والاسترجاع والاستبدال بيقروا منها، عشان مايبقاش فيه تلات نسخ
//    بتفترق (نفس سبب قاعدة «محرك واحد» في 8.6a: المدينة بتحدد **الفرع
//    والتسعيرة**، فنسختين بتفترقوا = شحنتين لنفس العنوان على مدينتين).
//
//   الدرجة      | العقد            | الحقول
//   ────────────┼──────────────────┼─────────────────────────────────────────
//   district    | ② موثّق          | city + districtId
//   zoneName    | ② موثّق          | city + cityId + districtName (اسم زون — 8.10.3)
//   zone        | ① غير موثّق      | zoneId **لوحده**
//   province    | ① غير موثّق      | city بالاسم فقط
//
// 🔴 ممنوع الخلط: `zoneId` على ② بيرجّع 400
//    (`must contain at least one of [districtId, districtName]`)، و`districtName`
//    على ① بيرجّع 400 `Zone Not Found` · 3002 حتى لو الاسم زون صحيح ١٠٠٪.
// ⚠️ على درجة الزون **مابنبعتش `city`** — بوسطة بتستنتج المدينة من الزون
//    (مقيس: `zoneId` لوحده بنص عنوان محايد رجّع المدينة صح — 8.10.1)، وبعتها
//    جنبه مالوش أثر (T2 وT3 نتيجتهم متطابقة). الأبسط إنه مايتبعتش.
function buildAddressObject(plan, mode, firstLine) {
  // 🔴 الحقل الصح `city` — مش `cityName`. الڤاليديتور مش شايف `cityName` أصلًا
  //    وبيتجاهله بصمت، فأي نسخ حرفي من داشبورد بوسطة بيقع في الفخ ده (8.2).
  if (mode === 'zone')     return { zoneId: plan.zoneId, firstLine };
  if (mode === 'district') return { city: plan.cityName, districtId: plan.districtId, firstLine };
  if (mode === 'zoneName') return { city: plan.cityName, cityId: plan.cityId,
                                    districtName: plan.districtName, firstLine };
  return { city: plan.cityName, firstLine };
}

// ─── §BOSTA::resolveZoneOverride ───
// 🔴 الزون المختار يدويًا بيتحقّق **زي المنطقة بالظبط**: لازم يكون موجود في
//    مدينة الرفع ومن مناطق متاحة للتسليم. مش لاقيينه = **وقف الصف**، مش رجوع
//    صامت لدرجة تانية — الموظف اختار صراحةً، والرفع على حاجة تانية من غير ما
//    يعرف = شحنة بفلوس على عنوان مش اللي وافق عليه.
// ⚠️ والبحث على `zoneId` مش على الاسم: الاسم بيتكرر بين المدن، والـ id هو
//    اللي بيترفع فعلًا (`bosta-api-helper` 8.10.4).
function resolveZoneOverride(catalog, cityId, zoneId) {
  const city = catalog.cities.find(c => c.cityId === cityId);
  const { list } = availableDistricts(city);
  const hit = list.find(d => d.zoneId && d.zoneId === zoneId);
  if (!hit) return null;
  return { zoneId: hit.zoneId, zoneName: hit.zone || hit.zoneAr || '' };
}

// ─── §BOSTA::addressDegree ───
// درجة العنوان اللي اتبعت فعلًا — بتتسجّل في D1 جنب `contract_used`.
// 🔴 `contract_used` **لوحده بقى ناقص** (8.10.4): الزون والمحافظة الاتنين
//    بيروحوا على العقد غير الموثّق، فالعمود مش بيفرّق بينهم. من غير الدرجة
//    مفيش طريقة نقيس بعدين نسبة كل درجة — وده قياس مطلوب في أول أسبوع تشغيل.
// ⚠️ الوصف اللي الموظف بيقراه في «الإجراءات» لازم يقول **الدرجة** مش العقد:
//    الزون والمحافظة الاتنين على نفس العقد، فوصفهم بالعقد بيخلي الاتنين
//    «بالمحافظة» — والموظف مش هيعرف إن الشحنة دي اتفرزت على هب الزون.
const DEGREE_LABEL = { district: 'بالمنطقة', zone: 'بالزون', province: 'بالمحافظة' };

function addressDegree(mode) {
  if (mode === 'district' || mode === 'zoneName') return 'district';
  if (mode === 'zone') return 'zone';
  return 'province';
}

// ─── §BOSTA::nextAddressDegree ───
// 🔴 النزول درجة بيحصل **لما اللي فوقه يفشل فقط** (8.5 خطوة ٦) — ومصدره
//    `errorCode` بوسطة، مش تخمين. النزول بيرجّع الدرجة الجاية أو `null`:
//      district/zoneName + `3003` (District Not Found) → زون لو فيه، وإلا محافظة
//      zone + `3002`/`3000` (Zone Not Found / عنوان ناقص) → محافظة
//    ⚠️ `errorCode` **نص مش رقم** — المقارنة بالرقم معناها إن الرجوع ده عمره
//       ما هيشتغل، وشحنة كان ممكن تعدّي بتتحسب فشل.
// 🔴 `zoneId` بيتبعت **من برّه** عن قصد، مابيتقراش من الخطة هنا: لما الموظف
//    يعدّل المدينة يدويًا، الزونات المحسوبة بتبقى بتاعة المدينة **الأصلية** —
//    والنزول عليها بيبعت الشحنة على المدينة اللي الموظف رفضها، في صمت. القرار
//    ده بتاع اللي شايف التعديل، مش بتاع الدالة دي.
function nextAddressDegree(mode, errorCode, zoneId) {
  const code = errorCode == null ? null : String(errorCode);
  if ((mode === 'district' || mode === 'zoneName') && code === '3003') {
    return zoneId ? 'zone' : 'province';
  }
  if (mode === 'zone' && (code === '3002' || code === '3000')) return 'province';
  return null;
}

// ─── §BOSTA::buildDeliveryPayload ───
function buildDeliveryPayload(order, plan, mode) {
  const sa = order.shippingAddress || {};
  const orderNumber = String(order.name || '').replace(/^#/, '');

  const fullName  = (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim();
  const parts     = fullName.split(/\s+/).filter(Boolean);
  const firstName = sa.firstName || parts[0] || '';
  const lastName  = sa.lastName  || parts.slice(1).join(' ');

  const phone   = wirePhone(sa.phone);
  const second  = wirePhone(order.phone);
  const sendSecond = second && normPhone(second) !== normPhone(phone);

  // 🔴 السالب هنا معناه **العميل دفع زيادة**، يعني مفيش حاجة تتحصّل → `0`.
  //    لحد v2.0.1 كان السطر ده `Math.abs`، وده كان **بيناقض تعليقه نفسه**:
  //    `-200` كانت بتتحوّل لـ«حصّل منه 200» — تحصيل من عميل دافع زيادة أصلًا.
  //    ✅ **مؤكَّد من أحمد 14-09-2026: السالب مستحيل هنا، و`0` وارد.** يعني لو
  //    قيمة سالبة ظهرت أصلًا فهي **بيانات غلط** — والحارس بيمنعها من تتحوّل
  //    لتحصيل بدل ما يعكسها. و`cod: 0` عدّى عند بوسطة فمحتاجش معالجة خاصة.
  //    ⚠️ وبوسطة **بتقبل `cod` سالب على `type 10`** (مقيس 14-09-2026: `-500`
  //    عدّى 200، و`3008` بيمسك تحت `-2000`) — يعني مفيش أي حاجة عندها بتمسك
  //    الحالة دي، والحارس الوحيد هو السطر ده. (`bosta-api-helper` 8d ④.)
  //    **وممنوع نسخ السطر ده لأي مسار استرجاع أو استبدال** — هناك السالب
  //    بيتبعت بإشارته (`§RE-UPLOAD::resolveCod`) وهو **الوضع الطبيعي**.
  const cod = Math.max(0, Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0));
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
  const dropOffAddress = buildAddressObject(plan, mode, firstLine);

  const receiver = { firstName, phone };              // الإلزامي الموثّق
  if (lastName)   receiver.lastName  = lastName;
  if (fullName)   receiver.fullName  = fullName;      // اختياري — يتبعت **مع** firstName مش بدلها
  if (sendSecond) receiver.secondPhone = second;      // بيقلّل فشل التوصيل (~3% من الأوردرات)

  const payload = {
    type: BOSTA_TYPE_BY_JOB[JOB_S1],
    cod,
    // قيمة البضاعة — مش الفلوس المحصّلة. محروسة بين GOODS_MIN وGOODS_MAX فوق.
    // ⚠️ وليها **تكلفة مباشرة**: بوسطة بتحسب `pricing.insuranceFee` تلقائيًا =
    //    **`clamp(1% , 10 , 50)`** — مش ١٪ مجردة (`bosta-api-helper` 8.9،
    //    اتصحّحت في v5.0.0: القياس القديم 2600 → 26 صادف إنه جوه المدى فالحدين
    //    ما بانوش. المقيس: 100 → 10 · 4500 → 45 · 49000 → 50).
    // 🔴 و`shipmentFees` **شامل التأمين أصلًا** مش زايد عليه — أي حساب تكلفة
    //    بيجمع `shipmentFees + insuranceFee` بيعدّ التأمين مرتين.
    goodsInfo: { amount: goods },
    receiver,
    dropOffAddress,
    specs: {
      packageType: 'Parcel',                          // 🔴 "Small" مش قيمة موثّقة في أي حقل
      size: 'SMALL',                                  // 🔴 حقل منفصل، بالكابيتال
      packageDetails: { itemsCount, description },
    },
    businessLocationId: BOSTA_LOCATION_ID,
    businessReference:       '#' + orderNumber,       // 🔴 بالهاش — من غيره كل أدوات EcomModa مش هتلاقي الشحنة
    // 🔴 القيمة دي **محجوزة لأداة رفع S1 دي بالذات** (`bosta-api-helper` 8.3،
    //    مقيس حيًا 10-09-2026). الفرادة عند بوسطة على **الحساب كله وعبر كل
    //    أنواع الشحنات**، و`terminate` بيحررها. يعني أي أداة تانية ترفع شحنة
    //    على نفس الأوردر (استرجاع/استبدال) لازم قيمة مختلفة وإلا `400 · 11000`.
    //    أداة الاسترجاع/الاستبدال بتبعت `#12345-R{n}` / `#12345-EX{n}`.
    uniqueBusinessReference: orderNumber,
    allowToOpenPackage: ALLOW_OPEN_PKG,
    flexShippingInfo: { isOrderEligible: true, amountToBeCollected: FLEX_AMOUNT },
  };
  if (order.note) payload.notes = String(order.note).slice(0, 500);   // الاسم الرسمي `notes`
  return payload;
}

// ─── §BOSTA::validateOrder ───
// اللي بيمنع الرفع أصلاً — بيتعرض للموظف قبل ما يضغط، مش بعد الفشل.
function validateOrder(order, plan, override) {
  const problems = [];
  const sa = order.shippingAddress || {};
  if (!plan.ok) { problems.push(plan.error); return problems; }
  if (!wirePhone(sa.phone) || normPhone(sa.phone).length < 8) problems.push('رقم تليفون الشحن ناقص أو غير صالح');
  const fullName = (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim();
  if (!fullName) problems.push('اسم المستلم فاضي — firstName إلزامي عند بوسطة');
  const firstLineLen = [sa.address1, sa.address2, sa.city, sa.province].filter(Boolean).join(' ').length;
  if (firstLineLen <= 5) problems.push('العنوان أقصر من الحد الأدنى (أكتر من ٥ حروف)');
  const cod = Math.max(0, Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0));
  if (cod > COD_MAX) problems.push(`قيمة التحصيل ${cod.toLocaleString('en-US')} أعلى من الحد الموثّق ${COD_MAX.toLocaleString('en-US')}`);
  problems.push(...goodsProblems(Math.abs(Number(order.currentSubtotalPriceSet?.presentmentMoney?.amount || 0))));
  problems.push(...coverageProblems(plan, override));
  return problems;
}

// ─── §BOSTA::goodsProblems ───
// 🔴 حارس `goodsInfo.amount` — لازم **قبل** النداء، مش اكتشاف الحد من رد بوسطة.
//    خارج المدى بيرجّع `400 · errorCode 41591` برسالة بتتكلم عن «قيمة الطرد»
//    مش عن حد أدنى، فالموظف بيقرا رفض مبهم على أوردر سليم تمامًا.
//    (`bosta-api-helper` 8.4 · 8.9 — الحد **مش موثّق في الـ spec خالص**.)
function goodsProblems(goods) {
  const v = Number(goods) || 0;
  if (v < GOODS_MIN) {
    return [`قيمة البضاعة ${v.toLocaleString('en-US')} أقل من الحد الأدنى عند بوسطة `
          + `(${GOODS_MIN}) — الشحنة هتترفض بـ errorCode 41591. راجع الأوردر أو ارفعه يدويًا.`];
  }
  if (v > GOODS_MAX) {
    return [`قيمة البضاعة ${v.toLocaleString('en-US')} أعلى من الحد الأقصى عند بوسطة `
          + `(${GOODS_MAX.toLocaleString('en-US')}) — الشحنة هتترفض بـ errorCode 41591.`];
  }
  return [];
}

// ─── §BOSTA::coverageProblems ───
// 🔴 العنوان طابق منطقة **مقفولة للتسليم** = برّه تغطية بوسطة (8.11). الوقف هنا
//    مش تشدّد: النزول لمسار المحافظة بيشتري شحنة بفلوس ترجع بعد أيام بـ
//    *outside Bosta's delivery coverage area*. المسار الصح تحويل لخدمة العملاء.
//
// 🔴 **استثناء واحد فقط: منطقة اختارها الموظف بإيده** (`override.districtId`).
//    الوقف قايم على إن **المطابقة التلقائية** وصلت لمنطقة مقفولة؛ الموظف اللي
//    فتح النافذة وحدد منطقة تانية بدّل نتيجة المطابقة دي بالكامل، والـ payload
//    بيبعت `districtId` بتاعه هو. والمنطقة المختارة بتتحقق بعد كده من
//    `availableDistricts` — اللي **مابترجّعش المقفولة أصلًا** — فمفيش طريق
//    لمنطقة مقفولة تعدّي من هنا: اختيارها بيوقف الصف برسالة صريحة.
//    ⚠️ **و`forceZone`/`forceProvince` مش استثناء**: دول بيغيّروا **درجة**
//    العنوان مش العنوان نفسه، وبوسطة بتفضل بتوصّل على نص العنوان اللي طابق
//    المنطقة المقفولة — يعني نفس الشحنة اللي بترجع، وده اللي الوقف موجود عشانه.
function coverageProblems(plan, override) {
  if (!plan.ok || plan.mode !== 'coverageBlocked') return [];
  if (override?.districtId) return [];
  const names = (plan.blockedDistricts || []).map(d => d.name || d.nameAr).filter(Boolean);
  return [`العنوان طابق منطقة بوسطة **مش بتسلّم فيها** (${names.join(' · ') || '—'}) — `
        + `العنوان خارج التغطية. الرفع على المحافظة مش بديل: الشحنة هتتشحن وترجع. `
        + `حوّل الأوردر لخدمة العملاء (عنوان بديل · كوريَر تاني · إلغاء).`];
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

// ─── §BOSTA::terminateDelivery ───
// الرجوع الوحيد. 🔴 بالـ `trackingNumber` — مسار الـ `_id` بيرجّع 404.
// بعد نجاحه الشحنة **بتختفي** (أي GET بعدها بيرجّع "400 Delivery not found.")،
// و`uniqueBusinessReference` **بيتحرّر** — فإعادة الرفع بعد التصحيح بتعدّي.
// الإقران ده (إلغاء ← إعادة رفع) هو سبب وجود الـ endpoint بدل زيارة الداشبورد.
async function terminateDelivery(env, trackingNumber) {
  const tn = cleanText(trackingNumber);
  if (!tn) return { ok: false, status: 0, message: 'رقم التتبع فاضي' };
  let resp, text;
  try {
    resp = await fetch(`${BOSTA_BASE}/deliveries/business/${encodeURIComponent(tn)}/terminate`, {
      method: 'DELETE', headers: bostaHeaders(env),
    });
    text = await resp.text();
  } catch (e) {
    return { ok: false, status: 0, message: `فشل الاتصال ببوسطة — ${e.message}` };
  }
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* نص خام تحت */ }
  if (resp.ok) return { ok: true, status: resp.status, alreadyGone: false };
  const errorCode = body?.errorCode != null ? String(body.errorCode) : null;
  // 🔴 الإلغاء المكرر **مميَّز عن الفشل** (`bosta-api-helper` 8.7 · مقيس
  //    14-09-2026 على ٦ شحنات): `terminate` تاني مرة بيرجّع **404** بينما
  //    `GET`/`PUT` على نفس الشحنة بيرجّعوا **400** — كلهم بـ`errorCode 1066`.
  //    فالـ 404 هنا = «اتلغت خلاص»، وعرضه كـ«فشل الإلغاء» بيبعت الموظف
  //    لداشبورد بوسطة يدوّر على شحنة **مش موجودة أصلًا**.
  //    ⚠️ التحقق من الإلغاء = **الاختفاء نفسه**، مش قراءة حالة نهائية — مفيش
  //    `state` زي `48 Terminated` تقدر تقراه، الشحنة بتتشال من النتايج.
  if (resp.status === 404 && errorCode === '1066') {
    return { ok: true, status: resp.status, alreadyGone: true };
  }
  return {
    ok: false,
    status: resp.status,
    errorCode,
    message: body?.message || body?.error || text.slice(0, 200) || `HTTP ${resp.status}`,
  };
}

// ─── §BOSTA::humanizeBostaError ───
// ⚠️ الرسالة بتختلف بالوضع في حالتين بالذات — ومش تجميل:
//    `11000` في s1 معناه «الأوردر ده مرفوع قبل كده»، وفي R/E معناه «الدورة دي
//    ليها شحنة شغّالة» **والحل مختلف** (زرار الإلغاء بيحرّر المرجع). و`3008`
//    مالوش معنى أصلًا في s1 (مفيش استرداد هناك).
function humanizeBostaError(res, job = null) {
  const code = res.errorCode;
  const isRE = !!job?.isRE;
  if (code === '11000') {
    return isRE
      ? 'بوسطة رافضة: الدورة دي مرفوعة عندها بالفعل ومعاها شحنة شغّالة '
        + '(uniqueBusinessReference مكرر). لو الشحنة القديمة غلط، ألغيها الأول بزرار «إلغاء الشحنة» وبعدين ارفع تاني.'
      : 'بوسطة رافضة: رقم الأوردر ده مرفوع عندها قبل كده (uniqueBusinessReference مكرر)';
  }
  if (code === '3003')  return 'بوسطة رافضة: المنطقة غير موجودة عندها (District Not Found)';
  if (code === '3002')  return 'بوسطة رافضة: الزون غير موجود عندها (Zone Not Found)';
  if (code === '3000')  return 'بوسطة رافضة: بيانات العنوان ناقصة — لازم درجة عنوان (منطقة أو مدينة أو محافظة) مع نص العنوان';
  if (code === '3009')  return 'بوسطة رافضة: العنوان من غير مفتاح درجة — لازم city أو zoneId أو districtId';
  if (code === '3007')  return `بوسطة رافضة: أقصى مبلغ تحصيل ${COD_MAX.toLocaleString('en-US')} جنيه`;
  if (code === '3008')  return `بوسطة رافضة: أقصى مبلغ استرداد عند الباب ${COD_REFUND_MIN} جنيه`;
  // 🔴 الحد `100`–`50000` **مش موثّق في الـ spec**، ورسالة بوسطة بتتكلم عن «قيمة
  //    الطرد» من غير ما تقول إن فيه حد أصلًا — فالترجمة دي هي اللي بتخلي الموظف
  //    يفهم إن ده حد مش عطل. (`bosta-api-helper` 8.4 · مقيس 14-09-2026.)
  if (code === '41591') return `بوسطة رافضة: قيمة البضاعة لازم تكون بين ${GOODS_MIN} و${GOODS_MAX.toLocaleString('en-US')} جنيه`;
  // 🔴 الشحنة مش موجودة — يا إما اتلغت خلاص يا إما رقم التتبع غلط. الفرق مهم:
  //    بعد `terminate` ناجح الشحنة **بتختفي** ومفيش حالة نهائية تتقرا (8.7).
  if (code === '1066')  return 'بوسطة مش لاقية الشحنة — يا إما اتلغت خلاص يا إما رقم التتبع غلط';
  if (code === '1028')  return 'بوسطة رافضة: مفتاح الـ API غير صالح — راجع BOSTA_API_KEY';
  // 🔴 مش كل فشل من بوسطة معاه `errorCode`. شكل العنوان الغلط بيرجّع
  //    **500 بلا كود خالص** (مقيس 10-09-2026 على عقد الاسترجاع). أي
  //    `humanizeBostaError` بيفترض وجود كود بيطلّع رسالة فاضية على الحالة دي.
  // 🔴 الـ 403 من بوسطة معناه **حقل برّه الـ whitelist**، والنداء كله بيتلغي
  //    مش جزء منه (`bosta-api-helper` 8d ①). الأداة دي مابتعملش `PUT` دلوقتي،
  //    والفرع موجود عشان أي حقل جديد يتضاف لجسم الإنشاء ميرجعش رسالة خام.
  if (res.status === 403) {
    return `بوسطة رفضت النداء كله (403): ${res.message} — فيه حقل مش مسموح بتعديله. `
         + 'مفيش أي جزء من الطلب اتنفّذ.';
  }
  if (res.status >= 500) {
    return `بوسطة ردّت بخطأ داخلي (HTTP ${res.status}): ${res.message} — `
         + (isRE ? 'غالبًا شكل العنوان غلط للنوع ده. ' : '')
         + 'بلّغ عن الأوردر ده بدل ما تعيد المحاولة.';
  }
  return `بوسطة رافضة (HTTP ${res.status}${code ? ` · كود ${code}` : ''}): ${res.message}`;
}

// ══════════════════════════════════════════════════════════════
// §UPLOAD — منطق الأداة
// ══════════════════════════════════════════════════════════════

// الوضع الوحيد اللي §UPLOAD بيخدمه — بيتحسب مرة عشان مايتبنيش في كل صف.
const S1_JOB = getJob(JOB_S1);


// ─── §UPLOAD::buildRow ───
// صف واحد للواجهة — بيانات العرض + خطة العنوان + حالة الرفع السابق.
function buildRow(order, catalog) {
  const sa = order.shippingAddress || {};
  const plan = resolveAddress(order, catalog);
  // 🔴 قايمتين عن قصد: `all` بتحكم **هل الصف يترفع**، و`problems` هي اللي
  //    بتتعرض. الفرق بينهم بند واحد — رسالة «خارج التغطية».
  //    السبب: الجدول بيقول نفس المعلومة **تلات مرات تانية** (بادج «حالة
  //    العنوان» · اسم المنطقة المقفولة في عمود المنطقة · حالة الرفع «موقوف»)،
  //    والجملة الطويلة جنبهم كانت بتاكل خلية العميل من غير ما تضيف حاجة.
  //    ⚠️ الشرح الكامل مش ضايع — عايش في الـ tooltip بتاع بادج الحالة، وفي
  //    رسالة الخطأ وقت الرفع (`§BOSTA::coverageProblems`) لو حد حاول يرفع.
  const all = validateOrder(order, plan);
  const covered = coverageProblems(plan);
  const problems = all.filter(p => !covered.includes(p));

  const trackingBefore = previousTrackingS1(order);
  const tags = Array.isArray(order.tags) ? order.tags : [];
  const hasTag = tags.includes(UPLOAD_TAG_BY_JOB[JOB_S1]);

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
    // نفس حساب `§BOSTA::buildDeliveryPayload` بالحرف — الرقم المعروض لازم يبقى
    // الرقم اللي هيتبعت، وإلا الموظف بيوافق على حاجة وبتترفع حاجة تانية.
    cod:         Math.max(0, Number(order.totalOutstandingSet?.presentmentMoney?.amount || 0)),
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
    // 🔤 الأسماء العربية جاية من **كتالوج بوسطة** (`otherName` لكل مستوى) —
    //    مفيش أي ترجمة عندنا. بتترجع **جنب** الإنجليزية مش بدلها: الواجهة
    //    بتعرض العربي في عمودي «محافظة بوسطة» و«المنطقة»، والـ payload بيبعت
    //    الإنجليزي (أو الـ id) لبوسطة. خلطهم = شحنة على اسم بوسطة مش فاهماه.
    cityNameAr:  plan.ok ? (plan.cityNameAr || '') : '',
    cityId:      plan.ok ? plan.cityId : '',
    mode:        plan.ok ? plan.mode : 'blocked',
    districtId:  plan.ok ? (plan.districtId || null) : null,
    districtName: plan.ok ? (plan.districtName || null) : null,
    districtNameAr: plan.ok ? (plan.districtNameAr || '') : '',
    ambiguous:   plan.ok ? !!plan.ambiguous : false,
    candidates:  plan.ok ? (plan.candidates || []) : [],
    // 🟠 المدينة مشكوك فيها — العنوان طابق منطقة في **مدينة تانية** غير اللي
    //    الجدول وصل لها. اقتراح للموظف، مش قرار: ممنوع التطبيق التلقائي.
    cityDoubt:   plan.ok ? !!plan.cityDoubt : false,
    crossCity:   plan.ok ? (plan.crossCity || []) : [],
    // زون جوّه نفس المدينة — المدينة صح، والزون بيقصّر قايمة الاختيار
    localZones:  plan.ok ? (plan.localZones || []) : [],
    // 🔴 درجة الزون — الصف ده هيترفع بـ`zoneId` مش بالمحافظة (8.5 درجة ٤)
    zoneId:      plan.ok ? (plan.zoneId || null) : null,
    zoneName:    plan.ok ? (plan.zoneName || null) : null,
    zoneNameAr:  plan.ok ? (plan.zoneNameAr || '') : '',
    zoneDistrictCount: plan.ok ? (plan.zoneDistrictCount || 0) : 0,
    // 🔍 المرساة — الكلمة اللي وصلت للمنطقة دي، والواجهة بتعرضها كسبب.
    addressAnchor: plan.ok ? (plan.addressAnchor || null) : null,
    // 🔴 `mode` بيقول `district` في الحالتين — العلم ده هو **الفرق الوحيد**
    //    بين مطابقة اسم كامل ومرساة كلمة واحدة، والواجهة بتلوّن وتسمّي منه.
    districtFromAnchor: plan.ok ? !!plan.districtFromAnchor : false,
    // 🔴 العنوان طابق منطقة **مقفولة للتسليم** — برّه تغطية بوسطة (8.11).
    //    بتترجع بالاسم عشان الموظف يشوف السبب، مش «مفيش مطابقة» صامتة.
    blockedDistricts: plan.ok ? (plan.blockedDistricts || []) : [],
    catalogWarning: plan.ok ? plan.catalogWarning : null,
    problems,
    // 🔴 بيتحسب من القايمة **الكاملة** — شيل الرسالة من العرض مايشيلش المنع
    uploadable:  all.length === 0,
    // 🔴 الصف موقوف **بسبب التغطية وفقط** — يعني اختيار منطقة يدويًا بيحرّره.
    //    بيتحسب هنا مش في الواجهة عن قصد: الواجهة ماتعرفش أنهي رسالة من `all`
    //    بتاعة التغطية وأنهي بتاعة التليفون أو قيمة البضاعة، وأي محاولة تخمّن
    //    ده من `problems` معناها نسخة تانية من `validateOrder` عايشة في
    //    الفرونت إند وبتفترق عنها بصمت.
    //    ⚠️ ومعناها **مش** «الصف قابل للرفع»: القرار اليدوي هو اللي بيحرّره،
    //    والحارس الحقيقي في `§BOSTA::coverageProblems` وقت الرفع نفسه.
    coverageOnly: !problems.length && plan.ok && plan.mode === 'coverageBlocked',
  };
}

// ─── §UPLOAD::uploadOne ───
// النتيجة تلات حالات مش اتنين: success · warning · error.
// warning = الشحنة اترفعت فعلًا على بوسطة فقط فيه حاجة بعدها ما تمّتش —
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
    addressDegree: null,     // district · zone · province — 🔴 `contract_used` لوحده مش بيفرّق (8.10.4)
    districtSent: null,
    zoneSent: null,
    citySent: null,
    cityAuto: null,          // المدينة اللي المطابقة التلقائية وصلت لها
    cityOverridden: false,   // الموظف غيّر المدينة يدويًا؟
    // ─── قياس التدخّل اليدوي على العنوان (v2.5.0) ───
    // 🔴 `district_sent` **لوحده مش بيفرّق** بين منطقة جت من المطابقة التلقائية
    //    ومنطقة الموظف اختارها بإيده — يعني مفيش طريقة نعرف بيها كام صف
    //    المطابقة فشلت فيه فعلًا. من غير الأربع حقول دي، أي قرار عن تحسين
    //    المطابقة بيتاخد على تقدير مش على رقم.
    districtOverridden: false,  // الموظف اختار المنطقة بإيده؟
    degreeForced: null,         // 'zone' · 'province' — تثبيت يدوي على درجة أقل
    addressAnchor: null,        // نص المرساة اللي النافذة فتحت بيه (لو فيه)
    // 🎯 المعنى **اتقلب في v2.6.0** — المرساة بقت بتتطبّق لوحدها، فالموظف
    //    اللي موافق عليها **مابيلمسش حاجة**:
    //      `null`  = ما اختارش منطقة بإيده (موافق ضمنيًا · أو مفيش مرساة)
    //      `true`  = اختار بإيده **نفس** منطقة المرساة (تأكيد صريح)
    //      `false` = اختار **غيرها** ← 🔴 **المرساة كانت غلط والموظف مسكها**
    //    `false` هو **إشارة الخطأ الوحيدة** دلوقتي، ونسبته لإجمالي الصفوف
    //    اللي فيها مرساة هي معدّل الخطأ الفعلي (بند ١٩).
    anchorHit: null,
    // 🎯 الشحنة اتعملت على منطقة المرساة فعلًا؟ بيتحسب في `applyDegree` من
    //    **الدرجة اللي اتبعتت فعلًا** مش من النيّة — لو بوسطة رفضت المنطقة
    //    ونزلنا للمدينة، المرساة ما اتطبقتش على الشحنة اللي موجودة دلوقتي.
    anchorApplied: false,
    error: null,
    warnings: [],
    // ─── ℹ️ ملحوظات إعلامية — منفصلة عن `warnings` عن قصد (v2.7.0) ───
    // 🔴 `warnings` = **حاجة ناقصة**: الشحنة موجودة عند بوسطة بفلوس وحاجة بعدها
    //    ما تمّتش، والصف بياخد «⚠ تم جزئيًا» عشان الموظف يتدخّل.
    //    `advisories` = العملية **تمّت بالكامل** وفيه معلومة تستاهل تتقال
    //    (المبلغ اتقص عند حد بوسطة · المدينة اتعدّلت يدويًا · العنوان نزل درجة).
    //    الاتنين كانوا في قايمة واحدة، والشرط `warnings.length ? 'warning'`
    //    كان بيدّي **أصفر على صف سليم اتعمل فيه كل حاجة** — والأصفر الكذّاب
    //    بيعلّم الموظف يعدّي على الأصفر الحقيقي (نفس مرض `already` في
    //    `worker-builder` 5A ④). القاعدة الفاصلة: **فيه حاجة محتاجة تدخّل؟**
    //    أيوه = `warnings` · لأ = `advisories`.
    advisories: [],
    logged: true,
  };

  const plan = resolveAddress(order, catalog);
  row.addressAnchor = plan.addressAnchor?.text || null;
  // 🔴 الـ `override` بيتبعت للڤاليديشن **قبل** ما يتطبّق تحت، وده مقصود:
  //    حارس التغطية الوحيد اللي بيتأثر بيه (`coverageProblems`) لازم يعرف إن
  //    الموظف بدّل المنطقة، وإلا الصف بيترفض هنا ويرجع قبل ما الكود يوصل أصلًا
  //    للسطور اللي بتقرا `override` — يعني اختيار يدوي سليم بيتبلع في صمت.
  const problems = validateOrder(order, plan, override);
  if (problems.length) {
    row.status = 'error';
    row.error  = problems.join(' · ');
    return row;
  }

  // ─── تعديل الموظف اليدوي — بيغلب المطابقة التلقائية ───
  // 🔴 التعديل ممكن يشمل **المدينة** كمان مش المنطقة فقط. تصنيف بوسطة مش
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
      row.error  = `المحافظة المختارة يدويًا (${ovCityId}) مش موجودة في كتالوج بوسطة — ` +
                   `الرفع اتوقف بدل ما يتبعت على المحافظة الأصلية`;
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
                   `محافظة ${planUsed.cityName} عند بوسطة — الرفع اتوقف. افتح النافذة واختر من الأول.`;
      return row;
    }
    mode = 'district';
    planUsed.districtId = d.id;
    planUsed.districtName = d.name;
    row.districtOverridden = true;
    // 🎯 المرساة وصلت لنفس المنطقة اللي الموظف اختارها؟ (قياس · v2.5.0)
    row.anchorHit = plan.addressAnchor ? plan.addressAnchor.districtId === d.id : null;
  } else if (override?.forceZone) {
    // 🔴 «ارفع على الزون فقط» — درجة وسيطة **يختارها الموظف**، مش تلقائية فقط.
    //    الفايدة مقيسة: هب وكود فرز محددين بدل الهب الافتراضي للمحافظة
    //    (`bosta-api-helper` 8.10.2). الحالة دي بتحصل لما المطابقة التلقائية
    //    مش واثقة من المنطقة، لكن الموظف عارف الزون.
    const z = resolveZoneOverride(catalog, planUsed.cityId, override.zoneId);
    if (!z) {
      row.status = 'error';
      row.error  = `المدينة المختارة يدويًا مش موجودة (أو كل مناطقها مقفولة للتسليم) في ` +
                   `محافظة ${planUsed.cityName} عند بوسطة — الرفع اتوقف. افتح النافذة واختر من الأول.`;
      return row;
    }
    mode = 'zone';
    planUsed.zoneId   = z.zoneId;
    planUsed.zoneName = z.zoneName;
    row.degreeForced  = 'zone';
  } else if (override?.forceProvince || row.cityOverridden) {
    // مدينة متعدّلة من غير منطقة = رفع على مستوى المدينة الجديدة (أفضل بكتير
    // من المدينة الغلط، وبيدخل مسار العناوين غير الواضحة عند بوسطة عادي)
    mode = 'province';
    // ⚠️ التثبيت الصريح بس هو اللي يتسجّل — المدينة المعدّلة من غير منطقة
    //    مسجّلة في `city_overridden` أصلًا، وخلطهم بيخلّي العدّ مضاعف.
    row.degreeForced = override?.forceProvince ? 'province' : null;
  }

  // 🔴 الزون اللي ينفع ننزل عليه لو المنطقة اترفضت. **بيتصفّر لو الموظف عدّل
  //    المدينة** — الزونات المحسوبة ساعتها بتاعة المدينة الأصلية، والنزول
  //    عليها بيرجّع الشحنة للمدينة اللي الموظف رفضها من غير ما حد يشوف.
  const fallbackZoneId = row.cityOverridden
    ? null
    : (planUsed.zoneId || planUsed.localZones?.[0]?.zoneId || null);

  // 🔴 المرساة اتطبّقت **على الشحنة** ولا لأ — الاختيار اليدوي بيلغيها،
  //    وسلّم النزول بيلغيها كمان (الشحنة بقت على المدينة/المحافظة مش عليها).
  const anchorPlanned = !!plan.districtFromAnchor && !override?.districtId;

  const applyDegree = (m) => {
    const doc = m === 'district' || m === 'zoneName';
    row.contractUsed   = doc ? 'documented' : 'undocumented';
    row.addressDegree  = addressDegree(m);
    row.districtSent   = (m === 'district' || m === 'zoneName') ? planUsed.districtName : null;
    row.zoneSent       = m === 'zone' ? (planUsed.zoneName || null) : null;
    row.anchorApplied  = anchorPlanned && m === 'district';
    return doc;
  };

  let documented = applyDegree(mode);
  let payload = buildDeliveryPayload(order, planUsed, mode);
  let res = await createDelivery(env, payload, documented);
  row.citySent     = planUsed.cityName;
  row.cityAuto     = plan.cityName;

  // 🔴 سلّم النزول **منطقة ← زون ← محافظة** (`bosta-api-helper` 8.5) — خطوة
  //    واحدة لكل رفض، ومصدرها `errorCode` بوسطة مش تخمين. الحلقة محدودة
  //    بطبيعتها (كل درجة بتنزل للي تحتها وفقط) فمفيش دوران.
  while (!res.ok) {
    const next = nextAddressDegree(mode, res.errorCode, fallbackZoneId);
    if (!next) break;
    // ℹ️ **ملحوظة مش تحذير** (v2.7.0): الشحنة اتعملت كاملة — بوسطة رفضت الدرجة
    //    الأعلى وإحنا نزلنا درجة **بقرارنا**، ومفيش حاجة ناقصة ولا تدخّل مطلوب.
    //    والدرجة اللي اتبعتت فعلًا ظاهرة في عمودي «العقد» و«المنطقة المبعوتة».
    row.advisories.push(next === 'zone'
      ? `بوسطة رفضت المنطقة "${row.districtSent}" — اترفعت على زون "${planUsed.localZones?.[0]?.zone || '—'}" بدلها`
      : `بوسطة رفضت ${row.districtSent ? `المنطقة "${row.districtSent}"` : `الزون "${row.zoneSent}"`} — اترفعت على مستوى المحافظة بدلها`);
    mode = next;
    if (next === 'zone') {
      planUsed.zoneId   = fallbackZoneId;
      planUsed.zoneName = planUsed.zoneName || planUsed.localZones?.[0]?.zone || '';
    }
    documented = applyDegree(mode);
    payload = buildDeliveryPayload(order, planUsed, mode);
    res = await createDelivery(env, payload, documented);
  }

  if (!res.ok) {
    row.status = 'error';
    row.error  = humanizeBostaError(res);
    return row;
  }

  actions.push(`رفع الشحنة على بوسطة (${DEGREE_LABEL[row.addressDegree] || 'بالمحافظة'})`);
  row.trackingNumber = res.trackingNumber;
  row.bostaId        = res.bostaId;

  if (!res.trackingNumber) {
    row.status = 'warning';
    row.warnings.push('بوسطة قبلت الشحنة فقط ما رجّعتش رقم تتبع — الكتابة على شوبيفاي اتوقفت');
    return row;
  }

  // الرفع نجح فعلًا — أي فشل بعد كده warning مش error
  try {
    const w = await writeBackToShopify(env, token, order, res.trackingNumber, actions, S1_JOB);
    row.warnings.push(...w);
    // 🔴 الحالة بتتقرا من `warnings` **لوحدها** (v2.7.0) — `advisories`
    //    مابتغيّرش اللون: الصف اللي كل حاجة فيه تمّت بيفضل أخضر ومعاه ملحوظته.
    row.status = row.warnings.length ? 'warning' : 'success';
  } catch (e) {
    row.status = 'warning';
    row.warnings.push(`الشحنة اترفعت (${res.trackingNumber}) لكن الكتابة على شوبيفاي فشلت: ${e.message}`);
    row.shopifyWriteFailed = true;
  }
  return row;
}

// ─── §UPLOAD::logRow ───
async function logRow(env, row, employee, job = S1_JOB) {
  // ⚠️ الترتيب مقصود: `skipped` قبل `error`، و«الكتابة الرجعية فشلت» منفصلة عن
  //    «الرفع فشل» عمدًا — الأولى معناها الشحنة **موجودة فعلًا** عند بوسطة
  //    والأوردر لسه مش عارف بيها؛ خلطهم بيخلي أي إعادة محاولة تعمل شحنة مكررة.
  const type = row.skipped                     ? 'skipped'
             : row.shopifyWriteFailed          ? job.writeFailType
             : row.status === 'error'          ? (row.trackingNumber ? job.writeFailType : job.uploadFailType)
             :                                   job.uploadedType;
  try {
    await writeLog(env.DB, {
      tool: job.tool,
      type,
      employee,
      orderId:   row.orderId,
      orderName: row.orderNumber,
      // نص السجل بياخد الاتنين — التفرقة عايشة في `extra`, والصف المكتوب
      // لازم يفضل مقروء لوحده من غير ما حد يفتح الـ JSON.
      notes:     row.error || [...row.warnings, ...(row.advisories || [])].join(' · ')
                 || `رقم التتبع ${row.trackingNumber || '—'}`,
      extra: {
        jobType:         job.jobType,
        result:          row.status,
        contract_used:   row.contractUsed,
        // 🔴 `contract_used` **لوحده بقى ناقص** (`bosta-api-helper` 8.10.4):
        //    الزون والمحافظة الاتنين على العقد غير الموثّق، فالعمود مش بيفرّق
        //    بينهم. من غير الدرجة مفيش طريقة نقيس نسبة كل درجة بعدين — وده
        //    قياس مطلوب في أول أسبوع تشغيل.
        address_degree:  row.addressDegree,
        tracking_number: row.trackingNumber,
        bosta_id:        row.bostaId,
        district_sent:   row.districtSent,
        zone_sent:       row.zoneSent || null,
        city_sent:       row.citySent,
        // تدخّل المدينة يتسجّل عشان نقيس تكراره — الحالات اللي بتتكرر هي
        // المرشحة تتحوّل لصف في جدول المحافظات بدل تدخّل يدوي كل مرة
        city_auto:       row.cityAuto,
        city_overridden: !!row.cityOverridden,
        // 🔴 نفس السبب بالظبط، على مستوى **المنطقة**: من غير العلم ده
        //    `district_sent` مابيفرّقش بين مطابقة نجحت وموظف صلّحها بإيده،
        //    فنسبة نجاح المطابقة **مش قابلة للقراءة من السجل** (v2.5.0).
        district_overridden: !!row.districtOverridden,
        degree_forced:   row.degreeForced,
        address_anchor:  row.addressAnchor,
        // 🎯 اتبعتت على منطقة المرساة فعلًا · و`anchor_hit = false` معناها
        //    الموظف صحّحها — ودي إشارة الخطأ اللي بند ١٩ بيتقاس بيها.
        anchor_applied:  !!row.anchorApplied,
        anchor_hit:      row.anchorHit,
        actions:         row.actions,
        // 🔴 قايمتين منفصلتين في السجل كمان (v2.7.0): `warnings` = حاجة ناقصة
        //    محتاجة تدخّل · `advisories` = ملحوظة على عملية تمّت. أي تقرير
        //    بيعدّ «الصفوف اللي محتاجة مراجعة» بيقرا `warnings` — قبل كده كان
        //    بيعدّ القص والتعديل اليدوي معاها.
        warnings:        row.warnings,
        advisories:      row.advisories || [],
      },
    });
  } catch (e) {
    row.logged = false;   // العملية حصلت — لكن مفيش سجل. الواجهة بتحذّر.
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
// §RE-UPLOAD — منطق الاسترجاع/الاستبدال
// 🔴 البلوك ده **مايتدمجش** مع §UPLOAD فوقه. الفرق مش في if واحدة —
//    اتجاه العنوان، إشارة الفلوس، المرجع الفريد، ومحتوى الطرد كلهم مختلفين،
//    والخلط بينهم بيطلّع شحنة بفلوس في الاتجاه الغلط (MERGE-BRIEF §٤).
// ══════════════════════════════════════════════════════════════

// ─── §RE-UPLOAD::returnItems ───
// اللي بيرجع فعليًا. صورة المرآة لـ §SHOPIFY-RE::outgoingItems، وبنفس الحماية:
// بيتحسب سيرفر-سايد من الدورة المفتوحة **الواحدة**، فالواجهة عمرها ما بتشوف
// `returns[]` ومش قادرة تعيد تجميعها بطريقة ما قبل v5.2.0 (Rule 15 ②).
// بيغذّي `returnSpecs` في **النوعين** — مقيس حيًا: بوسطة بتخزّن الطرد الراجع
// تحت `returnSpecs` في 25 و30 على السواء.
function resolveReturnItems(cycle) {
  return (cycle?.returnLineItems?.edges || [])
    .map((edge) => {
      const li  = edge?.node?.fulfillmentLineItem?.lineItem;
      const qty = edge?.node?.quantity || 1;
      if (!li) return null;
      return {
        label: cleanText(li.sku) || cleanText(li.name) || null,
        qty,
        unitPrice: parseFloat(li.originalUnitPriceSet?.shopMoney?.amount || 0) || 0,
      };
    })
    .filter((row) => row && row.label);
}

// ⚠️ ملاحظة الأوردر بتتلمّ في سطر واحد. حقل `notes` عند بوسطة نص واحد والمندوب
//    بيقراه؛ سطر جديد خام بيكسّر الصف.
//    ⚠️ والـ `note` ملاحظات **داخلية** لخدمة العملاء — الكلام ده بيوصل للمندوب.
function flattenNote(note) {
  const text = cleanText(note).replace(/\s*\n+\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim();
  return text ? text.slice(0, 500) : null;
}

function describeItems(rows) {
  return rows.map((r) => `${r.label} x${r.qty}`).join(' | ').slice(0, 900) || null;
}
function countItems(rows) {
  return rows.reduce((sum, r) => sum + (r.qty || 1), 0);
}
function valueItems(rows) {
  return rows.reduce((sum, r) => sum + (parseFloat(r.unitPrice) || 0) * (r.qty || 1), 0);
}

// ─── §RE-UPLOAD::uniqueRef ───
// 🔴 مقيس حيًا 10-09-2026 — ده **بيناقض** اللي كان مكتوب في `bosta-api-helper`
//    8.3 و`ecommoda-constants` §3.3، فاقرا الجدول مش النص القديم:
//
//   نفس الـ uref والشحنة الأصلية عايشة  → 400 · errorCode "11000"
//   نفس الـ uref بعد terminate           → 201  (الإلغاء **بيحرّر** القيمة)
//   نفس businessReference بـ uref مختلف  → 201  (ده اللي الإكسيل كان بيعمله)
//   نفس الـ uref على **نوع شحنة تاني**   → 400 · "11000" (الفرادة على الحساب كله)
//
// فالحارس حقيقي، وهو بالظبط الحارس اللي عايزينه: بيمنع شحنة تانية بفلوس لدورة
// ليها شحنة، وبيسمح بإعادة رفع مصححة بعد إلغاء الغلط.
//
// `businessReference` بيفضل `order.name` بالحرف — كل سكانرات الستاك بتدوّر بيه —
// والفرادة لكل دورة عايشة في الحقل المخفي ده. **`#12345` لوحده ممنوع هنا**:
// ده بالظبط اللي شحنة s1 بتبعته، فهيصطدم بيها.
function buildUniqueRef(order, jobType) {
  const cycleName = cleanText(order?.currentCycle?.name);
  const n = cycleName.match(/-R(\d+)$/i)?.[1] || null;
  if (!n) {
    return {
      ok: false,
      code: 'CYCLE_NAME_UNPARSEABLE',
      value: cycleName || '—',
      // Rule 13/14 — مفيش رجوع صامت. رقم متخمّن معناه إن نفس الدورة تترفع
      // مرتين تحت مرجعين مختلفين، والاتنين بفلوس.
      action: 'اسم الدورة في شوبيفاي مش على الشكل المتوقع (#12345-R1) — مش قادرين نبني مرجع فريد '
            + 'للشحنة، والرفع اتوقف بدل ما نخمّن رقم ونسمح برفع مكرر بفلوس. راجع الدورة في شوبيفاي.',
    };
  }
  return { ok: true, uref: `${cleanText(order.name)}${jobType === JOB_EXCHANGE ? '-EX' : '-R'}${n}` };
}

// ─── §RE-UPLOAD::resolveCod ───
// 🔴 §UPLOAD فوق بيلف القيمة دي في `Math.abs`. ده **صح هناك** (السالب في s1
//    معناه العميل دفع زيادة) و**كارثة هنا**: بيحوّل «رجّعله ٢٠٠٠» لـ«حصّل منه
//    ٢٠٠٠». الإشارة حمّالة معنى — من ٤ أوردرات R/E مقيسة **٣ سالبين**.
//    ❌ ممنوع نسخ سطر الـ cod من §UPLOAD::buildDeliveryPayload لهنا. ❌
function resolveCod(order) {
  const raw = parseFloat(order?.totalOutstandingSet?.shopMoney?.amount || 0) || 0;
  const cod = Math.max(raw, COD_REFUND_MIN);
  return {
    cod,
    raw,
    // بوسطة بترفض أي حاجة تحت -2000 (400 · errorCode "3008")، فالقص إلزامي —
    // فقط **معلَن**، مش صامت. الباقي بيتسوّى مكتبيًا، والموظف لازم يشوف الرقم.
    // (`#53517`: مستحق 2700 · الملف كان بيكتب 2000 والفرق مايبانش لحد.)
    clipped: raw < COD_REFUND_MIN,
    remainder: raw < COD_REFUND_MIN ? Math.abs(raw - COD_REFUND_MIN) : 0,
  };
}

// ─── §RE-UPLOAD::buildPayloadParts ───
// كل اللي الـ payload محتاجه من الدورة في مكان واحد، عشان التحقق تحت وبنّاء
// الـ payload مايختلفوش عليه أبدًا.
function buildPayloadParts(order, jobType) {
  const cycle    = order?.currentCycle || null;
  const returns  = resolveReturnItems(cycle);
  const outgoing = Array.isArray(order?.outgoingItems) ? order.outgoingItems : [];
  const money    = resolveCod(order);

  // قيمة البضاعة = اللي **بيسافر**. على الاستبدال ده الطرد الخارج؛ على
  // الاسترجاع القطع الراجعة.
  // ⚠️ وعليها تكلفة مباشرة: تأمين تلقائي **`clamp(1% , 10 , 50)`** — و
  //    `shipmentFees` شامله أصلًا، متجمعوش عليه تاني (`bosta-api-helper` 8.9).
  // 🔴 محروسة بين GOODS_MIN وGOODS_MAX في `validateReOrder` — والقيمة هنا
  //    متحسبة من سعر القطع مش من subtotal الأوردر، فالنزول تحت ١٠٠ وارد جدًا.
  const goodsValue = outgoing.length ? valueItems(outgoing) : valueItems(returns);

  return {
    ...money,
    returnItems: returns,
    returnCount: countItems(returns),
    returnDescription: describeItems(returns),
    outgoingCount: countItems(outgoing),
    outgoingDescription: describeItems(outgoing),
    goodsValue: Math.round(goodsValue * 100) / 100,
  };
}

// ─── §RE-UPLOAD::buildRePayload ───
// 🔴 **الاتجاه بيتقلب حسب النوع.** مقيس حيًا 10-09-2026:
//
//              CRP (25)                    Exchange (30)
//   العميل     pickupAddress               dropOffAddress
//   المخزن     dropOffAddress (تلقائي)      pickupAddress (تلقائي)
//
// بوسطة بتملا ناحية المخزن لوحدها من `businessLocationId`. بعت عنوان العميل في
// `dropOffAddress` على CRP بيرجّع HTTP 500
// ("Cannot read properties of undefined (reading 'city')") — **مش 400 نضيف**.
function buildRePayload(order, plan, mode, jobType, parts) {
  const sa = order.shippingAddress || {};

  const fullName  = cleanText(sa.name) || `${cleanText(sa.firstName)} ${cleanText(sa.lastName)}`.trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = cleanText(sa.firstName) || nameParts[0] || '';
  const lastName  = cleanText(sa.lastName)  || nameParts.slice(1).join(' ');

  // 🔴 `wirePhone` مش `normPhone` — الأخيرة مفتاح **مقارنة** فقط. المتجر فيه
  //    تلات أشكال مقيسة، منها `+20 12 71043044` **بمسافات** (`#53849`).
  const phone  = wirePhone(sa.phone);
  const second = wirePhone(order?.customer?.phone || order?.phone);
  const sendSecond = second && normPhone(second) !== normPhone(phone);

  const firstLine = [
    [sa.address1, sa.address2].filter(Boolean).join(' - '),
    `${cleanText(sa.city)}- ${cleanText(sa.province)}`,
  ].filter(Boolean).join(', ').trim();

  // 🔴 الحقل `city` — **مش `cityName`**. الڤاليديتور مش شايف `cityName` أصلًا
  //    وبيتجاهله بصمت، فأي نسخ حرفي من داشبورد بوسطة بيقع في الفخ ده.
  const address = buildAddressObject(plan, mode, firstLine);

  const receiver = { firstName, phone };            // الإلزامي الموثّق
  if (lastName)   receiver.lastName    = lastName;
  if (fullName)   receiver.fullName    = fullName;  // اختياري — **مع** firstName مش بدلها
  if (sendSecond) receiver.secondPhone = second;

  const payload = {
    type: BOSTA_TYPE_BY_JOB[jobType],
    cod: parts.cod,                                  // 🔴 بإشارتها — §RE-UPLOAD::resolveCod
    goodsInfo: { amount: parts.goodsValue },         // ⚠️ تأمين تلقائي clamp(1%,10,50) — 8.9
    receiver,
    // الطرد الراجع — موجود في **النوعين**.
    returnSpecs: {
      packageType: 'Parcel',
      size: 'SMALL',
      packageDetails: { itemsCount: parts.returnCount, description: parts.returnDescription },
    },
    businessLocationId: BOSTA_LOCATION_ID,
    businessReference: cleanText(order.name),        // ق-١ — بالحرف، بالهاش
    uniqueBusinessReference: parts.uref,             // ق-٢ — لكل دورة، مخفي عن أي بحث
    allowToOpenPackage: ALLOW_OPEN_PKG,
  };

  if (jobType === JOB_EXCHANGE) {
    payload.dropOffAddress = address;
    // الطرد الخارج. `analyzeReturnCycles` بترفض استبدال من غير حاجة خارجة
    // (`EXCHANGE_WITHOUT_ITEMS`)، فده عمره ما بيبقى فاضي.
    payload.specs = {
      packageType: 'Parcel',
      size: 'SMALL',
      packageDetails: { itemsCount: parts.outgoingCount, description: parts.outgoingDescription },
    };
  } else {
    payload.pickupAddress = address;
    // مفيش `specs` على CRP — مفيش حاجة خارجة من المخزن. متحقَّق: مقبول (201).
  }

  // ⚠️ `flexShippingInfo` **مابيتبعتش** هنا عن قصد (بعكس s1). بوسطة بتحطها
  //    لوحدها وبتعلّمها `status: "Not Applicable"` على شحنات R/E، فبعتها
  //    مابيغيّرش حاجة.
  const notes = flattenNote(order.note);
  if (notes) payload.notes = notes;                  // `notes` الاسم الرسمي؛ `deliveryNotes` مش موجود
  return payload;
}

// ─── §RE-UPLOAD::validateReOrder ───
// `worker-builder` ⑩① — كل فحص رخيص بيشتغل **قبل** النداء اللي مافيش رجوع منه.
// إنشاء الشحنة بيكلّف فلوس حقيقية؛ رفض بعده بيسيب شحنة مدفوعة محدش طلبها.
function validateReOrder(order, plan, parts, jobType, override) {
  const problems = [];
  const sa = order.shippingAddress || {};

  if (!plan.ok) { problems.push(plan.error); return problems; }

  if (!wirePhone(sa.phone) || normPhone(sa.phone).length < 8) {
    problems.push('رقم تليفون الشحن ناقص أو غير صالح');
  }
  const fullName = cleanText(sa.name) || `${cleanText(sa.firstName)} ${cleanText(sa.lastName)}`.trim();
  if (!fullName) problems.push('اسم المستلم فاضي — firstName إلزامي عند بوسطة');

  const firstLineLen = [sa.address1, sa.address2, sa.city, sa.province].filter(Boolean).join(' ').length;
  if (firstLineLen <= 5) problems.push('العنوان أقصر من الحد الأدنى (أكتر من ٥ حروف)');

  if (parts.cod > COD_MAX) {
    problems.push(`قيمة التحصيل ${parts.cod.toLocaleString('en-US')} أعلى من الحد الموثّق ${COD_MAX.toLocaleString('en-US')}`);
  }
  // 🔴 نفس حارس `§BOSTA::goodsProblems` — والحالة هنا **أقرب بكتير**: قيمة
  //    البضاعة في R/E متحسبة من سعر القطع اللي بتسافر (مش subtotal الأوردر)،
  //    فقطعة راجعة بـ٨٠ جنيه بتدّي `amount: 80` وبوسطة بترفض بـ41591.
  problems.push(...goodsProblems(parts.goodsValue));
  problems.push(...coverageProblems(plan, override));

  // شحنة من غير طرد على أي من الناحيتين مش شحنة. ناحية الاستبدال متمنوعة فوق
  // (`EXCHANGE_WITHOUT_ITEMS`)؛ ده بيمسك ناحية الاسترجاع، اللي مفيش حاجة تانية بتفحصها.
  if (!parts.returnCount) {
    problems.push('مفيش ولا قطعة راجعة في الدورة المفتوحة — الشحنة مالهاش محتوى، الرفع اتوقف');
  }
  if (jobType === JOB_EXCHANGE && !parts.outgoingCount) {
    problems.push('مفيش ولا قطعة خارجة على الاستبدال — الرفع اتوقف');
  }
  return problems;
}

// ─── §RE-UPLOAD::uploadOneRE ───
// أربع حالات مش اتنين — `worker-builder` Step 5A ④.
// 🔴 `warning` هنا معناها **الشحنة موجودة عند بوسطة ومعاها رقم تتبع** وحاجة
//    بعدها ما تمّتش. ممنوع تتعرض كفشل: إعادة الرفع بتشتري شحنة تانية بفلوس.
async function uploadOneRE(env, token, order, catalog, job, override) {
  const actions = [];
  const row = {
    orderId: cleanText(order.id),
    orderGid: cleanText(order.id),
    orderNumber: cleanText(order.name),
    status: 'error',
    actions,
    trackingNumber: null,
    bostaId: null,
    uref: null,
    contractUsed: null,
    addressDegree: null,
    citySent: null,
    cityAuto: null,
    districtSent: null,
    zoneSent: null,
    cityOverridden: false,
    // ─── قياس التدخّل اليدوي على العنوان — نفس §UPLOAD بالحرف (v2.5.0) ───
    districtOverridden: false,
    degreeForced: null,
    addressAnchor: null,
    anchorHit: null,
    anchorApplied: false,
    codSent: null,
    codClipped: false,
    codRemainder: 0,
    // 🔴 اتكتبت حالة S2 فعلًا؟ (استرجاع فقط). السجل بيقرا منه: `valueAfter`
    //    وصف `metafields_change` الاتنين بيتبنوا عليه، فصف بيقول «اتحركت»
    //    وهي ما اتحركتش **مستحيل** — ده بالظبط الصف اللي بيدّي KPIs زمن
    //    الدورة تاريخ اتحرك فيه حاجة على الورق فقط.
    s2Written: false,
    warnings: [],
    // ─── ℹ️ ملحوظات إعلامية — منفصلة عن `warnings` عن قصد (v2.7.0) ───
    // 🔴 `warnings` = **حاجة ناقصة**: الشحنة موجودة عند بوسطة بفلوس وحاجة بعدها
    //    ما تمّتش، والصف بياخد «⚠ تم جزئيًا» عشان الموظف يتدخّل.
    //    `advisories` = العملية **تمّت بالكامل** وفيه معلومة تستاهل تتقال
    //    (المبلغ اتقص عند حد بوسطة · المدينة اتعدّلت يدويًا · العنوان نزل درجة).
    //    الاتنين كانوا في قايمة واحدة، والشرط `warnings.length ? 'warning'`
    //    كان بيدّي **أصفر على صف سليم اتعمل فيه كل حاجة** — والأصفر الكذّاب
    //    بيعلّم الموظف يعدّي على الأصفر الحقيقي (نفس مرض `already` في
    //    `worker-builder` 5A ④). القاعدة الفاصلة: **فيه حاجة محتاجة تدخّل؟**
    //    أيوه = `warnings` · لأ = `advisories`.
    advisories: [],
    error: null,
    logged: true,
  };

  const plan  = resolveAddress(order, catalog);
  row.addressAnchor = plan.addressAnchor?.text || null;
  const parts = buildPayloadParts(order, job.jobType);

  // 🔴 الـ `override` بيتبعت هنا للسبب اللي في `§UPLOAD::uploadOne` بالظبط:
  //    حارس التغطية بيقف **قبل** السطور اللي بتقرا التعديل اليدوي تحت.
  const problems = validateReOrder(order, plan, parts, job.jobType, override);
  if (problems.length) { row.error = problems.join(' · '); return row; }

  const ref = buildUniqueRef(order, job.jobType);
  if (!ref.ok) { row.error = `${ref.code}: ${ref.action}`; return row; }
  row.uref = ref.uref;

  // ─── تعديل الموظف اليدوي — بيغلب المطابقة التلقائية ───
  // 🔴 ممكن يغيّر **المدينة** مش المنطقة فقط: تصنيف بوسطة مش التقسيم الإداري،
  //    والعميل بيغلط في اختيار المحافظة. من غيره الصفوف دي مالهاش حل يدوي —
  //    والمدينة الغلط مش fallback محايد زي المنطقة الناقصة، هي بتحدد الفرع
  //    والتسعيرة.
  // ⚠️ التعديل بيتكتب في `planUsed` نفسه عن قصد: الـ payload وحقول الصف
  //    **ورجوع 3003** كلهم بيقروا منه، فالرجوع بيفضل ماسك المدينة المصححة.
  //    متغير جنبي كان هيبعت الغلط تاني في صمت.
  let mode = plan.mode;
  const planUsed = { ...plan };

  const ovCityId = override?.cityId || null;
  if (ovCityId && ovCityId !== plan.cityId) {
    const ovCity = catalog.cities.find((c) => c.cityId === ovCityId);
    if (!ovCity) {
      row.error = `المحافظة المختارة يدويًا (${ovCityId}) مش موجودة في كتالوج بوسطة — `
                + 'الرفع اتوقف بدل ما يتبعت على المحافظة الأصلية';
      return row;
    }
    planUsed.cityId   = ovCity.cityId;
    planUsed.cityName = ovCity.cityName;
    row.cityOverridden = true;
  }

  if (override?.districtId) {
    const city = catalog.cities.find((c) => c.cityId === planUsed.cityId);
    const { list } = availableDistricts(city);
    const d = list.find((x) => x.id === override.districtId);
    // 🔴 مش لاقيينها = **وقف**، مش رجوع صامت للمطابقة التلقائية. الموظف اختار
    //    منطقة صراحةً؛ الشحن على حاجة تانية من غير ما يعرف = شحنة بفلوس على
    //    عنوان مش اللي وافق عليه.
    if (!d) {
      row.error = `المنطقة المختارة يدويًا مش موجودة (أو مش متاحة للتسليم) في `
                + `محافظة ${planUsed.cityName} عند بوسطة — الرفع اتوقف. افتح النافذة واختر من الأول.`;
      return row;
    }
    mode = 'district';
    planUsed.districtId   = d.id;
    planUsed.districtName = d.name;
    row.districtOverridden = true;
    row.anchorHit = plan.addressAnchor ? plan.addressAnchor.districtId === d.id : null;
  } else if (override?.forceZone) {
    // 🔴 نفس حارس §UPLOAD بالحرف — الوقف مش الرجوع الصامت.
    const z = resolveZoneOverride(catalog, planUsed.cityId, override.zoneId);
    if (!z) {
      row.error = `المدينة المختارة يدويًا مش موجودة (أو كل مناطقها مقفولة للتسليم) في `
                + `محافظة ${planUsed.cityName} عند بوسطة — الرفع اتوقف. افتح النافذة واختر من الأول.`;
      return row;
    }
    mode = 'zone';
    planUsed.zoneId   = z.zoneId;
    planUsed.zoneName = z.zoneName;
    row.degreeForced  = 'zone';
  } else if (override?.forceProvince || row.cityOverridden) {
    mode = 'province';
    row.degreeForced = override?.forceProvince ? 'province' : null;
  }

  const parts2 = { ...parts, uref: ref.uref };

  // 🔴 نفس قاعدة §UPLOAD: الزون الاحتياطي **بيتصفّر لو المدينة اتعدّلت يدويًا**،
  //    لأنه محسوب على المدينة الأصلية اللي الموظف رفضها.
  const fallbackZoneId = row.cityOverridden
    ? null
    : (planUsed.zoneId || planUsed.localZones?.[0]?.zoneId || null);

  // نفس قاعدة §UPLOAD بالحرف — الدرجة اللي اتبعتت فعلًا هي اللي بتتسجّل
  const anchorPlanned = !!plan.districtFromAnchor && !override?.districtId;

  const applyDegree = (m) => {
    const doc = m === 'district' || m === 'zoneName';
    row.contractUsed  = doc ? 'documented' : 'undocumented';
    row.addressDegree = addressDegree(m);
    row.districtSent  = (m === 'district' || m === 'zoneName') ? planUsed.districtName : null;
    row.zoneSent      = m === 'zone' ? (planUsed.zoneName || null) : null;
    row.anchorApplied = anchorPlanned && m === 'district';
    return doc;
  };

  let documented = applyDegree(mode);
  let payload = buildRePayload(order, planUsed, mode, job.jobType, parts2);

  let res;
  try {
    res = await createDelivery(env, payload, documented);
  } catch (e) {
    row.error = e.message;
    return row;
  }

  row.citySent     = planUsed.cityName;
  row.cityAuto     = plan.cityName;
  row.codSent      = parts.cod;
  row.codClipped   = parts.clipped;
  row.codRemainder = parts.remainder;

  // 🔴 سلّم النزول **منطقة ← زون ← محافظة** — نفس منطق §UPLOAD بالظبط، ومن
  //    **نفس** الدالة (`nextAddressDegree`). الشكل هو اللي بيختلف بين الوضعين
  //    (الاتجاه بيتقلب في R/E)، مش ترتيب الدرجات.
  while (!res.ok) {
    const next = nextAddressDegree(mode, res.errorCode, fallbackZoneId);
    if (!next) break;
    // ℹ️ **ملحوظة مش تحذير** (v2.7.0): الشحنة اتعملت كاملة — بوسطة رفضت الدرجة
    //    الأعلى وإحنا نزلنا درجة **بقرارنا**، ومفيش حاجة ناقصة ولا تدخّل مطلوب.
    //    والدرجة اللي اتبعتت فعلًا ظاهرة في عمودي «العقد» و«المنطقة المبعوتة».
    row.advisories.push(next === 'zone'
      ? `بوسطة رفضت المنطقة "${row.districtSent}" — اترفعت على زون "${planUsed.localZones?.[0]?.zone || '—'}" بدلها`
      : `بوسطة رفضت ${row.districtSent ? `المنطقة "${row.districtSent}"` : `الزون "${row.zoneSent}"`} — اترفعت على مستوى المحافظة بدلها`);
    mode = next;
    if (next === 'zone') {
      planUsed.zoneId   = fallbackZoneId;
      planUsed.zoneName = planUsed.zoneName || planUsed.localZones?.[0]?.zone || '';
    }
    documented = applyDegree(mode);
    payload = buildRePayload(order, planUsed, mode, job.jobType, parts2);
    try {
      res = await createDelivery(env, payload, documented);
    } catch (e) {
      row.error = e.message;
      return row;
    }
  }

  if (!res.ok) { row.error = humanizeBostaError(res, job); return row; }

  actions.push(`رفع شحنة ${job.label} على بوسطة (${DEGREE_LABEL[row.addressDegree] || 'بالمحافظة'})`);
  row.trackingNumber = res.trackingNumber;
  row.bostaId        = res.bostaId;

  // ✂ القص **معلَن ومقصود** — حد بوسطة (`errorCode 3008`)، والشحنة اتعملت
  //    بالمبلغ المقصوص بنجاح. ملحوظة للتسوية المكتبية، مش نقص في العملية.
  if (parts.clipped) {
    row.advisories.push(
      `العميل ليه ${Math.abs(parts.raw).toLocaleString('en-US')} — بوسطة هترجّع `
      + `${Math.abs(COD_REFUND_MIN).toLocaleString('en-US')} فقط (حد بوسطة)، والباقي `
      + `${parts.remainder.toLocaleString('en-US')} يتسوّى مكتبيًا`,
    );
  }
  // ✎ توثيق لفعل **الموظف نفسه** — مش حاجة ما تمّتش.
  if (row.cityOverridden) {
    row.advisories.push(`المحافظة اتغيّرت يدويًا من ${row.cityAuto} إلى ${row.citySent}`);
  }

  // 🔴 من هنا ورايح الشحنة **موجودة وبتكلّف فلوس**. أي حاجة بعدها warning،
  //    عمرها ما تبقى error (`worker-builder` ⑩②).
  if (!res.trackingNumber) {
    row.status = 'warning';
    row.warnings.push('بوسطة قبلت الشحنة فقط ما رجّعتش رقم تتبع — دوّر عليها على الداشبورد برقم الأوردر قبل أي إعادة رفع');
    return row;
  }

  // رقم تتبع S2 بقى ليه ميتافيلد من v2.0.0 (`custom.bosta_tracking_number_s2`)
  // + تاج `Bosta_Uploaded_S2`. 🔴 `custom.courier` **مابيتكتبش** هنا — اتتحقّق
  // منه في حارس الدورات قبل الشحنة.
  try {
    const w = await writeBackToShopify(env, token, order, res.trackingNumber, actions, job);
    row.warnings.push(...w);
    // الدالة بترمي على أي كتابة ما اتأكدتش، فالوصول هنا معناه إن الحالة
    // (لو الوضع بيكتبها أصلًا) **اتكتبت واتأكدت** من شوبيفاي.
    row.s2Written = !!job.uploadStatus;
  } catch (e) {
    row.warnings.push(
      `الشحنة اترفعت (${res.trackingNumber}) لكن كتابة رقم التتبع/التاج${job.uploadStatus ? '/الحالة' : ''} على شوبيفاي فشلت: ${e.message} — `
      + '**متعيدش الرفع**، ده بيعمل شحنة تانية بفلوس.',
    );
    row.shopifyWriteFailed = true;
  }

  // 🔴 نفس قاعدة §UPLOAD: `advisories` **مش** بتلوّن الصف (v2.7.0). صف اتعملت
  //    فيه الشحنة والكتابة والتاج والحالة — وكل اللي عليه إن المبلغ اتقص عند
  //    حد بوسطة — **نجاح**، والملحوظة بتتعرض جنبه.
  row.status = row.warnings.length ? 'warning' : 'success';
  return row;
}

// ─── §RE-UPLOAD::runUploadBatch ───
// توازي متحفّظ — بوسطة مابتنشرش حدود استهلاك في أي مصدر رسمي، فالرقم بيتقاس
// مش بيتخمّن.
// ⚠️ النتايج بترجع بترتيب **المدخل** مهما كان ترتيب الانتهاء — الواجهة بتقرن
//    الصفوف بالفهرس (`worker-builder` ⑬).
async function runUploadBatchRE(env, token, orders, catalog, job, overrides) {
  const out = new Array(orders.length);
  let cursor = 0;

  async function worker() {
    while (cursor < orders.length) {
      const i = cursor++;
      const order = orders[i];
      try {
        out[i] = await uploadOneRE(env, token, order, catalog, job, overrides[cleanText(order.id)] || null);
      } catch (e) {
        out[i] = {
          orderId: cleanText(order.id), orderNumber: cleanText(order.name),
          status: 'error', actions: [], warnings: [], advisories: [],
          trackingNumber: null, error: `خطأ غير متوقع: ${e.message}`, logged: true,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONC, orders.length) }, worker));
  return out;
}

// ─── §RE-UPLOAD::buildReRow ───
// صف واحد للواجهة — **نفس شكل** `§UPLOAD::buildRow` عشان الجدول وفلاتره ونافذة
// المنطقة يبقوا كود واحد للتلات أوضاع، وزيادة عليه حقول R/E.
function buildReRow(order, catalog, job, cycleAnalysis) {
  const sa = order.shippingAddress || {};
  const { current, outgoing, info } = cycleAnalysis;
  const enriched = { ...order, currentCycle: current, outgoingItems: outgoing.items };
  const parts = buildPayloadParts(enriched, job.jobType);

  let plan;
  if (!catalog) {
    // 🔴 الكتالوج مش متحمّل ≠ «مفيش مطابقة منطقة». الرسالة لازم تقول السبب
    //    الحقيقي، وإلا الموظف بيفتح النافذة يدوّر على منطقة والقايمة فاضية
    //    وهو فاكر إن العنوان هو المشكلة.
    plan = { ok: false, error: 'كتالوج بوسطة مش متحمّل — مسار الرفع المباشر مقفول. تصدير الإكسيل شغّال عادي.' };
  } else {
    // عزل لكل أوردر: خطة بترمي لازم تكلّف **الصف ده** خطته، مش الدفعة كلها.
    try { plan = resolveAddress(order, catalog); }
    catch (e) { plan = { ok: false, error: `فشل حساب خطة العنوان: ${e.message}` }; }
  }

  // 🔴 نفس قاعدة `§UPLOAD::buildRow`: `all` بتحكم المنع، و`problems` هي اللي
  //    بتتعرض — والفرق بينهم رسالة «خارج التغطية» اللي الجدول بيقولها تلات
  //    مرات تانية أصلًا (بادج الحالة · عمود المنطقة · حالة الرفع).
  const all = info.blocked
    ? [`${info.blockReason.code}: ${info.blockReason.action}`]
    : validateReOrder(enriched, plan, parts, job.jobType);

  const ref = buildUniqueRef(enriched, job.jobType);
  if (!ref.ok && !all.length) all.push(`${ref.code}: ${ref.action}`);

  const covered = coverageProblems(plan);
  const problems = all.filter(p => !covered.includes(p));

  const tags = Array.isArray(order.tags) ? order.tags : [];
  const prevTracking = cleanText(order?.mfTrackS2?.value) || null;
  const hasTag = tags.includes(job.tag);

  return {
    jobType:     job.jobType,
    orderId:     String(order.legacyResourceId || String(order.id).split('/').pop()),
    orderGid:    order.id,
    orderNumber: order.name,
    createdAt:   order.createdAt,
    customer:    (sa.name || `${sa.firstName || ''} ${sa.lastName || ''}`).trim(),
    phone:       sa.phone || '',
    secondPhone: (order.customer?.phone && normPhone(order.customer.phone) !== normPhone(sa.phone))
                   ? order.customer.phone : '',
    province:    sa.province || '',
    provinceCode: sa.provinceCode || '',
    addressCity: sa.city || '',
    address1:    sa.address1 || '',
    address2:    sa.address2 || '',
    s2:          cleanText(order?.s2Status?.value),
    courier:     cleanText(order?.courier?.value),
    // 🔴 بإشارتها. الجدول بيعرض «استرداد» لما تكون سالبة — الموظف لازم يشوف
    //    الاتجاه قبل ما يضغط.
    cod:         parts.cod,
    codRaw:      parts.raw,
    codClipped:  parts.clipped,
    codRemainder: parts.remainder,
    goodsValue:  parts.goodsValue,
    itemsCount:  job.jobType === JOB_EXCHANGE ? parts.outgoingCount : parts.returnCount,
    note:        order.note || '',
    // R/E — الدورة والقطع
    cycleName:      info.currentCycleName,
    cycleCreatedAt: current?.createdAt || null,
    cycleInfo:      info,
    returnItems:      parts.returnItems,
    returnCount:      parts.returnCount,
    returnDescription: parts.returnDescription,
    outgoingItems:    outgoing.items,
    outgoingSource:   outgoing.source,
    outgoingCount:    parts.outgoingCount,
    outgoingDescription: parts.outgoingDescription,
    uref:        ref.ok ? ref.uref : null,
    // حالة الرفع السابق — الصف بيفضل ظاهر ومعاه تنبيه، مش بيتشال
    alreadyUploaded: !!(prevTracking || hasTag),
    previousTracking: prevTracking,
    hasUploadTag: hasTag,
    // خطة العنوان — نفس المفاتيح بالظبط بتاعة s1
    addressOk:    plan.ok,
    addressError: plan.ok ? null : plan.error,
    cityName:     plan.ok ? plan.cityName : '',
    // 🔤 نفس `§UPLOAD::buildRow` بالحرف — الجدول واحد للتلات أوضاع
    cityNameAr:   plan.ok ? (plan.cityNameAr || '') : '',
    cityId:       plan.ok ? plan.cityId : '',
    mode:         plan.ok ? plan.mode : 'blocked',
    districtId:   plan.ok ? (plan.districtId || null) : null,
    districtName: plan.ok ? (plan.districtName || null) : null,
    districtNameAr: plan.ok ? (plan.districtNameAr || '') : '',
    ambiguous:    plan.ok ? !!plan.ambiguous : false,
    candidates:   plan.ok ? (plan.candidates || []) : [],
    cityDoubt:    plan.ok ? !!plan.cityDoubt : false,
    crossCity:    plan.ok ? (plan.crossCity || []) : [],
    localZones:   plan.ok ? (plan.localZones || []) : [],
    zoneId:       plan.ok ? (plan.zoneId || null) : null,
    zoneName:     plan.ok ? (plan.zoneName || null) : null,
    zoneNameAr:   plan.ok ? (plan.zoneNameAr || '') : '',
    zoneDistrictCount: plan.ok ? (plan.zoneDistrictCount || 0) : 0,
    // 🔍 نفس `§UPLOAD::buildRow` بالحرف — النافذة واحدة للتلات أوضاع
    addressAnchor: plan.ok ? (plan.addressAnchor || null) : null,
    districtFromAnchor: plan.ok ? !!plan.districtFromAnchor : false,
    blockedDistricts:  plan.ok ? (plan.blockedDistricts || []) : [],
    catalogWarning: plan.ok ? plan.catalogWarning : null,
    problems,
    // 🔴 من القايمة **الكاملة** — شيل الرسالة من العرض مايشيلش المنع
    uploadable:  all.length === 0,
    // 🔴 نفس `§UPLOAD::buildRow` بالحرف — موقوف بسبب التغطية وفقط، يعني اختيار
    //    منطقة يدويًا بيحرّره. ⚠️ وحارس الدورات **مش** بيتحرّر بالتعديل اليدوي:
    //    صف `info.blocked` بيدخل في `problems` فبيطفّي العلم ده تلقائيًا.
    coverageOnly: !problems.length && plan.ok && plan.mode === 'coverageBlocked',
  };
}

// ─── §RE-UPLOAD::fetchReRows ───
async function fetchReRows(env, token, job, catalog) {
  const discovery = await fetchReDiscovery(env, token, job);
  const ids = discovery.candidates.map(o => o.id);
  const rows = [];
  let fallbackPossible = false, blockedCount = 0, warnedCount = 0;

  for (const group of chunks(ids, DETAILS_BATCH_SIZE)) {
    const details = await fetchNodesWithCostFallback(env, token, buildReDetailsQuery(), group, 'fetchReDetails');
    if (details.length !== group.length) fallbackPossible = true;

    for (const order of details) {
      // إعادة الفحص على القيم نفسها — فلتر الميتافيلد ممكن يوسّع النتيجة.
      if (cleanText(order?.s2Status?.value) !== job.expectedStatus) continue;
      if (cleanText(order?.courier?.value).toLowerCase() !== COURIER_VALUE.toLowerCase()) continue;

      const analysis = analyzeReturnCycles(order, job.jobType);
      if (analysis.info.blocked) blockedCount += 1;
      else if (analysis.info.warnings.length) warnedCount += 1;

      // 🔴 `returns` و`lineItems` **مش** بيرجعوا للواجهة عن قصد: الصفحة بتاخد
      //    الدورة المفتوحة الواحدة والقطع المحسوبة، فالتجميع الغلط بتاع ما قبل
      //    v5.2.0 بقى **مستحيل** من الفرونت إند (Rule 15 ②).
      rows.push(buildReRow(order, catalog, job, analysis));
    }
  }

  return {
    rows,
    pageInfo: {
      ...discovery.pageInfo,
      discoveryCount: discovery.candidates.length,
      detailBatchSize: DETAILS_BATCH_SIZE,
      detailsFetched: rows.length,
      detailsFallbackPossible: fallbackPossible,
      blockedByCycles: blockedCount,
      warnedByCycles: warnedCount,
    },
  };
}

// ─── §RE-UPLOAD::normalizeOrderPayload ───
// الواجهة بتبعت IDs وأسماء فقط؛ العنوان والفلوس ومحتوى الدورة كلهم بيتقروا من
// شوبيفاي **وقت الرفع**، مش من شاشة ممكن تكون بقالها دقايق.
function normalizeOrderPayload(orders) {
  if (!Array.isArray(orders)) return [];
  const seen = new Set();
  const out = [];
  for (const o of orders) {
    const id = cleanText(o?.id || o?.orderGid);
    const name = cleanText(o?.name || o?.orderNumber);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id, name,
      s2Status: cleanText(o?.s2Status || o?.s2),
      courier:  cleanText(o?.courier),
      // الدورة المفتوحة اللي الصف ده بتاعها — نص مفتاح فحص تكرار الإكسيل (v5.3.0)
      cycleName:      cleanText(o?.cycleName) || null,
      cycleCreatedAt: cleanText(o?.cycleCreatedAt) || null,
    });
  }
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

    const url    = new URL(request.url);
    const action = url.searchParams.get('action') || '';

    // ALWAYS second: WORKER_SECRET
    // 🔴 السر الناقص (أو اللي اتضاف من غير Promote) بيخلّي القالب ينتج القيمة
    //    الحرفية `"Bearer undefined"` — وأي طلب بالهيدر ده **بيعدّي**. يعني
    //    غياب السر كان بيشيل الحماية بدل ما يشدّدها.
    // ⚠️ `diag` و`get_config` بيعدّوا **من الاتنين** (الحارس وفحص الـ auth) لما
    //    السر يكون غايب — دول مسار التشخيص، ومن غير الاستثناء ده الرسالة بتقول
    //    «شغّل ?action=diag» وهي حاجباه، وفحص السر جوّه `diag` بيبقى كود ميت.
    //    والكشف محدود بحالة «Worker مالوش سر أصلًا» — وهي الحالة اللي كانت
    //    بتفتح كل الـ endpoints قبل الحارس ده.
    const DIAG_ACTIONS = new Set(['diag', 'get_config']);
    const secretMissing = typeof env.WORKER_SECRET !== 'string' || env.WORKER_SECRET.trim() === '';

    if (secretMissing && !DIAG_ACTIONS.has(action))
      return new Response(JSON.stringify({
        error: 'WORKER_SECRET مش مضبوط على الـ Worker — ضِفه من Settings → Variables '
             + 'وبعدين Deployments → Promote version. (شغّل ?action=diag)',
      }), { status: 500, headers: getCORS(request) });

    if (!secretMissing) {
      const auth = request.headers.get('Authorization');
      if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: getCORS(request),
        });
    }

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
          // 🔴 غياب `read_all_orders` **مابيرجّعش خطأ** — بيرجّع صفر نتيجة على أي
          //    أوردر أقدم من ٦٠ يوم. الأداة دي بتفلتر من START_DATE، فأول ما
          //    التاريخ ده يعدّي الـ ٦٠ يوم الأوردرات القديمة بتختفي من القايمة
          //    في صمت والموظف بيفتكرها اترفعت. الفحص هنا هو الإشارة الوحيدة.
          checks.push({
            ok: scopes.includes('read_all_orders'),
            label: 'صلاحية read_all_orders',
            detail: scopes.includes('read_all_orders')
              ? 'موجودة — الأوردرات الأقدم من ٦٠ يوم بتظهر'
              : 'ناقصة! أي أوردر أقدم من ٦٠ يوم هيرجع **صفر نتيجة بدون خطأ** — مش رسالة صلاحية',
          });
          checks.push({ ok: true, label: 'صلاحيات التطبيق (معلومة)', detail: scopes.join(', ') || '—' });

          // أنواع الميتافيلدات الحية — التطابق الحرفي شرط لنجاح metafieldsSet
          const md = await shopifyGQL(env, token, `
            query { metafieldDefinitions(first: 50, ownerType: ORDER, namespace: "custom") {
              nodes { key type { name } } } }`, {}, 'diagMfDefs');
          const defs = new Map((md.data?.metafieldDefinitions?.nodes || []).map(n => [n.key, n.type?.name]));
          for (const mf of [MF_COURIER, MF_TRACKING_S1, MF_TRACKING_S2, MF_S2_STATUS, MF_PRINTING_S2]) {
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
          const blockedD = cat.cities.reduce((s, c) => s + availableDistricts(c).blocked.length, 0);
          const missing = cat.cities.filter(c => availableDistricts(c).fieldMissing).length;
          checks.push({
            ok: availD > 0,
            label: 'كتالوج بوسطة',
            detail: `${cat.cities.length} مدينة · ${totalD} منطقة · ${availD} متاحة للتسليم` +
                    (missing ? ` · ⚠️ ${missing} مدينة من غير dropOffAvailability` : ''),
          });
          // 🔴 العدد ده هو إجابة السؤال ٤ في «تجارب حية مفتوحة» بتاعة
          //    `bosta-api-helper` Step 9 — والمقيس لحد دلوقتي جنوب سيناء فقط
          //    (٢ من ٩). القراءة نضيفة ومفيهاش أي أثر، فمكانها الفحص الذاتي.
          //    المناطق دي **بتتعرض للموظف معلّمة** ومابتتبعتش لبوسطة (8.11).
          checks.push({
            ok: true,
            label: 'مناطق مقفولة للتسليم',
            detail: `${blockedD} منطقة dropOffAvailability=false من ${totalD} — `
                  + 'بتتعرض في نافذة الاختيار معلّمة، ومابتتبعتش لبوسطة. '
                  + 'العنوان اللي بيطابق واحدة منها **بيوقف الصف** بدل ما ينزل للمحافظة.',
          });
        } catch (e) { checks.push({ ok: false, label: 'كتالوج بوسطة', detail: e.message }); }

        // تغطية الزون — الفرق بين «مفيش زون في الكتالوج» و«المنطقة دي بلا زون»
        // لازم يبان. من غير الفحص ده، عمود زون فاضي في النافذة بيبقى غامض.
        try {
          const cat = await getCatalog(env);
          let withZone = 0, withZoneId = 0, totalD = 0;
          const zones = new Set();
          for (const c of cat.cities) {
            for (const d of availableDistricts(c).list) {
              totalD++;
              const z = d.zone || d.zoneAr;
              if (z) { withZone++; zones.add(`${c.cityName}/${z}`); }
              if (d.zoneId) withZoneId++;
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
          // 🔴 الاسم **مش** كفاية لدرجة الزون — اللي بيترفع هو `zoneId` (8.10.4).
          //    لو الكتالوج راجع بأسماء زون من غير ids، درجة الزون بتتعطّل بالكامل
          //    والأوردرات بتنزل للمحافظة **في صمت**. الفحص ده هو الإشارة الوحيدة.
          checks.push({
            ok: withZoneId > 0 || withZone === 0,
            label: 'zoneId في الكتالوج (درجة الزون)',
            detail: withZoneId
              ? `${withZoneId} من ${totalD} منطقة معاها zoneId — درجة الزون شغّالة`
              : `صفر zoneId رغم إن ${withZone} منطقة ليها اسم زون — **درجة الزون متعطّلة**، `
                + `وكل أوردر مالوش مطابقة منطقة هينزل للمحافظة وياخد هب افتراضي.`,
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

        // ─── الاسترجاع/الاستبدال (v2.0.0) ───
        // 🔴 مسار `upload_re` **ما اشتغلش حي ولا مرة** لحد 13-09-2026. الفحص
        //    هنا بيقول إن الفلتر شغّال وبيرجّع عدد — مش إنه اتجرّب.
        try {
          const token = await getAccessToken(env);
          const Q = `query CountS2($q: String!) { ordersCount(query: $q, limit: 10000) { count precision } }`;
          for (const jt of [JOB_RETURN, JOB_EXCHANGE]) {
            const j = getJob(jt);
            const d = await shopifyGQL(env, token, Q, { q: reCandidateQuery(j.expectedStatus) }, `diagS2_${jt}`);
            const n = d.data?.ordersCount?.count;
            checks.push({
              ok: n != null,
              label: `فلتر ${j.label} (S2)`,
              detail: n != null
                ? `${n} أوردر · ${j.expectedStatus} + courier:${COURIER_VALUE} → ${j.nextStatus}`
                : 'ordersCount رجّع قيمة فاضية',
            });
          }
        } catch (e) { checks.push({ ok: false, label: 'فلاتر S2', detail: e.message }); }

        // قيم `tool` اللي الأداة بتكتب تحتها — الدمج ساب **قيمتين** عن قصد،
        // والفحص ده هو اللي بيخلي ده مكتوب بدل ما يتكشف من صف سجل غريب.
        checks.push({
          ok: true, label: 'قيم tool في D1',
          detail: `s1 → ${TOOL_NAME} · استرجاع/استبدال → ${TOOL_NAME_RE} · `
                + `تاب السجل بيقرا الاتنين (MERGE-BRIEF §٥ اختيار «أ»، مؤقت)`,
        });

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
              // ⚠️ عدد المناطق المقفولة **مش بيترجع** عن قصد (v2.1.1، بطلب أحمد):
              //    الرقم مالوش أثر على أي قرار — اللي بيفرق هو إن **المنطقة دي
              //    بالذات** مقفولة، وده باين عليها في قايمة مناطق المدينة نفسها.
              //    (المقفولة نفسها لسه بترجع كاملة في `blockedDistricts` تحت.)
            })).sort((a, b) => a.cityName.localeCompare(b.cityName)),
          }, 200, request);
        }
        const city = cat.cities.find(c => c.cityId === cityId);
        const { list, blocked, fieldMissing } = availableDistricts(city);
        const shape = d => ({ id: d.id, name: d.name, nameAr: d.nameAr,
                              zone: d.zone, zoneAr: d.zoneAr, zoneId: d.zoneId || null,
                              bulkyBlocked: !!d.bulkyBlocked });
        return json({
          ok: true, cityId, cityName: city?.cityName || '', cityAr: city?.cityAr || '',
          fieldMissing,
          // 🔴 المدينة نفسها ممكن تكون مقفولة للتسليم — الحقل موجود على مستوى
          //    المدينة كمان مش المنطقة فقط (`bosta-api-helper` 8.6).
          cityDropOff: city?.cityDropOff,
          // الزون بيترجع بالاسمين **ومعاه `zoneId`** — الاسم للعرض، والـ id هو
          // اللي بيترفع فعلًا في درجة الزون (8.10.4).
          districts: list.map(shape),
          // 🔴 المقفولة بتترجع **معلّمة، مش متشالة** (8.11). الإخفاء الصامت
          //    بيخلّي الموظف يشوف قايمة ناقصة ويفتكر إن العنوان محتاج «محافظة
          //    فقط»، وهو أصلًا **برّه تغطية بوسطة** والشحنة هترجع بعد أيام.
          blockedDistricts: blocked.map(shape),
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
                          status: 'error', actions: [], warnings: [], advisories: [], trackingNumber: null,
                          error: 'الأوردر مش موجود على شوبيفاي (اتحذف أو الـ ID غلط)', logged: true };
            await logRow(env, row, employee);
            return row;
          }

          // 🔴 الرفع المكرر: تحذير + تأكيد صريح من الموظف، والمنع الفعلي عند بوسطة
          //    عبر uniqueBusinessReference. المنع الكامل من عندنا بيقفل حالات
          //    حقيقية (شحنة اتلغت عند بوسطة والأوردر لسه شايل رقم قديم).
          const prevTracking = previousTrackingS1(order);
          const hasTag = (order.tags || []).includes(UPLOAD_TAG_BY_JOB[JOB_S1]);
          if ((prevTracking || hasTag) && !item.allowDuplicate) {
            const row = {
              orderId: String(order.legacyResourceId), orderNumber: order.name,
              status: 'skipped', skipped: true, actions: [], warnings: [], advisories: [], trackingNumber: null,
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
                    status: 'error', actions: [], warnings: [], advisories: [], trackingNumber: null,
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

      // ─── §RE-ENDPOINTS — الاسترجاع/الاستبدال ──────────────────────
      // 🔴 الأربعة دول اتنقلوا من `Bosta-Return-Exchange-Exporter` v6.0.0.
      //    `upload_re` **بينشئ شحنات حقيقية بفلوس**.

      if (action === 'fetch_candidates') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const body = await request.json().catch(() => ({}));
        const job  = getJob(body.jobType, { allow: RE_JOBS });
        const token = await getAccessToken(env);

        // ⚠️ الكتالوج best-effort: بوسطة مش شغّالة **مايوقفش** مسار الإكسيل.
        //    الفشل بيترجع بدل ما يترمي، والصفوف بتوصل من غير خطة عنوان وزرار
        //    الرفع المباشر بيتقفل مع السبب. `addressPlan: null` في صمت كان
        //    هيتقرا «مفيش مطابقة منطقة» وده معنى تاني خالص.
        let catalog = null, catalogError = null;
        try { catalog = await getCatalog(env, { force: url.searchParams.get('refresh') === '1' }); }
        catch (e) { catalogError = e.message; }

        const result = await fetchReRows(env, token, job, catalog);

        // 🔴 **الفحص مابيتسجّلش** (v2.4.0 · طلب أحمد 15-09-2026). كان بيتكتب صف
        //    `type: 'scan'` مع **كل** نداء — وده بيحصل على كل فتحة للشاشة وكل
        //    تبديل وضع وكل «تحديث»، يعني عشرات الصفوف اليومية لقراءة **مالهاش
        //    أي أثر** (مفيش كتابة على شوبيفاي ولا شحنة عند بوسطة). النتيجة إن
        //    صفوف الرفع الحقيقية بتغرق وسطها، والرفع هو اللي السجل موجود عشانه.
        //    ⚠️ الصفوف التاريخية بتاعة `scan` **ما اتمسحتش** من D1، وقيمة
        //    `scan` لسه في فلتر نوع العملية في الواجهة عشان تفضل قابلة للقراءة.
        //    ووضع الشحن العادي (`get_orders`) ماكانش بيسجّل فحص من الأصل —
        //    فده بيوحّد السلوك بين التلات أوضاع.

        return json({
          ok: true,
          version: WORKER_VERSION,
          jobType: job.jobType,
          expectedStatus: job.expectedStatus,
          nextStatus: job.nextStatus,
          fetchedAt: new Date().toISOString(),
          query: result.pageInfo.searchQuery,
          catalogLoaded: !!catalog,
          catalogError,
          catalogFetchedAt: catalog?.fetchedAt || null,
          truncated: result.pageInfo.stoppedByLimit,
          pages: result.pageInfo.pagesFetched,
          pageInfo: result.pageInfo,
          rows: result.rows,
        }, 200, request);
      }

      // 🔴 بينشئ شحنات **حقيقية ومدفوعة**. ترتيب الأفعال مثبّت بـ
      //    `worker-builder` ⑩: كل فحص رخيص الأول، النداء اللي مافيش رجوع منه
      //    بعده، وكل حاجة بعده **تحذير مش خطأ**.
      if (action === 'upload_re') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify', 'bosta');
        const body = await request.json().catch(() => ({}));
        const job  = getJob(body.jobType, { allow: RE_JOBS });
        const employee = cleanText(body.employee) || null;
        const orders = normalizeOrderPayload(body.orders || body.items);
        const overrides = body.overrides && typeof body.overrides === 'object' ? body.overrides : {};

        if (!employee)     return json({ ok: false, error: 'employee مطلوب' }, 400, request);
        if (!orders.length) return json({ ok: false, error: 'مفيش أوردرات محددة' }, 400, request);
        // ② من سلسلة السقوف التلاتة — حارس لصق وسقف الـ subrequests بتاع
        //    Cloudflare، **مش** حجم الـ chunk بتاع الصفحة ولا سقف تكلفة الاستعلام.
        if (orders.length > MAX_BATCH) {
          return json({ ok: false, error: `أقصى عدد في الدفعة ${MAX_BATCH} أوردر — قسّم الرفع` }, 400, request);
        }

        const token = await getAccessToken(env);

        // ① دورة مفتوحة واحدة، **متقرية من شوبيفاي** مش متصدّقة من الصفحة —
        //    والكوريَر بيتتأكد هنا كمان (طلب أحمد: بنتحقق مش بنكتب).
        //    الحارس ده كان قدام ميتافيلد؛ دلوقتي قدام شحنة مدفوعة.
        const blockedCycles = await findBlockedCycleOrders(env, token, orders, job.jobType);
        if (blockedCycles.length) {
          const { logged, logError } = await logCycleBlocks(env.DB, blockedCycles, job, employee);
          return json({
            ok: false, code: 'CYCLE_BLOCKED',
            error: 'فيه أوردرات حالتها مش واضحة (دورات الاسترجاع أو الكوريَر) — اتمنع الرفع على بوسطة لحد ما تتصلّح في شوبيفاي',
            blocked: blockedCycles, logged, logError,
          }, 409, request);
        }

        // ② إعادة قراءة الصفوف كاملة من شوبيفاي.
        const catalog = await getCatalog(env);
        const fresh = await fetchNodesWithCostFallback(
          env, token, buildReDetailsQuery(), orders.map((o) => o.id), 'uploadReDetails');
        const byId = new Map();
        const lateBlocks = [];
        for (const order of fresh) {
          const { current, outgoing, info } = analyzeReturnCycles(order, job.jobType);
          // الحارس فوق اشتغل على استعلام تاني أرخص. إعادة الفحص على القراءة
          // الكاملة بتقفل الشباك بين الاتنين: دورة اتغيّرت في الثواني دي كانت
          // هتتشحن برضه. رخيص هنا لأن التحليل ده بيتحسب على أي حال.
          if (info.blocked) {
            lateBlocks.push({
              id: order.id, name: order.name,
              s2Status: cleanText(order?.s2Status?.value) || null,
              code: info.blockReason.code, value: info.blockReason.value, action: info.blockReason.action,
            });
            continue;
          }
          byId.set(order.id, { ...order, currentCycle: current, outgoingItems: outgoing.items });
        }
        if (lateBlocks.length) {
          const { logged, logError } = await logCycleBlocks(env.DB, lateBlocks, job, employee);
          return json({
            ok: false, code: 'CYCLE_BLOCKED',
            error: 'حالة الدورات اتغيّرت بين الفحص والرفع — الرفع اتوقف قبل أي شحنة',
            blocked: lateBlocks, logged, logError,
          }, 409, request);
        }

        const missing = orders.filter((o) => !byId.has(o.id));
        if (missing.length) {
          // `worker-builder` Step 5A ④ — «ما قدرناش نقراه» عمرها ما تبقى «تمام».
          return json({
            ok: false, code: 'ORDER_NOT_READABLE',
            error: 'شوبيفاي ما رجّعتش كل الأوردرات وقت الرفع — الرفع اتوقف كله بدل ما يتم على جزء',
            missing: missing.map((o) => o.name),
          }, 409, request);
        }

        // ③ الجزء اللي مافيش رجوع منه.
        const ordered = orders.map((o) => byId.get(o.id));
        const results = await runUploadBatchRE(env, token, ordered, catalog, job, overrides);

        // ④ 🔴 **الحالة بتتحرّك في الاسترجاع لوحده** (v2.3.0 · طلب أحمد
        //    15-09-2026): `status_2_r_e → In-Return`. الاستبدال والشحن العادي
        //    **لسه** مابيحركوش الحالة — نقلة `Ready` بتحصل عند **الطباعة**،
        //    وتقديمها من هنا بيكسر بوابة الطباعة.
        //    🔴 والكتابة نفسها **مش هنا** — عايشة في `writeBackToShopify` جوّه
        //    نفس نداء رقم التتبع، صف بصف. كتابة مجمّعة بعد الدفعة كانت هتحرّك
        //    حالة أوردر **شحنته فشلت** في نفس الدفعة، أو تسيب أوردر ناجح بحالة
        //    قديمة لو الكتابة المجمّعة وقعت. `r.s2Written` هو الأثر الوحيد
        //    المعتمد إن النقلة حصلت فعلًا.
        //    ⚠️ `printing_time_s2` **لسه مابيتكتبش** — ده وقت طباعة، وكتابته
        //    وقت الرفع بتخلي أي تقرير مبني عليه يقول إن البوليصة اتطبعت وهي لأ.
        //    ⚠️ `setS2Status`/`verifyS2Status` **لسه موجودين لمسار الإكسيل**
        //    (`confirm_upload`) — هناك الشحنة بتتعمل من الداشبورد بالإيد،
        //    فالتحديث خطوة يدوية منفصلة بمودال وchecklist.
        // ⏱️ ختم زمني واحد لكل صفوف الدفعة — عشان يبانوا عملية واحدة في السجل.
        const now = nowToSecond();

        // ⑤ السجل. `type` بيتقسم **بالأثر الخارجي** (`worker-builder` ⑭) —
        //    عشان كده رفع فاشل وكتابة رجعية فاشلة قيمتين مختلفتين: واحدة آمنة
        //    لإعادة المحاولة والتانية لأ.
        const logRows = results.map((r, i) => {
          const order = orders[i];
          const type = r.status === 'error' ? job.uploadFailType
                     : r.shopifyWriteFailed ? job.writeFailType
                     : job.uploadedType;
          return {
            timestamp: now,
            tool: job.tool,
            type,
            employee,
            orderId: order.id,
            orderName: order.name,
            // 🔴 `valueAfter` بيتقرا من **`r.s2Written`** مش من `job.uploadStatus`:
            //    الأول حقيقة مؤكَّدة من شوبيفاي، والتاني نيّة. الصف اللي شحنته
            //    نجحت وكتابته فشلت بيفضل `before == after` — وده الصح، الحالة
            //    فعلًا مكانها. وفي الاستبدال (`uploadStatus = null`) القيمتين
            //    بيفضلوا متساويين دايمًا: مفيش نقلة بتحصل في الرفع أصلًا.
            valueBefore: order.s2Status || job.expectedStatus,
            valueAfter:  r.s2Written ? job.uploadStatus : (order.s2Status || job.expectedStatus),
            notes: r.status === 'error'
              ? `فشل رفع ${job.label} على بوسطة — ${r.error}`
              : (() => {
                  const notes = [...(r.warnings || []), ...(r.advisories || [])];
                  return `رفع ${job.label} على بوسطة · تتبع ${r.trackingNumber || '—'}`
                       + (notes.length ? ` · ${notes.join(' · ')}` : '');
                })(),
            extra: {
              jobType: job.jobType,
              result: r.status,
              // نقلة الحالة كأثر خارجي منفصل عن الشحنة — القياس بيفرّق بين
              // «الشحنة اتعملت» و«الأوردر اتحرك».
              s2_status_written: !!r.s2Written,
              s2_status_after: r.s2Written ? job.uploadStatus : null,
              tracking_number: r.trackingNumber,
              bosta_id: r.bostaId,
              uniqueBusinessReference: r.uref,
              businessReference: order.name,
              contract_used: r.contractUsed,
              // 🔴 الزون والمحافظة على نفس العقد — الدرجة هي اللي بتفرّق (8.10.4)
              address_degree: r.addressDegree,
              city_sent: r.citySent,
              city_auto: r.cityAuto,
              // القياس اللي بيقول أنهي مدن تستاهل صف في جدول المحافظات بدل
              // تدخّل يدوي كل مرة.
              city_overridden: !!r.cityOverridden,
              // نفس حقول §UPLOAD::logRow بالحرف — الوضعين بيتقروا مع بعض
              district_overridden: !!r.districtOverridden,
              degree_forced: r.degreeForced,
              address_anchor: r.addressAnchor,
              anchor_applied: !!r.anchorApplied,
              anchor_hit: r.anchorHit,
              district_sent: r.districtSent,
              zone_sent: r.zoneSent || null,
              codSent: r.codSent,
              codClipped: r.codClipped,
              codRemainder: r.codRemainder,
              cycleName: order.cycleName || null,
              actions: r.actions,
              // 🔴 نفس تقسيم §UPLOAD::logRow (v2.7.0) — `warnings` محتاجة
              //    تدخّل، و`advisories` ملحوظة على عملية تمّت (القص · تعديل
              //    المدينة · نزول الدرجة).
              warnings: r.warnings,
              advisories: r.advisories || [],
              error: r.error,
            },
          };
        });

        // ⑥ تاريخ الحالة عبر الأدوات. KPIs زمن الدورة بتتقرا من
        //    `tool = 'metafields_change'` **فقط**، فنقلة مش مكتوبة هناك = نقلة
        //    مش موجودة في أي تقرير. الصف بيتكتب للصفوف اللي `s2Written` فيها
        //    فقط — اللي اتأكدت من شوبيفاي فعلًا.
        //    ⚠️ لحد v2.2.0 كان مسار الإكسيل (`confirm_upload`) هو **المصدر
        //    الوحيد** للصفوف دي، لأن الرفع ماكانش بيحرّك حالة أصلًا. بقى
        //    مصدرين من v2.3.0 — والاتنين بيكتبوا نفس الشكل بالظبط.
        const mfChangeRows = results.flatMap((r, i) => {
          if (!r.s2Written) return [];
          const order = orders[i];
          const before = order.s2Status || job.expectedStatus;
          return [{
            timestamp: now, tool: 'metafields_change', type: 'update', employee,
            orderId: order.id, orderName: order.name,
            valueBefore: before,
            valueAfter: job.uploadStatus,
            notes: `status_2_r_e: ${before} → ${job.uploadStatus} (via ${job.tool} · ${job.uploadedType})`,
            extra: {
              metafieldKey: 'custom.status_2_r_e', sourceTool: job.tool,
              jobType: job.jobType, source: 'upload_re',
              tracking_number: r.trackingNumber,
            },
          }];
        });

        let logged = true, logError = null;
        try {
          await writeLogsBatch(env.DB, logRows);
          await writeLogsBatch(env.DB, mfChangeRows);
        } catch (e) {
          // Step 5A ⑦ — فشل D1 مابيلغيش الشحنات، لكن ممنوع يبقى صامت.
          logged = false; logError = e.message;
        }

        const summary = {
          success: results.filter(r => r.status === 'success').length,
          warning: results.filter(r => r.status === 'warning').length,
          error:   results.filter(r => r.status === 'error').length,
          skipped: 0,
        };
        return json({
          ok: true, version: WORKER_VERSION, jobType: job.jobType,
          // ⚠️ عقد الترتيب: `results[i]` بتاع `orders[i]` من الطلب، مهما كان
          //    ترتيب انتهاء الرفع.
          results, summary, counts: summary, logged, logError,
        }, 200, request);
      }

      // الرجوع. الإلغاء **بيحرّر** `uniqueBusinessReference` فإعادة الرفع بعد
      // التصحيح بتعدّي — الإقران ده هو سبب وجود الـ endpoint بدل زيارة الداشبورد.
      if (action === 'cancel_re') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'bosta');
        const body = await request.json().catch(() => ({}));
        const employee       = cleanText(body.employee);
        const trackingNumber = cleanText(body.trackingNumber);
        const orderId  = cleanText(body.orderId)   || null;
        const orderName = cleanText(body.orderName) || null;
        const reason   = cleanText(body.reason)    || null;
        const job = getJob(body.jobType || JOB_RETURN, { allow: RE_JOBS });

        if (!employee)       return json({ ok: false, error: 'employee مطلوب' }, 400, request);
        if (!trackingNumber) return json({ ok: false, error: 'trackingNumber مطلوب' }, 400, request);

        const res = await terminateDelivery(env, trackingNumber);

        let logged = true, logError = null;
        try {
          await writeLog(env.DB, {
            tool: job.tool, type: CANCEL_TYPE, employee, orderId, orderName,
            notes: res.ok
              ? (res.alreadyGone
                  ? `الشحنة ${trackingNumber} كانت ملغية عند بوسطة خلاص${reason ? ` — ${reason}` : ''}`
                  : `إلغاء شحنة بوسطة ${trackingNumber}${reason ? ` — ${reason}` : ''}`)
              : `فشل إلغاء شحنة بوسطة ${trackingNumber} — ${res.message}`,
            extra: {
              jobType: job.jobType, trackingNumber,
              // `already` = العملية المطلوبة محصّلها تمّ، لكن مش دلوقتي
              // (`ecommoda-constants` §12) — مش نجاح جديد ومش فشل.
              result: res.ok ? (res.alreadyGone ? 'already' : 'success') : 'error',
              status: res.status,
              errorCode: res.errorCode || null, message: res.message || null, reason,
            },
          });
        } catch (e) { logged = false; logError = e.message; }

        if (!res.ok) {
          return json({ ok: false, error: `فشل الإلغاء: ${res.message}`, status: res.status, logged, logError }, 502, request);
        }
        return json({
          ok: true, trackingNumber,
          // 🔴 الإلغاء المكرر **نجاح**، مش فشل (8.7). من غير التفرقة دي الموظف
          //    بيقرا «فشل الإلغاء» على شحنة اتلغت فعلًا، ويروح داشبورد بوسطة
          //    يدوّر على حاجة مش موجودة.
          alreadyGone: !!res.alreadyGone,
          // 🔴 حالة S2 **مابترجعش** هنا عن قصد. إرجاع نقلة حالة قرار تاني غير
          //    إلغاء شحنة، وتخمين اللي الموظف قصده بيعيد كتابة حالة حية.
          //    وكمان رقم التتبع في `custom.bosta_tracking_number_s2` بيفضل —
          //    امسحه بالإيد لو الشحنة مش هتترفع تاني.
          note: (res.alreadyGone
            ? 'الشحنة دي كانت ملغية عند بوسطة خلاص — مفيش حاجة اتعملت دلوقتي. '
            : 'الشحنة اتلغت عند بوسطة. ')
            + 'حالة الأوردر على شوبيفاي ما اتغيّرتش — غيّرها يدويًا لو محتاج.',
          logged, logError,
        }, 200, request);
      }

      // ─── §EXCEL-ENDPOINTS — الخطة البديلة (اتسابت بقرار أحمد) ──────
      // ⚠️ الإكسيل **مش** طريق ميت: عقد بوسطة ممكن يتغيّر، والمفتاح ممكن ما
      //    يكونش متاح، والـ API ممكن يرفض أوردر معيّن. الصفوف اللي بتتكتب من
      //    هنا لسه بتتقرا في فحص التكرار.
      if (action === 'check_export_duplicates') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const body = await request.json().catch(() => ({}));
        getJob(body.jobType, { allow: RE_JOBS });
        const orders = normalizeOrderPayload(body.orders);
        if (!orders.length) return json({ ok: false, error: 'مفيش أوردرات لفحص التكرار' }, 400, request);
        const duplicates = await findExportDuplicateStats(env.DB, orders);
        return json({ ok: true, count: Object.keys(duplicates).length, duplicates }, 200, request);
      }

      if (action === 'record_export') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        const body = await request.json().catch(() => ({}));
        const job = getJob(body.jobType, { allow: RE_JOBS });
        const employee = cleanText(body.employee);
        const orders = normalizeOrderPayload(body.orders);
        const allowRepeat = !!body.allowRepeat;

        if (!employee)      return json({ ok: false, error: 'employee مطلوب' }, 400, request);
        if (!orders.length) return json({ ok: false, error: 'مفيش أوردرات للتسجيل' }, 400, request);

        const duplicateMap = await findExportDuplicateStats(env.DB, orders);
        const blocked = Object.keys(duplicateMap);
        if (blocked.length && !allowRepeat) {
          return json({
            ok: false, code: 'DUPLICATES_FOUND',
            error: 'فيه أوردرات نفس دورتها اتصدّرت Excel قبل كده — راجع نافذة التكرار واسمح بالتصدير لو عايز تكمل',
            duplicates: duplicateMap,
          }, 409, request);
        }

        const now = new Date().toISOString();
        await writeLogsBatch(env.DB, orders.map((order) => ({
          timestamp: now, tool: job.tool, type: job.exportType, employee,
          orderId: order.id, orderName: order.name,
          valueBefore: order.s2Status || job.expectedStatus,
          valueAfter:  order.s2Status || job.expectedStatus,
          notes: `${allowRepeat && duplicateMap[order.name] ? 'تصدير مكرر مسموح' : 'تصدير'} ملف بوسطة — ${job.label}`,
          extra: {
            jobType: job.jobType, expectedStatus: job.expectedStatus, courier: order.courier || COURIER_VALUE,
            // نص مفتاح التكرار — بيتقرا في كل تصدير لاحق للأوردر ده (v5.3.0).
            cycleName: order.cycleName, cycleCreatedAt: order.cycleCreatedAt,
            duplicateBeforeExport: !!duplicateMap[order.name],
            exportHistoryBefore: duplicateMap[order.name] || null,
          },
        })));

        return json({ ok: true, count: orders.length, duplicatesAllowed: allowRepeat, duplicateCount: blocked.length }, 200, request);
      }

      // تحديث S2 بعد تصدير الإكسيل ورفعه يدويًا على داشبورد بوسطة.
      // ⚠️ المسار ده مالوش رقم تتبع — الشحنة اتعملت من الداشبورد، فمفيش
      //    `custom.bosta_tracking_number_s2` ولا تاج. ده الفرق الحقيقي بينه
      //    وبين `upload_re`، ومكتوب هنا عشان محدش يفتكرهم نفس الحاجة.
      if (action === 'confirm_upload') {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405, request);
        assertEnv(env, 'shopify');
        const body = await request.json().catch(() => ({}));
        const job = getJob(body.jobType, { allow: RE_JOBS });
        const employee = cleanText(body.employee);
        const orders = normalizeOrderPayload(body.orders);
        // checklist من مودال التأكيد — **للتوثيق فقط**، البوابة الحقيقية هي زرار
        // الواجهة. (⚠️ ده مابينطبقش على حارس الدورات تحت — ده سيرفر-سايد فعلًا.)
        const checklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : null;
        const checklistNote = checklist
          ? ` | Checklist: بوسطة=${checklist.bostaUploaded ? '✓' : '✗'}${job.jobType === JOB_EXCHANGE ? `, فواتير=${checklist.invoicesSent ? '✓' : '✗'}` : ''}`
          : '';

        if (!employee)      return json({ ok: false, error: 'employee مطلوب' }, 400, request);
        if (!orders.length) return json({ ok: false, error: 'مفيش أوردرات للتأكيد' }, 400, request);

        const token = await getAccessToken(env);

        const blockedCycles = await findBlockedCycleOrders(env, token, orders, job.jobType);
        if (blockedCycles.length) {
          const { logged, logError } = await logCycleBlocks(env.DB, blockedCycles, job, employee,
            { action: `تحديث الحالة إلى ${job.nextStatus}` });
          return json({
            ok: false, code: 'CYCLE_BLOCKED',
            error: 'فيه أوردرات حالتها مش واضحة — اتمنع تحديث الحالة لحد ما تتصلّح في شوبيفاي',
            blocked: blockedCycles, logged, logError,
          }, 409, request);
        }

        const now = nowToSecond();
        await setS2Status(env, token, orders, job.nextStatus, now);
        const mismatches = await verifyS2Status(env, token, orders, job.nextStatus, now);
        if (mismatches.length) {
          return json({
            ok: false, code: 'VERIFY_FAILED',
            error: 'التحديث اتنفّذ لكن التحقق المباشر رجّع قيم غير متوقعة لبعض الأوردرات',
            mismatches,
          }, 500, request);
        }

        await writeLogsBatch(env.DB, orders.map((order) => ({
          timestamp: now, tool: job.tool, type: job.confirmType, employee,
          orderId: order.id, orderName: order.name,
          valueBefore: order.s2Status || job.expectedStatus,
          valueAfter: job.nextStatus,
          notes: (job.jobType === JOB_RETURN
            ? 'تأكيد رفع بوسطة وتحديث S2 إلى In-Return — استرجاع'
            : 'تأكيد رفع بوسطة + إرسال فواتير للمخزن، وتحديث S2 إلى Ready — استبدال') + checklistNote,
          extra: {
            jobType: job.jobType, expectedStatus: job.expectedStatus, nextStatus: job.nextStatus,
            courier: order.courier || COURIER_VALUE, source: 'excel', checklist,
          },
        })));

        // تاريخ الحالة عبر الأدوات — مطلوب عشان KPIs زمن الدورة (بتتقرا من
        // `metafields_change` فقط) تشوف النقلة دي.
        await writeLogsBatch(env.DB, orders.map((order) => ({
          timestamp: now, tool: 'metafields_change', type: 'update', employee,
          orderId: order.id, orderName: order.name,
          valueBefore: order.s2Status || job.expectedStatus,
          valueAfter: job.nextStatus,
          notes: `status_2_r_e: ${order.s2Status || job.expectedStatus} → ${job.nextStatus} (via ${job.tool})`,
          extra: { metafieldKey: 'custom.status_2_r_e', sourceTool: job.tool, jobType: job.jobType },
        })));

        return json({ ok: true, count: orders.length, updatedTo: job.nextStatus }, 200, request);
      }
      // ──────────────────────────────────────────────────────────────

      // ─── §LOG-ENDPOINTS ───────────────────────────────────────────
      if (action === 'get_logs') {
        const p      = logParamsFrom(url, LOG_TOOLS);
        // 🔴 `parseInt('abc')` = NaN، والـ NaN بيعدّي Math.min/Math.max زي ما هو
        //    ويوصل لـ D1 كـ bind فيرجّع خطأ غامض. البند ده رجع أكتر من مرة في
        //    الستاك — الحراسة بـ Number.isFinite مش اختيارية.
        const entries = await getLogs(env.DB, {
          ...p,
          limit:   clampInt(url.searchParams.get('limit'),  100, 1, 100),
          offset:  clampInt(url.searchParams.get('offset'),   0, 0, Number.MAX_SAFE_INTEGER),
          sortBy:  url.searchParams.get('sortBy')  || null,
          sortDir: url.searchParams.get('sortDir') || null,
        });
        return json({ ok: true, entries }, 200, request);
      }

      if (action === 'get_logs_count') {
        const total = await getLogsCount(env.DB, logParamsFrom(url, LOG_TOOLS));
        return json({ ok: true, total }, 200, request);
      }

      if (action === 'get_logs_export') {
        const p = logParamsFrom(url, LOG_TOOLS);
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
      // ⚠️ `getJob` و`assertEnv` بيعلّموا الخطأ بـ `status` — 400 على مدخل غلط
      //    و500 على إعداد ناقص. من غير السطر ده كل الاتنين كانوا بيرجعوا 500،
      //    والواجهة مش قادرة تفرّق بين «الموظف بعت قيمة غلط» و«الـ Worker مكسور».
      const status = Number.isInteger(err?.status) ? err.status : 500;
      return json({ error: err.message }, status, request);
    }
  },
};
