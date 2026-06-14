// Cloudflare Pages Function: POST /api/diet
// Holds the Gemini API key server-side (never exposed to the browser) and
// generates a meal plan. Set GEMINI_API_KEY in your Cloudflare Pages project:
//   Settings > Environment variables > add GEMINI_API_KEY (your free key).
//
// The app calls THIS endpoint, not Gemini directly, so the key stays secret
// and you control usage.

export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const key = env.GEMINI_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: cors });
    }

    const body = await request.json().catch(() => ({}));
    const p = body.profile || {};

    // Build a safe, supportive prompt. The app passes an already-calculated,
    // safe calorie target and floor; we forbid recommending below the floor.
    const goal = (p.goal || "lose fat");
    const target = p.target || 2000;
    const floor = p.floor || 1500;
    const prompt =
`You are a supportive, professional nutritionist writing for a general fitness app.
Create a concise, practical daily meal plan.

User context:
Goal: ${goal}
BMI: ${p.bmi || "unknown"}
Age: ${p.age || "unknown"}
Gender: ${p.gender || "unknown"}
Activity: ${p.activity || "unknown"}
Daily calorie target (already calculated and safe): about ${target} kcal.
Do NOT recommend eating below ${floor} kcal under any circumstances.
Location: Karachi, Pakistan; use common local foods and delivery (Pakistani cuisine, BBQ, salads).

Rules:
- Build the plan around the given calorie target. Never suggest a very low calorie or crash diet.
- Encourage balanced, sustainable, adequate eating. Do not promote restriction.
- Keep it under 250 words, with simple meal ideas and rough portions.
- End with one short line that this is general guidance, not medical advice, and to consult a qualified professional.`;

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const gRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
      }),
    });

    if (!gRes.ok) {
      const t = await gRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "AI service error", detail: t.slice(0, 300) }), { status: 502, headers: cors });
    }

    const data = await gRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return new Response(JSON.stringify({ error: "Empty response" }), { status: 502, headers: cors });
    }

    return new Response(JSON.stringify({ text }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", detail: String(e).slice(0, 200) }), { status: 500, headers: cors });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
