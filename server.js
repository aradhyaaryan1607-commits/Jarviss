import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.get("/api/health", (_req, res) => {
    res.json({
        ok: Boolean(GEMINI_API_KEY),
        model: GEMINI_MODEL,
        fallback: Boolean(GEMINI_FALLBACK_MODEL)
    });
});

async function callGemini(model, contents, systemInstruction) {

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {

        try {

            const upstream = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    system_instruction: systemInstruction,
                    contents,
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 700
                    }
                }),
                signal: AbortSignal.timeout(30000)
            });

            const result = await upstream.json();

            if (upstream.ok) {
                return {
                    success: true,
                    reply: result?.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("")
                        .trim()
                };
            }

            lastError = result?.error?.message ||
                `Gemini error ${upstream.status}`;

            console.error(`Gemini ${model}:`, lastError);

            // Retry temporary errors
            if ([429, 500, 502, 503, 504].includes(upstream.status)) {

                if (attempt < 2) {
                    await sleep(1000 * Math.pow(2, attempt));
                    continue;
                }
            }

            break;

        } catch (error) {

            lastError = error.message;

            if (attempt < 2) {
                await sleep(1000 * Math.pow(2, attempt));
            }
        }
    }

    return {
        success: false,
        error: lastError
    };
}

app.post("/api/chat", async (req, res) => {

    try {

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                error: "GEMINI_API_KEY missing hai. Render Environment check kijiye."
            });
        }

        const { message, history = [], image } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Message empty hai."
            });
        }

        const contents = [];

        for (const item of Array.isArray(history) ? history.slice(-12) : []) {

            if (!["user", "model"].includes(item?.role) ||
                !Array.isArray(item?.parts)) continue;

            const textParts = item.parts
                .filter(p => typeof p?.text === "string")
                .map(p => ({ text: p.text.slice(0, 5000) }));

            if (textParts.length) {
                contents.push({
                    role: item.role,
                    parts: textParts
                });
            }
        }

        const currentParts = [
            { text: message.slice(0, 8000) }
        ];

        if (typeof image === "string" && image.startsWith("data:image/")) {

            const match = image.match(
                /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
            );

            if (match) {
                currentParts.push({
                    inline_data: {
                        mime_type: match[1],
                        data: match[2]
                    }
                });
            }
        }

        contents.push({
            role: "user",
            parts: currentParts
        });

        const systemInstruction = {
            parts: [{
                text: `You are JARVIS, a helpful personal AI assistant.

Reply in natural, clear Hinglish written in Roman script unless the user requests another language.

Address the user politely as sir occasionally.

Be accurate, concise and helpful.

If an image is attached, analyse only what is actually visible.

Never claim you can see a live camera feed. You can only analyse supplied images.

For currency, describe visible denomination cautiously.

For obstacles, describe visible objects and approximate positions, but never claim image analysis is a reliable safety or navigation sensor.`
            }]
        };

        // Primary model and optional fallback
        const models = [
            GEMINI_MODEL,
            GEMINI_FALLBACK_MODEL
        ].filter((model, index, array) =>
            model && array.indexOf(model) === index
        );

        let result;

        for (const model of models) {

            console.log("Trying Gemini model:", model);

            result = await callGemini(
                model,
                contents,
                systemInstruction
            );

            if (result.success && result.reply) {
                return res.json({
                    reply: result.reply,
                    model
                });
            }

            console.log("Model failed:", model, result.error);
        }

        return res.status(502).json({
            error: result?.error ||
                "Gemini service temporarily unavailable. Please try again."
        });

    } catch (error) {

        console.error("JARVIS API error:", error);

        return res.status(500).json({
            error: "Server error. Please try again."
        });
    }
});

app.listen(PORT, () => {

    console.log(`JARVIS running on port ${PORT}`);

    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY missing!");
    }
});
