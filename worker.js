/**
 * Cloudflare Worker: Gemini AI Proxy for LexGlass
 * Securely handles streaming responses while hiding your API Key.
 */

export default {
    async fetch(request, env, ctx) {
        // 1. Handle CORS Preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        try {
            const { question } = await request.json();
            if (!question) {
                return new Response("Missing question", { status: 400 });
            }

            // 2. Prepare Gemini API Request
            const API_KEY = env.GEMINI_API_KEY;
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

            const prompt = `You are an expert AI Lawyer specializing in the Constitution of India.
Question: "${question}"
Write a clear, informative answer in flowing paragraphs. Cite Articles naturally. No lists, no bold. 3-5 paragraphs.
End with a legal disclaimer.`;

            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                }),
            });

            // 3. Stream back to Frontend
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();

            (async () => {
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                        writer.close();
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const sseData = JSON.parse(line.slice(6));
                                const text = sseData.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                                }
                            } catch (e) { }
                        }
                    }
                }
            })();

            return new Response(readable, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                },
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    },
};
