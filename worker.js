// Cloudflare Worker: keeps OPENAI_API_KEY secret (Settings → Variables and Secrets).
// Send { messages, search: true } to use a web-search model that returns citations.
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const { messages, search } = await request.json();
    // Only two allowed setups, so the public endpoint can't be used for any other model.
    const body = search
      ? { model: "gpt-4o-search-preview", web_search_options: {}, messages }
      : { model: "gpt-4o", messages, max_completion_tokens: 800 };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return new Response(await response.text(), { status: response.status, headers: corsHeaders });
  },
};
