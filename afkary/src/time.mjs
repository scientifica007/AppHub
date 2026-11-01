/** Display-only local date/time; the stored UTC ISO string remains intact. */
export function formatSavedAt(iso) {
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return 'وقت غير معروف';
 const pad=n=>String(n).padStart(2,'0');
 return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' · '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}
export function timestampDescription(iso) {
 const d=new Date(iso);
 return Number.isFinite(d.getTime())?'التوقيت المحلي: '+formatSavedAt(iso)+'؛ UTC: '+d.toISOString():'تاريخ غير صالح';
}
