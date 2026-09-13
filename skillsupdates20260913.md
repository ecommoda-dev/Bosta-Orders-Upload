<div dir="rtl" style="text-align: right;">

# تحديثات المهارات — 13-09-2026

> **المصدر:** جولة `skills-sweep` على `Bosta-Orders-Upload` (تحديث v1.4.0 /
> واجهة v1.6.0). بند واحد بس — إيجابية كاذبة في وصفة فحص.
> **الملف ده مكتفي بذاته.** الصيغة والتصنيف → `ecommoda-skill-versioning`.
>
> 📌 الملف السابق `skillsupdates20260910.md` (في ريبو
> `Bosta-Return-Exchange-Exporter`) **اتطبّق بالكامل** — `bosta-api-helper`
> بقى v2.0.0 و`constants` v2.5.0 و`graphql-helper` v2.2.0 و`order-lifecycle`
> v1.6.0 و`worker-builder` v3.3.0. مفيش بند متبقي منه.

---

## 1 · `ecommoda-html-builder` — المقترح: **v7.1.0 → v7.1.1** (PATCH)

### 1.1 · ⚪ تحريري — وصفة `H5-clientside-sort-with-serverside-pages` بتطلّع إيجابية كاذبة

**الوصفة الحالية** (`references/sweep-checks.yaml`):

```yaml
- id: H5-clientside-sort-with-serverside-pages
  mode: pair
  pattern: 'applySort'
  with:    'get_logs_count'
```

**المشكلة:** الشرط بيقيس **تواجد الاتنين في نفس الملف**، وده مابيفرّقش بين
جدولين في نفس الصفحة. في `Bosta-Orders-Upload`:

| الجدول | مصدر الصفوف | الترتيب |
|---|---|---|
| الأوردرات | `get_orders` — **القايمة كاملة**، بلا ترقيم سيرفر | `applySort` client-side — ✅ **صح** |
| سجل العمليات | `get_logs` بـ `limit`/`offset` — **صفحة** | اتحوّل server-side في v1.6.0 — ✅ **صح** |

الأداة دلوقتي **سليمة في الاتنين**، والوصفة لسه بتقول 🔴 لأن الاسمين لسه في
الملف. وده بالظبط الخطر اللي `skills-sweep` محذّرة منه بنفسها:

> «الوصفة اللي بتطلّع إيجابيات كاذبة بتخلّي الناس تتجاهل التقرير كله —
> وساعتها الجرد بيتحوّل من حماية لضوضاء.»

**المقترح** — الصفحة اللي بتبعت `sortBy` لـ `get_logs` بتكون سلّمت ترتيب
الجدول المصفَّح للسيرفر خلاص، وأي مُرتِّب client-side فاضل بيخص جدول تاني:

```yaml
- id: H5-clientside-sort-with-serverside-pages
  mode: pair
  pattern: 'applySort'
  with:    'get_logs_count'
  unless_file_has: 'sortBy'        # ← جديد على mode: pair
```

⚠️ **ده محتاج تعديل في `scripts/sweep.py`** — `unless_file_has` متدعومة في
`mode: forbid` بس دلوقتي. و`skills-sweep` بتعتبر ده سبب مشروع لتعديل السكريبت
(«صيغة قراءة اتغيّرت» / حقل جديد)، فالتعديل في مكانه.

**البديل لو التعديل ده مش مرغوب:** تنزيل التصنيف من `كاسر` لـ `مستحسن`، عشان
البند يفضل ظاهر من غير ما يوسم أداة سليمة بمخالفة كاسرة.

> **يخص:** أي أداة فيها جدول محمّل بالكامل **وجدول مصفَّح** في نفس الصفحة.
> **المكان:** `references/sweep-checks.yaml` (+ `scripts/sweep.py` في
> `skills-sweep` لو اتاخد المقترح الأول).

### 1.2 · بند CHANGELOG المقترح

```markdown
## v7.1.1 — 13-09-2026

> **بند ⚪ واحد.** المصدر: جولة جرد على `Bosta-Orders-Upload` —
> `skillsupdates20260913.md`.
>
> **ليه PATCH:** مفيش قاعدة اتغيّرت ومفيش كود بقى غلط — دي دقة **أداة
> الفحص** نفسها.

⚪ تحريري — `H5-clientside-sort-with-serverside-pages` بتطلّع إيجابية كاذبة
   على صفحة فيها جدول محمّل بالكامل + جدول مصفَّح. المقترح
   `unless_file_has: 'sortBy'` (محتاج دعم الحقل في `mode: pair`)، أو تنزيل
   التصنيف لـ`مستحسن`.
   يخص: أي أداة فيها الجدولين مع بعض — حاليًا `Bosta-Orders-Upload`
   المكان: references/sweep-checks.yaml
```

---

## 2 · اللي **مش** في الملف ده

كل البنود التانية اللي الجرد طلّعها على `Bosta-Orders-Upload` **اتقفلت في
الكود** (v1.4.0 / v1.6.0) — مكانها `CLAUDE.md` مش هنا:
الوقت الثابت · الترتيب client-side للسجل · `parseInt` بلا حراسة ·
`ORDER BY` حرفي · مهلة `apiRequest` · حارس `WORKER_SECRET` ·
`read_all_orders` في `diag`.

ومعاها أربع بنود طلعت من **مراجعة الكود** على نفس التعديل، وكلها إصلاحات
محلية مالهاش أثر على أي مهارة:
البحث في `LOG_SORT_COLUMNS` كان بيمشي على سلسلة الـ prototype ·
فلتر التاريخ كان بيقارن UTC بيوم القاهرة · المهلة كانت بتتطبّق على الرفع ·
والحارس الجديد كان بيحجب `diag` اللي رسالته بتحيل عليه.

</div>
