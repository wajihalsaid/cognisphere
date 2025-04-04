import fs from "fs";
import pdf from "pdf-parse";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const file = req.body.file; // Expecting a base64-encoded PDF

    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(file, "base64");

    // Extract text from PDF
    const data = await pdf(pdfBuffer);

    res.status(200).json({ text: data.text });
  } catch (error) {
    res.status(500).json({ message: "Error extracting text", error });
  }
}
