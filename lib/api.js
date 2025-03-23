import axios from "axios";
import CryptoJS from "crypto-js";

// Function to retrieve and decrypt the API key
const getDecryptedAPIKey = (storageKey) => {
  try {
    const encryptedKey = localStorage.getItem(storageKey);
    if (!encryptedKey) return null;

    const bytes = CryptoJS.AES.decrypt(encryptedKey, "your-secret-key");
    const decryptedKey = bytes.toString(CryptoJS.enc.Utf8);
    return decryptedKey || null;
  } catch (error) {
    console.error("Error decrypting API key:", error);
    return null;
  }
};

const axiosInstance = axios.create();
let requestDetails = "";

const maskAPIKey = (apiKey) => {
  // Mask the API key in logs
  return apiKey
    ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3")
    : "[REDACTED]";
};

// OpenAI API Request
export const getOpenAIResponse = async (question, model) => {
  let apiKey = "";
  if (model.startsWith("gpt-") || model === "o3-mini") {
    apiKey = getDecryptedAPIKey("OPENAI_API_KEY");
  } else if (model.startsWith("llama-") || model.startsWith("deepseek-")) {
    apiKey = getDecryptedAPIKey("META_LLM_API_KEY");
  } else if (model === "Gemini") {
    apiKey = getDecryptedAPIKey("GEMINI_API_KEY");
  }
  //const apiKey = getDecryptedAPIKey("OPENAI_API_KEY");
  if (!apiKey) throw new Error("Missing OpenAI API Key");

  // Get AI defense settings from localStorage
  const aiDefenseSettings = JSON.parse(
    localStorage.getItem("AI_DEFENSE_SETTINGS")
  );

  const aiDefenseMode = aiDefenseSettings?.aiDefenseMode || "browser"; // Default to "direct" if not found
  const gatewayUrl = aiDefenseSettings?.gatewayUrl || null;

  const requestPayload = {
    model: model,
    ...(model === "o3-mini" && { reasoning_effort: "medium" }),
    messages: [{ role: "user", content: question }],
    max_tokens: 1000,
  };

  const config = {
    headers: {
      Authorization: `Bearer ${maskAPIKey(apiKey)}`,
      "Content-Type": "application/json",
    },
  };

  //let apiUrl = "https://api.openai.com/v1/chat/completions"; // Default OpenAI API URL

  let apiUrl =
    model.startsWith("gpt") || model === "o3-mini"
      ? "https://api.openai.com/v1/chat/completions"
      : model.startsWith("llama") || model.startsWith("deepseek")
      ? "https://api.groq.com/openai/v1/chat/completions"
      : ""; // Default to an empty string if none match (to avoid undefined)

  // Change the URL if the mode is "gateway"
  if (aiDefenseMode === "gateway" && gatewayUrl) {
    apiUrl = gatewayUrl + "/v1/chat/completions"; // Set the custom gateway URL
  }

  // Log HTTP POST request details
  requestDetails = {
    via: aiDefenseMode,
    method: "POST",
    url: apiUrl,
    headers: config.headers,
    body: requestPayload,
  };

  try {
    const response = await axiosInstance.post(apiUrl, requestPayload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    //return response;
    return { response: response, logs: requestDetails };
  } catch (error) {
    //console.error("OpenAI API Error:", error.response?.data || error.message);
    // Extract error details safely
    const status = error.response?.status || "Unknown Status";
    const headers = error.response?.headers
      ? JSON.stringify(error.response.headers, null, 2)
      : "No Headers";
    const body = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : "No Response Body";

    // Construct error object
    const errorDetails = {
      message: error.message,
      status,
      headers,
      body,
      logs: requestDetails, // ✅ Include logs in case of failure
    };
    //console.error(errorDetails);
    throw errorDetails; // ✅ Throw structured error object instead of just a string
  }
};

// Gemini API Request
export const getGeminiResponse = async (question) => {
  const apiKey = getDecryptedAPIKey("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing Gemini API Key");

  // Get AI defense settings from localStorage
  const aiDefenseSettings = JSON.parse(
    localStorage.getItem("AI_DEFENSE_SETTINGS")
  );
  const aiDefenseMode = aiDefenseSettings?.aiDefenseMode || "browser"; // Default to "direct" if not found

  try {
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

    const response = await axiosInstance.post(
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
    return { response: response, logs: requestDetails };
  } catch (error) {
    //console.error("OpenAI API Error:", error.response?.data || error.message);
    // Extract error details safely
    const status = error.response?.status || "Unknown Status";
    const headers = error.response?.headers
      ? JSON.stringify(error.response.headers, null, 2)
      : "No Headers";
    const body = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : "No Response Body";

    // Construct error object
    const errorDetails = {
      message: error.message,
      status,
      headers,
      body,
      logs: requestDetails, // ✅ Include logs in case of failure
    };
    //console.error(errorDetails);
    throw errorDetails; // ✅ Throw structured error object instead of just a string
  }
};
