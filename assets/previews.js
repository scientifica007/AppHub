import { icon } from './icons.js';
import { escapeHTML as esc, safeURL } from './catalog.js';

let serial = 0;

function atom() {
  const id = `atom-preview-${++serial}`;
  return `<div class="preview-atom"><div class="atom-canvas"><span class="canvas-label">نموذج الذرّة</span><svg viewBox="0 0 260 220" class="atom-model" aria-hidden="true"><defs><radialGradient id="${id}-blue" cx="30%" cy="25%"><stop stop-color="#c4ddff"/><stop offset=".35" stop-color="#6d99ff"/><stop offset="1" stop-color="#3457c7"/></radialGradient><radialGradient id="${id}-red" cx="30%" cy="25%"><stop stop-color="#ffcfcd"/><stop offset=".5" stop-color="#da757a"/><stop offset="1" stop-color="#8a3f50"/></radialGradient><radialGradient id="${id}-silver" cx="30%" cy="25%"><stop stop-color="#fff"/><stop offset=".5" stop-color="#a6b3c7"/><stop offset="1" stop-color="#526177"/></radialGradient></defs><g fill="none" stroke="#8498bf" stroke-opacity=".45"><circle cx="130" cy="110" r="53"/><circle cx="130" cy="110" r="91"/><ellipse cx="130" cy="110" rx="91" ry="48" transform="rotate(-40 130 110)"/></g><g fill="url(#${id}-blue)"><circle cx="86" cy="80" r="7"/><circle cx="174" cy="140" r="7"/><circle cx="130" cy="19" r="7"/><circle cx="221" cy="110" r="7"/><circle cx="130" cy="201" r="7"/><circle cx="39" cy="110" r="7"/></g><g stroke="#152038" stroke-width=".8"><circle fill="url(#${id}-silver)" cx="130" cy="90" r="13"/><circle fill="url(#${id}-red)" cx="111" cy="100" r="14"/><circle fill="url(#${id}-silver)" cx="145" cy="102" r="14"/><circle fill="url(#${id}-red)" cx="128" cy="111" r="15"/><circle fill="url(#${id}-silver)" cx="112" cy="122" r="13"/><circle fill="url(#${id}-red)" cx="143" cy="125" r="13"/><circle fill="url(#${id}-silver)" cx="128" cy="132" r="12"/></g></svg></div><div class="atom-info"><div class="mini-app-title">${icon('atom')}<strong>مختبر الاكتشاف</strong></div><div class="element-name"><span class="element-symbol">C<small>6</small></span><div>الكربون<span>Carbon</span></div></div><div class="atom-stats"><div><small>العدد الذرّي</small><b>6</b></div><div><small>الكتلة الذرّية</small><b>12.011</b></div><div><small>الإلكترونات</small><b>2, 4</b></div></div><span class="mini-label">نموذج العرض</span><div class="mini-tabs"><span class="chosen">نموذج بور</span><span>عرض ثلاثي الأبعاد</span></div></div></div>`;
}

function planner() {
  return `<div class="preview-planner"><div class="mini-app-title">${icon('check')}<strong>مخطط اليوم</strong><span class="mini-add">+ إضافة مهمة</span></div><div class="planner-content"><div class="planner-tasks"><span class="mini-label">مساحة لترتيب أفكارك</span><div class="mini-task"><i class="checked">✓</i><span>مراجعة أهداف اليوم</span><b class="task-dot blue-dot"></b></div><div class="mini-task"><i></i><span>العمل على فكرة جديدة</span><b class="task-dot amber-dot"></b></div><div class="mini-task"><i></i><span>قراءة فصل من كتاب</span><b class="task-dot purple-dot"></b></div></div><div class="planner-progress"><div class="progress-ring"><span>1 <small>من 3</small></span></div><span>خطوة نحو الإنجاز</span></div></div></div>`;
}

function math() {
  return `<div class="preview-math"><div class="mini-app-title">${icon('grid')}<strong>تمارين الحساب</strong><span class="math-progress">تعلّم وتدرّب</span></div><div class="math-content"><div class="math-instruction">أوجد الناتج</div><div class="math-equation" dir="ltr">8 × 7 = <span>?</span></div><div class="math-answers" dir="ltr"><span>48</span><span class="correct">56</span><span>64</span><span>72</span></div><div class="math-bottom"><span class="math-bars"><i></i><i></i><i></i><i></i><i></i><i></i></span><span>كل محاولة، خطوة جديدة</span></div></div></div>`;
}

function notes() {
  return `<div class="preview-notes"><div class="notes-rail">${icon('file')}<i></i><i></i><i></i><i></i></div><div class="notes-page"><span class="mini-label">مساحة للأفكار</span><strong>فكرة اليوم تستحق أن تُكتب.</strong><div class="notes-rule"></div><span class="notes-line line-long"></span><span class="notes-line"></span><span class="notes-line line-short"></span><div class="notes-labels"><span>أفكار</span><span>مشروعات</span><span>للمراجعة</span></div></div></div>`;
}

function learning() {
  return `<div class="preview-learning"><div class="mini-app-title">${icon('book')}<strong>مساحة التعلّم</strong></div><div class="learning-content"><div class="learning-book">${icon('book')}<span>اكتشف. تعلّم. جرّب.</span></div><div class="learning-lessons"><div><i>01</i><span>ابدأ من الأساسيات</span>${icon('check')}</div><div><i>02</i><span>اختبر ما تعلّمته</span>${icon('arrow')}</div><div><i>03</i><span>انتقل إلى الخطوة التالية</span>${icon('arrow')}</div></div></div></div>`;
}

function tools(app) {
  return `<div class="preview-tools"><div class="mini-app-title">${icon(app.icon)}<strong>أدوات لمهمتك القادمة</strong></div><div class="tools-tiles">${['file','code','chart','tools','globe','folder'].map(name=>`<div>${icon(name)}<i></i></div>`).join('')}</div><div class="tools-caption">فكرة واضحة. خطوات أبسط.</div></div>`;
}

function illustration(app) {
  const art = app.icon === 'atom' ? atom() : ['layers','chart'].includes(app.icon) ? planner() : app.icon === 'game' ? math() : app.icon === 'file' ? notes() : app.icon === 'book' ? learning() : tools(app);
  return `<div class="preview-illustration" role="img" aria-label="رسم توضيحي لبطاقة ${esc(app.title)}؛ ليس لقطة من التطبيق"><div aria-hidden="true">${art}</div></div>`;
}

export function previewMarkup(app) {
  const image = safeURL(app.previewImage);
  return `<div class="app-preview ${image ? 'has-preview-image' : ''}">${image ? `<img class="preview-image" data-preview-image src="${esc(image)}" alt="معاينة ${esc(app.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}<div class="preview-fallback">${illustration(app)}</div><span class="preview-label">${image ? 'صورة التطبيق' : app.demo ? 'معاينة توضيحية' : 'رسم توضيحي'}</span></div>`;
}
