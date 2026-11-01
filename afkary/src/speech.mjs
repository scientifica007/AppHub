/** Web Speech recognition is optional; the browser/provider may process audio remotely. */
export function installSpeech({input,button,status,onInput=()=>{},onState=()=>{}}){
 const Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
 if(!Recognition){button.disabled=true;status.textContent='الإملاء الصوتي غير متاح في هذا المتصفح. يمكنك الكتابة عاديًا.';return ()=>{};}
 let engine=null,startingText='',lastCommitted='';
 const space=()=>startingText && !/\s$/.test(startingText)?' ':'';
 function setTranscript(confirmed,temporary=''){
   const spoken=confirmed+(temporary?(confirmed?' ':'')+temporary:'');
   const text=startingText+(spoken?space()+spoken:'');
   input.value=text.slice(0,input.maxLength||100000);onInput();
 }
 function reset(){button.textContent='🎙 بدء الإملاء';button.setAttribute('aria-pressed','false');input.readOnly=false;engine=null;onState(false);}
 button.addEventListener('click',()=>{
  if(engine){engine.stop();return;}
  try{
   startingText=input.value;lastCommitted='';const rec=new Recognition();engine=rec;
   rec.lang='ar-DZ';rec.interimResults=true;rec.continuous=true;
   rec.onstart=()=>{button.textContent='■ إيقاف الإملاء';button.setAttribute('aria-pressed','true');input.readOnly=true;onState(true);status.textContent='جارٍ الاستماع… اضغط إيقاف عند الانتهاء. النتائج الأولية قد تتغير.';};
   rec.onresult=e=>{
    let final='',interim='';for(let i=0;i<e.results.length;i++){const part=e.results[i][0]?.transcript||'';if(e.results[i].isFinal)final+=(final?' ':'')+part;else interim+=(interim?' ':'')+part;}
    lastCommitted=final.trim();setTranscript(lastCommitted,interim.trim());
    status.textContent=interim?'جارٍ تحويل الكلام إلى نص مباشر…':'تعرّف المتصفح على النص.';
   };
   rec.onerror=e=>{status.textContent=`تعذّر الإملاء (${e.error}). تحقّق من إذن الميكروفون ودعم المتصفح.`;};
   rec.onend=()=>{setTranscript(lastCommitted);reset();status.textContent=lastCommitted?'انتهى الإملاء. راجع النص ثم احفظ الفكرة.':'انتهى الاستماع. لم يُلتقط نص نهائي.';};
   rec.start();
  }catch{reset();status.textContent='تعذّر تشغيل الإملاء الصوتي في هذا المتصفح.';}
 });
 return ()=>{if(engine)engine.stop();};
}
