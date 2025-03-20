import React, { useState, useEffect, useRef } from "react";
import { FiSend, FiRefreshCcw, FiTerminal } from "react-icons/fi";
import { getOpenAIResponse, getGeminiResponse } from "../lib/api";
import CryptoJS from "crypto-js";
import { useRouter } from "next/router";
import { Icon } from "@iconify/react";
import { FiMessageSquare } from "react-icons/fi"; // Import chat icon
import { motion } from "framer-motion";

import AdminSidebar from "./AdminSidebar";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Clipboard, ClipboardCheck } from "lucide-react";

const predefinedQuestions = [
  "What's the weather like today?",
  "Tell me a joke.",
  "What's the latest news?",
  "How does AI work?",
];

function processInspectionResults(response, enabledRules) {
  if (response.is_safe) return null; // No violations

  let violations = [];

  response.rules.forEach((rule) => {
    const matchedRule = enabledRules[rule.rule_name];
    //console.log ("matchedRule ", matchedRule || null);
    if (!matchedRule || !matchedRule.enabled || matchedRule.action === "Ignore")
      return;

    //console.log ("rule.classification ", rule.classification || null);

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
      action: matchedRule.action,
    });
  });

  return violations.length ? violations : null;
}

function generateAlertMessages(violations) {
  return violations.map((v) => {
    return {
      message: `Violation detected: ${v.rule_name}${
        v.entity_types.length ? ` (${v.entity_types.join(", ")})` : ""
      }. Classification: ${v.classification}.`,
      type: v.action === "Block" ? "red" : "orange",
    };
  });
}

function generateAlertMessage(violations) {
  if (!violations || violations.length === 0) return null;

  const blockMessage = violations.find((v) => v.action === "Block");
  if (blockMessage) {
    return {
      message: `Violation detected: ${blockMessage.rule_name}${
        blockMessage.entity_types.length
          ? ` (${blockMessage.entity_types.join(", ")})`
          : ""
      }. Classification: ${blockMessage.classification}.`,
      type: "red",
    };
  }

  const alertMessage = violations.find((v) => v.action === "Alert");
  if (alertMessage) {
    return {
      message: `Violation detected: ${alertMessage.rule_name}${
        alertMessage.entity_types.length
          ? ` (${alertMessage.entity_types.join(", ")})`
          : ""
      }. Classification: ${alertMessage.classification}.`,
      type: "orange",
    };
  }

  return null;
}

// ✅ Copy Button Component
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  return (
    <button
      onClick={copyToClipboard}
      className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition"
    >
      {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
    </button>
  );
};

const Chatbot = () => {
  const [question, setQuestion] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [questionList, setQuestionList] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState("gpt-4");
  const [questions, setQuestions] = useState([]);
  const [logs, setLogs] = useState([]); // State to store logs
  const router = useRouter();
  const chatContainerRef = useRef(null); // To scroll to the bottom when new messages arrive
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false); // Toggle logs visibility
  const [showQs, setShowQs] = useState(true); // Toggle Questions List visibility
  const [showAdmin, setShowAdmin] = useState(false); // Toggle Admin Sidebar visibility

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

  useEffect(() => {
    // Ensure code runs only on the client
    const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
    if (storedSettings) {
      setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
      setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
      setApiServer(JSON.parse(storedSettings).apiServer);
      setApiKey(JSON.parse(storedSettings).apiKey);
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
  }, []);

  // Load chat history & predefined questions on mount
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("chat-history")) || [];
    const savedQuestions =
      JSON.parse(localStorage.getItem("chat-question")) || [];
    setAnswers(savedHistory);
    setQuestionList(savedQuestions);

    const storedQuestions =
      JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
    setQuestions(
      storedQuestions.length > 0 ? storedQuestions : predefinedQuestions
    );
    // ✅ Listen for changes in `localStorage`
    const handleStorageChange = (event) => {
      if (event.key === "PREDEFINED_QUESTIONS") {
        const storedQuestions =
          JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
        setQuestions(
          storedQuestions.length > 0 ? storedQuestions : predefinedQuestions
        );
      }
      if (event.key === "AI_DEFENSE_SETTINGS") {
        const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
        if (storedSettings) {
          setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
          setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
          setApiServer(JSON.parse(storedSettings).apiServer);
          setApiKey(JSON.parse(storedSettings).apiKey);
          setEnabledRules(JSON.parse(storedSettings).enabledRules);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    //  if (!showAdmin) {
    const storedQuestions =
      JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
    setQuestions(
      storedQuestions.length > 0 ? storedQuestions : predefinedQuestions
    );
    const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
    if (storedSettings) {
      setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
      setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
      setApiServer(JSON.parse(storedSettings).apiServer);
      setApiKey(JSON.parse(storedSettings).apiKey);
      setEnabledRules(JSON.parse(storedSettings).enabledRules);
    }
    //  }
  }, [showAdmin]); // 🔥 Triggers update when showAdmin changes

  /*
  useEffect(() => {
    const mod = Object.entries(enabledRules)
      .filter(([_, value]) => value.enabled) // Filter enabled rules
      .map(([key]) => ({ rule_name: key })); // Map to required format
    console.log("enabled rules:", mod);
  }, [showAdmin]);
  */

  useEffect(() => {
    const loadSettings = () => {
      const storedQuestions =
        JSON.parse(localStorage.getItem("PREDEFINED_QUESTIONS")) || [];
      setQuestions(
        storedQuestions.length > 0 ? storedQuestions : predefinedQuestions
      );

      const storedSettings = JSON.parse(
        localStorage.getItem("AI_DEFENSE_SETTINGS")
      );
      if (storedSettings) {
        setAiDefenseMode(storedSettings.aiDefenseMode);
        setGatewayUrl(storedSettings.gatewayUrl);
        setApiServer(storedSettings.apiServer);
        setApiKey(storedSettings.apiKey);
        setEnabledRules(storedSettings.enabledRules);
      }
    };

    if (!showAdmin) {
      loadSettings(); // Load settings when admin panel closes
    }

    window.addEventListener("storage", loadSettings); // Listen for changes

    return () => {
      window.removeEventListener("storage", loadSettings); // Cleanup on unmount
    };
  }, [showAdmin]); // Run when showAdmin changes

  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    if (!showAdmin) {
      setRefresh((prev) => !prev); // Force a re-render
    }
  }, [showAdmin]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [answers, newQuestion]);

  useEffect(() => {
    const storedLLM = localStorage.getItem("selectedLLM");
    if (storedLLM) {
      setSelectedLLM(storedLLM);
    }
  }, []);

  const handleLLMChange = (e) => {
    const newLLM = e.target.value;
    setSelectedLLM(newLLM);
    localStorage.setItem("selectedLLM", newLLM);
  };

  const saveHistory = (newAnswer) => {
    //console.log(newAnswer);
    const updatedHistory = [...answers, newAnswer];
    setAnswers(updatedHistory);
    localStorage.setItem("chat-history", JSON.stringify(updatedHistory));
  };

  const saveQuestions = (newQuestion) => {
    const updatedQuestion = [...questionList, newQuestion];
    setQuestionList(updatedQuestion);
    localStorage.setItem("chat-question", JSON.stringify(updatedQuestion));
  };

  const decryptKey = (encryptedKey) => {
    if (!encryptedKey) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, "your-secret-key");
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Error decrypting API key:", error);
      return null;
    }
  };

  const parseEnabledRules = (rules) => {
    if (!rules) return null;
    try {
      const arrayRules = Object.entries(enabledRules)
        .filter(([_, value]) => value.enabled) // Filter enabled rules
        .map(([key]) => ({ rule_name: key })); // Map to required format
      const modifiedRules = arrayRules.map((rule) => {
        if (rule.rule_name === "PCI") {
          return {
            ...rule,
            entity_types: [
              "Individual Taxpayer Identification Number (ITIN) (US)",
              "International Bank Account Number (IBAN)",
              "American Bankers Association (ABA) Routing Number (US)",
              "Credit Card Number",
              "Bank Account Number (US)",
            ],
          };
        } else if (rule.rule_name === "PII") {
          return {
            ...rule,
            entity_types: [
              "Email Address",
              "IP Address",
              "Phone Number",
              "Driver's License Number (US)",
              "Passport Number (US)",
              "Social Security Number (SSN) (US)",
            ],
          };
        } else if (rule.rule_name === "PHI") {
          return {
            ...rule,
            entity_types: [
              "Medical License Number (US)",
              "National Health Service (NHS) Number",
            ],
          };
        }
        return rule;
      });
      return modifiedRules;
    } catch (error) {
      console.error("Error parsing enabledRules:", error);
      return null;
    }
  };

  const getAPIKey = (llm) => {
    let encryptedKey = null;
    if (llm.startsWith("gpt-") || llm === "o3-mini") {
      encryptedKey = localStorage.getItem("OPENAI_API_KEY");
    } else if (llm.startsWith("llama-") || llm.startsWith("deepseek-")) {
      encryptedKey = localStorage.getItem("META_LLM_API_KEY");
    } else if (llm === "Gemini") {
      encryptedKey = localStorage.getItem("GEMINI_API_KEY");
    }
    return decryptKey(encryptedKey);
  };

  const maskAPIKey = (apiKey) => {
    // Mask the API key in logs
    return apiKey
      ? apiKey.replace(/(.{4})(.*)(.{4})/, "$1******$3")
      : "[REDACTED]";
  };

  const handleAskQuestion = async (message) => {
    const userQuestion = question || message;
    setNewQuestion(userQuestion);
    if (!userQuestion || loading) return;

    setQuestion("");
    // alert(userQuestion);

    setQuestionList((prev) => [...prev, { userQuestion }]);

    setLoading(true);

    const apiLLMKey = getAPIKey(selectedLLM);
    if (!apiLLMKey) {
      alert("API key not found or invalid!");
      setLoading(false);
      return;
    }

    if (
      aiDefenseMode === "gateway" &&
      (selectedLLM == "Gemini" ||
        selectedLLM.startsWith("llama-") ||
        selectedLLM.startsWith("deepseek-"))
    ) {
      alert(
        selectedLLM +
          " is not supported in AI Defense Gateway mode, please try via API Inspection!"
      );
      setLoading(false);
      return;
    }

    const storedSettings = localStorage.getItem("AI_DEFENSE_SETTINGS");
    if (storedSettings) {
      setAiDefenseMode(JSON.parse(storedSettings).aiDefenseMode);
      setGatewayUrl(JSON.parse(storedSettings).gatewayUrl);
      setApiServer(JSON.parse(storedSettings).apiServer);
      setApiKey(JSON.parse(storedSettings).apiKey);
      setEnabledRules(JSON.parse(storedSettings).enabledRules);
    }

    let answer;
    let response;
    let aiDefenseTrigger;
    try {
      aiDefenseTrigger = 0;
      // Mask API key before logging
      const maskedAPIKey = maskAPIKey(apiLLMKey);

      // Log API request details (masked key)
      const logMessage = ``;
      setLogs((prevLogs) => [...prevLogs, logMessage]);

      // API response handling
      if (
        [
          "gpt-4o",
          "gpt-4.5-preview",
          "o3-mini",
          "gpt-4",
          "llama-3.3-70b-versatile",
          "deepseek-r1-distill-llama-70b",
        ].includes(selectedLLM)
      ) {
        response =
          aiDefenseMode === "browser"
            ? await getOpenAIResponse(userQuestion, selectedLLM)
            : await axios.post("/api/openai", {
                selectedLLM,
                userQuestion,
                apiLLMKey,
                aiDefenseMode,
                gatewayUrl,
              });
        // console.log(response)
        answer =
          response?.data?.response?.choices[0]?.message?.content ??
          response?.response?.data?.choices[0]?.message?.content ??
          response?.data?.candidates[0]?.content.parts[0].text ??
          "No response received.";
      } else if (selectedLLM === "Gemini") {
        response =
          aiDefenseMode === "browser"
            ? await getGeminiResponse(userQuestion, apiLLMKey)
            : await axios.post("/api/gemini", {
                selectedLLM,
                userQuestion,
                apiLLMKey,
                aiDefenseMode,
                gatewayUrl,
              });
        //console.log("response: ", response);
        answer =
          response?.response?.data?.candidates[0]?.content.parts[0].text ??
          response?.data?.response?.candidates[0]?.content.parts[0].text;
        ("No response received.");
        //console.log("answer: ", answer);
      }

      // Log the POST request details without the API key
      setLogs((prevLogs) => [
        ...prevLogs,
        <pre key={prevLogs.length}>
          <span className="text-blue-400">Request:</span> {"\n"}
          {JSON.stringify(
            response?.data?.logs ?? response?.logs ?? "Failed to collect logs",
            null,
            2
          )}
        </pre>,
      ]);
      //console.log(response);
      // Log the response details
      setLogs((prevLogs) => [
        ...prevLogs,
        <pre key={prevLogs.length}>
          <span className="text-green-400">Response:</span> {"\n"}
          {JSON.stringify(
            response?.status ??
              response?.response?.status ??
              "Failed to collect logs",
            null,
            2
          )}{" "}
          {JSON.stringify(
            response?.statusText ??
              response?.response?.statusText ??
              "Failed to collect logs",
            null,
            2
          )}{" "}
          {JSON.stringify(
            response?.headers ??
              response?.response?.headers ??
              "Failed to collect logs",
            null,
            2
          )}{" "}
          {JSON.stringify(
            response?.data ??
              response?.response?.data ??
              "Failed to collect logs",
            null,
            2
          )}
        </pre>,
      ]);

      const newAnswer = { userQuestion, answer };

      if (aiDefenseMode === "api") {
        const inspectionResutls =
          aiDefenseMode === "api"
            ? await axios.post("/api/chatInspect", {
                promptRole: "user",
                responseRole: "assistant",
                userQuestion,
                answer,
                apiKey: decryptKey(apiKey),
                enabledRules: parseEnabledRules(enabledRules),
                apiServer,
                aiDefenseMode,
              })
            : [];

        const violations = processInspectionResults(
          inspectionResutls?.data?.response ?? [],
          enabledRules
        );
        //console.log ("violations: ", violations || null);
        if (violations !== null) {
          // console.log ("violations: ", violations || null);
          const aiDefenseMessage = generateAlertMessage(violations).message;
          const aiDefenseAction = generateAlertMessage(violations).type;
          //console.log(aiDefenseMessage);
          try {
            const aiAnswer = {
              userQuestion,
              answer,
              aiDefenseMessage,
              aiDefenseAction,
            };
            saveHistory(aiAnswer);
            aiDefenseTrigger = 1;
          } catch (error) {
            console.log(error);
          }
        }

        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.is_safe ?? true);
        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.classifications[0] ?? []);
        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.attack_technique) ?? [];
        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.severity ?? []);
        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.rules[0]?.rule_name ?? []);
        //console.log("inspectionResutls:", inspectionResutls?.data?.response?.rules[0]?.entity_types[0] ?? []);
        //alert (inspectionResutls.data.response.classifications)

        // Log API Inspect Call details without the API key
        setLogs((prevLogs) => [
          ...prevLogs,
          <pre key={prevLogs.length}>
            <span className="text-yellow-400">--API Inspect Call--</span> {"\n"}
            {JSON.stringify(inspectionResutls.data.logs, null, 2)}
          </pre>,
        ]);

        // Log Inspection Result Response details
        setLogs((prevLogs) => [
          ...prevLogs,
          <pre key={prevLogs.length}>
            <span className="text-orange-400">--API Inspect Response--</span>{" "}
            {"\n"}
            {JSON.stringify(
              inspectionResutls.status ?? inspectionResutls.response.status,
              null,
              2
            )}{" "}
            {JSON.stringify(
              inspectionResutls.statusText ??
                inspectionResutls.response.statusText,
              null,
              2
            )}{" "}
            {JSON.stringify(
              inspectionResutls.headers ?? inspectionResutls.response.headers,
              null,
              2
            )}{" "}
            {JSON.stringify(
              inspectionResutls.data.response ??
                inspectionResutls.response.data,
              null,
              2
            )}
          </pre>,
        ]);
      }

      if (aiDefenseTrigger === 0) {
        saveHistory(newAnswer);
      }
      aiDefenseTrigger = 0;
      const newQuestion = { userQuestion };
      saveQuestions(newQuestion);
      setLoading(false);
      setQuestion("");
      setNewQuestion("");
    } catch (error) {
      // Log the failed POST request details without the API key
      setLogs((prevLogs) => [
        ...prevLogs,
        <pre key={prevLogs.length}>
          <span className="text-blue-400">Request:</span> {"\n"}
          {JSON.stringify(
            error?.response?.data?.logs ?? error?.logs ?? "Unknow Issue",
            null,
            2
          )}
        </pre>,
      ]);

      //console.error("OpenAI API Error:", error.response ? error.response.data : error.message);
      //console.error("OpenAI API Error:", error);
      const errorMessage = `API Call Failed: ${JSON.stringify(
        error?.response?.data?.error ?? error ?? "Unknow Issue",
        null,
        2
      )}`;

      setLogs((prevLogs) => [
        ...prevLogs,
        <pre key={prevLogs.length}>
          <span className="text-red-400">Error:</span> {"\n"}
          {errorMessage}
        </pre>,
      ]);
      alert("Failed to fetch the answer. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent newline in textarea when pressing Enter
      handleAskQuestion(); // Trigger the question send
    }
  };

  // Function to clear chat history
  const clearHistory = () => {
    setAnswers([]);
    setQuestionList([]);
    setLogs([]);
    setSelectedLLM("gpt-4");
    localStorage.removeItem("chat-history");
    localStorage.removeItem("chat-question");
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white z-2 ">
      {/* ✅ Title */}
      {answers.length === 0 && newQuestion.length === 0 && (
        <motion.div
          key="overview"
          className="max-w-3xl mx-auto md:mt-20"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ delay: 0.5 }}
        >
          {/* Background Image Container */}
          <div className="relative flex items-center justify-center min-h-[66vh] text-center">
            {/* Background Image (Smaller) */}

            {/* Text Content */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-6  p-6 rounded-lg">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Cogni <span className="text-violet-400">Sphere</span>
              </h1>
              <p></p>
              <h2 className="text-3xl md:text-4xl font-semibold mt-2 text-gray-200">
                AI Chat Bot
              </h2>
              <p className="text-lg text-gray-300 mt-4">
                Ignite Your Mind, Connect the Cosmos.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ✅ Logo */}
      <div className="fixed absolute top-4 left-4 flex items-center gap-2 text-blue-500">
        <Icon icon="lucide:brain" className="text-4xl text-blue-500" />
        <p className="font-bold text-lg">Cogni Sphere</p>
      </div>

      {/* ✅ Sidebar Questions List */}
      <div
        className={`fixed top-20 left-0 h-full bg-gray-900 shadow-lg transition-transform transform ${
          showQs ? "translate-x-0" : "-translate-x-full"
        } w-126 p-4`}
      >
        <h2 className="text-lg font-bold">Questions List</h2>
        <div className="max-h-[80vh] overflow-y-auto">
          {questionList.map((msg, index) => (
            <div
              key={index}
              className="cursor-pointer"
              onClick={() => handleAskQuestion(msg.userQuestion)}
            >
              <pre className="font-mono text-s leading-tight mb-4">
                {" "}
                {msg.userQuestion}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Questions List Toggle Button */}
      <button
        className="fixed top-17 left-5 text-gray-100 hover:text-white transition"
        onClick={() => setShowQs(!showQs)}
      >
        <FiMessageSquare size={24} />
      </button>

      {/* ✅ Sidebar Console */}
      <div
        className={`fixed top-0 right-0 h-full bg-black shadow-lg transition-transform transform ${
          showLogs ? "translate-x-0" : "translate-x-full"
        } w-150 p-4 z-1`}
      >
        <h3 className="text-lg text-blue-500">API Logs</h3>
        <div className="max-h-[80vh] overflow-y-auto font-mono text-xs leading-tight">
          {logs.map((log, index) => (
            <pre key={index} className="text-white">
              {log}
            </pre>
          ))}
        </div>
      </div>

      {/* ✅ Admin Sidebar */}
      <AdminSidebar
        showAdmin={showAdmin}
        setShowAdmin={setShowAdmin}
        questions={questions}
        setQuestions={setQuestions}
      />

      {/* ✅ Console Toggle Button */}
      <button
        className="fixed top-5 right-25 text-gray-100 hover:text-white transition z-10"
        onClick={() => setShowLogs(!showLogs)}
      >
        <FiTerminal size={24} />
      </button>

      {/* Clear History Button */}
      <button
        className="fixed absolute top-5 right-15 text-gray-100 hover:text-white transition z-10"
        onClick={clearHistory}
      >
        <FiRefreshCcw size={24} /> {/* Icon for clearing history */}
      </button>

      <div className="w-full max-w-5xl p-4 bg-gray-900 rounded-lg shadow-lg space-y-6">
        {(answers.length > 0 || newQuestion.length > 0) && (
          <div className="max-w-5xl mx-auto px-4 py-6">
            {/* Fixed Chat Container */}
            <div
              ref={chatContainerRef}
              className="h-[400px] md:h-[632px] w-full overflow-y-auto border border-gray-900 rounded-lg p-4 space-y-4 bg-gray-900 shadow-lg"
            >
              {answers.map((item, index) => {
                if (item.aiDefenseAction === "red") {
                  // 🔴 Display Red Alert Only
                  return (
                    <div key={index} className="flex justify-center">
                      <div className="bg-red-600 text-white rounded-lg px-4 py-3 max-w-[50%] text-center flex">
                        <span
                          className="text-5xl"
                          style={{
                            filter:
                              "brightness(0) saturate(100%) invert(24%) sepia(80%) saturate(749%) hue-rotate(333deg) brightness(102%) contrast(102%)",
                          }}
                        >
                          🚫
                        </span>
                        <p className="text-sm font-bold">
                          {item.aiDefenseMessage}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={index} className="flex flex-col space-y-2">
                    {/* User Question (Right-Aligned Light Bubble) */}
                    <div className="flex justify-end">
                      <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[75%]">
                        <p className="text-sm">{item.userQuestion}</p>
                      </div>
                    </div>

                    {/* AI Answer (Left-Aligned Dark Bubble) */}
                    <div className="flex justify-start">
                      <div className="bg-gray-800 text-white rounded-lg px-4 py-3 max-w-none">
                        <div className="prose prose-invert max-w-none leading-relaxed space-y-4">
                          <ReactMarkdown
                            components={{
                              code({
                                node,
                                inline,
                                className,
                                children,
                                ...props
                              }) {
                                const match = /language-(\w+)/.exec(
                                  className || ""
                                );
                                const codeString = String(children).replace(
                                  /\n$/,
                                  ""
                                );
                                return match ? (
                                  <div className="relative group">
                                    <CopyButton text={codeString} />
                                    <SyntaxHighlighter
                                      style={oneDark}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{
                                        padding: "12px", // Adds padding inside the code block
                                        margin: "8px 0", // Adds space above & below the code block
                                        borderRadius: "8px", // Rounds the corners
                                        lineHeight: "1.6", // Increases line height for better spacing
                                        fontSize: "14px", // Adjust font size for readability
                                        overflowX: "auto", // Ensures horizontal scrolling if needed
                                      }}
                                      {...props}
                                    >
                                      {codeString}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className="bg-gray-700 px-2 py-1 rounded text-sm">
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {item.answer}
                          </ReactMarkdown>
                        </div>
                        ;
                      </div>
                    </div>

                    {/* 🟠 Amber Alert after Answer (Only if aiDefenseAction is "orange") */}
                    {item.aiDefenseAction === "orange" && (
                      <div className="flex justify-center">
                        <div className="bg-amber-500 text-white rounded-lg px-4 py-3 max-w-[50%] text-center flex">
                          <span className="text-4xl">⚠️</span>
                          <p className="text-sm font-bold">
                            {item.aiDefenseMessage}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ✅ AI Thinking Message (Only Shows When Loading) */}
              {loading && (
                <>
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[75%]">
                      <p className="text-sm">{newQuestion}</p>
                    </div>
                  </div>
                  <div className="flex justify-start items-center">
                    <div className="bg-gray-800 text-gray-400 rounded-lg px-4 py-2 max-w-[75%] flex items-center">
                      <div className="animate-spin mr-2">
                        {/* You can replace this with any loading spinner icon you prefer */}
                        <svg
                          className="w-5 h-5 text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 3v3m0 12v3m9-9h-3m-12 0H3"
                          />
                        </svg>
                      </div>
                      <span>Thinking...</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Predefined Questions */}
        <div className="flex flex-wrap gap-2 justify-center">
          {questions.map((q, index) => (
            <button
              key={index}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition"
              onClick={() => handleAskQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Input */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-4/5">
            {/* Textarea for input */}
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  // Only block Enter (not Shift+Enter for multiline)
                  e.preventDefault();
                  if (question.trim() !== "") {
                    handleKeyDown(e);
                  }
                }
              }}
              style={{ height: "6rem", resize: "both", width: "100%" }} // Adjusted to 100% of parent container
              className="p-6 bg-gray-700 rounded-lg focus:outline-none text-white w-full pr-12" // pr-12 for space on the right
              placeholder="Ask something..."
            />

            {/* Send button with icon inside the same container */}
            <button
              onClick={() => {
                if (question.trim() !== "") {
                  handleAskQuestion();
                }
              }}
              disabled={question.trim() === ""}
              className={`absolute top-1/2 right-4 transform -translate-y-1/2 text-white rounded-full p-2 ${
                question.trim() === ""
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <FiSend size={20} />
            </button>
          </div>
        </div>

        {/* Model Selector */}
        <div className="fixed top-3.5 right-35 text-gray-400 hover:text-white transition z-10">
          <select
            onChange={handleLLMChange}
            value={selectedLLM}
            className="w-50 p-2 bg-gray-700 rounded-lg text-white focus:outline-none"
          >
            <option value="gpt-4.5-preview">OpenAI GPT-4.5</option>
            <option value="o3-mini">OpenAI o3-mini</option>
            <option value="gpt-4o">OpenAI GPT-4o</option>
            <option value="gpt-4">OpenAI GPT-4</option>
            <option value="llama-3.3-70b-versatile">
              llama-3.3-70b-versatile
            </option>
            <option value="deepseek-r1-distill-llama-70b">deepseek-r1</option>
            <option value="Gemini">gemini-2.0-flash</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
