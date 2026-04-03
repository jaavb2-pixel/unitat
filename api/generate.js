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

    console.log("Incoming keys:", Object.keys(incoming || {}));
    console.log("Has messages:", !!incoming?.messages);
    console.log("Has prompt:", !!incoming?.prompt);

    const maxTokens = incoming.maxTokens || incoming.max_tokens || 1500;

    // Construïm els missatges
    let messages;
    if (incoming.messages && Array.isArray(incoming.messages)) {
      messages = incoming.messages;
    } else {
      messages = [{ role: "user", content: incoming.prompt || "" }];
    }

    console.log("Messages count:", messages.length);
    console.log("First message preview:", messages[0]?.content?.substring(0, 100));

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
    console.log("Groq status:", response.status);
    console.log("Groq choices:", data.choices?.length);

    if (!response.ok) {
      console.error("Error Groq:", JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    const text = data.choices?.[0]?.message?.content || "";
    console.log("Text length:", text.length);
    console.log("Text preview:", text.substring(0, 100));

    // Retornem en format Anthropic perquè el HTML sap llegir-lo
    return res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (err) {
    console.error("Error proxy:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
