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

    const maxTokens = incoming.maxTokens || incoming.max_tokens || 2000;

    let messages;
    if (incoming.messages && Array.isArray(incoming.messages)) {
      // Missatges ja preparats (poden incloure documents o imatges)
      messages = incoming.messages;
    } else if (incoming.pdf) {
      // PDF en base64 + instruccions
      messages = [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: incoming.pdf
            }
          },
          { type: "text", text: incoming.prompt || "" }
        ]
      }];
    } else {
      messages = [{ role: "user", content: incoming.prompt || "" }];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Error Claude" });
    }

    // La resposta pot tindre diversos blocs de text: els ajuntem tots
    const text = Array.isArray(data.content)
      ? data.content.filter(b => b.type === "text").map(b => b.text).join("")
      : "";

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
