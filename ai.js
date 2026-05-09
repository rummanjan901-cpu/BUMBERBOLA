// ════════════════════════════════════════════
//  ai.js  –  AI helpers using Google Gemini
// ════════════════════════════════════════════

const API_KEY = "AIzaSyDalKAuhwhQGREiaiqWRXhT4NycGGB3l8A";
const MODEL   = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

/**
 * Core wrapper – calls Gemini API
 */
async function callAI(systemPrompt, userMessage) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
}

// ══════════════════════════════════════════════
//  summarizeText(text)
// ══════════════════════════════════════════════
export async function summarizeText(text) {
  if (!text.trim()) throw new Error("Please provide some text to summarize.");
  return callAI(
    `You are an expert academic summarizer.
     Given a passage, produce a concise, well-structured summary.
     Use bullet points (•) for key points.
     Keep the summary under 200 words.
     Start directly with the summary — no preamble.`,
    `Summarize the following text:\n\n${text}`
  );
}

// ══════════════════════════════════════════════
//  generateQuiz(text)
//  Returns array: [{question, options:[A,B,C,D], answer}]
// ══════════════════════════════════════════════
export async function generateQuiz(text) {
  if (!text.trim()) throw new Error("Please provide text to generate a quiz from.");

  const raw = await callAI(
    `You are a quiz-master. Generate exactly 5 multiple-choice questions from the given text.
     Return ONLY a valid JSON array — no markdown, no explanation — like:
     [
       {
         "question": "...",
         "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
         "answer": "A. ..."
       }
     ]
     The "answer" must exactly match one of the "options" strings.`,
    `Create a 5-question MCQ quiz from this text:\n\n${text}`
  );

  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse quiz. Please try again.");
  }
}

// ══════════════════════════════════════════════
//  getAIResponse(message, history?)
// ══════════════════════════════════════════════
export async function getAIResponse(message, history = []) {
  const contents = history.map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }]
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: `You are StudyAI, a friendly, knowledgeable study assistant.
                 Help students understand concepts, solve problems, and study effectively.
                 Keep answers clear and concise. Use examples when helpful.`
        }]
      },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.8 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text
    || "I couldn't get a response. Please try again.";
}
