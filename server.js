import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY server par set nahi hai. .env file check kijiye." });
    }

    const { message, history = [], image } = req.body || {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message empty hai." });
    }

    const contents = [];
    for (const item of Array.isArray(history) ? history.slice(-12) : []) {
      if (!["user", "model"].includes(item?.role) || !Array.isArray(item?.parts)) continue;
      const textParts = item.parts
        .filter(p => typeof p?.text === "string")
        .map(p => ({ text: p.text.slice(0, 5000) }));
      if (textParts.length) contents.push({ role: item.role, parts: textParts });
    }

    const currentParts = [{ text: message.slice(0, 8000) }];
    if (typeof image === "string" && image.startsWith("data:image/")) {
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
      if (match) {
        currentParts.push({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }
    contents.push({ role: "user", parts: currentParts });

    const systemInstruction = {
      parts: [{
        text: `You are JARVIS, a helpful personal AI assistant. Reply in natural, clear Hinglish written in Roman script (Hindi + English), unless the user explicitly requests another language. Address the user politely as "sir" occasionally, but do not overuse it. Be accurate, concise, and explain when uncertain. If an image is attached, answer only about what is actually visible. Never claim you can see a live feed; you can only analyse the supplied captured image. For currency, describe visible denomination and features cautiously and say if authenticity cannot be verified from an image. For obstacles, describe visible objects and their approximate positions, but warn that image analysis is not a safety/navigation sensor.`
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: systemInstruction,
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
      })
    });

    const result = await upstream.json();
    if (!upstream.ok) {
      const detail = result?.error?.message || `Gemini API returned ${upstream.status}`;
      return res.status(502).json({ error: detail });
    }

    const reply = result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) return res.status(502).json({ error: "Gemini se readable response nahi mila." });
    res.json({ reply });
  } catch (error) {
    console.error("JARVIS API error:", error);
    res.status(500).json({ error: "Server error. Backend terminal/log check kijiye." });
  }
});

app.listen(PORT, () => {
  console.log(`JARVIS running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn("GEMINI_API_KEY missing. Add it to .env before using AI.");
});
