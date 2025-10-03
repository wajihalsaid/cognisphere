import axios from "axios";

const chatUrl = "api/v1/inspect/chat"; // Default Chat Inspect API URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = req.body.apiKey;
  const promptRole = req.body.promptRole;
  //const promptContent = req.body.userQuestion;
  const enabledRules = req.body.enabledRules;
  const apiServer = req.body.apiServer;
  const aiDefenseMode = req.body.aiDefenseMode;
  const extractedText = req.body.extractedText;

  const promptContent =
    extractedText.trim() === ""
      ? req.body.userQuestion
      : `Based on this document: "${extractedText}", answer: ${req.body.userQuestion}`;

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
    //console.error("AI Defense API Error:", JSON.stringify(error)); // Log full error for debugging
     const isEmptyArray = Array.isArray(enabledRules) && enabledRules.length === 0;
    const errorMessage =
           error.status === 400
    ? "This connection already has policy configured on AI Defense Dashboard. Please disable the existing Enabled Rules in Settings or use an API key associated with a connection that has no rules configured."
    : (error.status === 500 && isEmptyArray)
    ? "The AI Defense API key that you are using is not associated with any policy on AI Defense Dashboard. Please configure policy on AI Defense Dashboard or enable any of existing rules here"
    : error.status === 401
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
