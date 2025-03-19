import axios from "axios";


const apiUrl = ""; // Default GEMINI API URL

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

  // Change the URL if the mode is "gateway"
  if (aiDefenseMode === "gateway" && gatewayUrl) {
    return res
      .status(405)
      .json({
        error:
          "Gemini is currently not supported by AI Defense via Gateway, please try via API Inspection",
      });
    //apiUrl = gatewayUrl + "/v1/chat/completions"; // Set the custom gateway URL
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

    // Log HTTP POST request details
    requestDetails = {
      via: aiDefenseMode,
      method: "POST",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${maskAPIKey(
        apiKey
      )}`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        contents: [{ parts: [{ text: question }] }],
      },
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: question }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

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
