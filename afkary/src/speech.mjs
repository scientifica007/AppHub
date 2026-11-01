/** Optional browser recognition. Providers may process audio remotely. */
import {SpeechLedger} from './speech-ledger.mjs';
const errors={
 'not-allowed':'رُفض إذن الميكروفون. اسمح بالوصول من إعدادات الموقع وأعد المحاولة.',
 'service-not-allowed':'خدمة التعرف الصوتي محظورة في هذا المتصفح. جرّب Edge أو إملاء لوحة المفاتيح.',
 'audio-capture':'تعذّر التقاط الصوت. افحص الميكروفون وصلاحيات النظام.',
 'language-not-supported':'خدمة المتصفح لا تدعم التعرف على العربية.',
 'network':'انقطع الاتصال بخدمة التعرف الصوتي. لا يمكن متابعة الإملاء بهذه الخدمة.',
 'no-speech':'لم يسمع المتصفح كلامًا. تأكد من الميكروفون وتحدث بوضوح.'
};
const fatal=new Set(['not-allowed','service-not-allowed','audio-capture','language-not-supported','network']);
export function installSpeech({input,button,status,onInput=()=>{},onState=()=>{},
 Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,
 schedule=(fn,n)=>setTimeout(fn,n),cancel=id=>clearTimeout(id),now=()=>Date.now()}){
 if(!Recognition){
  button.textContent='🎙 إملاء غير متاح';
  status.textContent='التعرف الصوتي المباشر غير مدعوم هنا. يمكنك استعمال إملاء النظام إن توفر.';
  button.addEventListener('click',()=>{input.focus();status.textContent='لا يوفّر المتصفح خدمة التعرف الصوتي للتطبيق؛ لا يمكن تفعيلها بزر. جرّب متصفحًا يدعم الخدمة.';});
  return ()=>{};
 }
 let wanted=false,engine=null,ledger=null,timer=null,epoch=0,rapid=0,silent=0;
 let started=0,hasFinal=false,lastError='',ended=false;
 const show=x=>{status.textContent=x;};
 const publish=()=>{input.value=ledger.text().slice(0,input.maxLength||100000);onInput();};
 function buttonState(active){
  button.textContent=active?'■ إيقاف الإملاء':'🎙 بدء الإملاء';
  button.setAttribute('aria-pressed',String(active));input.readOnly=active;onState(active);
 }
 function clearPending(){if(timer!==null){cancel(timer);timer=null;}}
 function finish(note){wanted=false;clearPending();engine=null;buttonState(false);if(note)show(note);}
 function launch(restarted=false){
  if(!wanted)return;
  const id=++epoch;started=now();hasFinal=false;lastError='';ended=false;ledger.nextSession(restarted);
  let rec;
  try{
   rec=new Recognition();engine=rec;rec.lang='ar-DZ';rec.interimResults=true;rec.continuous=true;rec.maxAlternatives=1;
   rec.onstart=()=>{if(epoch===id&&wanted)show('جارٍ الاستماع… إذا انتهت الجلسة تلقائيًا سأحاول استئنافها.');};
   rec.onresult=e=>{
    if(epoch!==id||ended)return;
    for(const r of Array.from(e.results||[]))if(r.isFinal)hasFinal=true;
    ledger.ingest(e.results);publish();
    show(ledger.interim?'هذه الكلمات مؤقتة وقد تتغير قبل اعتمادها.':'تعرّف المتصفح على نص نهائي؛ الاستماع مستمر.');
   };
   rec.onerror=e=>{
    if(epoch!==id||ended)return;
    lastError=e.error||'unknown';if(fatal.has(lastError))wanted=false;
    show(errors[lastError]||'فشل الإملاء ('+lastError+').');
   };
   rec.onend=()=>{
    if(epoch!==id||ended)return;ended=true;engine=null;
    const elapsed=now()-started,natural=wanted&&!fatal.has(lastError);
    const result=ledger.finalize({keepInterim:true});publish();
    if(!natural){
     finish(lastError&&lastError!=='aborted'?(errors[lastError]||'انتهت الجلسة بسبب '+lastError)
      :result.provisional?'توقف الإملاء، واحتُفظ بالكلام المؤقت للمراجعة قبل الحفظ.'
      :result.hasText?'توقف الإملاء. راجع النص قبل الحفظ.':'انتهى الاستماع دون التقاط نص نهائي.');
     return;
    }
    rapid=(!hasFinal&&elapsed<2500)?rapid+1:0;
    silent=hasFinal?0:silent+1;
    if(rapid>=2||silent>=3){
     finish('توقفت خدمة التعرف سريعًا دون نتائج مستقرة. أُوقفت المحاولات لحماية النص؛ جرّب Edge أو حلًا بديلًا.');return;
    }
    show(result.provisional?'احتُفظ بالكلمات المؤقتة للمراجعة؛ جارٍ استئناف الإملاء…':'انتهت الجلسة تلقائيًا؛ جارٍ استئناف الإملاء…');
    timer=schedule(()=>{timer=null;launch(true);},elapsed<2500?900:350);
   };
   rec.start();
  }catch(e){
   if(epoch!==id)return;
   ledger.finalize({keepInterim:true});publish();
   finish('تعذّر بدء خدمة الإملاء ('+(e?.name||'خطأ غير معروف')+'). تحقّق من دعم المتصفح.');
  }
 }
 button.addEventListener('click',()=>{
  if(wanted){
   wanted=false;clearPending();show('جارٍ الإيقاف والاحتفاظ بالكلمات الملتقطة…');
   if(engine){try{engine.stop();}catch{ledger.finalize({keepInterim:true});publish();finish('توقف الإملاء، راجع النص.');}}
   else{ledger.finalize({keepInterim:true});publish();finish('توقف الإملاء، راجع النص.');}
   return;
  }
  ledger=new SpeechLedger(input.value);rapid=0;silent=0;wanted=true;buttonState(true);
  show('جارٍ تهيئة الميكروفون…');launch(false);
 });
 return ()=>{wanted=false;clearPending();++epoch;if(engine){try{engine.abort();}catch{}}engine=null;buttonState(false);};
}
