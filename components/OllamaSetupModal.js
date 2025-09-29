import { useState } from "react";

export default function OllamaSetupModal({ isOpen, onClose, onSave }) {
  const [url, setUrl] = useState("");

  const handleFetchModels = async () => {
    try {
      const res = await fetch("/api/ollamasetup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      //console.log("data: " , data);
      if (data.success) {
        onSave(data.url, data.models, data.apiKey); // pass back models + generated API key
        // Persist in browser
        localStorage.setItem("ollamaModelsUrl", data.url);
        localStorage.setItem("ollamaModels", JSON.stringify(data.models));
        localStorage.setItem("ollamaApiKey", data.apiKey);
        onClose();
      } else {
        alert("Failed to fetch models from Ollama");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to Ollama server");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 transition z-10">
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4 text-white">Connect to Ollama</h2>
        <input
          type="text"
          placeholder="http://localhost:11434"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 rounded mb-4 bg-gray-700 text-white placeholder-gray-400"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleFetchModels}
            className="px-4 py-2 bg-blue-500 rounded-lg"
          >
            Fetch Models
          </button>
        </div>
      </div>
    </div>
  );
}
