(() => {
'use strict';
const HISTORY_KEY='workout_history', ACTIVE_KEY='workout_active_session_v1';

function history(){try{const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(h)?h:[]}catch{return[]}}
function valid(r){return r&&typeof r==='object'&&(typeof r.id==='number'||typeof r.id==='string')&&typeof r.workoutId==='string'&&typeof r.workoutName==='string'&&Array.isArray(r.exercises)}
async function exportHistory(){
 const h=history(), text=JSON.stringify(h,null,2), date=new Date().toISOString().slice(0,10), name=`workout-history-${date}.json`, file=new File([text],name,{type:'application/json'});
 try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Workout history backup'});return}}catch(e){if(e?.name==='AbortError')return}
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importHistory(file){
 let incoming;try{incoming=JSON.parse(await file.text())}catch{alert('Could not read this file as JSON.');return}
 if(!Array.isArray(incoming)||!incoming.every(valid)){alert('This does not look like a valid workout history export. Nothing was changed.');return}
 const old=history(),ids=new Set(old.map(r=>String(r.id))),add=incoming.filter(r=>!ids.has(String(r.id)));
 if(!confirm(`Import ${incoming.length} sessions? ${add.length} are new. Existing sessions will be kept and duplicates skipped.`))return;
 localStorage.setItem(HISTORY_KEY,JSON.stringify([...old,...add].sort((a,b)=>Number(b.id)-Number(a.id))));if(typeof renderHistory==='function')renderHistory();alert(`Import complete. Added ${add.length} session${add.length===1?'':'s'}.`);
}
function transferUI(){
 const bar=document.querySelector('#screen-history .topbar'),clear=bar?.querySelector('.topbar-action');if(!bar||!clear||document.getElementById('history-transfer-actions'))return;
 const wrap=document.createElement('div');wrap.id='history-transfer-actions';wrap.className='history-transfer-actions';
 const exp=document.createElement('button');exp.type='button';exp.className='history-transfer-btn';exp.textContent='Export';exp.onclick=exportHistory;
 const imp=document.createElement('button');imp.type='button';imp.className='history-transfer-btn';imp.textContent='Import';
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.onchange=async()=>{const f=input.files?.[0];if(f)await importHistory(f);input.value=''};imp.onclick=()=>input.click();
 clear.remove();clear.classList.add('history-clear-btn');wrap.append(exp,imp,clear,input);bar.appendChild(wrap);
}
function eachExercise(workout,fn){workout?.groups?.forEach(g=>g.exercises?.forEach(fn))}
function exercise(id,names){let found=null;eachExercise(WORKOUTS[id],e=>{if(!found&&names.includes(e.name))found=e});return found}
function append(id,e){const w=WORKOUTS[id];if(!w?.groups?.length)return;if(!w.groups.some(g=>g.exercises?.some(x=>x.name===e.name)))w.groups.at(-1).exercises.push(e)}
function ceiling(v){if(typeof v==='string')return v.replace(/23\s?kg/g,m=>m.includes(' ')?'26 kg':'26kg');if(Array.isArray(v)){v.forEach((x,i)=>v[i]=ceiling(x));return v}if(v&&typeof v==='object')Object.keys(v).forEach(k=>v[k]=ceiling(v[k]));return v}
function program(){
 if(typeof WORKOUTS!=='object'||!WORKOUTS)return;ceiling(WORKOUTS);
 const pa=WORKOUTS['pull-a'];pa?.groups?.forEach(g=>g.exercises=(g.exercises||[]).filter(e=>!/^Chin-up(?: \(eccentric focus\))?$/.test(e.name)));
 const p=exercise('pull-a',['Pull-up (eccentric focus)','Pull-up (unassisted)','Pull-up']);if(p){p.name='Pull-up (unassisted)';p.scheme='4 × 3–5 clean reps';p.note='Full unassisted reps. Start from a controlled hang and stop before you need to kip or shorten the range. Lower logged reps than the old eccentric work are expected because these are substantially harder reps.';p.prog='Build to 4 × 5 clean reps, then gradually extend toward 6–8 before considering added load.';p.alt='If a rep stalls, end the set rather than turning it back into an eccentric-only set.'}
 const wp=exercise('pull-b',['Wide-grip pull-up (eccentric focus)','Wide-grip pull-up (unassisted)','Wide-grip pull-up']);if(wp){wp.name='Wide-grip pull-up (unassisted)';wp.scheme='4 × 3–5 clean reps';wp.note='Use a comfortably wide pronated grip and perform strict unassisted reps. Stop before kipping or losing shoulder position.';wp.prog='Build toward 4 × 5 clean reps, then extend the rep range. Keep the grip only as wide as remains comfortable at the wrists and shoulders.'}
 append('push-a',{name:'Dumbbell goblet squat',scheme:'3 × 8–12',muscle:'Quads, glutes, adductors, core',note:'Hold one adjustable dumbbell vertically at the chest. Sit down between the hips with the whole foot planted, then drive up through mid-foot. The adjustable DB is preferred to the fixed 20kg KB so load can progress gradually. Keep 1–3 reps in reserve, especially if football is the next day.',prog:'Reach 3 × 12 with clean depth, then increase load and return toward 8 reps.'});
 append('push-b',{name:'Dumbbell reverse lunge',scheme:'3 × 8–12 each',muscle:'Quads, glutes, adductors, single-leg stability',note:'Step backward, keep the front foot planted and control the descent. Hold dumbbells at your sides and log the load per dumbbell. Avoid taking these close to failure the day before football.',prog:'Reach 3 × 12 each side with stable knee tracking, then increase load and return toward 8 reps.'});
 append('pull-a',{name:'KB pronation / supination',scheme:'2 × 10–12 each',muscle:'Forearm pronators, supinators, wrist stabilisers',note:'Sit with the elbow around 90° and forearm supported. Hold the lightest KB by one side of the handle so the bell acts as an offset lever, then rotate slowly through a comfortable range. Choke up toward the bell to reduce leverage. Never force through wrist pain.',prog:'Progress control and range before leverage or load; use slow 2–3s rotations.'});
 append('pull-b',{name:'Dead hang',scheme:'2 × 20–45 sec',muscle:'Grip, forearms, shoulder and scapular tolerance',note:'Use the most comfortable pain-free pronated grip. Keep a little shoulder control instead of aggressively sinking into the joint. Enter seconds in the reps field and leave kg at 0.',prog:'Build both holds toward 45–60 seconds before adding load.'});
 WORKOUTS['bike-zone2']={id:'bike-zone2',name:'Zone 2 Bike',type:'bike',sub:'Easy aerobic · 30–45 min',info:'Ride at a steady conversational effort, roughly RPE 3–4/10. You should be able to speak in full sentences and finish feeling like you could continue. Keep cadence and resistance smooth rather than turning it into intervals. Zone 2 is useful for aerobic base and recovery; body-fat loss still depends mainly on overall energy balance.',groups:[]};
}
function aliases(){if(typeof getLastSession!=='function')return;const old=getLastSession;getLastSession=function(id){const r=old(id);if(r?.map){if(r.map['Pull-up (eccentric focus)']&&!r.map['Pull-up (unassisted)'])r.map['Pull-up (unassisted)']=r.map['Pull-up (eccentric focus)'];if(r.map['Wide-grip pull-up (eccentric focus)']&&!r.map['Wide-grip pull-up (unassisted)'])r.map['Wide-grip pull-up (unassisted)']=r.map['Wide-grip pull-up (eccentric focus)']}return r}}
function bikeCard(){
 const home=document.querySelector('#screen-home .scroll-area');if(!home||document.getElementById('bike-zone2-card'))return;
 const section=document.createElement('div');section.className='section-label';section.textContent='Cardio';section.id='bike-zone2-section';
 const card=document.createElement('div');card.className='split-card';card.id='bike-zone2-card';card.setAttribute('onclick',"openWorkout('bike-zone2')");card.innerHTML='<div class="split-dot" style="background:var(--bike)"></div><div class="split-info"><div class="split-name">Zone 2 Bike <span class="badge badge-bike">Aerobic</span></div><div class="split-meta">Easy conversational pace · 30–45 min</div></div><div class="split-arrow">›</div>';
 const anchor=[...home.querySelectorAll('.section-label')].find(e=>/Travel/i.test(e.textContent))||home.querySelector('.nav-spacer');anchor?anchor.before(section,card):home.append(section,card);
}
function counts(){document.querySelectorAll('#screen-home .split-card[onclick^="openWorkout("]').forEach(card=>{const m=card.getAttribute('onclick')?.match(/openWorkout\('([^']+)'\)/),w=m&&WORKOUTS[m[1]],meta=card.querySelector('.split-meta');if(!w?.groups||!meta)return;const n=w.groups.reduce((s,g)=>s+(g.exercises?.length||0),0);if(n)meta.textContent=meta.textContent.replace(/\b\d+\s+(exercises?|exercise pairs|moves?)\b/i,`${n} exercises`)})}

function syncInputs(){document.querySelectorAll('#screen-workout .log-row[id^="set-"]').forEach(row=>{const m=row.id.match(/^set-(\d+)-(\d+)$/);if(!m)return;const s=setData[+m[1]]?.sets?.[+m[2]];if(!s)return;const kg=row.querySelector('input[placeholder="kg"]'),reps=row.querySelector('input[placeholder="reps"]');if(kg)s.kg=kg.value;if(reps)s.reps=reps.value})}
function saveActive(){if(!sessionActive||!currentWorkoutId||!sessionStart)return;syncInputs();localStorage.setItem(ACTIVE_KEY,JSON.stringify({workoutId:currentWorkoutId,sessionStart,savedAt:Date.now(),setData:JSON.parse(JSON.stringify(setData||{}))}))}
function clearActive(){localStorage.removeItem(ACTIVE_KEY)}
function savedActive(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch{return null}}
function timerNow(){const e=document.getElementById('timer-val');if(!e||!sessionStart)return;const t=Math.max(0,Math.floor((Date.now()-sessionStart)/1000));e.textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`}
function persistence(){
 if(typeof startSession!=='function')return;
 const ss=startSession;startSession=function(){ss();saveActive()};
 const us=updateSet;updateSet=function(...a){us(...a);saveActive()};
 const td=toggleDone;toggleDone=function(...a){td(...a);saveActive()};
 const as=addSet;addSet=function(...a){as(...a);saveActive()};
 const fs=finishSession;finishSession=function(){syncInputs();fs();if(!sessionActive)clearActive()};
 const gh=goHome;goHome=function(){gh();if(!sessionActive)clearActive()};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveActive();else if(sessionActive)timerNow()});window.addEventListener('pagehide',saveActive);
}
function restore(){
 const s=savedActive();if(!s?.workoutId||!s.sessionStart||!WORKOUTS[s.workoutId])return;
 if(Date.now()-s.sessionStart>12*60*60*1000&&!confirm('An unfinished workout from more than 12 hours ago was found. Resume it?')){clearActive();return}
 openWorkout(s.workoutId);if(s.setData&&typeof s.setData==='object')Object.keys(s.setData).forEach(i=>setData[i]=s.setData[i]);sessionActive=true;sessionStart=Number(s.sessionStart);
 Object.keys(setData).forEach(i=>{const l=document.getElementById('log-'+i);if(!l)return;l.style.display='block';if(document.getElementById('sets-'+i))renderSets(+i)});
 const bar=document.getElementById('timer-bar');if(bar)bar.style.display='flex';const btn=document.querySelector('#screen-workout .start-btn');if(btn)btn.style.display='none';stopTimer();timerNow();startTimer();
}
function bikeHistory(){document.querySelectorAll('#history-content .history-card').forEach(c=>{const n=c.querySelector('.history-name');if(!n||!/Zone 2 Bike/.test(n.textContent))return;const d=n.querySelector('span');if(d)d.style.background='var(--bike)';[...c.children].forEach(x=>{if(/No sets logged/.test(x.textContent||''))x.textContent='Duration tracked · Zone 2 aerobic ride'})})}
function historyDecor(){if(typeof renderHistory!=='function')return;const old=renderHistory;renderHistory=function(){old();bikeHistory()}}
function styles(){const s=document.createElement('style');s.textContent=`:root{--bike:#38bdf8;--bike-bg:#06222b}#screen-workout{height:100dvh;min-height:0;overflow:hidden}#screen-workout .topbar{flex-shrink:0}#screen-workout .timer-bar{position:sticky;top:0;z-index:9;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.28)}#screen-workout .scroll-area{min-height:0}.history-transfer-actions{display:flex;align-items:center;gap:10px}.history-transfer-btn,.history-clear-btn{appearance:none;border:0;background:none;font:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:5px 0}.history-transfer-btn{color:var(--push)}.history-clear-btn{color:#c44}.badge-bike{background:var(--bike-bg);color:var(--bike)}@media(max-width:380px){.history-transfer-actions{gap:8px}.history-transfer-btn,.history-clear-btn{font-size:12px}}`;document.head.appendChild(s)}
function init(){program();aliases();styles();bikeCard();transferUI();historyDecor();persistence();counts();restore()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();