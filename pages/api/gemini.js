import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // Import UUID for session ID generation

const conversationMemoryGemini = {}; // In-memory storage (resets on server restart)

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
  const sessionId = req.body.sessionId;
  const extractedText = req.body.extractedText;

  // Generate a session ID if it's missing
  const userSessionId = sessionId || uuidv4();

  let requestDetails = "";

  // Change the URL if the mode is "gateway"
  if (aiDefenseMode === "gateway" && gatewayUrl) {
    return res.status(405).json({
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
  // Clear chat history from memory for the new sessions
  if (!sessionId || sessionId === "undefined") {
    conversationMemoryGemini[sessionId] = [];
  }
  // Retrieve chat history from memory storage (using sessionId)
  if (!conversationMemoryGemini[sessionId]) {
    conversationMemoryGemini[sessionId] = [];
  }
  let conversation = conversationMemoryGemini[sessionId];

  // Keep only the last 9 messages
  if (conversation.length > 19) {
    conversation = conversation.slice(-18);
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
    // Prepare the request payload with full context
    const requestPayload = {
      contents: conversation.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    };

    // Log HTTP POST request details
    requestDetails = {
      via: aiDefenseMode,
      method: "POST",
      url: `https://generativelanguage.googleapis.com/v1beta/models/${llm}:generateContent?key=${maskAPIKey(
        apiKey
      )}`,
      headers: {
        "Content-Type": "application/json",
      },
      body: requestPayload,
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${llm}:generateContent?key=${apiKey}`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Append AI response to chat history
    const aiResponse =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      response?.data?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response received.";

    conversation.push({ role: "model", content: aiResponse });

    // Save chat history in memory
    conversationMemoryGemini[sessionId] = conversation;

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
