import { useState, useEffect } from "react";
import { FiSettings, FiX } from "react-icons/fi";
import CryptoJS from "crypto-js";
import axios from "axios";

const predefinedQuestions = [
  "What's the weather?",
  "Tell me a joke.",
  "How does AI work?",
  "Give me a fun fact!",
];

const AdminSidebar = ({ showAdmin, setShowAdmin, questions, setQuestions }) => {
  const [openAIKey, setOpenAIKey] = useState("");
  const [groqKey, setgroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    alert("API Keys saved successfully!");
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
    setOpenAIKey("");
    setgroqKey("");
    setGeminiKey("");
    setQuestions(predefinedQuestions); // Reset to default questions

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
            <h2 className="text-lg font-semibold mb-4">API Keys</h2>

            <label className="block">OpenAI API Key</label>
            <input
              type="password"
              value={openAIKey}
              onChange={(e) => setOpenAIKey(e.target.value)}
              placeholder="Enter OpenAI API Key"
              className="w-full bg-gray-700 p-2 rounded mb-2"
            />

            <label className="block">groq API Key for LLMA & DeppSeek</label>
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
                <option value="browser">Direct(User Browser)</option>
                <option value="egress">
                  Direct(Server Gateway/MCD Gateway)
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
                      Send Prompt via Server Gateway
                    </option>
                    <option value="User Browser">
                      Send Prompt via User Browser
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
                      Send Prompt via Server Gateway
                    </option>
                    <option value="User Browser">
                      Send Prompt via User Browser
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
