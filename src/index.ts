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

    // 3. Audit: request_id + hash
    const requestId = crypto.randomUUID();
    const encoder = new TextEncoder();
    const requestHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(userInput)
    );
    const requestHash = [...new Uint8Array(requestHashBuffer)]
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
      return new Response("OpenAI error", { status: 502 });
    }

    const data = await openaiResponse.json();
    const output = data.choices?.[0]?.message?.content ?? "";

    // 5. Audit: response hash
    const responseHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(output)
    );
    const responseHash = [...new Uint8Array(responseHashBuffer)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // 6. Return response (no decisions)
    return new Response(
  JSON.stringify({
    reply: output,
    request_id: requestId,
    audit: {
      input_hash: requestHash,
      output_hash: responseHash
    }
  }),
  {
    headers: { "Content-Type": "application/json" }
  }
);