hereconst REPONSE_HEADERS = { "Content-Type": "application/json" };

function reponse(statut, objet) {
  return { statusCode: statut, headers: REPONSE_HEADERS, body: JSON.stringify(objet) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reponse(405, { error: "Méthode non autorisée." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return reponse(500, { error: "FATIA n'est pas encore configurée côté serveur." });
  }

  let donnees;
  try {
    donnees = JSON.parse(event.body || "{}");
  } catch (e) {
    return reponse(400, { error: "Requête invalide." });
  }

  const messages = donnees.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return reponse(400, { error: "Conversation invalide." });
  }

  for (const m of messages) {
    const roleOk = m && (m.role === "user" || m.role === "assistant");
    const texteOk = m && typeof m.content === "string" && m.content.trim() !== "" && m.content.length <= 4000;
    if (!roleOk || !texteOk) {
      return reponse(400, { error: "Message invalide ou trop long." });
    }
  }

  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") {
    return reponse(400, { error: "Ordre des messages invalide." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 1000,
        system: "Tu es FATIA, un assistant IA amical et clair. Tu réponds dans la langue de l'utilisateur, de façon simple et concise.",
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    });

    if (!r.ok) {
      console.error("Erreur API, statut :", r.status);
      return reponse(502, { error: "FATIA n'a pas pu répondre. Réessaie dans un instant." });
    }

    const data = await r.json();
    const texte = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return reponse(200, { reply: texte || "Je n'ai pas de réponse pour le moment." });
  } catch (e) {
    console.error("Erreur réseau côté serveur.");
    return reponse(502, { error: "Problème de connexion. Réessaie dans un instant." });
  }
};
