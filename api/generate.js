export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Mètode no permès" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });
  }

  try {
    let incoming = req.body;
    if (typeof incoming === "string") {
      try { incoming = JSON.parse(incoming); } catch {}
    }

    let body;
    if (incoming?.messages) {
      body = {
        model: incoming.model || "claude-haiku-4-5-20251001",
        max_tokens: incoming.max_tokens || 1500,
        messages: incoming.messages,
      };
    } else if (incoming?.prompt) {
      body = {
        model: incoming.model || "claude-haiku-4-5-20251001",
        max_tokens: incoming.max_tokens || 1500,
        messages: [{ role: "user", content: incoming.prompt }],
      };
    } else {
      body = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        ...incoming,
      };
    }

    console.log("Body enviat:", JSON.stringify(body).substring(0, 300));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Error Anthropic:", JSON.stringify(data));
    }
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Error proxy:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
