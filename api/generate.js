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

    const maxTokens = incoming.maxTokens || incoming.max_tokens || 2000;

    // Si el prompt ve del HTML, l'enriquim amb instruccions de media
    let messages;
    if (incoming.messages && Array.isArray(incoming.messages)) {
      messages = incoming.messages;
    } else {
      const originalPrompt = incoming.prompt || "";
      const enrichedPrompt = originalPrompt + `

INSTRUCCIONS ADDICIONALS DE FORMAT:
Al final del text, afegeix una secció "RECURSOS MULTIMÈDIA" amb:
1. Entre 1 i 2 vídeos de YouTube rellevants per al tema, en aquest format exacte:
   [VIDEO:Títol descriptiu del vídeo|https://www.youtube.com/results?search_query=paraules+clau+del+tema]
2. Entre 1 i 2 imatges suggerides, en aquest format exacte:
   [IMATGE:Descripció de la imatge|https://commons.wikimedia.org/w/index.php?search=paraules+clau]

Assegura't que els enllaços de cerca siguen rellevants per al tema tractat.
Separa la secció de recursos del text principal amb una línia en blanc.`;
      messages = [{ role: "user", content: enrichedPrompt }];
    }

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

    return res.status(200).json({ text });

  } catch (err) {
    console.error("Error proxy:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
