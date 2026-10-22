import { icon } from './icons.js';
import { loadCatalog, validateCatalog, escapeHTML as esc, normalize, storage, DRAFT_KEY, STATUS, COLORS, ICON_LABELS, formatDate, localDate } from './catalog.js';
import { setupUI, toast } from './shared.js';
setupUI();
const $ = id=>document.getElementById(id);
let catalog, published, basePublished, editingApp=null, editingCategory=null, formDirty=false, draftSaved=true;
const clone = value=>JSON.parse(JSON.stringify(value));
const uniqueID = prefix=>`${prefix}-${Array.from(crypto.getRandomValues(new Uint32Array(3)), n=>n.toString(36)).join('-')}`;
const iconOptions=Object.entries(ICON_LABELS).map(([key,name])=>`<option value="${key}">${name}</option>`).join('');
const colorOptions=Object.entries(COLORS).map(([key,name])=>`<option value="${key}">${name}</option>`).join('');
['app','category'].forEach(prefix=>{$(`${prefix}-icon`).innerHTML=iconOptions;$(`${prefix}-color`).innerHTML=colorOptions;});
function confirmChange(message) {
  $('confirm-message').textContent=message; $('confirm-dialog').showModal();
  return new Promise(resolve=>{ let answer=false; $('confirm-yes').onclick=()=>{answer=true;$('confirm-dialog').close();}; $('confirm-no').onclick=()=>$('confirm-dialog').close(); $('confirm-dialog').addEventListener('close',()=>resolve(answer),{once:true}); });
}
function persist() {
  draftSaved=storage.set(DRAFT_KEY,{catalog,basePublished,savedAt:new Date().toISOString()});
  $('draft-status').innerHTML=icon(draftSaved?'check':'info')+(draftSaved?'المسودة محفوظة في هذا المتصفح':'تعذّر الحفظ المحلي؛ صدّر نسخة الآن');
  if(!draftSaved) toast('تخزين المتصفح غير متاح أو ممتلئ. نزّل الفهرس للاحتفاظ بتعديلاتك.');
  $('draft-banner').hidden=false;
  $('draft-message').textContent = basePublished!==JSON.stringify(published) ? 'الفهرس المنشور تغيّر منذ إنشاء هذه المسودة. راجع الاختلافات قبل نشرها أو ارجع إلى النسخة المنشورة.' : 'أنت تعمل على مسودة محلية. لا تظهر التعديلات للزوار قبل نشر ملف الفهرس.';
  return draftSaved;
}
function render() {
  $('admin-app-count').textContent=`(${catalog.apps.length})`; $('admin-category-count').textContent=`(${catalog.categories.length})`;
  const q=normalize($('admin-search').value);
  const list=catalog.apps.filter(a=>normalize(`${a.title} ${a.description} ${a.tags.join(' ')}`).includes(q)).sort((a,b)=>a.order-b.order);
  $('admin-apps').innerHTML=list.length ? list.map(app=>`<article class="admin-row"><span class="admin-app-icon color-${app.color}">${icon(app.icon)}</span><div class="admin-row-body"><h3>${esc(app.title)} ${app.visible?'':'<span class="hidden-badge">مخفي من الواجهة</span>'}</h3><div class="admin-row-meta"><span>${esc(catalog.categories.find(c=>c.id===app.category)?.name || '')}</span><span class="status-badge status-${app.status}"><span></span>${STATUS[app.status]}</span><span>${formatDate(app.addedAt)}</span>${app.featured?'<span>★ مميّز</span>':''}</div></div><div class="admin-row-actions"><button class="icon-button" type="button" data-edit-app="${app.id}" aria-label="تعديل ${esc(app.title)}">${icon('edit')}</button><button class="icon-button" type="button" data-copy-app="${app.id}" aria-label="نسخ ${esc(app.title)}">${icon('copy')}</button><button class="icon-button danger" type="button" data-delete-app="${app.id}" aria-label="حذف ${esc(app.title)}">${icon('trash')}</button></div></article>`).join('') : `<div class="admin-empty">${icon(q?'search':'grid')}<h3>${q?'لا توجد نتائج مطابقة.':'لنبدأ بأول تطبيق.'}</h3><p>${q?'جرّب البحث باسم آخر.':'أضف رابط تطبيقك وبياناته، وستُنشأ بطاقته تلقائيًا.'}</p>${q?'':'<button class="button primary" type="button" data-add-app>إضافة تطبيق</button>'}</div>`;
  $('admin-categories').innerHTML=catalog.categories.length ? catalog.categories.map(c=>`<article class="admin-row"><span class="admin-app-icon color-${c.color}">${icon(c.icon)}</span><div class="admin-row-body"><h3>${esc(c.name)}</h3><div class="admin-row-meta"><span>${esc(c.description)}</span><span>التطبيقات: ${catalog.apps.filter(a=>a.category===c.id).length}</span></div></div><div class="admin-row-actions"><button class="icon-button" type="button" data-edit-category="${c.id}" aria-label="تعديل مجال ${esc(c.name)}">${icon('edit')}</button><button class="icon-button danger" type="button" data-delete-category="${c.id}" aria-label="حذف مجال ${esc(c.name)}">${icon('trash')}</button></div></article>`).join('') : '<div class="admin-empty"><h3>أضف مجالًا لتصنيف تطبيقاتك.</h3></div>';
}
function previewCard() { $('app-preview').innerHTML=`<span class="admin-app-icon color-${$('app-color').value}">${icon($('app-icon').value)}</span><div><strong>${esc($('app-title').value || 'اسم التطبيق')}</strong><p>معاينة الأيقونة واللون</p></div>`; }
function syncStatus() { const required=$('app-status').value!=='coming-soon'; $('app-url').required=required; $('url-required').hidden=!required; }
function openApp(id=null, duplicate=false) {
  if(!catalog.categories.length){toast('أضف مجالًا واحدًا على الأقل قبل إضافة تطبيق.');return;}
  const app=id?catalog.apps.find(a=>a.id===id):null;
  editingApp=duplicate?null:id;
  $('app-form').reset(); $('app-errors').hidden=true;
  $('app-category').innerHTML=catalog.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('app-editor-title').textContent=duplicate?'نسخ تطبيق':app?'تعديل التطبيق':'إضافة تطبيق';
  $('app-title').value=app?(duplicate?`${app.title.slice(0,72)} — نسخة`:app.title):'';
  $('app-description').value=app?.description || ''; $('app-url').value=app?.url || ''; $('app-tags').value=app?.tags.join('، ') || '';
  $('app-category').value=app?.category || catalog.categories[0].id; $('app-status').value=app?.status || 'available';
  $('app-icon').value=app && Object.hasOwn(ICON_LABELS,app.icon)?app.icon:'grid'; $('app-color').value=app?.color || 'green';
  $('app-date').value=formatDate(app?.addedAt || localDate()); $('app-order').value=app?.order ?? (catalog.apps.length?Math.max(...catalog.apps.map(a=>a.order))+1:0);
  $('app-featured').checked=app?.featured || false; $('app-visible').checked=duplicate?false:app?.visible ?? true;
  formDirty=false; syncStatus(); previewCard(); $('app-editor').showModal(); $('app-title').focus();
}
function openCategory(id=null) {
  const c=id?catalog.categories.find(c=>c.id===id):null; editingCategory=id;
  $('category-form').reset(); $('category-errors').hidden=true; $('category-editor-title').textContent=c?'تعديل المجال':'إضافة مجال';
  $('category-name').value=c?.name || ''; $('category-description').value=c?.description || '';
  $('category-icon').value=c && Object.hasOwn(ICON_LABELS,c.icon)?c.icon:'grid'; $('category-color').value=c?.color || 'green'; formDirty=false; $('category-editor').showModal(); $('category-name').focus();
}
async function cancelEditor(id) { if(formDirty && !(await confirmChange('توجد تعديلات داخل هذا النموذج لم تُحفظ. هل تريد إغلاقه والتخلي عنها؟')))return; formDirty=false; $(id).close(); }
['app-editor','category-editor'].forEach(id=>{ const d=$(id); d.addEventListener('cancel',e=>{e.preventDefault();cancelEditor(id);}); d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancelEditor(id);}}); });
$('app-form').addEventListener('input',()=>{formDirty=true;previewCard();});
$('app-form').addEventListener('change',()=>{formDirty=true;syncStatus();previewCard();});
$('category-form').addEventListener('input',()=>{formDirty=true;}); $('category-form').addEventListener('change',()=>{formDirty=true;});
$('app-form').addEventListener('submit',e=>{
  e.preventDefault();
  const date=$('app-date').value.split('/').reverse().join('-');
  const app={id:editingApp || uniqueID('app'),title:$('app-title').value.trim(),description:$('app-description').value.trim(),category:$('app-category').value,url:$('app-url').value.trim(),status:$('app-status').value,icon:$('app-icon').value,color:$('app-color').value,tags:$('app-tags').value.split(/[,،]/).map(t=>t.trim()).filter(Boolean),featured:$('app-featured').checked,visible:$('app-visible').checked,addedAt:date,order:Number($('app-order').value)};
  const next=clone(catalog);const index=next.apps.findIndex(a=>a.id===app.id);if(index<0)next.apps.push(app);else next.apps[index]=app;
  try{validateCatalog(next);catalog=next;formDirty=false;persist();render();$('app-editor').close();toast(draftSaved?'حُفظ التطبيق في المسودة.':'التطبيق جاهز؛ صدّر الفهرس لحفظه.');}
  catch(error){$('app-errors').hidden=false;$('app-errors').textContent=error.message;$('app-errors').scrollIntoView({block:'center'});}
});
$('category-form').addEventListener('submit',e=>{
  e.preventDefault();const c={id:editingCategory || uniqueID('category'),name:$('category-name').value.trim(),description:$('category-description').value.trim(),icon:$('category-icon').value,color:$('category-color').value};
  const next=clone(catalog);const index=next.categories.findIndex(x=>x.id===c.id);if(index<0)next.categories.push(c);else next.categories[index]=c;
  try{validateCatalog(next);catalog=next;formDirty=false;persist();render();$('category-editor').close();toast(draftSaved?'حُفظ المجال في المسودة.':'المجال جاهز؛ صدّر الفهرس لحفظه.');}
  catch(error){$('category-errors').hidden=false;$('category-errors').textContent=error.message;}
});
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  const d=button.dataset;
  if(d.cancel){cancelEditor(d.cancel);return;}if(d.close){$(d.close).close();return;}
  if(!catalog)return;
  if(d.editApp)openApp(d.editApp);if(d.copyApp)openApp(d.copyApp,true);if('addApp'in d)openApp();if(d.editCategory)openCategory(d.editCategory);
  if(d.deleteApp){const app=catalog.apps.find(a=>a.id===d.deleteApp);if(app&&await confirmChange(`هل تريد حذف «${app.title}» من المسودة؟ لن يُحذف من الموقع المنشور حتى ترفع الفهرس الجديد.`)){catalog.apps=catalog.apps.filter(a=>a.id!==app.id);persist();render();toast('حُذف التطبيق من المسودة.');}}
  if(d.deleteCategory){const c=catalog.categories.find(c=>c.id===d.deleteCategory);if(!c)return;if(catalog.apps.some(a=>a.category===c.id)){toast('انقل التطبيقات المرتبطة بهذا المجال أولًا، بما فيها التطبيقات المخفية.');return;}if(await confirmChange(`هل تريد حذف مجال «${c.name}» من المسودة؟`)){catalog.categories=catalog.categories.filter(x=>x.id!==c.id);persist();render();}}
});
$('add-app').addEventListener('click',()=>openApp()); $('add-category').addEventListener('click',()=>openCategory()); $('admin-search').addEventListener('input',render);
['apps','categories'].forEach(name=>$(`${name}-tab`).addEventListener('click',()=>{['apps','categories'].forEach(n=>{$(`${n}-panel`).hidden=n!==name;$(`${n}-tab`).classList.toggle('active',n===name);$(`${n}-tab`).setAttribute('aria-pressed',String(n===name));});}));
$('preview-draft').addEventListener('click',e=>{if(!catalog||!persist())e.preventDefault();});
$('publish-button').addEventListener('click',()=>{if(!catalog)return;try{validateCatalog(catalog);$('json-output').value=JSON.stringify(catalog,null,2)+'\n';$('publish-summary').textContent=`عدد التطبيقات: ${catalog.apps.length}، الظاهرة: ${catalog.apps.filter(a=>a.visible).length}. عدد المجالات: ${catalog.categories.length}. ستستبدل هذه النسخة ملف الفهرس المنشور كاملًا.`;$('publish-dialog').showModal();}catch(error){toast(error.message);}});
$('download-catalog').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(validateCatalog(catalog),null,2)+'\n'],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='apps.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('أُرسل ملف الفهرس للتنزيل. ارفعه إلى GitHub لنشره.');});
$('copy-catalog').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(catalog,null,2)+'\n');toast('نُسخ الفهرس.');}catch{$('json-output').closest('details').open=true;$('json-output').focus();$('json-output').select();toast('انسخ النص المحدد يدويًا؛ النسخ التلقائي غير متاح.');}});
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{if(file.size>2_000_000)throw new Error('الملف كبير جدًا. الحد الأقصى 2 ميغابايت.');let data;try{data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch{throw new Error('الملف لا يحتوي JSON صالحًا.');}validateCatalog(data);if(!(await confirmChange(`سيستبدل الاستيراد المسودة الحالية بالفهرس المستورد (التطبيقات: ${data.apps.length}، المجالات: ${data.categories.length}). هل تريد المتابعة؟`)))return;catalog=clone(data);basePublished=JSON.stringify(published);persist();render();toast('استُورد الفهرس إلى المسودة؛ لم يُنشر بعد.');}
  catch(error){$('admin-error').hidden=false;$('admin-error').textContent='تعذّر الاستيراد: '+error.message;$('admin-error').scrollIntoView({block:'center'});}
});
$('reset-draft').addEventListener('click',async()=>{
  if(!(await confirmChange('سيُعاد تحميل الفهرس المنشور، وستُستبدل المسودة المحلية به. صدّر مسودتك أولًا إذا أردت الاحتفاظ بها. هل تريد المتابعة؟')))return;
  try{const fresh=await loadCatalog();published=clone(fresh);catalog=clone(fresh);basePublished=JSON.stringify(fresh);persist();$('draft-banner').hidden=true;render();toast('أُعيد تحميل الفهرس المنشور.');}catch(error){toast(error.message);}
});
window.addEventListener('beforeunload',e=>{if(formDirty || !draftSaved){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===DRAFT_KEY&&catalog){$('draft-banner').hidden=false;$('draft-message').textContent='تغيّرت المسودة في علامة تبويب أخرى. تجنّب التحرير المتزامن؛ صدّر عملك قبل إعادة تحميل الصفحة.';}});
try{
  published=await loadCatalog();catalog=clone(published);basePublished=JSON.stringify(published);
  const draft=storage.get(DRAFT_KEY);
  if(draft?.catalog){try{validateCatalog(draft.catalog);catalog=clone(draft.catalog);basePublished=typeof draft.basePublished==='string'?draft.basePublished:basePublished;$('draft-banner').hidden=false;$('draft-message').textContent=basePublished!==JSON.stringify(published)?'الفهرس المنشور تغيّر منذ إنشاء هذه المسودة. راجع عملك قبل استبداله، أو ارجع إلى النسخة المنشورة.':'استُعيدت مسودتك المحفوظة في هذا المتصفح. التعديلات لم تُنشر للزوار بعد.';}catch{toast('المسودة المحفوظة غير صالحة؛ عُرض الفهرس المنشور.');}}
  $('editor').dataset.loading='false';$('draft-status').innerHTML=icon('check')+(draft?.catalog?'مسودة محلية':'الفهرس المنشور جاهز للتحرير');render();
}catch(error){$('admin-error').hidden=false;$('admin-error').innerHTML=`<h3>تعذّر تحميل الفهرس</h3><p>${esc(error.message)}</p><a class="button secondary" href="./admin.html">إعادة المحاولة</a>`;$('draft-status').textContent='الفهرس غير متاح';}
