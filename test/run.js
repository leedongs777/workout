/* MATE 로직 회귀 테스트 — 의존성 0 (Node 내장 fs/vm만).
 * index.html의 <script>를 추출해 vm 샌드박스(가짜 DOM)에서 실행하고
 * 플랜 엔진·렌더 산출물·핵심 불변식을 검증한다.
 * 실행: node test/run.js   (CI/deploy.yml에서 자동 실행)
 * 한계: Firebase/실브라우저 의존 경로는 로직 목으로만 커버 — 라이브는 수동(§7).
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const IDX = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(IDX, 'utf8');
const m = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (!m) { console.error('::error::index.html에서 <script>를 찾지 못함'); process.exit(1); }
let js = m[1];
const cut = js.indexOf('/* live timers tick */');
if (cut < 0) { console.error('::error::init 마커(/* live timers tick */)를 찾지 못함 — 추출 실패'); process.exit(1); }
js = js.slice(0, cut); // 런타임 init(DOM 부팅) 제거

// ---- 가짜 DOM (innerHTML 캡처) ----
const captured = [];
function mkEl(id){ let _h=''; const cls=new Set();
  return { get innerHTML(){return _h;}, set innerHTML(v){ _h=String(v); captured.push({id,html:_h}); },
    textContent:'', value:'', style:{}, dataset:{},
    classList:{add:x=>cls.add(x),remove:x=>cls.delete(x),toggle:(x,o)=>{o?cls.add(x):cls.delete(x);},contains:x=>cls.has(x)},
    querySelector:()=>mkEl('q'), querySelectorAll:()=>[], appendChild(){}, addEventListener(){}, removeEventListener(){},
    focus(){}, scrollIntoView(){}, remove(){}, getBoundingClientRect:()=>({top:0,left:0,width:0,height:0}) }; }
const els = {};
const doc = { getElementById:id=>{ if(!els[id])els[id]=mkEl(id); return els[id]; },
  querySelector:()=>mkEl('q'), querySelectorAll:()=>[], createElement:()=>mkEl('c'),
  createTreeWalker:()=>({nextNode:()=>null}), body:mkEl('body'), head:mkEl('head'), addEventListener(){} };

const EXPORTS = 'SESSIONS,state,freshState,sessionFor,sessionExercises,sessionTimes,effVol,goalMods,slotCands,slotActive,isPostureSlot,programFor,weekTotal,weekPlanned,cardioGuide,cardioDetail,safetyBox,renderHome,renderToday,renderPlan,renderSetup,renderAnal,anChartKind,anChart,anKcalFor,anWeekKcal,anExSeries,anTotals,showProfile,Auth,wByGender,esc,renderSetLog,volEditor,todayStr,DEFAULT_EQUIP,isBW';
js += `\n;globalThis.__T={${EXPORTS}};globalThis.__setPlanDate=d=>{planDate=d;};`;

const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Set, Map, isNaN, parseInt, parseFloat, Promise, Function, encodeURIComponent,
  setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, requestAnimationFrame:()=>0,
  document:doc, localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, matchMedia:()=>({matches:false,addEventListener(){}}), navigator:{clipboard:{readText:()=>Promise.resolve('')}}, location:{}, fetch:()=>Promise.resolve({}) };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
try { vm.runInContext(js, ctx, { filename: 'mate.js' }); }
catch (e) { console.error('::error::스크립트 평가 실패:', e.message); console.error(e.stack.split('\n').slice(0,4).join('\n')); process.exit(1); }
const T = ctx.__T;

let fails = 0;
function ok(cond, msg){ if(!cond){ fails++; console.error('  ✗', msg); } }
function section(name){ console.log('▶', name); }

/* ---------- 1. freshState 완전성 ---------- */
section('freshState 완전성');
{
  const f = T.freshState();
  ['equipment','includeBodyweight','includeFloor','workoutDays','sessionMinutes','startDate','restDays','doneDays','log','steps','stepStart','stepMs','slotCustom','slotPick','cardioMin','profile','consent','authPassed']
    .forEach(k => ok(k in f, `freshState 필드 누락: ${k}`));
  ok(Object.keys(f.log).length===0 && f.profile===null && f.authPassed===false, 'freshState 초기값 이상');
}

/* ---------- 2. 플랜 엔진 매트릭스 (일수 × 장비 × 목표) ---------- */
section('플랜 엔진 매트릭스');
{
  const GOALS = ['다이어트(체중감량)','근육 만들기','체력 향상','자세교정','현 상태 유지'];
  const EQUIP = { none: [], home: ['band','dumbbell','mat','bench'], gym: [...T.DEFAULT_EQUIP.length?T.DEFAULT_EQUIP:[], 'treadmill','leg_press','lat_pulldown','seated_row','chest_press','shoulder_press','cable','smith','barbell','dumbbell','kettlebell','bench','band','mat','foam_roller','step_box','assisted_pullup','hip_abduction','hip_adduction','bicep_curl','lying_leg_curl','hack_squat','box','chest_supported_row','leg_extension','leg_curl','pec_deck','reverse_pec_deck'] };
  const DAYS = { d1:[1], d2:[1,4], d3:[1,3,5], d4:[1,3,5,6], d5:[1,2,4,5,6], d6:[0,2,3,4,5,6] };
  const MINS = [30,45,60,90,120];
  const start = T.todayStr();
  let i = 0, checked = 0;
  for (const g of GOALS) for (const [en,eq] of Object.entries(EQUIP)) for (const [dn,days] of Object.entries(DAYS)) {
    const mins = MINS[i++ % MINS.length];
    T.state.equipment = [...eq]; T.state.includeBodyweight = true; T.state.includeFloor = true;
    T.state.workoutDays = [...days]; T.state.sessionMinutes = mins; T.state.startDate = start;
    T.state.restDays=[]; T.state.doneDays=[]; T.state.log={}; T.state.steps={}; T.state.slotCustom={}; T.state.slotPick={}; T.state.cardioMin={};
    T.state.profile = { gender:'male', goals:[g], postureTypes: g==='자세교정'?['neck','back']:[], injuries:{has:false}, conditions:{has:false}, liftingExp:false };
    try {
      const prog = T.programFor();
      ok(Array.isArray(prog) && prog.length>0, `programFor 빈값 [${g},${dn}]`);
      ok(T.weekTotal()===days.length, `weekTotal 불일치 [${dn}]`);
      const Texp = Math.max(20, mins);
      for (let d=0; d<8; d++) { // 순환의 여러 세션을 커버하려 며칠치 검사
        const date = new Date(Date.parse(start)+d*86400000).toISOString().slice(0,10);
        const e = T.sessionFor(date); if(!e || e.rest) continue;
        const s = T.SESSIONS[e.session];
        const kept = T.sessionExercises(s, e.session);
        const tm = T.sessionTimes(s, kept, e.session);
        ok(Number.isFinite(tm.total) && tm.total===Texp, `sessionTimes.total ${tm&&tm.total}!=${Texp} [${g},${dn},${mins}m,${en}]`);
        kept.forEach(x => { const v = T.effVol(e.session, x.key!=null?x.key:x.oi, x.sl, x.r);
          ok(v.sets>=2 && v.sets<=5, `sets 범위 밖 ${v.sets} ${x.sl.role}`);
          ok(v.reps!=null && String(v.reps).length>0, `reps 빈값 ${x.sl.role}`);
          if (en==='gym') ok(T.slotCands(x.sl).length>0 || !T.slotActive(x.sl), `풀장비 빈 슬롯 ${x.sl.role}`); });
        ok(T.cardioGuide(T.cardioDetail(s)).indexOf('·')<0, `cardioGuide raw · [S${e.session}]`);
        checked++;
      }
    } catch (err) { fails++; console.error(`  ✗ 예외 [${g},${en},${dn},${mins}m]: ${err.message}`); }
  }
  console.log('   조합 검사:', checked);
}

/* ---------- 3. 렌더 산출물 스캔 (onclick 문법 + 사용자입력 이스케이프) ---------- */
section('렌더 스캔 (onclick 문법 + XSS 이스케이프)');
{
  captured.length = 0;
  const XSS = '<img src=x onerror=alert(1)>"\'`';
  T.state.profile = { nickname:XSS, name:XSS, gender:'female', goals:['근육 만들기','자세교정'], postureTypes:['neck','back'], liftingExp:false,
    injuries:{has:true,list:['무릎'],other:XSS}, conditions:{has:true,list:['고혈압'],other:XSS}, weightKg:70, targetWeightKg:65, running:true, runPace:XSS, birth:'1990-05-15' };
  T.state.equipment = ['dumbbell','bench','band','cable','barbell']; T.state.includeBodyweight=true; T.state.includeFloor=true;
  T.state.workoutDays=[1,3,5,6]; T.state.startDate=T.todayStr(); T.state.authPassed=true; T.state.consent={tos:true};
  T.state.log={}; T.state.steps={}; T.state.slotCustom={}; T.state.cardioMin={};
  T.state.doneDays=[T.todayStr()]; // 분석 탭이 콜드 스타트가 아닌 실데이터 경로도 그리도록
  [['renderHome',()=>T.renderHome()],['renderToday',()=>{ctx.__setPlanDate(T.todayStr());T.renderToday();}],['renderPlan',()=>T.renderPlan()],['renderAnal',()=>T.renderAnal()],['renderSetup',()=>T.renderSetup()],['showProfile',()=>T.showProfile()],['Auth.show',()=>T.Auth.show()]]
    .forEach(([nm,fn]) => { try { fn(); } catch(e){ fails++; console.error(`  ✗ 렌더 예외 ${nm}: ${e.message}`); } });
  const seen = new Set(); let handlers = 0;
  captured.forEach(({id,html}) => { const re=/\son\w+="([^"]*)"/g; let mm;
    while((mm=re.exec(html))){ const body=mm[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
      if(seen.has(body))continue; seen.add(body); handlers++;
      try{ new Function(body); }catch(e){ fails++; console.error(`  ✗ 핸들러 문법 [${id}]: ${body.slice(0,70)} → ${e.message}`); } } });
  let raw = 0; captured.forEach(({html}) => { if(html.includes('<img src=x onerror')) raw++; });
  ok(raw===0, `사용자입력 원시 노출 ${raw}건 (이스케이프 누락)`);
  console.log('   검사한 고유 핸들러:', handlers, '| 원시 노출:', raw);
  // 맨몸 세트 점 onclick(문자열 키) 문법 — UI-1 회귀 방지
  const dots = T.renderSetLog({role:'코어',sets:3,reps:'20–30초/측',options:[],fb:{name:'사이드 플랭크'}}, {name:'사이드 플랭크',bw:true,eq:['mat']}, '2099-01-01','5b',3);
  [...dots.matchAll(/onclick="([^"]*)"/g)].forEach(mm=>{ try{ new Function(mm[1]); }catch(e){ fails++; console.error('  ✗ 맨몸 세트점 onclick 문법:', e.message); } });
  // volEditor 맨몸 코어 슬롯(문자열 키 "4b") onclick 문법 + reps 이스케이프 — P0-1/P0-2 회귀 방지
  // (chgSets/setReps/resetVol에 oi를 따옴표 없이 심으면 chgSets(0,4b,…)로 SyntaxError, reps 미이스케이프면 자기-XSS)
  T.state.profile={gender:'male',goals:['근육 만들기']};
  const ve = T.volEditor(0,'4b',{role:'코어',sets:3,reps:'20회',options:[],fb:{name:'데드버그'}},
                         {sets:3,reps:'<img src=x onerror=alert(1)>"',customized:true},'20회');
  [...ve.matchAll(/\son\w+="([^"]*)"/g)].forEach(mm=>{ const body=mm[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
    try{ new Function(body); }catch(e){ fails++; console.error('  ✗ volEditor onclick 문법(pbw 문자열키):', body.slice(0,60), '→', e.message); } });
  ok(!ve.includes('<img src=x onerror'), 'volEditor reps 원시 노출(이스케이프 누락)');
}

/* ---------- 4. 자세교정 판정 동작 보존 (구 regex ≡ isPostureSlot) ---------- */
section('자세교정 판정 보존');
{
  const OLD = /자세교정|거북목|흉추|페이스 풀|후면 삼각|골반 정렬/;
  let mism = 0;
  T.SESSIONS.forEach(s => s.slots.forEach(sl => { if (OLD.test(sl.role) !== T.isPostureSlot(sl)) mism++; }));
  ok(mism===0, `구 regex vs isPostureSlot 불일치 ${mism}건`);
}

/* ---------- 5. 유닛 ---------- */
section('유닛');
{
  T.state.profile={gender:'female'}; ok(T.wByGender({m:5,f:3})===3, 'wByGender 여성=f값');
  T.state.profile={gender:'male'};   ok(T.wByGender({m:5,f:3})===5, 'wByGender 남성=m값');
  ok(T.esc('<b>"&\'')==='&lt;b&gt;&quot;&amp;&#39;', 'esc 이스케이프 정확');
  ok(typeof T.weekPlanned==='function' && typeof T.weekTotal==='function', 'weekTotal/weekPlanned 분리 유지');

  // 분석 탭 유닛
  ok(T.anChartKind('machine')==='m' && T.anChartKind('barbell')==='b' && T.anChartKind('smith')==='b'
     && T.anChartKind('dumbbell')==='d' && T.anChartKind('kettlebell')==='k', 'anChartKind 기구→그래프 문법 매핑');
  T.state.profile={weightKg:70}; T.state.stepMs={'2099-01-05':{warm:600000, ex0:1800000, cardio:900000, cool:300000}}; T.state.doneDays=['2099-01-05'];
  const kc=T.anKcalFor('2099-01-05'); // 2.8·4.5·6.0·2.5 MET × 70kg × 시간
  ok(kc>150 && kc<400, `anKcalFor MET 추정 범위(${kc}kcal)`);
  ok(T.anKcalFor('2099-01-06')===0, 'anKcalFor 미완료일 0');
  ok(T.anWeekKcal().length===7, 'anWeekKcal 7일');
  // anChart: 최근 7일형 — 무게 라벨 수 = 기록 있는 날 수, 빈 날은 점
  const days=[{lb:'월',w:8},{lb:'화',w:null},{lb:'수',w:16}];
  const chart=T.anChart('k',days);
  ok(chart.includes('<svg') && (chart.match(/kg</g)||[]).length===2, 'anChart 무게 라벨 = 기록일 수');
  const chart2=T.anChart('m',[{lb:'월',w:30}]); // 10kg/판 → 3판
  ok((chart2.match(/rx="1.3"/g)||[]).length===3, 'anChart 머신 10kg/판');
  const chart3=T.anChart('m',[{lb:'월',w:990}]); // 상한 120kg=12판 캡
  ok((chart3.match(/rx="1.3"/g)||[]).length===12 && chart3.includes('990kg'), 'anChart 상한 캡 + 실값 라벨');
}

console.log('');
if (fails) { console.error(`::error::로직 테스트 실패 ${fails}건`); process.exit(1); }
console.log('=== 모든 로직 테스트 통과 ✓ ===');
