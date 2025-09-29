// pages/api/ollama/setup.js
import crypto from "crypto";

const apiKeys = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;
  try {
    const response = await fetch(`${url}/api/tags`);
    //if (!response.ok) throw new Error("Failed to fetch models");
    const data = await response.json();

    const models = data.models.map((m) => m.name);

    const key = crypto.randomBytes(32).toString("hex"); // 64-character hex key
    apiKeys.add(key);
    res.status(200).json({ success: true, url, models, apiKey: key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// expose function to validate later
export function validateOllamaApiKey(key) {
  return apiKeys.has(key);
}
