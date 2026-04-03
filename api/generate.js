export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Mètode no permès" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada." });
  }

  try {
    let incoming = req.body;
    if (typeof incoming === "string") {
      try { incoming = JSON.parse(incoming); } catch {}
    }

    const prompt = incoming.messages
      ? incoming.messages.map(m => m.content).join("\n")
      : incoming.prompt || "";

    const maxTokens = incoming.maxTokens || incoming.max_tokens || 1500;

    // Crida a l'API de Groq (compatible amb OpenAI)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: incoming.messages || [
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error Groq:", JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    // Convertim la resposta de Groq al format d'Anthropic
    // perquè el HTML espera { content: [{ text: "..." }] }
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (err) {
    console.error("Error proxy:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
