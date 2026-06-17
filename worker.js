/**
 * Cloudflare Worker: OpenRouter AI Proxy for LexByte
 * Securely handles responses while hiding your API Key.
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

        let question;
        let selectedModel = "google/gemini-2.0-pro-exp-02-05:free";
        try {
            const body = await request.json();
            question = body.question;
            if (body.model) selectedModel = body.model;
        } catch (e) {
            return new Response(
                JSON.stringify({ error: "Invalid JSON body: " + e.message }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        if (!question) {
            return new Response(
                JSON.stringify({ error: "Missing 'question' field in request body." }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        const API_KEY = env.OPENROUTER_LexAi_API_KEY;
        if (!API_KEY) {
            return new Response(
                JSON.stringify({ error: "OPENROUTER_LexAi_API_KEY secret is not configured in Cloudflare Worker settings." }),
                { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        try {
            // 2. Use OpenRouter Chat Completions API
            const API_URL = "https://openrouter.ai/api/v1/chat/completions";

            const systemPrompt = "You are LexByte AI, an expert AI Lawyer specializing in the Constitution of India. Write a clear, informative answer in flowing paragraphs. Cite Articles naturally. No lists, no bold. 3-5 paragraphs. End with a brief legal disclaimer.";

            const orResponse = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://lexbyte-ai-lawyer.web.app",
                    "X-Title": "LexByte AI Lawyer",
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        { role: "system", "content": systemPrompt },
                        { role: "user", "content": question }
                    ]
                }),
            });

            if (!orResponse.ok) {
                const errBody = await orResponse.text();
                return new Response(
                    JSON.stringify({ error: `OpenRouter API error ${orResponse.status}: ${errBody}` }),
                    { status: orResponse.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }

            const orData = await orResponse.json();
            const text = orData?.choices?.[0]?.message?.content;

            if (!text) {
                return new Response(
                    JSON.stringify({ error: `OpenRouter returned no text. Response: ${JSON.stringify(orData)}` }),
                    { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }

            // 3. Simulate SSE streaming by sending the full text as chunks
            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            const chunkSize = 80;
            ctx.waitUntil((async () => {
                for (let i = 0; i < text.length; i += chunkSize) {
                    const chunk = text.slice(i, i + chunkSize);
                    writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                }
                writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                writer.close();
            })());

            return new Response(readable, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
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
