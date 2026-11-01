/**
 * Afkary speech dictation — a reviewed, temporary transcript, adapted from
 * Official_report_template_03's UX-04.1 workflow. Browser recognition providers
 * may send audio to third parties; Afkary itself stores neither audio nor drafts.
 * The original idea field remains editable and is NEVER changed by recognition events.
 */
import { appendRecognized } from './speech-buffer.mjs';

const ERROR = {
  'not-allowed': 'رُفض إذن الميكروفون؛ تحقق من صلاحيات الموقع.',
  'service-not-allowed': 'خدمة التعرف الصوتي محظورة في هذا المتصفح.',
  'audio-capture': 'تعذّر التقاط الصوت؛ افحص الميكروفون.',
  'language-not-supported': 'لغة التعرف المختارة غير مدعومة لدى الخدمة.',
  'network': 'تعذّر الاتصال بخدمة التعرف الصوتي في المتصفح.',
  'no-speech': 'لم يُلتقط كلام واضح؛ سيُعاد الاستماع إذا أمكن.',
  'aborted': 'توقفت جلسة الاستماع.'
};
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network']);
const LANGUAGES = [['ar-DZ', 'العربية — الجزائر'], ['ar-SA', 'العربية — السعودية'], ['ar', 'العربية العامة']];

function make(tag, className = '', content = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (content) e.textContent = content;
  return e;
}
function action(label, code) {
  const b = make('button', 'button secondary', label);
  b.type = 'button'; b.dataset.voiceAction = code;
  return b;
}
function combineWithIdea(original, addition) {
  const text = String(addition || '').trim();
  if (!text) return String(original || '');
  return String(original || '') + (original && !String(original).endsWith('\n') ? '\n' : '') + text;
}

export function installSpeech({input,button,status,onInput=()=>{},onState=()=>{},
 Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition,
 schedule=(fn,delay)=>setTimeout(fn,delay),cancel=id=>clearTimeout(id),now=()=>Date.now(),
 confirmDiscard=()=>globalThis.confirm('هل تريد إلغاء مسودة الإملاء الصوتي دون إدراجها؟')}={}) {
  if (!input || !button || !status) throw new Error('Speech controls are required');
  let panel=null, transcript=null, language=null, start=null, stop=null, panelStatus=null;
  let wanted=false, rec=null, timer=null, epoch=0;
  let emptyStops=0, quickStops=0, gotFinal=false, lastError='', startedAt=0, seenFinal=new Set();
  let currentlyStopping=false, disposed=false;

  const notify = msg => { if (status) status.textContent = msg; if (panelStatus) panelStatus.textContent = msg; };
  const pending = () => Boolean(transcript?.value?.trim());
  const markPending = () => { button.dataset.pending = String(pending()); };
  const setActive = active => {
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '■ إيقاف الإملاء' : panel ? '🎙 متابعة الإملاء' : '🎙 بدء الإملاء';
    // Unlike v0.4.1, the actual idea remains editable. Dictation writes only to its own draft.
    onState(false);
  };
  const clearTimer = () => { if (timer !== null) { cancel(timer);timer=null; } };
  const invalidate = () => { ++epoch; clearTimer(); wanted=false; currentlyStopping=false; };
  const stopRecognizer = (abort = false) => {
    const old=rec; rec=null;
    if (old) { old.onresult=null;old.onerror=null;old.onend=null;old.onstart=null;
      try { if (abort) old.abort(); else old.stop(); } catch { /* already ended */ }
    }
  };
  const pause = note => {
    wanted=false;clearTimer();currentlyStopping=false;setActive(false);
    if (start) {start.disabled=false;start.textContent='استئناف الاستماع';}
    if (stop) stop.disabled=true;
    if (note) notify(note);
  };
  function appendFinal(text, fromRestart = false) {
    if (!transcript) return;
    transcript.value = appendRecognized(transcript.value, text, { restart: fromRestart });
    markPending();
  }
  function launch(isRestart = false) {
    if (!wanted || disposed || !panel || rec) return;
    const myEpoch=++epoch;
    startedAt=now();gotFinal=false;lastError='';seenFinal=new Set();
    let recognition;
    try {
      recognition = new Recognition();
      rec=recognition;
      recognition.lang=language.value||'ar-DZ';
      recognition.continuous=true;
      recognition.interimResults=false; // only stable final words enter draft
      recognition.maxAlternatives=1;
      recognition.onstart=()=>{if(myEpoch===epoch && wanted)notify('جارٍ الاستماع؛ الكلمات المعتمدة تظهر في مسودة مستقلة قابلة للتصحيح.');};
      recognition.onresult=event=>{
        if (myEpoch!==epoch || rec!==recognition) return;
        const pieces=[];
        for (let i=Math.max(0,event?.resultIndex??0);i<(event?.results?.length??0);i++) {
          const result=event.results[i];
          if (result?.isFinal && result[0]?.transcript && !seenFinal.has(i)) {
            seenFinal.add(i); pieces.push(String(result[0].transcript).trim());
          }
        }
        if (pieces.length) {
          const before=transcript.value;
          appendFinal(pieces.filter(Boolean).join(' '), isRestart);
          if (transcript.value!==before) {gotFinal=true;emptyStops=0;quickStops=0;}
          notify('أُضيف الكلام المعتمد إلى مسودة الإملاء. يمكنك الاستمرار أو المراجعة أو النسخ.');
        }
      };
      recognition.onerror=event=>{
        if (myEpoch!==epoch || rec!==recognition) return;
        lastError=event?.error||'unknown';
        if (FATAL.has(lastError)) wanted=false;
        notify(ERROR[lastError]||'حدث خطأ أثناء التعرف الصوتي: '+lastError);
      };
      recognition.onend=()=>{
        if (myEpoch!==epoch || rec!==recognition) return;
        rec=null;
        if (!wanted || currentlyStopping || FATAL.has(lastError)) {
          pause(lastError && lastError!=='aborted' ? (ERROR[lastError]||lastError) :
            'توقف الاستماع. نص الإملاء محفوظ في المسودة المؤقتة حتى تراجعه وتدرجه.');
          return;
        }
        const elapsed=now()-startedAt;
        if (!gotFinal) {
          ++emptyStops;
          quickStops=elapsed<2500 ? quickStops+1 : 0;
        } else {emptyStops=0;quickStops=0;}
        if (emptyStops>=6 || quickStops>=3) {
          pause('تكررت جلسات قصيرة أو صامتة. توقفت المحاولات تلقائيًا؛ النص السابق محفوظ. يمكنك استئناف الاستماع يدويًا.');
          return;
        }
        notify('توقفت جلسة المتصفح تلقائيًا؛ سنحاول استئناف الاستماع دون إعادة إدراج الكلام السابق.');
        timer=schedule(()=>{timer=null;if(wanted && !disposed)launch(true);},elapsed<2500?650:400);
      };
      recognition.start();
      start.disabled=true;stop.disabled=false;setActive(true);
    } catch (e) {
      if (myEpoch!==epoch) return;
      stopRecognizer(true);
      pause('تعذّر بدء التعرف ('+(e?.name||'خطأ غير معروف')+'). قد يطلب المتصفح بدء الاستماع بلمسة جديدة.');
    }
  }
  function stopListening() {
    if (!wanted && !rec && timer===null) return;
    wanted=false;currentlyStopping=true;clearTimer();stopRecognizer(false);
    pause('توقف الاستماع. راجع مسودة الإملاء وصححها، ثم أدرجها في الفكرة.');
  }
  function closePanel({discard=false,allowCancel=true}={}) {
    if (!panel) return true;
    if (discard && allowCancel && pending() && !confirmDiscard()) return false;
    invalidate();stopRecognizer(true);
    if (discard && transcript) transcript.value='';
    panel.remove();panel=null;transcript=null;language=null;start=null;stop=null;panelStatus=null;
    markPending();setActive(false);
    notify('النص المكتوب في الفكرة لا يتغير حتى تختار إدراج مسودة الإملاء.');
    return true;
  }
  function openPanel() {
    if (panel) {transcript.focus();return;}
    const wrap=make('section','voice-dictation-panel');
    wrap.setAttribute('aria-label','مسودة الإملاء الصوتي المستقلة');
    const title=make('h3','voice-panel-title','مسودة إملاء صوتي — راجع النص قبل إدراجه');
    const privacy=make('p','voice-privacy-note','قد يرسل المتصفح صوتك إلى مزوّد التعرف. يحتفظ أفكاري بالنص مؤقتًا داخل هذا التبويب فقط، ولا يضيفه للفكرة تلقائيًا. انسخه أو أدرجه قبل إغلاق الصفحة.');
    const options=make('label','voice-language-label','لغة التعرف');
    language=make('select','voice-language');
    for (const [id,label] of LANGUAGES){const option=make('option','',label);option.value=id;language.append(option);}
    options.append(language);
    const top=make('div','voice-panel-actions');
    start=action('بدء الاستماع','start');stop=action('إيقاف الاستماع','stop');stop.disabled=true;
    top.append(start,stop);
    panelStatus=make('p','voice-panel-status','النص الأصلي لم يتغير. انقر «بدء الاستماع» للموافقة على استعمال خدمة المتصفح.');
    panelStatus.setAttribute('role','status');panelStatus.setAttribute('aria-live','polite');
    const label=make('label','voice-transcript-label','نص الإملاء المؤقت — يمكن تحريره');
    transcript=make('textarea','voice-transcript');transcript.rows=5;
    transcript.placeholder='تظهر هنا النتائج النهائية للتعرف الصوتي، ويمكنك تصحيحها قبل إدراجها.';
    label.append(transcript);
    const bottom=make('div','voice-panel-actions');
    const copy=action('نسخ النص','copy'),insert=action('إدراج في الفكرة','insert'),cancelButton=action('إلغاء المسودة','discard');
    insert.classList.add('primary');bottom.append(copy,insert,cancelButton);
    wrap.append(title,privacy,options,top,panelStatus,label,bottom);
    input.insertAdjacentElement('afterend',wrap);panel=wrap;markPending();setActive(false);
    transcript.addEventListener('input',markPending);
    language.addEventListener('change',()=>{if(wanted)notify('يُطبّق تغيير اللغة عند الجلسة التالية.');});
    start.addEventListener('click',()=>{if(wanted)return;emptyStops=0;quickStops=0;wanted=true;launch(false);});
    stop.addEventListener('click',stopListening);
    copy.addEventListener('click',async()=>{
      if (!pending()) {notify('لا يوجد نص لنسخه.');return;}
      try {if (!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(transcript.value);notify('نُسخت المسودة. لا تزال محفوظة في التبويب.');}
      catch {transcript.focus();transcript.select();notify('تعذّر النسخ التلقائي؛ حُدد النص لنسخه يدويًا.');}
    });
    insert.addEventListener('click',()=>{
      if (!pending()) {notify('لا يوجد نص لإدراجه.');return;}
      const text=transcript.value;
      input.value=combineWithIdea(input.value,text);onInput();
      closePanel({discard:true,allowCancel:false});input.focus();
      notify('أُدرج النص بعد مراجعته. اضغط «احفظ الفكرة» عندما تريد حفظها.');
    });
    cancelButton.addEventListener('click',()=>closePanel({discard:true}));
  }
  if (!Recognition) {
    button.textContent='🎙 إملاء غير متاح';button.setAttribute('aria-pressed','false');
    notify('لا يوفّر المتصفح خدمة التعرف الصوتي. يمكنك استعمال إملاء لوحة المفاتيح إن توفر.');
    button.addEventListener('click',()=>{input.focus();notify('هذا المتصفح لا يوفر واجهة SpeechRecognition؛ لا يمكن تفعيلها من داخل الموقع.');});
    return Object.assign(()=>{}, {hasPendingTranscript:()=>false});
  }
  button.addEventListener('click',()=>{
    if (wanted) stopListening();
    else if (panel) {transcript.focus();notify('مسودة الإملاء مفتوحة. اضغط «بدء الاستماع» لاستئنافها.');}
    else openPanel();
  });
  return Object.assign(()=>{disposed=true;closePanel({discard:true,allowCancel:false});}, {hasPendingTranscript:pending});
}