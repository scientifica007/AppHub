export const SIDEBAR_KEY='afkary:sidebar:v1';
export const FOCUS_KEY='afkary:focus:v1';
export function readPreference(storage,key,fallback=false){try{const v=storage.getItem(key);return v===null?fallback:v==='true';}catch{return fallback;}}
export function initWorkspace(){
 const sidebar=document.getElementById('workspace-sidebar'),toggle=document.getElementById('sidebar-toggle'),focusButton=document.getElementById('focus-toggle');
 if(!sidebar||!toggle||!focusButton)return;
 let visible=readPreference(localStorage,SIDEBAR_KEY,true),focus=readPreference(localStorage,FOCUS_KEY,false);
 function save(key,v){try{localStorage.setItem(key,String(v));}catch{}}
 function update(){
  const open=visible&&!focus;
  document.body.classList.toggle('sidebar-collapsed',!open);
  document.body.classList.toggle('focus-mode',focus);
  sidebar.inert=!open;sidebar.setAttribute('aria-hidden',String(!open));
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'إخفاء الشريط الجانبي':'إظهار الشريط الجانبي');
  toggle.textContent=open?'☰ إخفاء القائمة':'☰ إظهار القائمة';
  focusButton.setAttribute('aria-pressed',String(focus));
  focusButton.textContent=focus?'✕ إنهاء عدم التشويش':'◯ عدم التشويش';
  document.documentElement.style.colorScheme=focus?'light':(document.documentElement.dataset.theme==='paper'?'light':'dark');
 }
 toggle.addEventListener('click',()=>{visible=!visible;save(SIDEBAR_KEY,visible);update();});
 focusButton.addEventListener('click',()=>{focus=!focus;save(FOCUS_KEY,focus);update();if(focus)document.getElementById('idea-input')?.focus();});
 document.addEventListener('keydown',e=>{if(focus&&e.key==='Escape'&&!e.defaultPrevented){focus=false;save(FOCUS_KEY,focus);update();focusButton.focus();}});
 update();
}
