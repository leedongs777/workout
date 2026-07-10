# CLAUDE.md — MATE (My AI Training Expert)

> 이 파일은 Claude Code가 매 세션 시작 시 읽는 프로젝트 온보딩 문서입니다.
> 여기 담긴 규칙·구조·관례는 여태까지 축적된 결정 사항이므로 **손실 없이 유지**하세요.
> 언어: 앱 UI와 회원(DongHun)과의 대화는 **모두 한국어**로 합니다.

---

## 0. 한눈에 보기
- **제품**: MATE (My AI Training Expert). 태그라인 "AI가 짜주는 나만의 운동 플랜".
- **형태**: **단일 HTML 파일** 웹앱. 바닐라 JS(프레임워크 없음). 모바일 우선, 한국어 전용.
- **배포본**: 저장소 루트의 **`index.html`** 이 곧 사이트. (단일 파일 — 이것만 편집)
- **호스팅**: GitHub Pages, 소스=GitHub Actions. 사이트: `https://leedongs777.github.io/workout/`
- **저장소**: `leedongs777/workout` (사용자명 `leedongs777`, 저장소명 `workout`). `index.html`은 **루트**에 위치.
- **대상 사용자**: **불특정 다수**. 각자 온보딩에서 입력한 목표·경험·부상 이력에 따라 **서로 다른 플랜**을 받아야 한다.
- **운영자(DongHun)**: 이 앱의 개발 의뢰자이자 운영자. 비개발자(호스팅/git 관점). 본인은 허리 수술 이력이 있으나, **그것은 앱의 기본값이 아니라 "허리"를 선택한 사용자에게만 적용되는 조건**이다(아래 3장).
- ⚠️ **개인 맞춤 금지**: 운영자 한 사람의 신체 조건·장비·선호를 전역 기본값으로 하드코딩하지 말 것. 사용자가 고른 값이 플랜을 결정한다.
- **비전**: 1인 + 여러 AI로 서비스 운영. 자동화 가능한 부분은 최대한 자동화.

---

## 1. 파일 구조 (단일 파일)
- 앱 전체가 **하나의 HTML 파일 `index.html`**에 들어 있음(임베드된 SVG 아이콘 때문에 ~560KB). 바닐라 JS(`<script>` 인라인) + `<style>` 인라인.
- **`index.html`을 직접 편집**한다. 이게 곧 배포본이자 사이트.
- 배포용 자동화: `.github/workflows/deploy.yml` (push 시 JS 문법검사 → 통과하면 Pages 자동 배포).
- 참고: 과거 채팅 작업 환경에서는 `workout-planner.html`이라는 검증용 사본을 두고 `index.html`로 복사하는 2파일 방식을 썼으나, **이 저장소에는 `index.html` 하나만 존재**한다. 사본·동기화 개념은 필요 없다.
- ⚠️ **공개 배포 주의**: `deploy.yml`이 저장소 전체(`path: '.'`)를 Pages로 업로드함 → `CLAUDE.md`·`배포.bat` 등 저장소 안 모든 파일이 `https://leedongs777.github.io/workout/<파일명>`으로 **공개 접근 가능**. 따라서 저장소에는 **비밀키·PAT·민감정보·불필요한 파일을 두지 말 것**(PAT는 절대 커밋 금지). 임시/잡파일도 커밋 전에 정리.

---

## 2. 검증/테스트 워크플로 (신뢰성 확보된 방식)
편집 후 반드시 이 순서로 검증:
1. **문법 검사**: `<script>` 블록을 추출해 `node --check`.
   - 예: HTML에서 `<script>…</script>` 안 JS를 파일로 뽑아 `node --check file.js`.
2. **로직 유닛 테스트**: 함수/상수를 brace-match로 추출해 mock state로 `eval` 실행.
   - 헬퍼 패턴: 이름으로 함수 본문을 뽑는 `grab()`, `const`를 brace-match로 뽑는 `gc()`.
3. **UI 렌더링 확인**(가능한 환경일 때): 헤드리스 브라우저 스크린샷 등으로 확인. 과거엔 `wkhtmltoimage`(한국어 폰트 NanumGothic) + `cairosvg`를 썼음.
   - ⚠️ `wkhtmltoimage`는 **구형 webkit이라 CSS Grid 지원이 약함** → 달력 등 grid 레이아웃 미리보기가 실제와 다르게(겹치거나 세로 stack) 나옴. 실제 iOS/안드 Safari에선 정상. **grid는 그 도구로 시각 검증 불가**로 간주.
4. 편집 완료 후: `index.html`에서 `<script>` 추출해 `node --check`로 문법 확인 → 로직 테스트 → (가능하면) 렌더 확인.

---

## 3. 부상 기반 안전 프로그래밍 (조건부 규칙 — 사용자가 고른 부상에만 적용)

> ⚠️ **이력 주의**: 예전 이 문서는 "백세이프(척추 축부하 금지)"를 **모든 사용자에 대한 절대 규칙**으로 못박고 있었다. 그것은 운영자 개인(허리 수술)의 조건을 전역화한 것이었고, **2026-07 결정으로 폐기**했다. 되돌리지 말 것.

### 3.1 동작 원리
- 부상 필터는 **슬롯 단위가 아니라 운동 단위**다. `CONTRA_EX = {운동명: [관절…]}`.
- `avoidJoints()`가 `state.profile.injuries.list` → `INJ_JOINT`로 관절 집합을 만들고, `slotCands()`가 **그 관절이 금기인 운동만 후보에서 제외**한다. 슬롯은 살아남고 **안전한 대체 동작이 대신 선택**된다.
- 후보 순서: **`options`(기구) → `fb`(기본 맨몸) → `alts`(부상 시에만 쓰이는 안전 대안)**. `alts`를 `options`에 넣으면 **부상 없는 사용자의 기본 동작까지 바뀌므로 금지**.
- 관절 키: `knee`, `shoulder`, `ankle`, `lower_back`, `wrist`, `neck`.
- 금기 운동은 **기구 선택 버튼에도 나타나지 않는다**(직접 고를 수 없음).

### 3.2 기본값 = 표준 프로그래밍
- **부상을 선택하지 않은 사용자**는 바벨 백 스쿼트 / 컨벤셔널·루마니안 데드리프트 / 바벨 벤치 프레스 / 바벨 오버헤드 프레스 / 바벨 벤트오버 로우를 **1순위로 받는다**(장비 보유 시).
- **`허리 (디스크/수술)`를 고른 사용자**만 위 운동들이 `lower_back` 태그로 빠지고, 등받이 지지 머신 · 힙힌지/둔근 중심 · 맥길 코어(데드버그·버드독·사이드 플랭크) 구성으로 대체된다.

### 3.3 유지할 것
- 모든 동작 큐(cue)에 "허리 중립 유지, 통증 시 즉시 중단" 취지 반영(모든 사용자 공통 안전 문구).
- `CONTRA_EX` 태그는 **의학적 검증을 받지 않은 초안**이다. 태그를 바꾸려면 근거를 남기고 운영자 확인을 받을 것.
- 부상/지병 관련 **안내 문구는 프로필 조건부**로만 노출한다(예전엔 "허리 수술 이력이 있으시니"가 전원에게 노출되는 버그가 있었음).

---

## 4. 앱 아키텍처 (index.html 내부)

### 4.1 저장/상태
- 저장 계층: `window.storage → localStorage → memory`. 키 **`workoutPlanner:v1`**.
- `persist()`(디바운스), `touch()`(=_ts 갱신 + persist + Sync.push). Firebase 설정 키 `workoutPlanner:fbcfg`.
- **state 필드**: `equipment[]`, `includeBodyweight`, `includeFloor`, `workoutDays:[0,2,3,4,5,6]`(요일 인덱스, 0=일), `sessionMinutes:60`, `startDate`, `restDays[]`, `doneDays[]`, `log{}`, `steps{}`(날짜별 단계 완료), `stepStart{}`(단계 시작 타임스탬프), `stepMs{}`(단계 소요 ms), `slotCustom{}`, `cardioChoice`, `cardioMin{}`(세션 인덱스별 유산소 분 override, 없으면 추천값 `sessionTimes().cardioAuto`), `authPassed`, `authProvider`, `consent`, `profile`, `onboarded`, `_ts`.
- `resetAll`과 state 기본값 모두 `workoutDays`, `sessionMinutes:60` 포함.

### 4.2 스케줄 엔진 (요일 기반)
- `wDays()` = `state.workoutDays||[0,2,3,4,5,6]`.
- `isRestDow(d)` = 해당 요일이 workoutDays에 없으면 정기 휴식.
- `buildSchedule`, `sessionFor` 모두 `isRestDow` 사용(휴식 = isRestDow || restDays). `sessionFor`는 startDate 이전엔 null.
- 6개 세션(S0~S5) 로테이션: startDate부터 비휴식일을 카운트해 배정.
- `isMon()`은 남아있지만 미사용. 하드코딩된 요일 참조 금지 — 항상 `isRestDow`.

### 4.3 6개 세션 (S0~S5)
- S0 하체A·둔근 / S1 상체 당기기·자세교정 / S2 유산소·모빌리티 / S3 하체B·좌우균형 / S4 상체 밀기·자세교정 / S5 유산소·코어·교정.
- 각 slot: `{role, sets, reps, options:[{name, eq[], cue, reps?}], fb, alts?:[…]}`.
  - `reps`는 **슬롯 단위 기본값**이고, 운동별로 `reps`를 주면 그게 우선(`defReps(slot, r)`). 유지형(월 싯 `30–45초`)이 그 예. 같은 슬롯의 기구 운동은 영향받지 않는다.
  - `alts`는 **부상 시에만 쓰이는 안전 대안**(3.1 참고). `options`에 넣지 말 것.
- `resolveSlot`: 금기 운동 제외 후, 보유 장비로 가능한 첫 후보 선택. `slotCands`가 후보를 만든다.
- `isBW(eq)` = `eq.every(e=>e==='mat')` — 빈 배열도 `true`. **`eq`를 빼먹으면 장비가 필요한 운동이 맨몸으로 새어나간다**(과거 `밴드 레그 컬` 버그). 맨몸 동작의 큐에도 장비를 언급하지 말 것.
- **맨몸 운동 25종**으로 기구 없이도 32개 슬롯이 모두 채워진다(바닥 운동 포함 시).
- **운동 명칭은 정식/검색 가능한 표준 명칭만.** (예전에 "회전근개 외회전/케이블 외회전"→**페이스 풀**로 교체. "A + B" 식 결합 명칭 금지.)
- **장비 없이 못 하는 동작은 대체(fb)로 두지 말 것.** 벤치가 필요한 `체어 스쿼트`는 `eq:['bench']` 옵션이고, 무장비 대체는 `맨몸 스플릿 스쿼트`다.

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

### 4.8 아이콘 (전부 운영자 소유 AI 생성 이미지)
- **장비 아이콘 34종 = CSS mask 방식** (2026-07 교체). `EQ_SVG`(구 벡터, 300KB)는 **삭제됨**.
  - CSS: `.ic-msk{background-color:currentColor; mask-image:url(data:image/png;base64,…)}` + `.ic-eq-{id}` 34개 클래스.
  - `eqIcon(id)` → `<span class="ic-msk ic-eq-${id}">`. 색은 부모의 `color`(currentColor)를 따라가므로 **선택/미선택·다크모드 자동 대응**.
  - 컨테이너별 크기: `.eqmodal-ill`(76px)·`.eq-tile .ill`·`.mini-fig`는 100%, `.step-fig`36px, `.ex-fig`38px, `.eq-ic`16px.
  - 마스크 생성: 투명 PNG → 알파 bbox crop → 정사각 중앙정렬 → 160px 리샘플 → **팔레트+알파 PNG(64색)** → base64. (RGBA로 저장하면 4배 커짐)
  - 원본: `MATE_운동기구_아이콘_34종_투명배경/` (파일명 = `EQ_LABEL` 값과 1:1).
- **하단 나브 아이콘 4종**도 같은 mask 방식(`.nav-ic.home|plan|schedule|setup`). 원본 `MATE_하단메뉴_아이콘_4종_투명배경/`.
- `POSE_SVG`: 자세 아이콘 15종 — **아직 구 벡터**. `legext·stepup·chestpress·ytw` 4개는 원본 하단에 한글 이름이 박혀 있어 `_CROP_POSE` + `cropSvg()`로 viewBox 높이를 줄여 잘라 쓰는 중. **새 아이콘으로 교체하면 이 crop 코드를 제거할 것.**
- `patIcon(role)` = `cropSvg(POSE_SVG[ROLE_PAT[role]]) || svgWrap(PAT_ICON[pat])`.
- `exFig(r,role)`는 **반드시 `patIcon(role)` 경유**(과거 버그: svgWrap(PAT_ICON[...]) 직접 호출로 새 아이콘 무시됨).
- ⚠️ **역할명(`slot.role`)을 바꾸면 `ROLE_PAT` 키도 같이 바꿀 것.** 안 그러면 아이콘이 폴백된다.
- 구 파이프라인(참고): PNG → cv2 + potrace → 정사각 viewBox. **이 PC에는 cv2·potrace가 없어 재현 불가.** PIL·numpy만 있음.

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
- **컬러 = 팬톤 기반** (2026-07 교체). 액센트는 **팬톤 62x 램프**(같은 색상군의 밝기 7단계)라, 나중에 테마 컬러 교체 기능을 만들 때 이 램프만 갈아끼우면 라이트·다크·틴트가 함께 따라온다.
  - `--accent` 626 C `#285C4D` / 다크 624 C `#789F90`, `--accent-ink` 627 C `#13322B` / 다크 623 C `#9AB9AD`, `--accent-soft` 626 C 12% 틴트.
  - `--sand` 7556 C / 다크 7407 C, `--danger` 7599 C / 다크 7416 C, 심박존 334·7489·142·7577·7619 C.
  - **`--on-accent`** = 액센트 배경 위 글자색(라이트 `#FFFFFF`, 다크 627 C). 다크에서 흰 글자는 대비 2.9:1로 WCAG AA 미달이라 도입함. **액센트 배경을 쓰는 요소는 반드시 `color:var(--on-accent)`** (하드코딩 `#fff` 금지).
  - **중성색(배경 `#F5F4EF`·흰색·검정)은 팬톤으로 바꾸지 말 것.** 최근접이 Cool Gray 1 C(ΔE 6.0)라 배경이 회색으로 어두워진다.
- **레이아웃 폭**: `.wrap`·`.nav-inner` `max-width:430px`(폰 폭). 넓은 화면·미리보기에서도 폰처럼 가운데 정렬(모바일 전용 앱). 640px 등으로 넓히지 말 것.
- **한글 문장부호 규칙**: 명사형 어미(~기/~하기 등)는 마침표 없음. `~다/~요`는 마침표 유지.
- **텍스트 줄바꿈 규칙 (전역 · 모바일 기준)** — 긴 문구는 다음 규칙으로 보기 좋게 끊는다. 핵심 헬퍼 **`smartBreak(text, cap)`**(cap=한 줄에 들어가는 대략 글자 수, 기본 26~27). `periodLines()`=`smartBreak(t,27)`(문단), `fmtCue()`=절 분리 후 `smartBreak(c,26)`(운동 큐/유산소). 웜업/쿨다운 항목 설명은 `wuDesc()`가 수동 `|` 마커(nowrap 조각)로 처리.
  1. **마침표(. ) 뒤에서 줄바꿈** — 문장 단위로 나눔.
  2. **쉼표 줄바꿈은 조건부**: ①문장이 한 줄(cap)을 넘칠 때만, ②쉼표 앞부분(part1)이 한 줄에 들어갈 때만(≤cap), ③쉼표가 문장의 35% 이후일 때만 → 그 쉼표에서 줄바꿈(중앙에 가장 가까운 것). **짧으면 그대로 한 줄**, **너무 길어 part1이 한 줄을 못 넘으면 억지로 안 끊고 자연 줄바꿈**(예: 안전 안내문의 긴 문장). 조기 쉼표(나열 "무릎, 어깨")도 안 끊음.
  3. **`·`(가운뎃점)은 정말 필요할 때만** — 항목 "이름 · 분량"은 `이름(분량)`으로, "좌·우/앞·뒤"는 `좌/우·앞/뒤`(슬래시)로. **예외(유지)**: 공백 없는 합성 나열(`둔근·햄스트링`, `팔·다리`, `벽·기둥`)과 구조적 구분자(`준비 · 워밍업`, `유산소 · 약 6분`).
  4. **어절(단어) 중간에서 안 끊기**: 전역 `word-break:keep-all`. 불릿("- ") 줄은 flex 행잉인덴트로 둘째 줄을 텍스트 첫 글자에 맞춤.
  5. **운동 큐/유산소 설명**: `" · "`·`" — "`(양옆 공백)를 절 구분으로 보고 `- ` 불릿으로 분리, 절 안은 쉼표/마침표에서 끊음. 새 문구 작성 시에도 위 규칙을 따를 것.

---

## 6. 배포 (현재 워크플로, 회원의 주 방법)
1. Windows PC. `workout` 저장소는 로컬에 clone됨:
   `C:\DONGHUN\11. 비즈니스\01. MATE(My AI Trainer for Exercise)\99. 배포\workout`
2. git 사용자 정보·`credential.helper manager` 설정 완료(로그인 저장됨).
3. 폴더 안 **`배포.bat`** (더블클릭): `git pull --no-edit → git add . → git commit -m "update" → git push`.
4. push → GitHub Actions(`deploy.yml`)가 **JS 문법검사 → 통과 시 자동 배포**. (Settings→Pages Source = GitHub Actions)
5. 확인: `leedongs777.github.io/workout/` 강력 새로고침(Ctrl/Cmd+Shift+R).
- 보조 경로: 아이폰 단축어(GitHub API로 index.html PUT). URL은 `https://api.github.com/repos/leedongs777/workout/contents/index.html`, 헤더 `Authorization: Bearer <PAT>`, Base64 인코딩 시 **줄바꿈 없음** 필수(안 그러면 "content is not valid Base64" 422).

### Claude Code에서 배포할 때
- `index.html` 직접 편집 → `<script>` 문법 확인(`node --check`) → `git pull --no-edit` → `git add . && git commit -m "..." && git push`.
- `git pull --no-edit`를 push 전에 먼저(원격에 없는 로컬 변경으로 인한 rejected 방지).
- **커밋·푸시 전 회원 확인**을 받는 걸 기본으로(자율 배포 지양). 의료·안전 로직 변경은 특히 신중히.

---

## 7. 로드맵 / 향후
- **1인 + AI 운영, 자동화 우선.** 완전 무인 X(프로덕션 배포 승인·결제·개인정보/의료·스토어 심사·사고 대응은 사람 게이트 유지).
- 계층: L0 GitHub(소스), L1 오케스트레이터 AI, L2 전문 에이전트(개발/리뷰/테스트/QA스크린샷/트리아지/모니터링), L3 CI·CD+에러 모니터링+크론, L4 사람 승인.
- 우선순위: ①GitHub Actions 자동배포(**완료**), ②localStorage→Firebase Firestore(확장 핵심), 이후 스크린샷 회귀 테스트·파일 경량화(아이콘 외부화)·결제·본인인증(NICE/포트원)·PWA(웹푸시)·React/Next 이관(성장 시).
- 스토어 출시 전 필수: 실제 본인인증, 실제 약관·개인정보처리방침(현재 플레이스홀더), 계정·데이터 삭제.

## 7.5 알려진 미해결 문제 (다음 작업 후보, 우선순위 순)
1. **사용자 목표(goals)가 플랜에 전혀 반영되지 않음.** 온보딩에서 체중감량/근력/자세교정을 고르게 해놓고 표시만 하고 있다. 실제로 플랜을 바꾸는 프로필 값은 `liftingExp`(초보 → 세트 −1)와 `injuries`뿐. 나이는 심박존만. → 목표별로 `sets/reps`와 유산소 비중을 분기해야 함(근력 5×5, 감량 유산소↑ 등).
2. **기구 목록에 파워랙/스쿼트랙이 없다.** 바벨 백 스쿼트는 `eq:['barbell']`만으로 나오므로, 랙 없는 홈짐 사용자에게 위험할 수 있음.
3. **"바닥 운동 제외" 시 16/32 슬롯이 빈다.** 특히 S5는 4개 슬롯이 전부 비어 세션이 통째로 사라짐(코어가 전부 바닥 동작). 서서 하는 코어 대안이 필요.
4. **지병(conditions)은 운동 선택에 영향 없음** — 경고 문구만 나옴.
5. **어깨 부상자는 `수직 밀기 (어깨)` 슬롯이 빈다.** 오버헤드 전부 제외되므로 임상적으로는 타당하나, 슬롯이 사라지는 UI 안내가 없음.
6. `POSE_SVG` 4종의 이름 crop(§4.8) — 새 아이콘 받으면 제거.
7. **케틀벨·메디신볼은 선택해도 쓰이는 운동이 없다.**

---

## 8. 향후 기능 아이디어(백로그)
PWA+웹푸시 리마인더, 세트 휴식 타이머+이전 기록 표시, 바디/통증 로그+그래프, 결과 공유 카드, 배지/스트릭+햅틱, AI 채팅 코치, 캘린더 히트맵.

---

## 9. 작업 시 반드시 지킬 것 (요약)
1. 한국어로 소통. 명사형 어미 마침표 규칙 준수.
2. **불특정 다수용 앱.** 운영자 개인 조건(허리 수술 등)을 전역 기본값으로 넣지 말 것. 부상 제약은 사용자가 고른 값 → `CONTRA_EX`로만 적용(§3).
3. 장비 게이팅: 선택 안 한 장비는 운동생성·설명·웜업/쿨다운·isBW 무료목록 어디에도 안 나오게. **기구가 하나도 없으면 맨몸 운동은 자동 ON이며 해제 불가**(설정·온보딩 양쪽).
4. 웜업/쿨다운: 한 항목=한 동작, 정식 명칭만, 전신 커버+그날 부위 중심, 유지형/횟수형 구분.
5. `index.html` 직접 편집 후 `<script>` 문법 확인(`node --check`). 배포는 `git pull --no-edit` → add → commit → push.
6. grid 레이아웃은 wkhtmltoimage로 시각검증 불가(실제 브라우저는 정상).
7. 커밋·푸시 전 회원 확인. 자율 배포 지양.
8. 저장소 전체가 공개 배포됨 → 비밀키·PAT·민감정보·잡파일 커밋 금지(§1 참고).
