import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL_ID = "onnx-community/SmolLM2-360M-Instruct-ONNX";
let generatorPromise = null;
let generator = null;

function supportsWebGPU() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function extractText(output) {
  const generated = output?.[0]?.generated_text;
  if (Array.isArray(generated)) {
    const last = generated.at(-1);
    return (last?.content || "").trim();
  }
  if (typeof generated === "string") return generated.trim();
  return "";
}

export function getLocalAIInfo() {
  return {
    model: MODEL_ID,
    device: supportsWebGPU() ? "webgpu" : "wasm",
    note: "외부 AI API를 호출하지 않고 브라우저에서 모델을 실행합니다."
  };
}

export async function prepareLocalAI(onProgress = () => {}) {
  if (generator) return generator;
  if (generatorPromise) return generatorPromise;

  const useWebGPU = supportsWebGPU();
  const device = useWebGPU ? "webgpu" : "wasm";
  const dtype = useWebGPU ? "q4f16" : "q4";

  generatorPromise = pipeline("text-generation", MODEL_ID, {
    device,
    dtype,
    progress_callback: (event) => {
      // Transformers.js progress_callback event shapes can vary by stage.
      const progress = Number(event?.progress);
      onProgress({
        status: event?.status || "loading",
        file: event?.file || "",
        progress: Number.isFinite(progress) ? progress : null,
        device
      });
    }
  }).then((pipe) => {
    generator = pipe;
    onProgress({ status: "ready", progress: 100, device });
    return pipe;
  }).catch((error) => {
    generatorPromise = null;
    throw error;
  });

  return generatorPromise;
}

export async function runLocalAICoach(studentText, ruleSummary, onProgress = () => {}) {
  const pipe = await prepareLocalAI(onProgress);

  const systemPrompt = `
You are a Korean middle-school English writing coach for grade 7.
The student is writing a short travel plan in English.

Rules:
- Do NOT write the whole assignment for the student.
- Do NOT provide a polished full replacement paragraph.
- Give only short hints that help the student revise independently.
- Use simple Korean suitable for a Korean middle-school first-year student.
- Focus on meaning, naturalness, repetition, and whether the travel plan is clear.
- Do not repeat rule-based grammar feedback unless it is important to meaning.
- If the writing is already clear, praise one strength and suggest one small improvement.
- Never ask for or infer personal information.
- Maximum 3 bullet points.
- Keep the response under 170 Korean characters if possible.
`.trim();

  const userPrompt = `
학생 글:
${studentText}

기본 문법 점검 요약:
${ruleSummary || "특별히 발견된 기본 오류 없음"}

위 글을 학생이 스스로 고칠 수 있도록 짧은 한국어 힌트만 주세요.
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const output = await pipe(messages, {
    max_new_tokens: 120,
    do_sample: false,
    repetition_penalty: 1.08
  });

  const text = extractText(output);
  if (!text) throw new Error("로컬 AI가 피드백을 생성하지 못했습니다.");
  return text;
}
