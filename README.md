# Trip English Hybrid Coach

중학교 1학년 여행 계획 영어 쓰기를 위한 **하이브리드 피드백 웹앱**입니다.

## 구조

- **기본 문법 점검**: `app.js`의 정규식/규칙 기반. 완전히 브라우저 로컬에서 즉시 처리.
- **로컬 AI 코치**: `Transformers.js` + `SmolLM2-360M-Instruct-ONNX`. 외부 생성형 AI API/API 키 없이 브라우저에서 추론.
- **학생 원문 서버 저장 없음**: 앱 코드에는 학생 원문을 서버/DB로 보내는 `fetch`, Firebase, Supabase, Analytics 로직이 없습니다.
- `localStorage`에는 이전 문장과 달라졌는지 비교하기 위한 `fingerprint`와 오류 개수만 저장합니다.

> 주의: AI 코치를 처음 켤 때 **Transformers.js 라이브러리와 모델 파일은 CDN/Hugging Face에서 다운로드**됩니다. 따라서 “완전 오프라인”은 아닙니다. 모델이 캐시된 뒤에는 이후 로딩이 빨라질 수 있습니다.

## 파일

```text
index.html
styles.css
app.js
local-ai.js
.nojekyll
README.md
```

## 실행

VS Code에서 폴더를 연 뒤 `index.html`을 Live Server로 실행합니다.

`file://`로 직접 여는 것보다 `http://localhost...` 형태의 로컬 서버 사용을 권장합니다.

## GitHub Pages 배포

1. GitHub에서 새 저장소를 만듭니다.
2. 위 파일 5개(`README.md` 포함)를 저장소 루트에 업로드합니다.
3. GitHub 저장소에서 **Settings → Pages**로 이동합니다.
4. **Build and deployment → Source**를 `Deploy from a branch`로 선택합니다.
5. Branch를 `main`, Folder를 `/(root)`로 선택하고 Save 합니다.
6. 잠시 기다린 뒤 표시되는 Pages 주소로 접속합니다.

## AI 코치 관련

기본 모델:
`onnx-community/SmolLM2-360M-Instruct-ONNX`

`local-ai.js`에서 모델 ID를 바꿀 수 있습니다.

Transformers.js는 최초 모델 사용 시 모델 파일을 다운로드하고 브라우저 캐시에 저장합니다. WebGPU가 있으면 WebGPU를 사용하고, 없으면 WASM으로 시도합니다.

### 학교 기기에서 꼭 테스트할 것

- 최신 Chrome 또는 Edge 권장
- WebGPU 지원 여부
- 첫 모델 다운로드 시간
- 학교 네트워크의 Hugging Face/CDN 접근 가능 여부
- 한 학급이 동시에 처음 다운로드할 때 네트워크 부하

AI 코치가 실패해도 **기본 문법 점검은 계속 작동**하도록 설계되어 있습니다.

## 개인정보 원칙

이 앱 자체는 다음을 하지 않습니다.

- 학생 이름/학번 요구
- 학생 글 DB 저장
- OpenAI/Claude/Gemini API 호출
- Firebase/Supabase 저장
- Google Analytics 사용
- 학생 원문을 개발자에게 전송

다만 GitHub Pages, jsDelivr, Hugging Face 등 정적 파일/모델 호스팅 서비스에는 일반적인 웹 요청(IP, 브라우저 정보 등)이 발생할 수 있습니다. 학생의 영어 원문을 전송하는 앱 로직은 포함되어 있지 않습니다.
