import axios from "axios";

const chatUrl = "api/v1/inspect/chat"; // Default Chat Inspect API URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = req.body.apiKey;
  const promptRole = req.body.promptRole;
  const promptContent = req.body.userQuestion;
  const enabledRules = req.body.enabledRules;
  const apiServer = req.body.apiServer;
  const aiDefenseMode = req.body.aiDefenseMode;

  const maskAPIKey = (apiKey) => {
    // Mask the API key in logs
    return apiKey
      ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3")
      : "[REDACTED]";
  };

  let apiUrl = apiServer + chatUrl;

  let requestDetails = "";

  try {
    const requestPayload = {
      messages: [
        {
          role: promptRole,
          content: promptContent,
        },
      ],
      metadata: {},
      config: {
        enabled_rules: enabledRules,
      },
    };

    const maskedHeaders = {
      "X-Cisco-AI-Defense-API-Key": maskAPIKey(apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const headers = {
      "X-Cisco-AI-Defense-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Log HTTP POST request details
    requestDetails = {
      via: aiDefenseMode,
      method: "POST",
      url: apiUrl,
      headers: maskedHeaders,
      body: requestPayload,
    };

    const response = await axios.post(apiUrl, requestPayload, { headers });

    res.status(200).json({ response: response.data, logs: requestDetails });
  } catch (error) {
    //console.error("AI Defense API Error:", error); // Log full error for debugging
    const errorMessage =
      error.status === 401
        ? "API Inspect Request Failed due to: Unauthorized (Invalid API Key)"
        : "API Inspect Request Failed due to: " +
          (error.code ||
            error?.response?.data?.error?.message ||
            error.message ||
            "Unknown error occurred");
    const errorStatus = error?.response?.status || "Unknown status";
    res.status(error.status).json({
      error: {
        message: errorMessage || error,
        status: errorStatus,
      },
      logs: requestDetails,
    });
  }
}
