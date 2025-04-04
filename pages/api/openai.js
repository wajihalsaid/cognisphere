import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // Import UUID for session ID generation

const conversationMemoryOpenAI = {}; // In-memory storage (resets on server restart)

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
  const sessionId = req.body.sessionId;
  const extractedText = req.body.extractedText;

  // Generate a session ID if it's missing
  const userSessionId = sessionId || uuidv4();

  let requestDetails = "";
  let apiUrl =
    llm.startsWith("gpt") || llm === "o3-mini"
      ? "https://api.openai.com/v1/chat/completions"
      : llm.startsWith("llama") || llm.startsWith("deepseek")
      ? "https://api.groq.com/openai/v1/chat/completions"
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

  // Retrieve chat history from memory storage (using sessionId)
  if (!conversationMemoryOpenAI[sessionId]) {
    conversationMemoryOpenAI[sessionId] = [];
  }
  let conversation = conversationMemoryOpenAI[sessionId];

  // Ensure system message is always first if it is provided
  const SYSTEM_PROMPT = req.body.SYSTEM_PROMPT;
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

  // Append new user message
  conversation.push({
    role: "user",
    content:
      extractedText.trim() === ""
        ? question
        : `Based on this document: "${extractedText}", answer: ${question}`,
  });

  try {
    const requestPayload = {
      model: llm,
      ...(llm === "o3-mini" && { reasoning_effort: "medium" }),
      messages: [...conversation],
      ...(llm !== "o3-mini" && { max_tokens: 1000 }),
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

    // Append AI response to chat history
    const aiResponse =
      response?.data?.choices?.[0]?.message?.content ||
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response received.";

    conversation.push({ role: "assistant", content: aiResponse });

    // Save chat history in memory
    conversationMemoryOpenAI[sessionId] = conversation;

    res
      .status(200)
      .json({
        response: response.data,
        logs: requestDetails,
        sessionId: userSessionId,
      });
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
