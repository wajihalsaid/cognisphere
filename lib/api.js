import axios from "axios";
import CryptoJS from "crypto-js";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

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

const maskKey = (apiKey) => {
  // Mask the API key in logs
  return apiKey
    ? apiKey.replace(/(.{16})(.*)(.{4})/, "$1******$3")
    : "[REDACTED]";
};

// OpenAI API Request
export const getOpenAIResponse = async (question, model, extractedText) => {
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

  // Retrieve chat history from localStorage
  let conversation =
    JSON.parse(localStorage.getItem("CONVERSATION_OPENAI")) || [];

  // Ensure system message is always first if it is provided
  const SYSTEM_PROMPT = localStorage.getItem("systemPrompt");
  if (!SYSTEM_PROMPT) {
    conversation = conversation.filter((msg) => msg.role !== "system");
    // Keep only the last 9 messages
    if (conversation.length > 19) {
      conversation = conversation.slice(-18);
    }
  } else {
    if (!conversation.some((msg) => msg.role === "system")) {
      conversation.unshift({ role: "system", content: SYSTEM_PROMPT });

      // Keep only the last 9 messages + system message
      if (conversation.length > 20) {
        conversation = [conversation[0], ...conversation.slice(-19)];
      }
    }
  }

  // Append the new user message to chat history
  conversation.push({
    role: "user",
    content:
      extractedText.trim() === ""
        ? question
        : `Based on this document: "${extractedText}", answer: ${question}`,
  });

  const requestPayload = {
    model: model,
    ...(model === "o3-mini" && { reasoning_effort: "medium" }),
    messages: [...conversation],
    ...(model !== "o3-mini" && { max_tokens: 1000 }),
  };

  const config = {
    headers: {
      Authorization: `Bearer ${maskAPIKey(apiKey)}`,
      "Content-Type": "application/json",
    },
  };

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

    // Append the assistant's response to chat history
    conversation.push({
      role: "assistant",
      content:
        response?.choices?.[0]?.message?.content ??
        response?.data?.choices?.[0]?.message?.content ??
        response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "No response received.",
    });

    // Store updated chat history in localStorage
    localStorage.setItem("CONVERSATION_OPENAI", JSON.stringify(conversation));

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
export const getGeminiResponse = async (question, apiLLMKey, extractedText) => {
  const apiKey = getDecryptedAPIKey("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing Gemini API Key");

  // Get AI defense settings from localStorage
  const aiDefenseSettings = JSON.parse(
    localStorage.getItem("AI_DEFENSE_SETTINGS")
  );
  const aiDefenseMode = aiDefenseSettings?.aiDefenseMode || "browser"; // Default to "direct" if not found

  // Retrieve chat history from localStorage
  let conversation =
    JSON.parse(localStorage.getItem("CONVERSATION_Gemini")) || [];

  // Keep only the last 9 messages and responses
  if (conversation.length > 19) {
    conversation = conversation.slice(-18);
  }

  // Append the new user message to chat history
  conversation.push({
    role: "user",
    content:
      extractedText.trim() === ""
        ? question
        : `Based on this document: "${extractedText}", answer: ${question}`,
  });

  // Prepare the request payload with full context
  const requestPayload = {
    contents: conversation.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
  };

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
      body: requestPayload,
    };

    const response = await axiosInstance.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    // Append the assistant's response to chat history
    conversation.push({
      role: "assistant",
      content:
        response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        response?.data?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "No response received.",
    });

    // Store updated chat history in localStorage
    localStorage.setItem("CONVERSATION_Gemini", JSON.stringify(conversation));

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

// Bedrock API Request
export const getBedrockResponse = async (question, model, extractedText) => {
  try {
    const secretAccessKey = getDecryptedAPIKey("AWS_SECRET_KEY");
    const accessKeyId = getDecryptedAPIKey("AWS_ACCESS_KEY");
    if (!secretAccessKey) throw new Error("Missing AWS Secret Key");
    if (!accessKeyId) throw new Error("Missing AWS Access Key");

    const region = localStorage.getItem("AWS_REGION") || "us-east-1";
    const CustomURL = localStorage.getItem("AWS_Bedrock_CustomURL");

    const signer = new SignatureV4({
      service: "bedrock",
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      sha256: Sha256,
    });

    // Get AI defense settings from localStorage
    const aiDefenseSettings = JSON.parse(
      localStorage.getItem("AI_DEFENSE_SETTINGS")
    );
    const aiDefenseMode = aiDefenseSettings?.aiDefenseMode || "browser"; // Default to "direct" if not found
    const gatewayUrl = aiDefenseSettings?.gatewayUrl || null;

    const modelId =
      model === "anthropic.claude-3-7-sonnet-20250219-v1:0" ||
      model === "anthropic.claude-3-5-haiku-20241022-v1:0" ||
      model === "anthropic.claude-3-5-sonnet-20240620-v1:0" ||
      model === "meta.llama3-3-70b-instruct-v1:0" ||
      model === "meta.llama3-2-11b-instruct-v1:0" ||
      model === "meta.llama3-1-70b-instruct-v1:0" ||
      model === "meta.llama3-1-8b-instruct-v1:0"
        ? region.substring(0, 2) + "." + model
        : model;

    const hostname =
      CustomURL && CustomURL.trim() !== ""
        ? CustomURL
        : `bedrock-runtime.${region}.amazonaws.com`;
    const path = `/model/${modelId}/converse`;
    let apiUrl = `https://${hostname}${path}`;

    // Change the URL if the mode is "gateway"
    if (aiDefenseMode === "gateway" && gatewayUrl) {
      apiUrl = gatewayUrl + path; // Set the custom gateway URL
    }

    // Retrieve chat history from localStorage
    let conversation =
      JSON.parse(localStorage.getItem("CONVERSATION_Bedrock")) || [];

    // Keep only the last 9 messages and responses
    if (conversation.length > 19) {
      conversation = conversation.slice(-18);
    }

    // Append the new user message to chat history
    conversation.push({
      role: "user",
      content:
        extractedText.trim() === ""
          ? question
          : `Based on this document: "${extractedText}", answer: ${question}`,
    });

    // Prepare the request payload using chat history
    const requestPayload = {
      messages: conversation.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
    };

    // Add system prompt if it exists and is supported
    const SYSTEM_PROMPT = localStorage.getItem("systemPrompt");
    if (
      SYSTEM_PROMPT &&
      (model.startsWith("meta") || model.startsWith("anthropic"))
    ) {
      requestPayload.system = [{ text: SYSTEM_PROMPT }];
    }

    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname: hostname,
      path: path,
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Host: hostname,
      },
      body: JSON.stringify(requestPayload),
    });

    const signedRequest = await signer.sign(request);

    const maskedSignedHeaders = {
      ...signedRequest.headers, // Spread original header
      authorization: `${maskKey(signedRequest.headers.authorization)}`, // Mask
      "x-amz-content-sha256": `${maskAPIKey(
        signedRequest.headers["x-amz-content-sha256"]
      )}`,
    };

    requestDetails = {
      via: aiDefenseMode,
      method: signedRequest.method,
      url: apiUrl,
      headers: maskedSignedHeaders,
      body: signedRequest.body,
    };

    const response = await fetch(apiUrl, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
    });

    const headersObject = {};
    response.headers.forEach((value, key) => {
      headersObject[key] = value;
    });

    const contentType = response.headers.get("content-type") || "";
    const jsonResponse =
      contentType === "application/json"
        ? await response.json()
        : await response.text();
    //console.log(jsonResponse);

    // Append the assistant's response to chat history
    conversation.push({
      role: "assistant",
      content:
        jsonResponse.output?.message?.content?.[0]?.text ??
        "No response received.",
    });

    // Store updated chat history in localStorage
    localStorage.setItem("CONVERSATION_Bedrock", JSON.stringify(conversation));

    return {
      response: response,
      body: jsonResponse,
      headers: headersObject,
      logs: requestDetails,
    };
  } catch (error) {
    //console.error("Bedrock API Error:", error.response?.data || error.message);
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
