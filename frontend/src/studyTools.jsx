import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";
const PROGRESS_KEY = "mindmap-ai-learning-progress-v1";

const defaultProgress = {
  studiedMinutes: 0,
  completedTopics: [],
  quizAttempts: 0,
  quizCorrect: 0,
  flashcardsReviewed: 0,
  weakTopics: [],
  goals: [],
  notes: [],
};

function loadProgress() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PROGRESS_KEY) || "{}"
    );

    return {
      ...defaultProgress,
      ...saved,
    };
  } catch {
    return { ...defaultProgress };
  }
}

function speak(text, rate = 1) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.rate = rate;

    window.speechSynthesis.speak(u);
  }
}

export default function StudyTools({
  content = "",
  mindMap = {},
  savedMindMaps = [],
}) {
  const [progress, setProgress] = useState(loadProgress);

  const [activeTool, setActiveTool] = useState("dashboard");

  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState("");
  const [toolOutput, setToolOutput] = useState(null);

  const [plannerDays, setPlannerDays] = useState(7);
  const [dailyMinutes, setDailyMinutes] = useState(45);

  const [difficulty, setDifficulty] = useState("medium");

  const [notesFormat, setNotesFormat] = useState("exam");

  const [revisionTopic, setRevisionTopic] = useState("");

  const [tutorQuestion, setTutorQuestion] = useState("");

  const [language, setLanguage] = useState("English");

  const [multiFiles, setMultiFiles] = useState([]);
  const [fileText, setFileText] = useState("");

  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [voiceListening, setVoiceListening] = useState(false);

  const recognitionRef = useRef(null);

  /* -------------------------------------------------------
     SAVE LOCAL LEARNING PROGRESS
  ------------------------------------------------------- */

  useEffect(() => {
    try {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify(progress)
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [progress]);

  /* -------------------------------------------------------
     SOURCE MATERIAL
  ------------------------------------------------------- */

  const sourceText = useMemo(() => {
    if (typeof content === "string" && content.trim()) {
      return content;
    }

    if (typeof fileText === "string" && fileText.trim()) {
      return fileText;
    }

    return "";
  }, [content, fileText]);

  /* -------------------------------------------------------
     TOPICS FROM MIND MAP
     IMPORTANT:
     Filter invalid/empty labels so FastAPI does not receive
     null/undefined values inside topics.
  ------------------------------------------------------- */

  const topicNames = useMemo(() => {
    const nodes = Array.isArray(mindMap?.nodes)
      ? mindMap.nodes
      : [];

    const names = nodes
      .filter((node) => node && node.type !== "root")
      .map((node) => {
        if (typeof node?.label === "string") {
          return node.label.trim();
        }

        if (typeof node?.data?.label === "string") {
          return node.data.label.trim();
        }

        return "";
      })
      .filter(Boolean);

    return [...new Set(names)].slice(0, 20);
  }, [mindMap]);

  /* -------------------------------------------------------
     WEAK TOPICS
  ------------------------------------------------------- */

  const weakTopicList = useMemo(() => {
    if (
      Array.isArray(progress.weakTopics) &&
      progress.weakTopics.length > 0
    ) {
      return progress.weakTopics.filter(Boolean);
    }

    return topicNames.slice(0, 5);
  }, [progress.weakTopics, topicNames]);

  /* -------------------------------------------------------
     COMMON STUDY TOOL API CALL
  ------------------------------------------------------- */

  const callTool = async (action, extra = {}) => {
    const actionsRequiringContent = [
      "planner",
      "notes",
      "quiz",
      "revision",
      "tutor",
      "multilingual",
    ];

    if (
      actionsRequiringContent.includes(action) &&
      !sourceText.trim()
    ) {
      setToolError(
        "Add study material or upload a file first."
      );
      return;
    }

    setToolLoading(true);
    setToolError("");
    setToolOutput(null);
    setQuizSubmitted(false);
    setQuizAnswers({});

    try {
      /* ---------------------------------------------------
         Build a clean request body.

         This is important because FastAPI expects:
         action       -> string
         content      -> string
         topics       -> list[str]
         --------------------------------------------------- */

      const cleanTopics = Array.isArray(topicNames)
        ? topicNames
            .filter(
              (topic) =>
                typeof topic === "string" &&
                topic.trim().length > 0
            )
            .map((topic) => topic.trim())
        : [];

      const requestBody = {
        action: String(action || ""),
        content: String(sourceText || ""),
        topics: cleanTopics,
        ...extra,
      };

      console.log(
        "Study Tools request:",
        requestBody
      );

      const response = await fetch(
        `${API_BASE}/api/study-tools`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Backend returned an invalid response (${response.status}).`
        );
      }

      console.log(
        "Study Tools HTTP status:",
        response.status
      );

      console.log(
        "Study Tools response:",
        data
      );

      /* ---------------------------------------------------
         FASTAPI 422 VALIDATION ERROR
         --------------------------------------------------- */

      if (response.status === 422) {
        let validationMessage =
          "The study tool request could not be validated.";

        if (Array.isArray(data?.detail)) {
          validationMessage = data.detail
            .map((item) => {
              const location = Array.isArray(item?.loc)
                ? item.loc.join(" → ")
                : "request";

              const message =
                item?.msg ||
                "Invalid value.";

              return `${location}: ${message}`;
            })
            .join("\n");
        } else if (data?.detail) {
          validationMessage =
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail);
        }

        throw new Error(
          `Validation error (422):\n${validationMessage}`
        );
      }

      /* ---------------------------------------------------
         OTHER HTTP ERRORS
         --------------------------------------------------- */

      if (!response.ok) {
        const message =
          data?.error ||
          data?.detail ||
          `Study tool request failed (${response.status}).`;

        throw new Error(
          typeof message === "string"
            ? message
            : JSON.stringify(message)
        );
      }

      /* ---------------------------------------------------
         BACKEND SUCCESS CHECK
         --------------------------------------------------- */

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Study tool failed to generate an output."
        );
      }

      setToolOutput(data.output);

      /* ---------------------------------------------------
         QUIZ PROGRESS
         --------------------------------------------------- */

      if (action === "quiz") {
        setProgress((previous) => ({
          ...previous,
          quizAttempts:
            Number(previous.quizAttempts || 0) + 1,
        }));
      }
    } catch (error) {
      console.error(
        "Study Tools error:",
        error
      );

      setToolError(
        error?.message ||
          "Study tool failed. Check the backend terminal."
      );
    } finally {
      setToolLoading(false);
    }
  };

  /* -------------------------------------------------------
     LOG STUDY TIME
  ------------------------------------------------------- */

  const saveProgressMinutes = () => {
    const minutes = Number(dailyMinutes) || 0;

    setProgress((previous) => ({
      ...previous,
      studiedMinutes:
        Number(previous.studiedMinutes || 0) + minutes,
    }));
  };

  /* -------------------------------------------------------
     COMPLETE / UNCOMPLETE TOPIC
  ------------------------------------------------------- */

  const toggleTopic = (topic) => {
    setProgress((previous) => {
      const completed = Array.isArray(
        previous.completedTopics
      )
        ? previous.completedTopics
        : [];

      const alreadyCompleted =
        completed.includes(topic);

      return {
        ...previous,
        completedTopics: alreadyCompleted
          ? completed.filter(
              (item) => item !== topic
            )
          : [...completed, topic],
      };
    });
  };

  /* -------------------------------------------------------
     MULTI-FILE UPLOAD
  ------------------------------------------------------- */

  const handleMultiFiles = async (files) => {
    const arr = Array.from(files || []).slice(0, 10);

    setMultiFiles(arr);
    setToolError("");
    setToolOutput(null);

    if (!arr.length) {
      setFileText("");
      return;
    }

    let localText = "";
    const serverFiles = [];

    for (const file of arr) {
      const extension = file.name
        .toLowerCase()
        .split(".")
        .pop();

      if (
        extension === "txt" ||
        extension === "md"
      ) {
        try {
          const text = await file.text();

          localText +=
            `\n\n# ${file.name}\n` +
            text;
        } catch {
          setToolError(
            `Could not read ${file.name}.`
          );
        }
      } else {
        serverFiles.push(file);
      }
    }

    /* ---------------------------------------------------
       Send PDF / DOCX / PPTX to backend
       --------------------------------------------------- */

    if (serverFiles.length > 0) {
      try {
        const formData = new FormData();

        serverFiles.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(
          `${API_BASE}/api/upload-multiple`,
          {
            method: "POST",
            body: formData,
          }
        );

        let data = {};

        try {
          data = await response.json();
        } catch {
          throw new Error(
            `Invalid response from multi-file upload (${response.status}).`
          );
        }

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.error ||
              data?.detail ||
              "Multiple-file upload failed."
          );
        }

        localText +=
          `\n\n${data.text || ""}`;
      } catch (error) {
        setToolError(
          error?.message ||
            "Multiple-file upload failed."
        );
      }
    }

    setFileText(localText);
  };

  /* -------------------------------------------------------
     VOICE INPUT
  ------------------------------------------------------- */

  const startVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setToolError(
        "Voice input is not supported by this browser. Try Chrome or Edge."
      );
      return;
    }

    try {
      const recognition =
        new SpeechRecognition();

      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setVoiceListening(true);
        setToolError("");
      };

      recognition.onend = () => {
        setVoiceListening(false);
      };

      recognition.onerror = () => {
        setVoiceListening(false);

        setToolError(
          "Voice input could not be started."
        );
      };

      recognition.onresult = (event) => {
        const transcript =
          event?.results?.[0]?.[0]?.transcript ||
          "";

        setTutorQuestion(transcript);
      };

      recognitionRef.current = recognition;

      recognition.start();
    } catch (error) {
      setVoiceListening(false);

      setToolError(
        error?.message ||
          "Voice input could not be started."
      );
    }
  };

  /* -------------------------------------------------------
     QUIZ DATA
  ------------------------------------------------------- */

  const quizItems = Array.isArray(toolOutput)
    ? toolOutput
    : [];

  /* -------------------------------------------------------
     SUBMIT QUIZ
  ------------------------------------------------------- */

  const submitQuiz = () => {
    if (!quizItems.length) {
      return;
    }

    let correct = 0;

    quizItems.forEach((question, index) => {
      if (
        quizAnswers[index] ===
        question?.correct_answer
      ) {
        correct++;
      }
    });

    setQuizSubmitted(true);

    setProgress((previous) => ({
      ...previous,
      quizCorrect:
        Number(previous.quizCorrect || 0) +
        correct,
    }));
  };

  /* -------------------------------------------------------
     EXPORT NOTES
  ------------------------------------------------------- */

  const exportNotes = () => {
    if (!toolOutput) {
      return;
    }

    const text =
      typeof toolOutput === "string"
        ? toolOutput
        : JSON.stringify(
            toolOutput,
            null,
            2
          );

    const blob = new Blob(
      [text],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "AI-Study-Notes.txt";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  /* -------------------------------------------------------
     SWITCH TOOL
  ------------------------------------------------------- */

  const changeTool = (tool) => {
    setActiveTool(tool);
    setToolOutput(null);
    setToolError("");
    setQuizSubmitted(false);
    setQuizAnswers({});
  };

  /* -------------------------------------------------------
     OUTPUT RENDERING
  ------------------------------------------------------- */

  const renderOutput = () => {
    if (toolOutput === null) {
      return null;
    }

    if (typeof toolOutput === "string") {
      return (
        <pre className="tool-output">
          {toolOutput}
        </pre>
      );
    }

    return (
      <pre className="tool-output">
        {JSON.stringify(
          toolOutput,
          null,
          2
        )}
      </pre>
    );
  };

  /* -------------------------------------------------------
     DASHBOARD
  ------------------------------------------------------- */

  const completedTopics =
    Array.isArray(progress.completedTopics)
      ? progress.completedTopics
      : [];

  const topicMastery =
    topicNames.length > 0
      ? Math.round(
          (completedTopics.length /
            topicNames.length) *
            100
        )
      : 0;

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <section className="study-tools-section">

      {/* -------------------------------------------------
          HEADING
      ------------------------------------------------- */}

      <div className="study-tools-heading">
        <div>
          <div className="hero-badge">
            🎓 Smart Learning Hub
          </div>

          <h2>
            Learn beyond the mind map
          </h2>

          <p>
            Plan, practise, revise and track
            your learning without changing
            your existing workspace.
          </p>
        </div>
      </div>

      {/* -------------------------------------------------
          8 FEATURE BUTTONS
      ------------------------------------------------- */}

      <div className="study-tools-nav">

        {[
          ["dashboard", "Dashboard"],
          ["planner", "Study Planner"],
          ["revision", "Revision"],
          ["notes", "AI Notes"],
          ["quiz", "Difficulty Quiz"],
          ["tutor", "AI Tutor"],
          ["files", "Multi-file"],
          ["language", "Languages"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={
              activeTool === id
                ? "tool-tab active"
                : "tool-tab"
            }
            onClick={() =>
              changeTool(id)
            }
          >
            {label}
          </button>
        ))}

      </div>

      {/* -------------------------------------------------
          ERROR
      ------------------------------------------------- */}

      {toolError && (
        <div className="tool-error">
          {toolError}
        </div>
      )}

      {/* -------------------------------------------------
          LOADING
      ------------------------------------------------- */}

      {toolLoading && (
        <div className="tool-loading">
          ✨ AI is preparing your learning
          tool…
        </div>
      )}

      {/* =================================================
          1. DASHBOARD
      ================================================= */}

      {activeTool === "dashboard" && (
        <div className="learning-dashboard">

          <div className="progress-hero">

            <div>
              <span className="muted-label">
                LEARNING PROGRESS
              </span>

              <h3>
                {completedTopics.length}{" "}
                topics completed
              </h3>

              <p>
                {progress.quizCorrect || 0}{" "}
                correct quiz answers ·{" "}
                {progress.flashcardsReviewed ||
                  0}{" "}
                flashcards reviewed ·{" "}
                {progress.studiedMinutes ||
                  0}{" "}
                study minutes
              </p>
            </div>

            <button
              className="primary-button"
              onClick={
                saveProgressMinutes
              }
            >
              + Log {dailyMinutes} min
            </button>

          </div>

          <div className="progress-grid">

            <div className="progress-stat">
              <b>{topicMastery}%</b>
              <span>
                Topic mastery
              </span>
            </div>

            <div className="progress-stat">
              <b>
                {progress.quizAttempts ||
                  0}
              </b>
              <span>
                Quiz attempts
              </span>
            </div>

            <div className="progress-stat">
              <b>
                {progress.quizCorrect ||
                  0}
              </b>
              <span>
                Correct answers
              </span>
            </div>

            <div className="progress-stat">
              <b>
                {progress.studiedMinutes ||
                  0}
              </b>
              <span>
                Study minutes
              </span>
            </div>

          </div>

          <div className="tool-columns">

            <div>
              <h3>
                Topic checklist
              </h3>

              {topicNames.length > 0 ? (
                topicNames.map((topic) => (
                  <label
                    className="topic-check"
                    key={topic}
                  >
                    <input
                      type="checkbox"
                      checked={completedTopics.includes(
                        topic
                      )}
                      onChange={() =>
                        toggleTopic(topic)
                      }
                    />

                    <span>{topic}</span>
                  </label>
                ))
              ) : (
                <p>
                  Add a mind map to populate
                  your topics.
                </p>
              )}
            </div>

            <div>
              <h3>
                Weak-topic detection
              </h3>

              <p>
                Topics that are incomplete
                or missed in quizzes become
                revision candidates.
              </p>

              {weakTopicList.length > 0 ? (
                weakTopicList.map((topic) => (
                  <div
                    className="weak-topic"
                    key={topic}
                  >
                    ⚠️ {topic}
                  </div>
                ))
              ) : (
                <p>
                  No weak topics detected yet.
                </p>
              )}
            </div>

          </div>

          <div className="tool-note">
            <b>
              Personalized revision:
            </b>{" "}
            the checklist and quiz history
            are stored locally in this browser,
            so progress survives page refreshes.
          </div>

        </div>
      )}

      {/* =================================================
          2. STUDY PLANNER
      ================================================= */}

      {activeTool === "planner" && (
        <div className="tool-panel">

          <h3>
            AI Study Planner
          </h3>

          <p>
            Create a day-by-day study plan
            from your uploaded material.
          </p>

          <div className="tool-form">

            <label>
              Days

              <input
                type="number"
                min="1"
                max="30"
                value={plannerDays}
                onChange={(event) =>
                  setPlannerDays(
                    Number(event.target.value)
                  )
                }
              />
            </label>

            <label>
              Minutes/day

              <input
                type="number"
                min="15"
                max="240"
                value={dailyMinutes}
                onChange={(event) =>
                  setDailyMinutes(
                    Number(event.target.value)
                  )
                }
              />
            </label>

          </div>

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "planner",
                {
                  days: Number(
                    plannerDays
                  ),
                  daily_minutes: Number(
                    dailyMinutes
                  ),
                }
              )
            }
          >
            Generate my plan
          </button>

          {renderOutput()}

        </div>
      )}

      {/* =================================================
          3. REVISION
      ================================================= */}

      {activeTool === "revision" && (
        <div className="tool-panel">

          <h3>
            Personalized Revision
          </h3>

          <p>
            Focus your revision session on
            a specific topic or your weak
            topics.
          </p>

          <input
            className="tool-input"
            placeholder="Optional topic to revise"
            value={revisionTopic}
            onChange={(event) =>
              setRevisionTopic(
                event.target.value
              )
            }
          />

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "revision",
                {
                  topic:
                    revisionTopic.trim(),
                  weak_topics:
                    weakTopicList,
                }
              )
            }
          >
            Create revision session
          </button>

          {renderOutput()}

        </div>
      )}

      {/* =================================================
          4. AI NOTES
      ================================================= */}

      {activeTool === "notes" && (
        <div className="tool-panel">

          <h3>
            AI Notes Generator
          </h3>

          <p>
            Turn your study material into
            concise, exam-ready notes.
          </p>

          <select
            className="tool-input"
            value={notesFormat}
            onChange={(event) =>
              setNotesFormat(
                event.target.value
              )
            }
          >
            <option value="exam">
              Exam-ready notes
            </option>

            <option value="quick">
              Quick revision notes
            </option>

            <option value="cornell">
              Cornell-style notes
            </option>
          </select>

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "notes",
                {
                  format:
                    notesFormat,
                }
              )
            }
          >
            Generate notes
          </button>

          {toolOutput && (
            <>
              {renderOutput()}

              <button
                className="secondary-button"
                onClick={
                  exportNotes
                }
              >
                Export notes
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  speak(
                    typeof toolOutput ===
                      "string"
                      ? toolOutput
                      : JSON.stringify(
                          toolOutput
                        )
                  )
                }
              >
                🔊 Read notes aloud
              </button>
            </>
          )}

        </div>
      )}

      {/* =================================================
          5. DIFFICULTY QUIZ
      ================================================= */}

      {activeTool === "quiz" && (
        <div className="tool-panel">

          <h3>
            Difficulty-based Quiz
          </h3>

          <p>
            Test yourself using questions
            based on your selected difficulty.
          </p>

          <div className="difficulty-row">

            {[
              "easy",
              "medium",
              "hard",
            ].map((level) => (
              <button
                key={level}
                className={
                  difficulty === level
                    ? "difficulty active"
                    : "difficulty"
                }
                onClick={() =>
                  setDifficulty(
                    level
                  )
                }
              >
                {level}
              </button>
            ))}

          </div>

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "quiz",
                {
                  difficulty,
                }
              )
            }
          >
            Generate {difficulty} quiz
          </button>

          {quizItems.length > 0 && (
            <div className="quiz-tool">

              {quizItems.map(
                (question, index) => (
                  <div
                    className="quiz-tool-item"
                    key={index}
                  >

                    <b>
                      {index + 1}.{" "}
                      {question?.question}
                    </b>

                    {(question?.options ||
                      []).map(
                      (option) => (
                        <label
                          key={option}
                        >
                          <input
                            type="radio"
                            name={`q${index}`}
                            checked={
                              quizAnswers[
                                index
                              ] === option
                            }
                            onChange={() =>
                              setQuizAnswers(
                                (
                                  previous
                                ) => ({
                                  ...previous,
                                  [index]:
                                    option,
                                })
                              )
                            }
                          />

                          {option}
                        </label>
                      )
                    )}

                    {quizSubmitted && (
                      <small>
                        {quizAnswers[
                          index
                        ] ===
                        question?.correct_answer
                          ? "✓ Correct"
                          : "Review this question"}
                      </small>
                    )}

                  </div>
                )
              )}

              <button
                className="primary-button"
                onClick={
                  submitQuiz
                }
              >
                Submit quiz
              </button>

              {quizSubmitted && (
                <h3>
                  Score:{" "}
                  {
                    quizItems.filter(
                      (question, index) =>
                        quizAnswers[
                          index
                        ] ===
                        question?.correct_answer
                    ).length
                  }
                  /
                  {quizItems.length}
                </h3>
              )}

            </div>
          )}

        </div>
      )}

      {/* =================================================
          6. AI TUTOR
      ================================================= */}

      {activeTool === "tutor" && (
        <div className="tool-panel">

          <h3>
            AI Personal Tutor + Voice Ask
          </h3>

          <p>
            Ask questions about your study
            material and get an AI explanation.
          </p>

          <textarea
            className="tool-textarea"
            rows="4"
            placeholder="Ask your study material anything…"
            value={tutorQuestion}
            onChange={(event) =>
              setTutorQuestion(
                event.target.value
              )
            }
          />

          <div className="button-row">

            <button
              className="secondary-button"
              onClick={
                startVoice
              }
            >
              {voiceListening
                ? "🎙️ Listening…"
                : "🎙️ Voice Ask"}
            </button>

            <button
              className="primary-button"
              onClick={() =>
                callTool(
                  "tutor",
                  {
                    question:
                      tutorQuestion.trim(),
                  }
                )
              }
              disabled={
                !tutorQuestion.trim()
              }
            >
              Ask Tutor
            </button>

          </div>

          {toolOutput && (
            <>
              {renderOutput()}

              <button
                className="secondary-button"
                onClick={() =>
                  speak(
                    typeof toolOutput ===
                      "string"
                      ? toolOutput
                      : JSON.stringify(
                          toolOutput
                        )
                  )
                }
              >
                🔊 Read aloud
              </button>
            </>
          )}

        </div>
      )}

      {/* =================================================
          7. MULTI-FILE
      ================================================= */}

      {activeTool === "files" && (
        <div className="tool-panel">

          <h3>
            Multiple-file Study Workspace
          </h3>

          <p>
            Combine TXT, PDF, DOCX and PPTX
            study material into one learning
            source.
          </p>

          <input
            type="file"
            multiple
            accept=".txt,.md,.pdf,.docx,.pptx"
            onChange={(event) =>
              handleMultiFiles(
                event.target.files
              )
            }
          />

          {multiFiles.length > 0 && (
            <div className="file-list">

              {multiFiles.map(
                (file) => (
                  <span
                    key={`${file.name}-${file.size}`}
                  >
                    📄 {file.name}
                  </span>
                )
              )}

            </div>
          )}

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "notes",
                {
                  format: "quick",
                }
              )
            }
            disabled={
              !fileText.trim() ||
              toolLoading
            }
          >
            Generate combined notes
          </button>

          {toolOutput &&
            renderOutput()}

        </div>
      )}

      {/* =================================================
          8. LANGUAGES
      ================================================= */}

      {activeTool === "language" && (
        <div className="tool-panel">

          <h3>
            Multilingual Learning
          </h3>

          <p>
            Convert your study material into
            another supported language.
          </p>

          <select
            className="tool-input"
            value={language}
            onChange={(event) =>
              setLanguage(
                event.target.value
              )
            }
          >

            {[
              "English",
              "Hindi",
              "Telugu",
              "Tamil",
              "Kannada",
              "Malayalam",
              "Bengali",
              "Marathi",
              "Spanish",
              "French",
            ].map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}

          </select>

          <button
            className="primary-button"
            onClick={() =>
              callTool(
                "multilingual",
                {
                  language,
                }
              )
            }
          >
            Convert study notes
          </button>

          {renderOutput()}

        </div>
      )}

      {/* -------------------------------------------------
          FOOTER STATUS
      ------------------------------------------------- */}

      <div className="advanced-tools-row">

        <span>
          Saved maps:{" "}
          {Array.isArray(
            savedMindMaps
          )
            ? savedMindMaps.length
            : 0}
        </span>

        <span>
          AI fallback ready
        </span>

        <span>
          Browser voice ready when supported
        </span>

        <span>
          Cloud-ready architecture
        </span>

      </div>

    </section>
  );
}