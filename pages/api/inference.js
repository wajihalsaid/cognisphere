// polyfill.js - MUST BE FIRST
import { File } from "formdata-node";
globalThis.File = File;

import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import https from "https";
const { Agent } = await import("undici");

function generateAlertMessage(violations) {
  if (!violations || violations.length === 0) return null;
  const blockMessage = violations.map(
    (v) =>
      ` ${v.classification}: ${v.rule_name}${
        v.entity_types && v.entity_types.length
          ? ` (${v.entity_types.join(", ")})`
          : ""
      }`
  );
  return { message: blockMessage };
}

function processInspectionResults(response) {
  if (response.is_safe) return null; // No violations
  //console.log ("process response: ", response);
  let violations = [];

  response.rules.forEach((rule) => {
    violations.push({
      classification: rule.classification,
      rule_name: rule.rule_name,
      entity_types: rule.entity_types.filter((e) => e),
      attack_technique:
        response.attack_technique !== "NONE_ATTACK_TECHNIQUE"
          ? response.attack_technique
          : null,
      severity:
        response.severity !== "NONE_SEVERITY" ? response.severity : null,
    });
  });

  return violations.length ? violations : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!req.headers["model"]) {
    return res
      .status(405)
      .json({ error: "'model' header is missing from HTTP request" });
  }

  try {
    let answer;
    let response;
    const selectedLLM = req.headers["model"];
    const apiLLMKey = req.headers["api-key"] || "";
    const aiDefenseMode = req.headers["ai-defense-mode"] || "";
    const gatewayUrl = req.headers["ai-defense-gateway-url"] || "";
    const aiDefenseRegion = req.headers["ai-defense-region"] || "";
    const aiDefenseKey = req.headers["ai-defense-key"] || "";
    const AWS_REGION = req.headers["aws-region"] || "";
    const AWS_Bedrock_CustomURL = req.headers["aws-bedrock-custom-dns"] || "";
    const AWS_ACCESS_KEY = req.headers["aws-access-key"] || "";
    const AWS_SECRET_KEY = req.headers["aws-secret-key"] || "";
    const { instructions, messages } = req.body || "";
    const SYSTEM_PROMPT = instructions;
    const userQuestion = messages;
    const extractedText = "";
    const model = selectedLLM;
    // Map region to API server
    const regionMap = {
      us: "https://us.api.inspect.aidefense.security.cisco.com/",
      eu: "https://eu.api.inspect.aidefense.security.cisco.com/",
      ap: "https://ap.api.inspect.aidefense.security.cisco.com/",
      ap: "https://uae.api.inspect.aidefense.security.cisco.com/",
    };
    let apiServer = "";
    apiServer = regionMap[aiDefenseRegion] || aiDefenseRegion;

    //console.log("aiDefenseMode: ", aiDefenseMode);
    //console.log("gatewayUrl: ", gatewayUrl);
    if (
      [
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-2025-08-07",
        "gpt-4o",
        "gpt-4.1",
        "o3-mini",
        "gpt-4",
        "llama-3.3-70b-versatile",
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "qwen/qwen3-32b",
        "moonshotai/kimi-k2-instruct-0905",
      ].includes(selectedLLM) ||
      selectedLLM.startsWith("ollama")
    ) {
      if (!req.headers["ai-defense-mode"]) {
      } else if (req.headers["ai-defense-mode"] === "gateway") {
        if (!req.headers["ai-defense-gateway-url"]) {
          return res.status(405).json({
            error:
              "'ai-defense-gateway-url' header is missing from HTTP request",
          });
        } else {
          if (
            [
              "llama-3.3-70b-versatile",
              "meta-llama/llama-4-maverick-17b-128e-instruct",
              "moonshotai/kimi-k2-instruct-0905",
              "qwen/qwen3-32b",
            ].includes(selectedLLM) ||
            selectedLLM.startsWith("ollama")
          ) {
            return res.status(405).json({
              error: "AI Defense Gateway is not saupported on Selected Model:",
              selectedLLM,
            });
          }
        }
      } else if (req.headers["ai-defense-mode"] === "api") {
        if (!req.headers["ai-defense-region"]) {
          return res.status(405).json({
            error: "'ai-defense-region' header is missing from HTTP request",
          });
        } else {
          apiServer = regionMap[aiDefenseRegion] || regionMap["us"];
        }

        if (!req.headers["ai-defense-key"]) {
          return res.status(405).json({
            error: "'ai-defense-key' header is missing from HTTP request",
          });
        }
        try {
          const apiPromptInspectResult = await callChatInspectPrompt({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiPromptInspectResult.response.is_safe) {
            const Violation = processInspectionResults(
              apiPromptInspectResult.response ?? []
            );
            response = await runInference(
              "AI Defense [Prompt]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(
                    apiPromptInspectResult.response ?? []
                  )
                ).message
              }.`
            );

            return res.status(200).json(response);
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        return res.status(405).json({
          error:
            "AI Defense Mode is not recognized. It should be 'gateway' or 'api'",
          selectedLLM,
        });
      }
      if (!req.headers["api-key"]) {
        if (selectedLLM.startsWith("ollama")) {
          return res
            .status(405)
            .json({ error: "'api-key' header should have ollama URL value" });
        } else {
          return res
            .status(405)
            .json({ error: "'api-key' header is missing from HTTP request" });
        }
      }

      response = await callOpenAI({
        apiKey: apiLLMKey,
        llm: selectedLLM,
        question: userQuestion,
        gatewayUrl: gatewayUrl,
        aiDefenseMode: aiDefenseMode,
        SYSTEM_PROMPT,
      });
      //      console.log ("response: ", JSON.stringify(response));
      //      console.log ("response: ", response.response.choices[0].message.content);
      answer =
        response?.response?.choices?.[0]?.message?.content ??
        response?.data?.response?.choices?.[0]?.message?.content ??
        response?.response?.data?.choices?.[0]?.message?.content ??
        response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        response?.response?.message?.content ??
        "No response received.";
      try {
        if (req.headers["ai-defense-mode"] === "api") {
          const apiInspectResult = await callChatInspect({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            responseRole: "assistant",
            answer: answer,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiInspectResult.response.is_safe) {
            response = await runInference(
              "AI Defense [Response]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(apiInspectResult.response ?? [])
                ).message
              }.`
            );

            return res.status(200).json(response);
          }
        }
      } catch (err) {
        console.log(err);
      }
    } else if (selectedLLM.startsWith("gemini")) {
      if (!req.headers["ai-defense-mode"]) {
      } else if (req.headers["ai-defense-mode"] === "gateway") {
        return res.status(405).json({
          error: "AI Defense Gateway is not saupported on Selected Model:",
          selectedLLM,
        });
      } else if (req.headers["ai-defense-mode"] === "api") {
        if (!req.headers["ai-defense-region"]) {
          return res.status(405).json({
            error: "'ai-defense-region' header is missing from HTTP request",
          });
        } else {
          apiServer = regionMap[aiDefenseRegion] || regionMap["us"];
        }

        if (!req.headers["ai-defense-key"]) {
          return res.status(405).json({
            error: "'ai-defense-key' header is missing from HTTP request",
          });
        }
        try {
          const apiPromptInspectResult = await callChatInspectPrompt({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiPromptInspectResult.response.is_safe) {
            response = await runInference(
              "AI Defense [Prompt]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(
                    apiPromptInspectResult.response ?? []
                  )
                ).message
              }.`
            );

            return res.status(200).json(response);
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        return res.status(405).json({
          error:
            "AI Defense Mode is not recognized. It should be 'gateway' or 'api'",
          selectedLLM,
        });
      }
      if (!req.headers["api-key"]) {
        return res
          .status(405)
          .json({ error: "'api-key' header is missing from HTTP request" });
      }
      response = await callGemini({
        apiKey: apiLLMKey,
        llm: selectedLLM,
        question: userQuestion,
        aiDefenseMode: aiDefenseMode,
        gatewayUrl: gatewayUrl,
      });
      answer =
        response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
        response?.response?.data?.candidates?.[0]?.content.parts[0].text ??
        response?.data?.response?.candidates?.[0]?.content.parts[0].text;
      ("No response received.");
      try {
        if (req.headers["ai-defense-mode"] === "api") {
          const apiInspectResult = await callChatInspect({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            responseRole: "assistant",
            answer: answer,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiInspectResult.response.is_safe) {
            response = await runInference(
              "AI Defense [Response]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(apiInspectResult.response ?? [])
                ).message
              }.`
            );
            return res.status(200).json(response);
          }
        }
      } catch (err) {
        console.log(err);
      }
    } else if (selectedLLM.startsWith("bedrock")) {
      let modelId = selectedLLM.replace("bedrock - ", "");
      if (!req.headers["ai-defense-mode"]) {
      } else if (req.headers["ai-defense-mode"] === "gateway") {
        if (!req.headers["ai-defense-gateway-url"]) {
          return res.status(405).json({
            error:
              "'ai-defense-gateway-url' header is missing from HTTP request",
          });
        }
      } else if (req.headers["ai-defense-mode"] === "api") {
        if (!req.headers["ai-defense-region"]) {
          return res.status(405).json({
            error: "'ai-defense-region' header is missing from HTTP request",
          });
        } else {
          apiServer = regionMap[aiDefenseRegion] || regionMap["us"];
        }
        try {
          if (!req.headers["ai-defense-key"]) {
            return res.status(405).json({
              error: "'ai-defense-key' header is missing from HTTP request",
            });
          }

          const apiPromptInspectResult = await callChatInspectPrompt({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiPromptInspectResult.response.is_safe) {
            response = await runInference(
              "AI Defense [Prompt]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(
                    apiPromptInspectResult.response ?? []
                  )
                ).message
              }.`
            );

            return res.status(200).json(response);
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        return res.status(405).json({
          error:
            "AI Defense Mode is not recognized. It should be 'gateway' or 'api'",
          selectedLLM,
        });
      }
      if (!req.headers["aws-region"]) {
        return res
          .status(405)
          .json({ error: "'aws-region' header is missing from HTTP request" });
      }
      if (!req.headers["aws-access-key"]) {
        return res.status(405).json({
          error: "'aws-access-key' header is missing from HTTP request",
        });
      }
      if (!req.headers["aws-secret-key"]) {
        return res.status(405).json({
          error: "'aws-secret-key' header is missing from HTTP request",
        });
      }

      response = await callBedrock({
        AWS_REGION: AWS_REGION,
        AWS_Bedrock_CustomURL: AWS_Bedrock_CustomURL,
        AWS_ACCESS_KEY: AWS_ACCESS_KEY,
        AWS_SECRET_KEY: AWS_SECRET_KEY,
        userQuestion: userQuestion,
        modelId: modelId,
        gatewayUrl: gatewayUrl,
        aiDefenseMode: aiDefenseMode,
        SYSTEM_PROMPT: SYSTEM_PROMPT,
      });
      answer =
        response?.response?.candidates?.[0]?.content?.parts[0]?.text ??
        response?.response?.data?.candidates?.[0]?.content?.parts[0]?.text ??
        response?.data?.response?.candidates?.[0]?.content?.parts[0]?.text ??
        response?.data?.body.content?.[0]?.text ??
        response?.data?.response?.body ??
        response?.body?.output?.message?.content?.[0]?.text ??
        response?.data?.body?.output?.message?.content?.[0].text ??
        "No response received.";
      try {
        if (req.headers["ai-defense-mode"] === "api") {
          const apiInspectResult = await callChatInspect({
            apiKey: aiDefenseKey,
            promptRole: "user",
            userQuestion: userQuestion,
            responseRole: "assistant",
            answer: answer,
            enabledRules: [],
            apiServer: apiServer,
            aiDefenseMode: aiDefenseMode,
            extractedText: "",
          });
          if (!apiInspectResult.response.is_safe) {
            response = await runInference(
              "AI Defense [Response]: ",
              `Blocked due to${
                generateAlertMessage(
                  processInspectionResults(apiInspectResult.response ?? [])
                ).message
              }.`
            );

            return res.status(200).json(response);
          }
        }
      } catch (err) {
        console.log(err);
      }
    } else {
      return res.status(405).json({
        error:
          "LLM Model is not recognized. Pleade check you are using supported Model in 'model' Header of HTTP Request",
      });
    }

    response = await runInference(model, answer);

    return res.status(200).json(response);
  } catch (err) {
    //console.error(err);
    return res
      .status(500)
      .json({ error: "Internal Server Error", "Details: ": err });
  }
}

// Inference function
async function runInference(model, answer) {
  // Connect to OpenAI, AWS Bedrock, or your chatbot logic
  return {
    id: `req_${uuidv4()}`,
    model,
    created: Date.now(),
    choices: [{ role: "assistant", content: answer }],
  };
}

export async function callOpenAI({
  apiKey,
  llm,
  question,
  gatewayUrl,
  aiDefenseMode,
  SYSTEM_PROMPT,
}) {
  try {
    let agent = undefined;
    // Determine API URL
    let apiUrl =
      llm.startsWith("gpt") || llm === "o3-mini"
        ? "https://api.openai.com/v1/chat/completions"
        : llm.startsWith("llama") ||
          llm.startsWith("qwen") ||
          llm.startsWith("moonshotai") ||
          llm.startsWith("meta-llama")
        ? "https://api.groq.com/openai/v1/chat/completions"
        : llm.startsWith("ollama")
        ? apiKey + "/api/chat"
        : "";
    //console.log("aiDefenseMode: ", aiDefenseMode);
    //console.log("gatewayUrl: ", gatewayUrl);
    if (aiDefenseMode === "gateway" && gatewayUrl) {
      const allowedPrefixes = [
        "https://us.gateway.aidefense",
        "https://eu.gateway.aidefense",
        "https://ap.gateway.aidefense",
      ];
      const shouldIgnoreCert = !allowedPrefixes.some((prefix) =>
        apiUrl.startsWith(prefix)
      );
      agent = shouldIgnoreCert
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;
      apiUrl = gatewayUrl + "/v1/chat/completions";
    }

    if (!llm || !question || !apiKey) {
      throw new Error("Model, API Key, and question are required");
    }
    let conversation = [];
    if (!SYSTEM_PROMPT) {
      // Append new user message
      conversation.push({ role: "user", content: question });
    } else {
      // Append System Instructions
      conversation.push({ role: "system", content: SYSTEM_PROMPT });

      // Append new user message
      conversation.push({ role: "user", content: question });
    }

    // Prepare payload
    const requestPayload = {
      model: llm.startsWith("ollama-") ? llm.replace("ollama-", "") : llm,
      messages: [...conversation],
      ...(llm.startsWith("ollama") ? { stream: false } : {}),
    };

    const response = await axios.post(apiUrl, requestPayload, {
      headers: {
        ...(llm.startsWith("ollama")
          ? {}
          : { Authorization: `Bearer ${apiKey}` }),
        "Content-Type": "application/json",
        "Accept-Encoding": "", // Temporrary solution for Server Gateway option
      },
      httpsAgent: agent,
    });

    const aiResponse =
      response?.data?.choices?.[0]?.message?.content ||
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response received.";

    return {
      response: response.data,
    };
  } catch (error) {
    //    console.error("OpenAI API Error:", error); // Log full error for debugging
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
    };
    //console.error(errorDetails);
    throw errorDetails; // ✅ Throw structured error object instead of just a string
  }
}

export async function callChatInspectPrompt({
  apiKey,
  promptRole,
  userQuestion,
  enabledRules,
  apiServer,
  aiDefenseMode,
  extractedText,
}) {
  const chatUrl = "api/v1/inspect/chat"; // Default Chat Inspect API URL
  let apiUrl = apiServer + chatUrl;
  const allowedPrefixes = [
    "https://us.api.inspect",
    "https://eu.api.inspect",
    "https://ap.api.inspect",
    "https://uae.api.inspect",
  ];

  const maskAPIKey = (apiKey) =>
    apiKey ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3") : "[REDACTED]";

  const promptContent =
    extractedText.trim() === ""
      ? userQuestion
      : `Based on this document: "${extractedText}", answer: ${userQuestion}`;

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

  const requestDetails = {
    via: aiDefenseMode,
    method: "POST",
    url: apiUrl,
    headers: maskedHeaders,
    body: requestPayload,
  };

  try {
    const shouldIgnoreCert = !allowedPrefixes.some((prefix) =>
      apiUrl.startsWith(prefix)
    );
    const agent = shouldIgnoreCert
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;
    const response = await axios.post(apiUrl, requestPayload, {
      headers,
      httpsAgent: agent,
    });

    return {
      response: response.data,
      logs: requestDetails,
    };
  } catch (error) {
    const errorMessage =
      error.status === 400
        ? "This connection already has policy configured on AI Defense Dashboard. Please disable the existing Enabled Rules in Settings or use an API key associated with a connection that has no rules configured."
        : error.status === 401
        ? "API Inspect Request Failed due to: Unauthorized (Invalid API Key)"
        : "API Inspect Request Failed due to: " +
          (error.code ||
            error?.response?.data?.error?.message ||
            error.message ||
            "Unknown error occurred");

    const errorStatus = error?.response?.status || "Unknown status";

    throw {
      error: {
        message: errorMessage,
        status: errorStatus,
      },
      logs: requestDetails,
    };
  }
}

export async function callChatInspect({
  apiKey,
  promptRole,
  userQuestion,
  responseRole,
  answer,
  enabledRules,
  apiServer,
  aiDefenseMode,
  extractedText = "",
}) {
  const chatUrl = "api/v1/inspect/chat"; // Default Chat Inspect API URL
  let apiUrl = apiServer + chatUrl;
  const allowedPrefixes = [
    "https://us.api.inspect",
    "https://eu.api.inspect",
    "https://ap.api.inspect",
    "https://uae.api.inspect",
  ];

  const maskAPIKey = (apiKey) =>
    apiKey ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3") : "[REDACTED]";

  const promptContent =
    extractedText.trim() === ""
      ? userQuestion
      : `Based on this document: "${extractedText}", answer: ${userQuestion}`;

  const requestPayload = {
    messages: [
      { role: promptRole, content: promptContent },
      { role: responseRole, content: answer },
    ],
    metadata: {},
    config: {},
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

  const requestDetails = {
    via: aiDefenseMode,
    method: "POST",
    url: apiUrl,
    headers: maskedHeaders,
    body: requestPayload,
  };

  try {
    const shouldIgnoreCert = !allowedPrefixes.some((prefix) =>
      apiUrl.startsWith(prefix)
    );
    const agent = shouldIgnoreCert
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    const response = await axios.post(apiUrl, requestPayload, {
      headers,
      httpsAgent: agent,
    });

    return {
      response: response.data,
      logs: requestDetails,
    };
  } catch (error) {
    const errorMessage =
      error.status === 400
        ? "This connection already has policy configured on AI Defense Dashboard. Please disable the existing Enabled Rules in Settings or use an API key associated with a connection that has no rules configured."
        : error.status === 401
        ? "API Inspect Request Failed due to: Unauthorized (Invalid API Key)"
        : "API Inspect Request Failed due to: " +
          (error.code ||
            error?.response?.data?.error?.message ||
            error.message ||
            "Unknown error occurred");

    const errorStatus = error?.response?.status || "Unknown status";

    throw {
      error: {
        message: errorMessage,
        status: errorStatus,
      },
      logs: requestDetails,
    };
  }
}

export async function callGemini({
  apiKey,
  llm,
  question,
  aiDefenseMode,
  gatewayUrl,
}) {
  if (aiDefenseMode === "gateway" && gatewayUrl) {
    throw new Error(
      "Gemini is currently not supported by AI Defense via Gateway, please try via API Inspection"
    );
  }

  if (!llm || !question || !apiKey) {
    throw new Error("Model, API Key, and question are required");
  }

  const maskAPIKey = (apiKey) =>
    apiKey ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3") : "[REDACTED]";

  let conversation = [];
  // Add user message
  conversation.push({ role: "user", content: question });

  const requestPayload = {
    contents: conversation.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
  };
  try {
    const requestDetails = {
      via: aiDefenseMode,
      method: "POST",
      url: `https://generativelanguage.googleapis.com/v1beta/models/${llm}:generateContent?key=${maskAPIKey(
        apiKey
      )}`,
      headers: { "Content-Type": "application/json" },
      body: requestPayload,
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${llm}:generateContent?key=${apiKey}`,
      requestPayload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    const aiResponse =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      response?.data?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response received.";
    return {
      response: response.data,
      logs: requestDetails,
    };
  } catch (error) {
    // console.error("OpenAI API Error:", error?.response?.data?.error?.message); // Log full error for debugging
    //  console.error("OpenAI API Error:", JSON.stringify(error)); // Log full error for debugging
    const errorMessage =
      error?.response?.data?.error?.message ||
      error.message ||
      "Unknown error occurred";
    const errorStatus =
      error?.status || error?.response?.status || "Unknown status";
    const combinedError = {
      error: {
        message: errorMessage,
        status: errorStatus,
      },
    };
    throw combinedError;
  }
}

export async function callBedrock({
  AWS_REGION,
  AWS_Bedrock_CustomURL,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  userQuestion,
  modelId,
  gatewayUrl,
  aiDefenseMode,
  SYSTEM_PROMPT,
}) {
  try {
    const signer = new SignatureV4({
      service: "bedrock",
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
      sha256: Sha256,
    });

    let conversation = [];
    // Add user message
    conversation.push({ role: "user", content: userQuestion });

    const payload = {
      messages: conversation.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
    };

    if (
      SYSTEM_PROMPT &&
      (modelId.startsWith("meta") || modelId.startsWith("anthropic"))
    ) {
      payload.system = [{ text: SYSTEM_PROMPT }];
    }

    modelId =
      modelId === "anthropic.claude-haiku-4-5-20251001-v1:0" ||
      modelId === "anthropic.claude-sonnet-4-5-20250929-v1:0" ||
      modelId === "anthropic.claude-opus-4-1-20250805-v1:0" ||
      modelId === "anthropic.claude-sonnet-4-20250514-v1:0" ||
      modelId === "anthropic.claude-3-7-sonnet-20250219-v1:0" ||
      modelId === "anthropic.claude-3-5-haiku-20241022-v1:0" ||
      modelId === "anthropic.claude-3-5-sonnet-20240620-v1:0" ||
      modelId === "amazon.nova-premier-v1:0" ||
      modelId === "meta.llama4-maverick-17b-instruct-v1:0" ||
      modelId === "meta.llama3-3-70b-instruct-v1:0" ||
      modelId === "meta.llama3-2-11b-instruct-v1:0" ||
      modelId === "meta.llama3-1-70b-instruct-v1:0" ||
      modelId === "meta.llama3-1-8b-instruct-v1:0"
        ? AWS_REGION.substring(0, 2) + "." + modelId
        : modelId;

    const hostname =
      AWS_Bedrock_CustomURL && AWS_Bedrock_CustomURL.trim() !== ""
        ? AWS_Bedrock_CustomURL
        : `bedrock-runtime.${AWS_REGION}.amazonaws.com`;
    const path = `/model/${modelId}/converse`;
    let apiUrl = `https://${hostname}${path}`;

    let agent = undefined;
    if (aiDefenseMode === "gateway" && gatewayUrl) {
      const allowedPrefixes = [
        "https://us.gateway.aidefense",
        "https://eu.gateway.aidefense",
        "https://ap.gateway.aidefense",
      ];
      const shouldIgnoreCert = !allowedPrefixes.some((prefix) =>
        gatewayUrl.startsWith(prefix)
      );
      agent = shouldIgnoreCert
        ? new Agent({
            connect: {
              rejectUnauthorized: false,
            },
          })
        : undefined;
      apiUrl = gatewayUrl + path;
    }

    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname,
      path,
      headers: {
        "Content-Type": "application/json",
        //"Accept-Encoding": "", // Temporrary solution for Server Gateway option
        accept: "application/json",
        Host: hostname,
      },
      body: JSON.stringify(payload),
    });

    const signedRequest = await signer.sign(request);

    const response = await fetch(apiUrl, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
      dispatcher: agent,
    });

    const jsonResponse = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : await response.text();

    const aiResponse =
      jsonResponse.output?.message?.content?.[0]?.text ??
      "No response received.";

    return {
      status: response.status,
      body: jsonResponse,
    };
  } catch (error) {
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
    };

    // throw errorDetails; // ✅ Throw structured error object instead of just a string
    throw errorDetails;
  }
}
