# CLAUDE.md — MATE (My AI Training Expert)

> 이 파일은 Claude Code가 매 세션 시작 시 읽는 프로젝트 온보딩 문서입니다.
> 여기 담긴 규칙·구조·관례는 여태까지 축적된 결정 사항이므로 **손실 없이 유지**하세요.
> 언어: 앱 UI와 회원(DongHun)과의 대화는 **모두 한국어**로 합니다.

---

## 0. 한눈에 보기
- **제품**: MATE (My AI Training Expert). 태그라인 "AI가 짜주는 나만의 운동 플랜".
- **형태**: **단일 HTML 파일** 웹앱. 바닐라 JS(프레임워크 없음). 모바일 우선, 한국어 전용.
- **배포본**: 저장소 루트의 **`index.html`** 이 곧 사이트. (`workout-planner.html`은 동일 사본 — 아래 파일 규칙 참고)
- **호스팅**: GitHub Pages, 소스=GitHub Actions. 사이트: `https://leedongs777.github.io/workout/`
- **저장소**: `leedongs777/workout` (사용자명 `leedongs777`, 저장소명 `workout`). `index.html`은 **루트**에 위치.
- **회원**: 비개발자(호스팅/git 관점). **허리 수술 이력** 있음 → 백세이프 프로그래밍 필수(아래 3장).
- **비전**: 1인 + 여러 AI로 서비스 운영. 자동화 가능한 부분은 최대한 자동화.

---

## 1. 파일 구조 & 동기화 규칙 (매우 중요)
- 앱 전체가 **하나의 HTML 파일**에 들어 있음(임베드된 SVG 아이콘 때문에 ~560KB).
- 두 파일을 **항상 동일하게** 유지: `workout-planner.html` == `index.html`.
  - 편집은 `workout-planner.html`에 하고, 끝나면 반드시 `cp workout-planner.html index.html`.
  - **파일을 제시/커밋하기 전에 항상 두 파일이 identical한지 `diff -q`로 확인.**
- 배포용 자동화: `.github/workflows/deploy.yml` (push 시 JS 문법검사 → 통과하면 Pages 자동 배포).

---

## 2. 검증/테스트 워크플로 (신뢰성 확보된 방식)
편집 후 반드시 이 순서로 검증:
1. **문법 검사**: `<script>` 블록을 추출해 `node --check`.
   - 예: HTML에서 `<script>…</script>` 안 JS를 파일로 뽑아 `node --check file.js`.
2. **로직 유닛 테스트**: 함수/상수를 brace-match로 추출해 mock state로 `eval` 실행.
   - 헬퍼 패턴: 이름으로 함수 본문을 뽑는 `grab()`, `const`를 brace-match로 뽑는 `gc()`.
3. **UI 렌더링 확인**: `wkhtmltoimage`(한국어 폰트 `/usr/share/fonts/truetype/nanum/NanumGothic.ttf`) + `cairosvg`.
   - ⚠️ `wkhtmltoimage`는 **구형 webkit이라 CSS Grid 지원이 약함** → 달력 등 grid 레이아웃 미리보기가 실제와 다르게(겹치거나 세로 stack) 나옴. 실제 iOS/안드 Safari에선 정상. **grid는 시각 검증 불가**로 간주.
4. 편집 완료 후: `node --check` → `cp workout-planner.html index.html` → 두 파일 diff 확인.

---

## 3. 백세이프 프로그래밍 (절대 규칙 — 회원 허리 수술 이력)
- **척추 축부하(axial load) 금지**: 바벨 스쿼트/데드리프트/서서 하는 오버헤드 프레스/크런치 등 금지.
- 대체: **등받이 지지 머신**, 힙힌지/둔근 중심, **맥길(McGill) 스타일 코어**(데드버그·버드독·사이드 플랭크).
- 모든 동작 큐(cue)에 "허리 중립 유지, 통증 시 즉시 중단" 취지 반영.
- 이 원칙은 안전과 직결되므로 어떤 리팩터링에서도 **깨뜨리지 말 것**.

---

## 4. 앱 아키텍처 (workout-planner.html 내부)

### 4.1 저장/상태
- 저장 계층: `window.storage → localStorage → memory`. 키 **`workoutPlanner:v1`**.
- `persist()`(디바운스), `touch()`(=_ts 갱신 + persist + Sync.push). Firebase 설정 키 `workoutPlanner:fbcfg`.
- **state 필드**: `equipment[]`, `includeBodyweight`, `includeFloor`, `workoutDays:[0,2,3,4,5,6]`(요일 인덱스, 0=일), `sessionMinutes:60`, `startDate`, `restDays[]`, `doneDays[]`, `log{}`, `steps{}`(날짜별 단계 완료), `stepStart{}`(단계 시작 타임스탬프), `stepMs{}`(단계 소요 ms), `slotCustom{}`, `cardioChoice`, `authPassed`, `authProvider`, `consent`, `profile`, `onboarded`, `_ts`.
- `resetAll`과 state 기본값 모두 `workoutDays`, `sessionMinutes:60` 포함.

### 4.2 스케줄 엔진 (요일 기반)
- `wDays()` = `state.workoutDays||[0,2,3,4,5,6]`.
- `isRestDow(d)` = 해당 요일이 workoutDays에 없으면 정기 휴식.
- `buildSchedule`, `sessionFor` 모두 `isRestDow` 사용(휴식 = isRestDow || restDays). `sessionFor`는 startDate 이전엔 null.
- 6개 세션(S0~S5) 로테이션: startDate부터 비휴식일을 카운트해 배정.
- `isMon()`은 남아있지만 미사용. 하드코딩된 요일 참조 금지 — 항상 `isRestDow`.

### 4.3 6개 세션 (S0~S5, 백세이프)
- S0 하체A·둔근 / S1 상체 당기기·자세교정 / S2 유산소·모빌리티 / S3 하체B·좌우균형 / S4 상체 밀기·자세교정 / S5 유산소·코어·교정.
- 각 slot: `{role, sets, reps, options:[{name, eq[], cue}], fb}`.
- `resolveSlot`: 부상 관절 회피, 보유 장비로 가능한 첫 후보 선택.
- `isBW(eq)` = `eq.every(e=>e==='mat')` — **폼롤러는 무료 목록에서 제외됨**(선택해야 나옴).
- **운동 명칭은 정식/검색 가능한 표준 명칭만.** (예전에 "회전근개 외회전/케이블 외회전"→**페이스 풀**로 교체. "A + B" 식 결합 명칭 금지.)

### 4.4 시간 배분 — `sessionTimes(s, kept, si)`
- 웜업(15%, 5~12분 clamp) / 쿨다운(10%, 4~8분) / 유산소(유산소날 32% 아니면 12%) / 운동별 시간이 **정확히 `state.sessionMinutes` 합**이 되게 배분. 30/45/60/90/120 모두 합 정확 검증됨.

### 4.5 웜업/쿨다운 — **동적 생성** (하드코딩 아님)
- 정의 위치: `const SESSIONS=[...]` 바로 뒤. `sessionCat(s)`, `isPullDay(s)`, `buildWU(s)`, `buildCD(s)` → `SESSIONS.forEach(s=>{ s.warm=buildWU(s); s.cool=buildCD(s); })`.
- **핵심 규칙: 한 항목 = 한 동작.** "전신 관절 풀기" 같은 결합/묶음 항목 **금지**. 각 부위를 개별 항목으로.
- **웜업 순서(과학적)**: ① 가벼운 유산소(체온) → ② 전신 부위별 단일 동작 순서 **목 → 어깨 → 팔 → 허리(상체 회전) → 옆구리 → 고관절(레그 스윙) → 허벅지(니 하이 마치) → 종아리(카프 레이즈) → 손목 → 발목** → ③ 그날 부위 활성화(상체: 밴드 풀 어파트 + [당기기=턱 당기기 / 밀기=벽 팔굽혀펴기]; 하체: 바디웨이트 스쿼트 + 밴드 사이드 스텝; 유산소: 힙 서클).
- **쿨다운**: 부위별 단일 정적 스트레칭. 그날 부위 위주로 순서·시간 가중(M{} 딕셔너리: neck/shoulder/triceps/chest/back/side/glute/quad/ham/calf). 유산소날은 앞에 "호흡 정리 걷기" 추가.
- **그날 부위 중심 원칙**: 상체날=상체 위주, 하체날=하체 위주, 유산소날=유산소 적합 동작 위주. 단, 다른 부위를 빼는 게 아니라 **중심만 이동**(전신은 항상 커버).
- **턱 당기기 = 유지형(초)**. (Chin Tuck은 hold)
- 항목 태그 구조: `{n:이름, a:분량, d:설명, eq?:[장비], floor?:bool, alt?:{n,a,d}}` 또는 `{cardio:true}`.
- `wuResolve(arr)`: eq/floor로 필터(안 되면 alt로 대체, 그래도 안 되면 드롭).
- `cardioMachines()`/`cardioChips()`/`pickCardio(id)`: 유산소 기구 선택 버튼(state.cardioChoice).
- `listBody(arr)`: 두 줄 렌더 — `.wu-name`(이름 · 분량) + `.wu-desc`("- 설명").

### 4.6 웜업/쿨다운 자동 가이드 플레이어
- `wuTiming(it)`: `a` 문자열 파싱 → `{mode:'hold'|'reps', reps, dur}`. 초/분→hold(초); 회/걸음→reps(회, 템포 ~2초/회, 걸음 ~0.7초); 좌/우 각각·앞·뒤·각각→2배; ×N 세트 곱; hold clamp 15~150초, reps clamp 12~90초; cardio→300초.
- `wuBuildItems(arr)` = wuResolve 후 wuTiming 매핑. `fmtClock(sec)`→"m:ss".
- 모듈 변수 `let wuP=null, wuTimer=null;`.
- `wuStart(phase,dateStr)`: 아이템 생성, `wuP={phase,dateStr,items,idx,t0,beganAt}`, `setInterval(wuTick,200)`, renderToday.
- `wuTick()`: `#wup-fill` 너비 / `#wup-count` / `#wup-rep`(횟수는 전체 시간 동안 **균일 증가**) 갱신, 경과≥dur이면 자동 다음.
- `wuNext()`=건너뛰기. `wuFinish()`=stepMs 기록 후 wuP 해제, `doneStep(dateStr,phase)`.
- `wuPlayerCard()`: 큰 타이머 + 횟수 라인 + 진행바 + 점(dots) + [다음 →]/[웜업|쿨다운 마침].
- `wuStepCard(phase,s,dateStr,active,done,mins)`: 시작 전 카드([웜업|쿨다운 시작 →]).
- `renderSessionCard`에서 'warm'/'cool' 단계: wuP 활성이면 `wuPlayerCard()`, 아니면 `wuStepCard()`.
- **쿨다운 마침 → 운동 완료로 이어짐**(doneStep이 모든 단계 완료 시 그날 완료 처리).

### 4.7 본운동 단계별 타이머
- `stepShell`: 시작/완료 타이머. 미시작→[시작 →](`startStep`) → 진행중→[완료 · live-timer](doneStep이 stepMs 기록) → 완료→"✓ 완료 · N분 M초" + 다시 열기(`resetStep`).
- 전역 `setInterval(1s)`가 `.live-timer`(data-start) 갱신. `fmtDur(ms)`→"N분 M초".
- **완료된 운동에 취소선(line-through) 금지** — 색만 muted 처리.

### 4.8 아이콘 (전부 회원 소유 AI 생성 이미지 → 벡터화)
- `EQ_SVG`: 장비 아이콘 34종(`fill="currentColor"`). `eqIcon(id)`. `EQ_DESC`(별칭/설명).
- `POSE_SVG`: 자세 아이콘 15종 (squat, splitsquat, deadbug, birddog, sideplank, hipthrust, stretch, cardio, chintuck, legext, legcurl, stepup, adduction, chestpress, ytw).
- `patIcon(role)` = `POSE_SVG[ROLE_PAT[role]] || svgWrap(PAT_ICON[pat])`.
- `exFig(r,role)`는 **반드시 `patIcon(role)` 경유**(과거 버그: svgWrap(PAT_ICON[...]) 직접 호출로 새 아이콘 무시됨).
- 나브 아이콘: house / person+dumbbell / calendar / gear. `PAT_ICON`은 구 폴백(현재 사실상 미사용).
- 아이콘 파이프라인: PNG → cv2 임계값+모폴로지 close(kernel ~40) blob 검출 → potrace(`-b svg -t 4 -a 1.2 -O 0.35 --tight`) → 중앙 정사각 viewBox(S=max(w,h)*1.12, `fill="currentColor"`, `preserveAspectRatio xMidYMid meet`).

### 4.9 탭/네비게이션
- 하단 탭 [홈][플랜][일정][설정] (data-tab home/plan/schedule/setup). `switchTab(tab)`: activeTab 설정, `if(tab==='plan')planDate=null`, 뷰 토글(`.hidden{display:none!important}`), hd-title, updateBackBtn, refresh.
- **레이아웃**: `.wrap`에 `min-height:100vh` 쓰지 말 것(모바일에서 주소창 영역까지 잡혀 빈 스크롤 발생) → 제거하고 `body{min-height:100dvh}`.

### 4.10 화면별 핵심
- **홈**(`renderHome`): 인사(닉네임 우선), 통계, 다가오는 일정, `profileBanner()`(카드 `padding:16px` — 안 주면 내용이 가장자리에 붙음).
- **플랜**(`renderToday`): 날짜 이동(planDate), 히어로("약 N분 · 순환 x/6"), 단계 카드들, 끝에 `safetyBox()`.
- `safetyBox()`: `state.profile.injuries/conditions` 기반 맞춤 안전 원칙. 기본 문구/면책 문구는 정해진 정확한 표현 유지. 회색 상단 구분선 넣지 말 것.
- **일정**(`renderPlan`): planYear/planMonth/planMode. `.modeseg`[리스트|달력]. **달력 셀은 고정 높이(약 46px)** — `aspect-ratio` 쓰면 기기에서 과대·오버플로우로 범례/안내문과 겹침.
- **설정**(`renderSetup`): 회원정보·목표 수정(→`Onboard.startEdit`), 운동 요일, 하루 운동 시간, 장비 섹션.

### 4.11 온보딩 (Onboard 모듈, 3스텝, 자유 이동)
- Step1 개인정보: 이름 + 닉네임(최대10자) + **생년월일 커스텀 달력**(네이티브 date input 아님. `Onboard.openBirth` → `renderBirthCal`, bdStep 'year'|'month'|'cal'. **연도 선택은 1930~올해 스크롤 목록** + 선택 연도 자동 스크롤) + 성별(남/여만, "기타" 없음) + 내/외국인 + 본인인증(스텁).
- Step2 신상정보: 키/몸무게/목표몸무게/근력경험/러닝경험(→pace+최장거리)/운동목표/부상·수술/지병.
- Step3 운동환경·요일: 운동 요일 칩(월~일) + 하루 운동 시간(30/45/60/75/90/120) + 맨몸/바닥 토글 + 장비 그리드. `finish()`가 닉네임·workoutDays·sessionMinutes 포함 저장.
- `Onboard.startEdit()`: state에서 값 채워 온보딩 재오픈(설정에서 호출).

---

## 5. UI/스타일 관례
- **버튼 그룹을 감싸는 "박스"(테두리+배경+패딩 컨테이너) 금지.** 버튼 각자의 테두리는 유지하되, 여러 버튼을 통째로 감싸는 네모는 없앰.
  - 과거 버그: 온보딩 행 `class="obchips seg"`가 별도 `.seg` 박스 스타일에 걸려 감싸는 네모 생성됨 → `.obchips.seg{background:none;border:none;padding:0;margin-bottom:0}`로 무효화. `.seg`(이메일 토글)·`.modeseg`(일정 토글)·`.ob-inline`(러닝 입력)의 감싸는 박스도 제거함.
- 다중 선택 칩은 `.obgrid`(2열 균등 너비). 성별·내외국인·본인인증·근력/러닝 유무 등 이지선다형은 `.obchips.seg`(한 줄 균등 너비).
- 폰트 Pretendard. 다크모드는 `prefers-color-scheme` 자동. 테두리 변수(라이트 `--line:#D8D3C6 --line-2:#E3DFD3`, 다크 `--line:#3A3F47 --line-2:#31363D`).
- **한글 문장부호 규칙**: 명사형 어미(~기/~하기 등)는 마침표 없음. `~다/~요`는 마침표 유지. 내부 ". " → " · ".

---

## 6. 배포 (현재 워크플로, 회원의 주 방법)
1. Windows PC. `workout` 저장소는 로컬에 clone됨:
   `C:\DONGHUN\11. 비즈니스\MATE(My AI Trainer for Exercise)\99. 배포\workout`
2. git 사용자 정보·`credential.helper manager` 설정 완료(로그인 저장됨).
3. 폴더 안 **`배포.bat`** (더블클릭): `git add . && git commit -m "update" && git push`.
4. push → GitHub Actions(`deploy.yml`)가 **JS 문법검사 → 통과 시 자동 배포**. (Settings→Pages Source = GitHub Actions)
5. 확인: `leedongs777.github.io/workout/` 강력 새로고침(Ctrl/Cmd+Shift+R).
- 보조 경로: 아이폰 단축어(GitHub API로 index.html PUT). URL은 `https://api.github.com/repos/leedongs777/workout/contents/index.html`, 헤더 `Authorization: Bearer <PAT>`, Base64 인코딩 시 **줄바꿈 없음** 필수(안 그러면 "content is not valid Base64" 422).

### Claude Code에서 배포할 때
- 편집 → `cp workout-planner.html index.html` → `diff -q`로 동일 확인 → `git add . && git commit -m "..." && git push`.
- **커밋·푸시 전 회원 확인**을 받는 걸 기본으로(자율 배포 지양). 의료·안전 로직 변경은 특히 신중히.

---

## 7. 로드맵 / 향후
- **1인 + AI 운영, 자동화 우선.** 완전 무인 X(프로덕션 배포 승인·결제·개인정보/의료·스토어 심사·사고 대응은 사람 게이트 유지).
- 계층: L0 GitHub(소스), L1 오케스트레이터 AI, L2 전문 에이전트(개발/리뷰/테스트/QA스크린샷/트리아지/모니터링), L3 CI·CD+에러 모니터링+크론, L4 사람 승인.
- 우선순위: ①GitHub Actions 자동배포(**완료**), ②localStorage→Firebase Firestore(확장 핵심), 이후 스크린샷 회귀 테스트·파일 경량화(아이콘 외부화)·결제·본인인증(NICE/포트원)·PWA(웹푸시)·React/Next 이관(성장 시).
- 스토어 출시 전 필수: 실제 본인인증, 실제 약관·개인정보처리방침(현재 플레이스홀더), 계정·데이터 삭제.

## 8. 향후 기능 아이디어(백로그)
PWA+웹푸시 리마인더, 세트 휴식 타이머+이전 기록 표시, 바디/통증 로그+그래프, 결과 공유 카드, 배지/스트릭+햅틱, AI 채팅 코치, 캘린더 히트맵.

---

## 9. 작업 시 반드시 지킬 것 (요약)
1. 한국어로 소통. 명사형 어미 마침표 규칙 준수.
2. 백세이프 원칙 절대 유지(척추 축부하 금지).
3. 장비 게이팅: 선택 안 한 장비는 운동생성·설명·웜업/쿨다운·isBW 무료목록 어디에도 안 나오게.
4. 웜업/쿨다운: 한 항목=한 동작, 정식 명칭만, 전신 커버+그날 부위 중심, 유지형/횟수형 구분.
5. 편집 후 `node --check` → `cp workout-planner.html index.html` → `diff -q` 확인.
6. grid 레이아웃은 wkhtmltoimage로 시각검증 불가(실제 브라우저는 정상).
7. 커밋·푸시 전 회원 확인. 자율 배포 지양.
