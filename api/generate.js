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

    const maxTokens = incoming.maxTokens || incoming.max_tokens || 1500;
    const messages = incoming.messages && Array.isArray(incoming.messages)
      ? incoming.messages
      : [{ role: "user", content: incoming.prompt || "" }];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error Groq:", JSON.stringify(data));
      return res.status(response.status).json({ error: data?.error?.message || "Error Groq" });
    }

    const text = data.choices?.[0]?.message?.content || "";
    console.log("Text generat, longitud:", text.length);

    // El HTML espera exactament { text: "..." }
    return res.status(200).json({ text });

  } catch (err) {
    console.error("Error proxy:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
