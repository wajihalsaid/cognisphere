import { useState, useEffect } from "react";
import { FiSettings, FiX } from "react-icons/fi";
import CryptoJS from "crypto-js";
import axios from "axios";
import {
  FiDownload,
  FiUpload,
  FiSave,
  FiTrash,
  FiCopy,
  FiInfo,
} from "react-icons/fi"; // Import icons

const predefinedQuestions = [
  "What's the weather?",
  "Tell me a joke.",
  "How does AI work?",
  "Give me a fun fact!",
];

const awsRegions = [
  "us-east-1", // US East (N. Virginia)
  "us-east-2", // US East (Ohio)
  "us-west-1", // US West (N. California)
  "us-west-2", // US West (Oregon)
  "af-south-1", // Africa (Cape Town)
  "ap-east-1", // Asia Pacific (Hong Kong)
  "ap-south-1", // Asia Pacific (Mumbai)
  "ap-south-2", // Asia Pacific (Hyderabad)
  "ap-southeast-1", // Asia Pacific (Singapore)
  "ap-southeast-2", // Asia Pacific (Sydney)
  "ap-southeast-3", // Asia Pacific (Jakarta)
  "ap-southeast-4", // Asia Pacific (Melbourne)
  "ap-northeast-1", // Asia Pacific (Tokyo)
  "ap-northeast-2", // Asia Pacific (Seoul)
  "ap-northeast-3", // Asia Pacific (Osaka)
  "ca-central-1", // Canada (Central)
  "ca-west-1", // Canada West (Calgary)
  "eu-central-1", // Europe (Frankfurt)
  "eu-central-2", // Europe (Zurich)
  "eu-west-1", // Europe (Ireland)
  "eu-west-2", // Europe (London)
  "eu-west-3", // Europe (Paris)
  "eu-north-1", // Europe (Stockholm)
  "eu-south-1", // Europe (Milan)
  "eu-south-2", // Europe (Spain)
  "il-central-1", // Israel (Tel Aviv)
  "me-central-1", // Middle East (UAE)
  "me-south-1", // Middle East (Bahrain)
  "sa-east-1", // South America (São Paulo)
  "us-gov-east-1", // AWS GovCloud (US-East)
  "us-gov-west-1", // AWS GovCloud (US-West)
];

const AdminSidebar = ({ showAdmin, setShowAdmin, questions, setQuestions }) => {
  const [openAIKey, setOpenAIKey] = useState("");
  const [groqKey, setgroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const decryptKey = (encryptedKey) => {
    if (!encryptedKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, "your-secret-key");
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Error decrypting key:", error);
      return "";
    }
  };

  // System Prompt Actions
  const handleSaveSystemPrompt = () => {
    localStorage.setItem("systemPrompt", systemPrompt);
    alert("System prompt saved successfully.");
  };

  const handleClearSystemPrompt = () => {
    localStorage.removeItem("systemPrompt");
    setSystemPrompt("");
    alert("System prompt cleared.");
  };

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(systemPrompt).then(() => {});
  };

  // AI Defense State
  const [aiDefenseMode, setAiDefenseMode] = useState("browser");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [apiServer, setApiServer] = useState(
    "https://us.api.inspect.aidefense.security.cisco.com/"
  );
  const [apiKey, setApiKey] = useState("");
  const [enabledRules, setEnabledRules] = useState({
    "Code Detection": { enabled: false, action: "Ignore" },
    Harassment: { enabled: false, action: "Ignore" },
    "Hate Speech": { enabled: false, action: "Ignore" },
    PCI: { enabled: false, action: "Ignore" },
    PHI: { enabled: false, action: "Ignore" },
    PII: { enabled: false, action: "Ignore" },
    "Prompt Injection": { enabled: false, action: "Ignore" },
    Profanity: { enabled: false, action: "Ignore" },
    "Sexual Content & Exploitation": { enabled: false, action: "Ignore" },
    "Social Division & Polarization": { enabled: false, action: "Ignore" },
    "Violence & Public Safety Threats": { enabled: false, action: "Ignore" },
  });
  const [sendPromptVia, setSendPromptVia] = useState("Server Gateway");

  const handleExportSettings = () => {
    const data = {
      OPENAI_API_KEY: localStorage.getItem("OPENAI_API_KEY"),
      META_LLM_API_KEY: localStorage.getItem("META_LLM_API_KEY"),
      GEMINI_API_KEY: localStorage.getItem("GEMINI_API_KEY"),
      AWS_REGION: localStorage.getItem("AWS_REGION"),
      AWS_ACCESS_KEY: localStorage.getItem("AWS_ACCESS_KEY"),
      AWS_SECRET_KEY: localStorage.getItem("AWS_SECRET_KEY"),
      AI_DEFENSE_SETTINGS: localStorage.getItem("AI_DEFENSE_SETTINGS"),
      PREDEFINED_QUESTIONS: localStorage.getItem("PREDEFINED_QUESTIONS"),
      systemPrompt: localStorage.getItem("systemPrompt"),
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cognisphere_admin_settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        Object.keys(importedData).forEach((key) => {
          if (importedData[key] !== null) {
            localStorage.setItem(key, importedData[key]);

            setOpenAIKey(decryptKey(localStorage.getItem("OPENAI_API_KEY")));
            setgroqKey(decryptKey(localStorage.getItem("META_LLM_API_KEY")));
            setGeminiKey(decryptKey(localStorage.getItem("GEMINI_API_KEY")));
            setAwsRegion(localStorage.getItem("AWS_REGION") || "us-east-1");
            setAwsAccessKey(decryptKey(localStorage.getItem("AWS_ACCESS_KEY")));
            setAwsSecretKey(decryptKey(localStorage.getItem("AWS_SECRET_KEY")));
            setSystemPrompt(localStorage.getItem("systemPrompt"));

            const savedQuestions =
              JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
            setQuestions(
              savedQuestions.length > 0 ? savedQuestions : predefinedQuestions
            );

            const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
            if (storedSettings) {
              setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
              setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
              setApiServer(JSON.parse(storedSettings).apiServer);
              setApiKey(decryptKey(JSON.parse(storedSettings).apiKey));
              setEnabledRules(JSON.parse(storedSettings).enabledRules);
            } else {
              const settings = {
                aiDefenseMode,
                gatewayUrl,
                apiServer,
                apiKey,
                enabledRules,
              };
              localStorage.setItem(
                "AI_DEFENSE_SETTINGS",
                JSON.stringify(settings)
              );
            }
          }
        });

        alert("Settings imported successfully!");
      } catch (error) {
        alert("Invalid JSON file. Please check the format.");
      }
    };

    reader.readAsText(file);
  };

  const handleSaveSettings = async () => {
    if (aiDefenseMode === "browser") {
      const settings =
        JSON.parse(localStorage.getItem("AI_DEFENSE_SETTINGS")) || {};
      settings.aiDefenseMode = aiDefenseMode; // Update only aiDefenseMode
      settings.sendPromptVia = "User Browser";
      localStorage.setItem("AI_DEFENSE_SETTINGS", JSON.stringify(settings));
      alert("AI Defense settings saved successfully!");
      return;
    }
    if (aiDefenseMode === "egress") {
      const settings =
        JSON.parse(localStorage.getItem("AI_DEFENSE_SETTINGS")) || {};
      settings.aiDefenseMode = aiDefenseMode; // Update only aiDefenseMode
      settings.sendPromptVia = "Server Gateway";
      localStorage.setItem("AI_DEFENSE_SETTINGS", JSON.stringify(settings));
      alert("AI Defense settings saved successfully!");
      return;
    }
    if (aiDefenseMode === "gateway") {
      if (!gatewayUrl.trim()) {
        alert(
          "Gateway URL is required when AI Defense Mode is set to 'Via Gateway'."
        );
        return; // Stop the function if the URL is missing
      }

      // To prevent adding additional context to url
      const regex =
        /^(https:\/\/.*\.gateway\.aidefense\.security\.cisco\.com\/[a-f0-9\-]+\/connections\/[a-f0-9\-]+)(?:.*)?$/;
      const match = gatewayUrl.match(regex);
      let gwUrl = "";
      if (match) {
        gwUrl = match[1];
      } else {
        alert(
          "Gateway URL is not valid, please use Copy icon beside Gateway URL in Connection Guide"
        );
        return; // Stop the function if the URL is missing
      }

      const settings =
        JSON.parse(localStorage.getItem("AI_DEFENSE_SETTINGS")) || {};
      settings.aiDefenseMode = aiDefenseMode; // Update aiDefenseMode
      settings.gatewayUrl = gwUrl; // Update gatewayUrl
      settings.sendPromptVia = sendPromptVia; // Update Prompt sending method
      localStorage.setItem("AI_DEFENSE_SETTINGS", JSON.stringify(settings));
      alert("AI Defense settings saved successfully!");
      return;
    }
    if (aiDefenseMode === "api") {
      if (!apiKey.trim()) {
        alert("API Key is required when AI Defense Mode is set to 'Via API'.");
        return; // Stop the function if the URL is missing
      }
      setIsSaving(true);
      try {
        const checkAuth = await axios.post("/api/chatInspect", {
          promptRole: "user",
          responseRole: "assistant",
          userQuestion: "check API Authentication",
          answer: "checked",
          apiKey: apiKey,
          enabledRules: [],
          apiServer,
          aiDefenseMode,
        });
      } catch (error) {
        alert("API Key is invalid. Please verify");
        return;
      } finally {
        setIsSaving(false); // Stop loading
      }
      const encryptedApiKey = encryptKey(apiKey);
      const settings =
        JSON.parse(localStorage.getItem("AI_DEFENSE_SETTINGS")) || {};
      settings.aiDefenseMode = aiDefenseMode; // Update aiDefenseMode
      settings.apiServer = apiServer; // Update apiServer
      settings.apiKey = encryptedApiKey; // Update apiKey
      settings.sendPromptVia = sendPromptVia; // Update Prompt sending method
      settings.enabledRules = enabledRules; // Update enabledRules
      localStorage.setItem("AI_DEFENSE_SETTINGS", JSON.stringify(settings));
      alert("AI Defense settings saved successfully!");
      return;
    }
    return;
  };

  useEffect(() => {
    setOpenAIKey(decryptKey(localStorage.getItem("OPENAI_API_KEY")));
    setgroqKey(decryptKey(localStorage.getItem("META_LLM_API_KEY")));
    setGeminiKey(decryptKey(localStorage.getItem("GEMINI_API_KEY")));
    setAwsRegion(localStorage.getItem("AWS_REGION") || "us-east-1");
    setAwsAccessKey(decryptKey(localStorage.getItem("AWS_ACCESS_KEY")));
    setAwsSecretKey(decryptKey(localStorage.getItem("AWS_SECRET_KEY")));
    setSystemPrompt(localStorage.getItem("systemPrompt") || "");

    const savedQuestions =
      JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
    setQuestions(
      savedQuestions.length > 0 ? savedQuestions : predefinedQuestions
    );

    const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
    if (storedSettings) {
      setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
      setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
      setApiServer(JSON.parse(storedSettings).apiServer);
      setApiKey(decryptKey(JSON.parse(storedSettings).apiKey));
      setEnabledRules(JSON.parse(storedSettings).enabledRules);
    } else {
      const settings = {
        aiDefenseMode,
        gatewayUrl,
        apiServer,
        apiKey,
        enabledRules,
      };
      localStorage.setItem("AI_DEFENSE_SETTINGS", JSON.stringify(settings));
    }

    const handleStorageChange = (event) => {
      if (event.key === "PREDEFINED_QUESTIONS") {
        const savedQuestions =
          JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
        setQuestions(
          savedQuestions.length > 0 ? savedQuestions : predefinedQuestions
        );
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [showAdmin]);

  const [refresh, setRefresh] = useState(false);
  useEffect(() => {
    if (!showAdmin) {
      setRefresh((prev) => !prev); // Force a re-render
    }
  }, [showAdmin]);

  const encryptKey = (key) =>
    CryptoJS.AES.encrypt(key, "your-secret-key").toString();

  const handleSaveKeys = () => {
    localStorage.setItem("OPENAI_API_KEY", encryptKey(openAIKey));
    localStorage.setItem("META_LLM_API_KEY", encryptKey(groqKey));
    localStorage.setItem("GEMINI_API_KEY", encryptKey(geminiKey));
    localStorage.setItem("AWS_REGION", awsRegion);
    localStorage.setItem("AWS_ACCESS_KEY", encryptKey(awsAccessKey));
    localStorage.setItem("AWS_SECRET_KEY", encryptKey(awsSecretKey));
    alert("API Keys & AWS Bedrock settings saved successfully!");
  };

  const handleAddQuestion = () => {
    if (newQuestion.trim()) {
      const updatedQuestions = [...questions, newQuestion];
      setQuestions(updatedQuestions);
      localStorage.setItem(
        "PREDEFINED_QUESTIONS",
        JSON.stringify(updatedQuestions)
      );
      setNewQuestion("");
    }
  };

  const handleRemoveQuestion = (index) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    localStorage.setItem(
      "PREDEFINED_QUESTIONS",
      JSON.stringify(updatedQuestions)
    );
  };

  const handleClearData = () => {
    localStorage.removeItem("OPENAI_API_KEY");
    localStorage.removeItem("META_LLM_API_KEY");
    localStorage.removeItem("GEMINI_API_KEY");
    localStorage.removeItem("PREDEFINED_QUESTIONS");
    localStorage.removeItem("AI_DEFENSE_SETTINGS");
    localStorage.removeItem("AWS_REGION");
    localStorage.removeItem("AWS_ACCESS_KEY");
    localStorage.removeItem("AWS_SECRET_KEY");
    localStorage.removeItem("systemPrompt");
    setOpenAIKey("");
    setgroqKey("");
    setGeminiKey("");
    setAwsRegion("us-east-1");
    setAwsAccessKey("");
    setAwsSecretKey("");
    setQuestions(predefinedQuestions); // Reset to default questions
    setSystemPrompt("");

    setAiDefenseMode("browser");
    setGatewayUrl("");
    setApiServer("https://us.api.inspect.aidefense.security.cisco.com/");
    setApiKey("");
    setEnabledRules({
      "Code Detection": { enabled: false, action: "Ignore" },
      Harassment: { enabled: false, action: "Ignore" },
      "Hate Speech": { enabled: false, action: "Ignore" },
      PCI: { enabled: false, action: "Ignore" },
      PHI: { enabled: false, action: "Ignore" },
      PII: { enabled: false, action: "Ignore" },
      "Prompt Injection": { enabled: false, action: "Ignore" },
      Profanity: { enabled: false, action: "Ignore" },
      "Sexual Content & Exploitation": { enabled: false, action: "Ignore" },
      "Social Division & Polarization": { enabled: false, action: "Ignore" },
      "Violence & Public Safety Threats": { enabled: false, action: "Ignore" },
    });
    alert("All data cleared for this site.");
  };

  return (
    <>
      {/* ⚙️ Settings Icon */}
      <button
        className="fixed top-5 right-5 z-50 text-white hover:text-gray-300"
        onClick={() => setShowAdmin(true)}
      >
        <FiSettings size={24} />
      </button>

      {/* Overlay when sidebar is open */}
      {showAdmin && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowAdmin(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-[1350px] bg-gray-900 text-white shadow-lg transform transition-transform ${
          showAdmin ? "translate-x-0" : "translate-x-full"
        } z-50 overflow-hidden`}
        style={{ maxHeight: "100vh" }}
      >
        {/* ❌ Close Button */}
        <button
          className="absolute top-4 right-4 text-gray-300 hover:text-white"
          onClick={() => setShowAdmin(false)}
        >
          <FiX size={24} />
        </button>

        <h1 className="text-2xl font-bold mb-4 p-6">Admin Panel</h1>

        {/* 🏗️ Three-Column Layout */}
        <div className="grid grid-cols-3 gap-6 h-full p-6">
          {/* 🔑 API Keys Column */}
          <div className="bg-gray-800 p-4 rounded overflow-y-auto">
            <div className="flex space-x-4 mt-4">
              <button
                onClick={handleExportSettings}
                className="bg-blue-600 hover:bg-blue-700 p-3 rounded-full text-white shadow-md"
                title="Export Admin Settings to a File"
              >
                <FiDownload size={20} />
              </button>

              {/* Import Button (Hidden Input for File Selection) */}
              <label
                htmlFor="importSettings"
                className="bg-green-600 hover:bg-green-700 p-3 rounded-full text-white shadow-md cursor-pointer"
                title="Load Admin Settings from a File"
              >
                <FiUpload size={20} />
              </label>
              <input
                id="importSettings"
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="hidden"
              />
            </div>

            <h2 className="text-lg font-semibold mb-4">API Keys</h2>

            <label className="block">OpenAI API Key</label>
            <input
              type="password"
              value={openAIKey}
              onChange={(e) => setOpenAIKey(e.target.value)}
              placeholder="Enter OpenAI API Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <label className="block">groq API Key for LLMA & DeepSeek</label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setgroqKey(e.target.value)}
              placeholder="Enter groq API Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <label className="block">Gemini API Key</label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Enter Gemini API Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <h2 className="text-lg font-semibold mb-4">
              AWS Bedrock Settings
              <a
                href="/bedrock.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 text-sm ml-2 underline"
              >
                How to integrate?
              </a>
            </h2>
            <label className="block">AWS Region</label>
            <select
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              className="w-full bg-gray-700 p-2 rounded mb-2"
            >
              {awsRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>

            <label className="block">AWS Access Key</label>
            <input
              type="password"
              value={awsAccessKey}
              onChange={(e) => setAwsAccessKey(e.target.value)}
              placeholder="Enter AWS Access Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <label className="block">AWS Secret Key</label>
            <input
              type="password"
              value={awsSecretKey}
              onChange={(e) => setAwsSecretKey(e.target.value)}
              placeholder="Enter AWS Secret Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <button
              onClick={handleSaveKeys}
              className="mt-4 bg-blue-600 hover:bg-blue-700 w-full py-2 rounded"
            >
              Save Keys
            </button>

            {/* Clear Data Button */}
            <button
              onClick={handleClearData}
              className="bg-red-600 hover:bg-red-700 w-full py-2 rounded mt-4 text-white"
            >
              Clear All Admin Panel Data
            </button>
          </div>

          {/* ❓ Predefined Questions Column */}
          <div className="bg-gray-800 p-4 rounded overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Predefined Questions</h2>

            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
                placeholder="Add new question"
                className="flex-1 bg-gray-700 p-2 rounded"
              />
              <button
                onClick={handleAddQuestion}
                className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
              >
                +
              </button>
            </div>

            {/* 📜 Scrollable List of Questions */}
            <ul className="mt-3 space-y-2">
              {questions.length > 0 ? (
                questions.map((question, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center bg-gray-700 p-2 rounded"
                  >
                    {question}
                    <button
                      onClick={() => handleRemoveQuestion(index)}
                      className="text-red-400 hover:text-red-500"
                    >
                      ✖
                    </button>
                  </li>
                ))
              ) : (
                <p className="text-gray-400">No predefined questions.</p>
              )}
            </ul>

            <div className="mb-4 p-4 bg-gray-800 rounded relative">
              <div className="flex items-center space-x-2 mt-2">
                <h3 className="text-lg font-semibold mb-2 text-left ">
                  System Prompt
                </h3>
                <FiInfo
                  size={16}
                  className="text-gray-400 justify-center"
                  title="This is used to instruct the LLM on how to behave. Supported on OpenAI, Llama, and Anthropic."
                />

                <div className="flex-grow flex justify-end space-x-2 mt-2">
                  <button
                    onClick={handleSaveSystemPrompt}
                    disabled={systemPrompt?.trim() === "" || systemPrompt === null}
                    className={`p-1 rounded flex items-center justify-center text-white ${
                      (systemPrompt?.trim() === "" || systemPrompt === null)
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    <FiSave size={16} />
                  </button>
                  <button
                    onClick={handleClearSystemPrompt}
                    disabled={systemPrompt?.trim() === "" || systemPrompt === null}
                    className={`p-1 rounded flex items-center justify-center text-white ${
                      (systemPrompt?.trim() === ""  || systemPrompt === null)
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <FiTrash size={16} />
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={systemPrompt?.trim() === ""  || systemPrompt === null}
                    className={`p-1 rounded flex items-center justify-center text-white ${
                      (systemPrompt?.trim() === ""  || systemPrompt === null)
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-yellow-600 hover:bg-yellow-700"
                    }`}
                  >
                    <FiCopy size={16} />
                  </button>
                </div>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter System Prompt"
                className="p-2 bg-gray-700 rounded-lg focus:outline-none text-white w-full h-54 pr-12"
              />
            </div>
            <div className="mb-4 p-4 bg-gray-800 rounded relative"></div>
          </div>

          {/* AI Defense Column */}
          <div
            className="bg-gray-800 p-4 rounded flex flex-col"
            style={{ maxHeight: "80vh" }}
          >
            <div className="overflow-y-auto pr-2" style={{ flexGrow: 1 }}>
              <h2 className="text-lg font-semibold mb-4">
                AI Defense Settings
              </h2>
              <label className="block">Defense Mode</label>
              <select
                className="w-full bg-gray-700 p-2 rounded mb-2"
                value={aiDefenseMode}
                onChange={(e) => setAiDefenseMode(e.target.value)}
              >
                <option value="browser">Direct(From User Browser)</option>
                <option value="egress">
                  Direct(From Server via Egress Gateway/MCD)
                </option>
                <option value="gateway">Via AI Defense Gateway</option>
                <option value="api">Via API</option>
              </select>
              {aiDefenseMode === "gateway" && (
                <>
                  <input
                    type="text"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    placeholder="Enter Gateway URL"
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                  />

                  <select
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                    value={sendPromptVia || "Server Gateway"}
                    onChange={(e) => setSendPromptVia(e.target.value)}
                  >
                    <option value="Server Gateway">
                      Send Prompt from Server itself
                    </option>
                    <option value="User Browser">
                      Send Prompt from User Browser
                    </option>
                  </select>
                </>
              )}
              {aiDefenseMode === "api" && (
                <>
                  <select
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                    value={apiServer}
                    onChange={(e) => setApiServer(e.target.value)}
                  >
                    <option value="">Select API Server</option>
                    <option value="https://us.api.inspect.aidefense.security.cisco.com/">
                      US Server
                    </option>
                    <option value="https://eu.api.inspect.aidefense.security.cisco.com/">
                      EU Server
                    </option>
                    <option value="https://ap.api.inspect.aidefense.security.cisco.com/">
                      AP Server
                    </option>
                  </select>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API Key"
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                  />

                  <select
                    className="w-full bg-gray-700 p-2 rounded mb-2"
                    value={sendPromptVia || "Server Gateway"}
                    onChange={(e) => setSendPromptVia(e.target.value)}
                  >
                    <option value="Server Gateway">
                      Send Prompt from Server itself
                    </option>
                    <option value="User Browser">
                      Send Prompt from User Browser
                    </option>
                  </select>

                  <h3 className="text-lg font-semibold mt-4">Enabled Rules</h3>
                  {Object.keys(enabledRules).map((rule) => {
                    const ruleData = enabledRules[rule];

                    // Determine the background color based on action
                    let bgColor = "bg-gray-700 text-gray-400 opacity-50"; // Default (disabled)
                    if (ruleData.enabled) {
                      if (ruleData.action === "Block") {
                        bgColor = "bg-red-700 text-white"; // Red for Block
                      } else if (ruleData.action === "Alert") {
                        bgColor = "bg-orange-500 text-white"; // Orange for Alert
                      } else {
                        bgColor = "bg-green-700 text-white"; // Green for Ignore
                      }
                    }

                    return (
                      <div
                        key={rule}
                        className={`flex justify-between items-center p-2 rounded mb-2 transition-all ${bgColor}`}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={ruleData.enabled}
                            onChange={(e) =>
                              setEnabledRules({
                                ...enabledRules,
                                [rule]: {
                                  ...ruleData,
                                  enabled: e.target.checked,
                                },
                              })
                            }
                          />{" "}
                          {rule.toUpperCase()}
                        </label>
                        <select
                          className="bg-gray-600 p-1 rounded"
                          value={ruleData.action}
                          onChange={(e) =>
                            setEnabledRules({
                              ...enabledRules,
                              [rule]: {
                                ...ruleData,
                                action: e.target.value,
                              },
                            })
                          }
                          disabled={!ruleData.enabled} // Disable dropdown if rule is inactive
                        >
                          <option value="Block">Block</option>
                          <option value="Ignore">Ignore</option>
                          <option value="Alert">Alert</option>
                        </select>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <button
              onClick={handleSaveSettings}
              className={`mt-4 w-full py-2 rounded ${
                isSaving
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              style={{ position: "sticky", bottom: 0 }}
              disabled={isSaving} // Disable button while saving
            >
              {isSaving ? "Saving..." : "Save AI Defense Settings"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;
