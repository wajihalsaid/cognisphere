import axios from "axios";


const apiUrl = ""; // Default OpenAI API URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = req.body.apiLLMKey;
  const llm = req.body.selectedLLM;
  const question = req.body.userQuestion;
  const gatewayUrl = req.body.gatewayUrl;
  const aiDefenseMode = req.body.aiDefenseMode;

  let requestDetails = "";
  let apiUrl =
    llm.startsWith("gpt") || llm === "o3-mini"
      ? "https://api.openai.com/v1/chat/completions"
      : llm === "MetaLLM"
      ? "https://api.meta.com/v1"
      : llm === "Gemini"
      ? "https://api.gemini.com/v1"
      : ""; // Default to an empty string if none match (to avoid undefined)

  // Change the URL if the mode is "gateway"
  if (aiDefenseMode === "gateway" && gatewayUrl) {
    apiUrl = gatewayUrl + "/v1/chat/completions"; // Set the custom gateway URL
  }

  if (!llm || !question || !apiKey) {
    return res
      .status(400)
      .json({ error: "Model, API Key, and question are required" });
  }

  const maskAPIKey = (apiKey) => {
    // Mask the API key in logs
    return apiKey
      ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3")
      : "[REDACTED]";
  };

  try {
    const requestPayload = {
      model: llm,
      ...(llm === "o3-mini" && { reasoning_effort: "medium" }),
      messages: [{ role: "user", content: question }],
      max_tokens: 1000,
    };

    const config = {
      headers: {
        Authorization: `Bearer ${maskAPIKey(apiKey)}`,
        "Content-Type": "application/json",
      },
    };

    // Log HTTP POST request details
    requestDetails = {
      via: aiDefenseMode,
      method: "POST",
      url: apiUrl,
      headers: config.headers,
      body: requestPayload,
    };

    const response = await axios.post(apiUrl, requestPayload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    res.status(200).json({ response: response.data, logs: requestDetails });
  } catch (error) {
    console.error("OpenAI API Error:", error); // Log full error for debugging
    const errorMessage =
      error?.response?.data?.error?.message ||
      error.message ||
      "Unknown error occurred";
    const errorStatus = error?.response?.status || "Unknown status";
    res.status(500).json({
      error: {
        message: errorMessage,
        status: errorStatus,
      },
      logs: requestDetails,
    });
  }
}
