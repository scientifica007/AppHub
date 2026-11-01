/** Reconciles cumulative speech results without touching persisted ideas. */
const words=x=>String(x??'').trim().split(/\s+/u).filter(Boolean);
const canon=x=>String(x).normalize('NFKC').toLocaleLowerCase('ar').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]/gu,'');
export function removeReplay(before,after,minimum=3){
 const a=words(before),b=words(after);
 for(let n=Math.min(30,a.length,b.length);n>=minimum;n--){
  if(a.slice(-n).every((x,i)=>canon(x)!==''&&canon(x)===canon(b[i])))return b.slice(n).join(' ');
 }
 return String(after??'').trim();
}
const join=(a,b)=>[a,b].filter(Boolean).join(' ');
const reconcile=arr=>arr.reduce((s,x)=>join(s,removeReplay(s,x)),'');
export class SpeechLedger{
 constructor(base=''){this.base=base;this.confirmed='';this.final='';this.interim='';this.restarted=false;this.lastProvisional=false;}
 nextSession(restart=false){this.final='';this.interim='';this.restarted=restart;}
 ingest(results){
  const finals=[],interims=[];
  // The entire results array is a cumulative snapshot, not newly appended text.
  for(let i=0;i<(results?.length??0);i++){
   const r=results[i],t=String(r?.[0]?.transcript??'').trim();
   if(t)(r.isFinal?finals:interims).push(t);
  }
  const snapshot=reconcile(finals);
  this.final=this.restarted?removeReplay(this.confirmed,snapshot,this.lastProvisional?2:3):snapshot;
  this.interim=removeReplay(join(this.confirmed,this.final),reconcile(interims));
  return this.text();
 }
 finalize({keepInterim=false}={}){
  const candidate=this.final||(keepInterim?this.interim:'');
  this.confirmed=join(this.confirmed,candidate);
  const provisional=!this.final&&!!this.interim&&keepInterim;
  this.final='';this.interim='';this.lastProvisional=provisional;
  return {provisional,hasText:!!this.confirmed};
 }
 text(){
  const t=join(join(this.confirmed,this.final),this.interim);
  return t?this.base+(!this.base||/\s$/u.test(this.base)?'':' ')+t:this.base;
 }
}
