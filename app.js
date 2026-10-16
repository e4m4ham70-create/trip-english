import { getLocalAIInfo, runLocalAICoach } from "./local-ai.js";

const $ = (id) => document.getElementById(id);
const writing = $("writing");
const feedbackForm = $("feedback-form");
const clearButton = $("clear-button");
const reviseButton = $("revise-button");
const charCount = $("char-count");
const formMessage = $("form-message");
const emptyResult = $("empty-result");
const feedbackResult = $("feedback-result");
const feedbackSections = $("feedback-sections");
const resultPanel = $("result-panel");
const originalText = $("original-text");
const aiToggle = $("ai-toggle");
const aiFeedback = $("ai-feedback");
const modelStatus = $("model-status");
const progressTrack = $("progress-track");
const progressBar = $("progress-bar");
const feedbackButton = $("feedback-button");

const spellingRules = [
  ["becuase","because"],["beacuse","because"],["travle","travel"],["resturant","restaurant"],
  ["mountian","mountain"],["beautifull","beautiful"],["exicited","excited"],["thier","their"],
  ["freind","friend"],["planing","planning"],["tommorow","tomorrow"],["vaction","vacation"]
];

const placeRules = [
  ["korea","Korea"],["japan","Japan"],["china","China"],["jeju","Jeju"],["seoul","Seoul"],
  ["busan","Busan"],["paris","Paris"],["london","London"],["new york","New York"],
  ["america","America"],["france","France"]
];

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function cleanFragment(value,max=72){const flat=String(value).replace(/\s+/g," ").trim();return flat.length>max?flat.slice(0,max-1)+"…":flat}
function issue(key,before,direction,reason){return{key,before:cleanFragment(before),direction,reason}}
function addUnique(list,item){if(!list.some(x=>x.key===item.key))list.push(item)}

function analyze(text) {
  const normalized = text.replace(/\s+/g," ").trim();
  const fixes=[], good=[], hints=[];
  const futurePlanPattern = /\b(?:will|(?:am|is|are)\s+going\s+to|plan(?:s)?\s+to|want(?:s)?\s+to|would\s+like\s+to|hope(?:s)?\s+to)\b/i;
  const presentPlanMatch = normalized.match(/\b(?:I|we)\s+(?:go|visit|stay|eat|see|travel|take|buy|meet|arrive|leave|fly)\b/i);
  const pastPlanMatch = normalized.match(/\b(?:I|we)\s+(?:went|visited|stayed|ate|saw|traveled|travelled|took|bought|met|arrived|left|flew)\b/i);

  if (pastPlanMatch) addUnique(fixes,issue("task-past",pastPlanMatch[0],"주어 + will / be going to + 동사원형","앞으로의 여행 계획에서는 미래 계획 표현을 사용해요."));
  else if (presentPlanMatch) addUnique(fixes,issue("task-present",presentPlanMatch[0],"주어 + will / be going to + 동사원형","현재의 습관보다 앞으로 할 일을 나타내 보세요."));
  else if (!futurePlanPattern.test(normalized)) addUnique(fixes,issue("task-future","미래 계획 표현이 보이지 않음","will / be going to / plan to 중 알맞은 표현","앞으로 할 일을 알 수 있는 표현이 필요해요."));

  spellingRules.forEach(([wrong,right])=>{const m=normalized.match(new RegExp("\\b"+wrong+"\\b","i"));if(m)addUnique(fixes,issue("spell-"+wrong,m[0],right,"철자를 다시 확인해요."))});
  if(/\bi\b/.test(normalized))addUnique(fixes,issue("capital-i","i","I","나를 뜻하는 I는 대문자로 써요."));
  placeRules.forEach(([wrong,right])=>{const pattern=new RegExp("\\b"+wrong.replace(" ","\\s+")+"\\b","g");const ms=normalized.match(pattern);if(ms&&ms.some(m=>m!==right)){const bad=ms.find(m=>m!==right);addUnique(fixes,issue("place-"+wrong,bad,right,"나라와 도시 이름은 대문자로 시작해요."))}});

  const sentences=normalized.match(/[^.!?]+[.!?]?/g)||[];
  sentences.forEach((raw,index)=>{const s=raw.trim();if(!s)return;const f=s.match(/[A-Za-z]/);if(f&&f[0]===f[0].toLowerCase())addUnique(fixes,issue("start-"+index,cleanFragment(s,38),"첫 글자를 대문자로","영어 문장은 대문자로 시작해요."));if(!/[.!?]$/.test(s))addUnique(fixes,issue("punct-"+index,cleanFragment(s,38),"문장 끝에 . ? ! 중 알맞은 표시","문장의 끝을 표시해 주세요."))});

  const patterns = [
    [/\bI\s+(?:is|are)\b/i,"be-i","I + is/are","I + ___","I와 어울리는 be동사를 골라 보세요."],
    [/\bI\s+going\s+to\b/i,"going-be","I going to","I ___ going to","be going to에는 be동사가 필요해요."],
    [/\b(?:want|wants|wanted)\s+(?:visit|go|travel|see|eat|stay|take|buy|enjoy|experience)\b/i,"want-to","want + 동사","want + ___ + 동사원형","want와 동사 사이에 필요한 말을 생각해 보세요."],
    [/\b(?:want|wants|wanted)\s+to\s+(?:visiting|going|traveling|travelling|seeing|eating|staying|taking|buying)\b/i,"want-base","want to + 동사-ing","want to + 동사원형","want to 뒤에는 동사원형을 써요."],
    [/\b(?:am|is|are)\s+going\s+(?:visit|go|travel|see|eat|stay|take|buy)\b/i,"going-to","be going + 동사","be going + ___ + 동사원형","미래 계획의 be going to에서 to를 확인해요."],
    [/\bwill\s+(?:going|visiting|traveling|travelling|seeing|eating|staying|taking|bought|went|visited|visits|goes|travels|sees|eats|stays|takes|buys)\b/i,"will-base","will + 바뀐 동사","will + 동사원형","will 뒤에는 동사원형을 써요."],
    [/\bcan\s+(?:going|visiting|traveling|travelling|seeing|eating|staying|taking|went|visited)\b/i,"can-base","can + 바뀐 동사","can + 동사원형","can 뒤에는 동사원형을 써요."],
    [/\barrive(?:s|d)?\s+to\b/i,"arrive-prep","arrive to","arrive + in/at","도시·나라에는 in, 작은 장소에는 at이 잘 어울려요."],
    [/\bvisit(?:s|ed)?\s+to\s+[A-Za-z]/i,"visit-no-to","visit to + 장소","visit + 장소","visit 뒤에는 장소를 바로 써요."],
    [/\b(?:go|travel|come|went|traveled|travelled|came)\s+(?:in|on)\s+(?:bus|train|plane|car|taxi)\b/i,"transport","in/on + 교통수단","by + 교통수단","교통수단으로 이동할 때는 보통 by를 사용해요."],
    [/\b(?:in|at)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,"day-prep","in/at + 요일","on + 요일","요일 앞에는 on을 사용해요."],
    [/\b(?:on|at)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,"month-prep","on/at + 월","in + 월","월 앞에는 in을 사용해요."],
    [/\bthere\s+is\s+(?:many|two|three|four|five|several)\b/i,"there-plural","There is + 여러 개","There ___ + 여러 개","여러 개가 있을 때 어울리는 be동사를 생각해요."],
    [/\b(?:two|three|four|five|six|seven|eight|nine|ten|many|several)\s+(?:day|night|place|hotel|restaurant|museum|park|city)\b/i,"plural","두 개 이상 + 단수 명사","두 개 이상 + 명사-s","두 개 이상이면 셀 수 있는 명사는 보통 -s를 붙여요."]
  ];
  patterns.forEach(r=>{const m=normalized.match(r[0]);if(m)addUnique(fixes,issue(r[1],m[0]||r[2],r[3],r[4]))});

  if(futurePlanPattern.test(normalized))good.push("<strong>앞으로의 계획</strong>을 나타내는 표현을 잘 사용했어요.");
  if(/\bbecause\b/i.test(normalized))good.push("<code>because</code>로 이유를 덧붙인 점이 좋아요.");
  if(/\b(?:first|then|next|after that|finally)\b/i.test(normalized))good.push("순서를 나타내는 말을 사용해서 계획이 잘 이어져요.");
  if(/\b(?:and|but|so)\b/i.test(normalized))good.push("문장을 이어 주는 말을 알맞게 사용했어요.");
  if(sentences.length>=2)good.push("여행 계획을 여러 문장으로 나누어 표현했어요.");
  if(!good.length)good.push("내 생각을 영어로 직접 적어 본 것이 좋은 시작이에요.");

  if(!fixes.length){good.unshift("<strong>잘 썼어요!</strong> 기본 점검에서 뚜렷한 오류가 보이지 않아요.");hints.push("문장을 소리 내어 읽으며 의미가 자연스럽게 이어지는지 확인해 보세요.");}
  else hints.push("힌트의 빈칸이나 동사 모양을 보고 먼저 직접 고쳐 보세요.");
  hints.push("수정한 뒤 다시 피드백을 받아 변화가 있는지 확인해 보세요.");

  return {fixes:fixes.slice(0,4),good:good.slice(0,3),hints:hints.slice(0,2)};
}

function looksLikeDraft(text){
  const englishWords=text.match(/[A-Za-z]+/g)||[];
  const instruction=/(?:대신\s*써|써\s*줘|작성해\s*줘|만들어\s*줘|완성해\s*줘|(?:please|can you|could you|would you)\s+(?:please\s+)?(?:write|make|finish|complete)|write (?:it|this) for me|do (?:it|this) for me)/i.test(text);
  return{hasDraft:englishWords.length>=1,instruction};
}
function sectionHTML(type,number,title,items){const content=items.map(item=>"<li>"+item+"</li>").join("");return `<section class="feedback-card ${type}"><h3 class="card-title"><span>${number}</span>${title}</h3><ul class="feedback-list">${content}</ul></section>`}
function renderRuleFeedback(text,original){
  const result=analyze(text);let previous=null;
  try{previous=JSON.parse(localStorage.getItem("tripEnglishLast")||"null")}catch{}
  let fingerprint=0;for(let i=0;i<text.length;i++)fingerprint=((fingerprint<<5)-fingerprint+text.charCodeAt(i))|0;
  let praise="";if(previous&&previous.fingerprint!==fingerprint&&previous.issueCount>result.fixes.length)praise='<p class="revision-praise">지난번보다 고쳐 볼 부분이 줄었어요. 직접 잘 고쳤어요! 👏</p>';
  const fixItems=result.fixes.length?result.fixes.map(f=>`<span class="fix-item"><span class="change-line"><code>${escapeHTML(f.before)}</code><span class="arrow">→</span>${escapeHTML(f.direction)}</span><span class="reason">${escapeHTML(f.reason)}</span></span>`):["<strong>잘 썼어요!</strong> 기본 점검에서는 고쳐 볼 점이 없어요."];
  feedbackSections.innerHTML=praise+sectionHTML("good","1","잘한 점",result.good)+sectionHTML("fix","2","고쳐 볼 점",fixItems)+sectionHTML("check","3","다시 확인해 보기",result.hints);
  originalText.textContent=original;emptyResult.hidden=true;feedbackResult.hidden=false;resultPanel.classList.add("has-feedback");
  try{localStorage.setItem("tripEnglishLast",JSON.stringify({fingerprint,issueCount:result.fixes.length}))}catch{}
  return result;
}
function ruleSummary(result){return result.fixes.length?result.fixes.map(f=>`${f.before} → ${f.direction}`).join("; "):"기본 규칙에서 뚜렷한 오류 없음"}

function updateProgress(event){
  progressTrack.hidden=false;
  const raw=Number(event?.progress);
  let pct=Number.isFinite(raw)?raw:0;
  if(pct<=1)pct*=100;
  pct=Math.max(0,Math.min(100,pct));
  progressBar.style.width=`${pct}%`;
  if(event?.status==="ready"){modelStatus.textContent=`AI 코치 준비 완료 · ${event.device||""}`;setTimeout(()=>{progressTrack.hidden=true},500)}
  else modelStatus.textContent=`AI 모델 준비 중${pct?` · ${Math.round(pct)}%`:""} · ${event?.device||""}`;
}
function showFormMessage(msg){formMessage.textContent=msg;formMessage.hidden=false;writing.classList.add("has-error");writing.focus()}
function updateInputState(){const len=writing.value.length;charCount.textContent=`${len} / 800`;clearButton.hidden=len===0;formMessage.hidden=true;writing.classList.remove("has-error")}
writing.addEventListener("input",updateInputState);
clearButton.addEventListener("click",()=>{writing.value="";updateInputState();writing.focus()});
aiToggle.addEventListener("change",()=>{const info=getLocalAIInfo();modelStatus.textContent=aiToggle.checked?`AI 코치: 사용 예정 · ${info.device}`:"AI 코치: 꺼짐"});

feedbackForm.addEventListener("submit",async(event)=>{
  event.preventDefault();const original=writing.value;const text=original.trim();
  if(!text)return showFormMessage("먼저 내가 직접 쓴 영어 문장을 입력해 주세요.");
  const draft=looksLikeDraft(text);
  if(draft.instruction)return showFormMessage("여행 계획을 대신 써 주지는 않아요. 내가 직접 쓴 영어 문장을 먼저 입력해 주세요.");
  if(!draft.hasDraft)return showFormMessage("영어 문장을 한 문장 이상 입력해 주세요.");

  feedbackButton.disabled=true;
  const result=renderRuleFeedback(text,original);
  try{resultPanel.focus({preventScroll:true})}catch{resultPanel.focus()}
  if(window.matchMedia?.("(max-width: 840px)").matches)resultPanel.scrollIntoView({behavior:"smooth",block:"start"});

  if(aiToggle.checked){
    aiFeedback.className="ai-feedback loading";
    aiFeedback.textContent="로컬 AI 코치를 준비하고 있어요. 처음 사용할 때는 모델 다운로드 때문에 시간이 걸릴 수 있습니다.";
    try{
      const answer=await runLocalAICoach(text,ruleSummary(result),updateProgress);
      aiFeedback.className="ai-feedback";
      aiFeedback.textContent=answer;
    }catch(error){
      console.error(error);
      aiFeedback.className="ai-feedback error";
      aiFeedback.textContent="AI 코치를 실행하지 못했어요. 기본 문법 점검은 정상적으로 사용할 수 있습니다. Chrome/Edge 최신 버전과 인터넷 연결을 확인해 주세요.";
      modelStatus.textContent="AI 코치 실행 실패 · 기본 점검만 사용 가능";
    }
  }else{
    aiFeedback.className="ai-feedback";
    aiFeedback.innerHTML='<p class="ai-placeholder">AI 코치가 꺼져 있습니다. 기본 문법 점검만 실행했습니다.</p>';
  }
  feedbackButton.disabled=false;
});

reviseButton.addEventListener("click",()=>{writing.focus();writing.setSelectionRange(writing.value.length,writing.value.length);writing.scrollIntoView({behavior:"smooth",block:"center"})});
writing.addEventListener("keydown",(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter")feedbackForm.requestSubmit()});
updateInputState();
