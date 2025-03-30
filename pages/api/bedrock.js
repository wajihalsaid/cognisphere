import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";


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
  const accessKeyId = req.body.AWS_ACCESS_KEY;
  const secretAccessKey = req.body.AWS_SECRET_KEY;
  const signer = new SignatureV4({
    service: "bedrock",
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    sha256: Sha256,
  });

  try {

    const prompt = req.body.userQuestion;

    const model = req.body.modelId;
    const modelId =
      model === "anthropic.claude-3-7-sonnet-20250219-v1:0" ||
      model === "anthropic.claude-3-5-haiku-20241022-v1:0" ||
      model === "anthropic.claude-3-5-sonnet-20240620-v1:0" ||
      model === "meta.llama3-3-70b-instruct-v1:0" ||
      model === "meta.llama3-2-11b-instruct-v1:0" ||
      model === "meta.llama3-1-70b-instruct-v1:0" ||
      model === "meta.llama3-1-8b-instruct-v1:0"
        ? region.substring(0, 2) + "." + req.body.modelId
        : req.body.modelId;

    const gatewayUrl = req.body.gatewayUrl;
    const sendPromptVia = req.body.sendPromptVia;

    const hostname = `bedrock-runtime.${region}.amazonaws.com`;
    const path = `/model/${modelId}/converse`;

    const requestPayload = {
      messages: [
        {
          role: "user",
          content: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    let apiUrl = `https://${hostname}${path}`;

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

    if (aiDefenseMode === "gateway" && gatewayUrl) {
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

    res.status(response.status).json({
      response: response,
      body: jsonResponse,
      headers: headersObject,
      logs: requestDetails,
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
