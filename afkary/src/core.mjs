/** Afkary: local, deterministic analysis. No original text is ever rewritten. */
export const CATEGORIES = Object.freeze([
  { id: 'technology', name: 'التقنية والبرمجيات', terms: ['تطبيق', 'موقع', 'برنامج', 'برمجة', 'خوارزمية', 'ذكاء اصطناعي', 'حاسوب', 'بيانات', 'انترنت', 'ويب', 'رقمي', 'نظام', 'تقنية', 'تطوير برمجيات', 'امن سيبراني'] },
  { id: 'education', name: 'التعليم والتكوين', terms: ['تعليم', 'تكوين', 'بيداغوج', 'تدريس', 'استاذ', 'متعلم', 'مناهج', 'تقييم', 'تقويم', 'امتحان', 'مؤسسة', 'تفتيش', 'كفاءات', 'درس', 'تعلم'] },
  { id: 'research', name: 'العلم والبحث', terms: ['بحث', 'تجربة', 'فرضية', 'رياضيات', 'معادلة', 'نظرية', 'علم', 'مختبر', 'قياس', 'فيزياء', 'كيمياء', 'برهان', 'دراسة'] },
  { id: 'business', name: 'المشاريع والأعمال', terms: ['مشروع', 'تجاري', 'سوق', 'زبائن', 'استثمار', 'مبيعات', 'منتج', 'تكلفة', 'ميزانية', 'شركة', 'ربح', 'خدمة', 'تسويق', 'عميل'] },
  { id: 'creative', name: 'الإبداع والثقافة', terms: ['رواية', 'قصة', 'رسم', 'تصميم', 'موسيقى', 'فن', 'ثقافة', 'قصيدة', 'كتابة', 'فيلم', 'لعبة', 'مسرح', 'ابداع'] },
  { id: 'life', name: 'الحياة والتنظيم الشخصي', terms: ['حياة', 'عادة', 'صحة', 'وقت', 'سفر', 'منزل', 'اسرة', 'تنظيم', 'يومي', 'شخصي', 'رياضة', 'هدف', 'تعلم ذاتي'] }
]);
export const UNCATEGORIZED = { id: 'other', name: 'أفكار متنوعة' };
const STOP = new Set('هذا هذه ذلك تلك الذي التي الذين الى على من في عن مع لقد سوف يمكن ربما عندما كيف لماذا ماذا أين حيث هناك هنا ثم أو ام لكن ان إن كان كانت يكون تكون لدي عند الى ايضا ايضا أنا نحن هي هو هم فقط كل بعض اي اذا حتى فكرة افكار شيء أشياء جدا عدم دون عبر بعد قبل بين غير حول أكثر اقل واحد واحدة مثل عمل جديد جديدة ايضا'.split(/\s+/).map(normalizeArabic));
const LIMIT = 100000;

export function normalizeArabic(input) {
  return String(input ?? '').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه');
}
export function tokenize(input) {
  return (normalizeArabic(input).match(/[\p{L}\p{N}]+/gu) ?? []).filter(w => w.length >= 3 && !STOP.has(w));
}
export function validateRaw(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('اكتب الفكرة أولًا قبل حفظها.');
  if (value.length > LIMIT) throw new Error('تجاوز النص الحد الأقصى (100,000 حرف).');
  return value; // deliberately not trimmed, normalized or edited
}
export function deriveTitle(raw) {
  const first = raw.split(/\r?\n/).map(x => x.trim()).find(Boolean) || 'فكرة دون عنوان';
  return first.length > 84 ? `${first.slice(0, 81)}…` : first;
}
export function classify(raw) {
  const normalized = normalizeArabic(raw);
  let winner = UNCATEGORIZED;
  let top = 0;
  for (const category of CATEGORIES) {
    const score = category.terms.reduce((total, term) => total + (normalized.includes(normalizeArabic(term)) ? (term.includes(' ') ? 3 : 1) : 0), 0);
    if (score > top) { top = score; winner = category; }
  }
  return winner.id;
}
export function categoryName(id) { return CATEGORIES.find(c => c.id === id)?.name ?? UNCATEGORIZED.name; }
export function deriveTags(raw) {
  const normalized = normalizeArabic(raw);
  const tags = [];
  for (const c of CATEGORIES) for (const term of c.terms) if (normalized.includes(normalizeArabic(term)) && !tags.includes(term)) tags.push(term);
  const freq = new Map();
  for (const w of tokenize(raw)) if (w.length >= 4) freq.set(w, (freq.get(w) || 0) + 1);
  for (const [word] of [...freq].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0], 'ar'))) {
    if (tags.length >= 6) break;
    if (!tags.some(tag => normalizeArabic(tag) === word)) tags.push(word);
  }
  return tags.slice(0, 6);
}
export function deriveIndex(entry, meta = {}) {
  const raw = validateRaw(entry.raw);
  const inferredCategory = classify(raw);
  const category = CATEGORIES.some(c => c.id === meta.categoryOverride) ? meta.categoryOverride : (meta.categoryOverride === 'other' ? 'other' : inferredCategory);
  const keywords = [...new Set(tokenize(raw))];
  return { id: entry.id, raw, createdAt: entry.createdAt, checksum: entry.checksum,
    title: deriveTitle(raw), preview: raw.replace(/\s+/g,' ').trim().slice(0, 155),
    category, inferredCategory, tags: deriveTags(raw), keywords,
    favorite: Boolean(meta.favorite), note: typeof meta.note === 'string' ? meta.note : '' };
}
export function relatedIdeas(target, items, max = 4) {
  const a = new Set(target.keywords);
  return items.filter(item => item.id !== target.id).map(item => {
    const overlap = item.keywords.filter(word => a.has(word)).length;
    const score = overlap * 3 + (item.category !== 'other' && item.category === target.category ? 1 : 0);
    return { item, score, overlap };
  }).filter(x => x.score >= 3).sort((a,b) => b.score-a.score || b.item.createdAt.localeCompare(a.item.createdAt)).slice(0,max);
}
export function suggestDirections(item) {
  const category = item.category;
  const specialized = {
    technology: ['ما الوظيفة الأساسية التي يجب إثباتها في نموذج أولي يعمل دون خدمات مدفوعة؟', 'ما البيانات المطلوبة؟ وكيف تُحمى خصوصية المستخدم منذ البداية؟'],
    education: ['كيف يمكن تحويل الفكرة إلى نشاط تعلّمي قابل للملاحظة والتقويم؟', 'ما مؤشرات التحسن التي تميز أثر الفكرة عن الانطباعات الشخصية؟'],
    research: ['ما الفرضية القابلة للدحض التي يمكن استخلاصها من هذه الفكرة؟', 'ما أصغر تجربة تسمح باختبار الفرضية وإعادة إنتاج النتائج؟'],
    business: ['من المستفيد تحديدًا، وما المشكلة التي سيدفع مقابل حلها؟', 'ما تجربة السوق الأقل تكلفة للتحقق من وجود طلب حقيقي؟'],
    creative: ['ما الشكل الذي يمنح الفكرة طابعًا أصيلًا يمكن التعرف عليه؟', 'ما النسخة القصيرة التي تكشف قوة الفكرة قبل التوسع؟'],
    life: ['ما الخطوة الصغيرة التي يمكن تجربتها خلال أسبوع؟', 'كيف تقيس أثر هذه التجربة دون إضافة عبء جديد؟'],
    other: ['إلى أي مجال يمكن أن تنتمي الفكرة إذا توضحت غايتها؟', 'ما تجربة صغيرة تساعد على تحويل هذا التصور إلى شيء ملموس؟']
  };
  return [
    { type: 'clarify', title: 'تحديد المقصود', body: 'ما المشكلة أو الحاجة الدقيقة التي تحاول هذه الفكرة معالجتها؟' },
    { type: 'explore', title: 'أفق تطوير أول', body: specialized[category]?.[0] ?? specialized.other[0] },
    { type: 'explore', title: 'أفق تطوير ثانٍ', body: specialized[category]?.[1] ?? specialized.other[1] },
    { type: 'test', title: 'اختبار نقدي', body: 'ما الافتراض الأكثر هشاشة في الفكرة، وما الدليل الذي قد يثبت خطأه؟' }
  ];
}
export function searchIdeas(items, { query = '', category = 'all', view = 'all' } = {}) {
  const words = tokenize(query);
  const normalizedQuery = normalizeArabic(query.trim());
  return items.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (view === 'favorites' && !item.favorite) return false;
    if (!normalizedQuery) return true;
    const haystack = normalizeArabic([item.raw, item.title, item.note, categoryName(item.category), ...item.tags].join(' '));
    return (words.length ? words.every(word => haystack.includes(word) || (word.startsWith('ال') && word.length > 4 && haystack.includes(word.slice(2)))) : haystack.includes(normalizedQuery));
  }).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
export function validateArchive(archive) {
  if (!archive || archive.format !== 'afkary-backup' || archive.schemaVersion !== 1 || !Array.isArray(archive.entries) || !Array.isArray(archive.annotations)) throw new Error('ملف النسخة الاحتياطية غير مدعوم.');
  if (archive.entries.length > 10000 || archive.annotations.length > 10000) throw new Error('الملف أكبر من الحد المدعوم.');
  const seen = new Set();
  for (const e of archive.entries) {
    if (!e || typeof e.id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(e.id) || seen.has(e.id) || typeof e.createdAt !== 'string' || Number.isNaN(Date.parse(e.createdAt))) throw new Error('سجل فكرة غير صالح أو مكرر.');
    validateRaw(e.raw);
    if (typeof e.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(e.checksum)) throw new Error('بصمة محتوى غير صالحة.');
    seen.add(e.id);
  }
  const metaSeen = new Set();
  for (const m of archive.annotations) {
    if (!m || !seen.has(m.id) || metaSeen.has(m.id) || typeof m.favorite !== 'boolean' || typeof m.note !== 'string' || m.note.length > 20000 || typeof m.categoryOverride !== 'string' || !['', 'other', ...CATEGORIES.map(c=>c.id)].includes(m.categoryOverride)) throw new Error('بيانات التصنيف والتعليقات غير صالحة.');
    metaSeen.add(m.id);
  }
  return archive;
}
