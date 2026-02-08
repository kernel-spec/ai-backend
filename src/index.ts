export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // 1. Only POST allowed
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 2. Parse input
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const userInput = body?.input;
    if (!userInput || typeof userInput !== "string") {
      return new Response("Missing input", { status: 400 });
    }

    // 3. Audit: request_id + input hash
    const requestId = crypto.randomUUID();
    const encoder = new TextEncoder();

    const inputHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(userInput)
    );
    const inputHash = [...new Uint8Array(inputHashBuffer)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // 4. Call OpenAI API (execution only)
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [
            { role: "user", content: userInput }
          ],
          temperature: 0.2
        })
      }
    );

    if (!openaiResponse.ok) {
      return new Response(
        JSON.stringify({ error: "OpenAI error" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await openaiResponse.json();
    const reply =
      data?.choices?.[0]?.message?.content ?? "";

    // 5. Audit: output hash
    const outputHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(reply)
    );
    const outputHash = [...new Uint8Array(outputHashBuffer)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // 6. Final response (Custom GPT friendly)
    return new Response(
      JSON.stringify({
        reply: reply,
        request_id: requestId,
        audit: {
          input_hash: inputHash,
          output_hash: outputHash
        }
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};