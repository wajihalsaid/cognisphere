// polyfill.js - MUST BE FIRST
import { File } from "formdata-node";
globalThis.File = File;

import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { v4 as uuidv4 } from "uuid"; // Import UUID for session ID generation

const { Agent } = await import("undici");

const conversationMemoryBedrock = {}; // In-memory storage (resets on server restart)

const maskAccessKey = (AccessKey) => {
  // Mask the API key in logs
  return AccessKey
    ? AccessKey.replace(/(.{2})(.*)(.{2})/, "$1******$3")
    : "[REDACTED]";
};

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  let requestDetails;
  const aiDefenseMode = req.body.aiDefenseMode;
  const region = req.body.AWS_REGION;
  const CustomURL = req.body.AWS_Bedrock_CustomURL;
  const accessKeyId = req.body.AWS_ACCESS_KEY;
  const secretAccessKey = req.body.AWS_SECRET_KEY;
  const sessionId = req.body.sessionId;
  const extractedText = req.body.extractedText;
  const signer = new SignatureV4({
    service: "bedrock",
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    sha256: Sha256,
  });

  // Generate a session ID if it's missing
  const userSessionId = sessionId || uuidv4();

  try {
    const prompt = req.body.userQuestion;

    const model = req.body.modelId;
    const modelId =
      model === "anthropic.claude-haiku-4-5-20251001-v1:0" ||
      model === "anthropic.claude-sonnet-4-5-20250929-v1:0" ||
      model === "anthropic.claude-opus-4-1-20250805-v1:0" ||
      model === "anthropic.claude-sonnet-4-20250514-v1:0" ||
      model === "anthropic.claude-3-7-sonnet-20250219-v1:0" ||
      model === "anthropic.claude-3-5-haiku-20241022-v1:0" ||
      model === "anthropic.claude-3-5-sonnet-20240620-v1:0" ||
      model === "amazon.nova-premier-v1:0" ||
      model === "meta.llama4-maverick-17b-instruct-v1:0" ||
      model === "meta.llama3-3-70b-instruct-v1:0" ||
      model === "meta.llama3-2-11b-instruct-v1:0" ||
      model === "meta.llama3-1-70b-instruct-v1:0" ||
      model === "meta.llama3-1-8b-instruct-v1:0"
        ? region.substring(0, 2) + "." + req.body.modelId
        : req.body.modelId;

    const gatewayUrl = req.body.gatewayUrl;
    const sendPromptVia = req.body.sendPromptVia;

    const hostname =
      CustomURL && CustomURL.trim() !== ""
        ? CustomURL
        : `bedrock-runtime.${region}.amazonaws.com`;
    const path = `/model/${modelId}/converse`;

    // Retrieve chat history from memory storage (using sessionId)
    if (!conversationMemoryBedrock[sessionId]) {
      conversationMemoryBedrock[sessionId] = [];
    }
    let conversation = conversationMemoryBedrock[sessionId];

    // Keep only the last 9 messages
    if (conversation.length > 19) {
      conversation = conversation.slice(-18);
    }

    // Append new user message

    conversation.push({
      role: "user",
      content:
        extractedText.trim() === ""
          ? prompt
          : `Based on this document: "${extractedText}", answer: ${prompt}`,
    });

    // Prepare the request payload using chat history
    const requestPayload = {
      messages: conversation.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
    };

    // Add system prompt if it exists and is supported
    const SYSTEM_PROMPT = req.body.SYSTEM_PROMPT;
    if (
      SYSTEM_PROMPT &&
      (model.startsWith("meta") || model.startsWith("anthropic"))
    ) {
      requestPayload.system = [{ text: SYSTEM_PROMPT }];
    }

    let apiUrl = `https://${hostname}${path}`;

    const request = new HttpRequest({
      method: "POST",
      protocol: "https:",
      hostname: hostname,
      path: path,
      headers: {
        "Content-Type": "application/json",
        //"Accept-Encoding": "", // Temporrary solution for Server Gateway option
        accept: "application/json",
        Host: hostname,
      },
      body: JSON.stringify(requestPayload),
    });
    const signedRequest = await signer.sign(request);
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
      apiUrl = gatewayUrl + path; // Set the custom gateway URL
    }

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
      dispatcher: agent,
    };

    const response = await fetch(apiUrl, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
      dispatcher: agent,
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

    // Append AI response to chat history
    const aiResponse =
      jsonResponse.output?.message?.content?.[0]?.text ??
      "No response received.";

    conversation.push({ role: "assistant", content: aiResponse });
    conversationMemoryBedrock[sessionId] = conversation;

    res.status(response.status).json({
      response: response,
      body: jsonResponse,
      headers: headersObject,
      logs: requestDetails,
      sessionId: userSessionId,
    });
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
      logs: requestDetails, // ✅ Include logs in case of failure
    };

    // throw errorDetails; // ✅ Throw structured error object instead of just a string

    res.status(500).json({
      errorDetails,
    });
  }
}
