import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from "reactflow";
import { jsPDF } from "jspdf";
import "reactflow/dist/style.css";

const API_BASE = "http://127.0.0.1:8000";

function buildFlowNodes(nodes = []) {
  return nodes.map((node) => {
    const level =
      node.type === "root" ? 0 : node.type === "main" ? 1 : 2;

    const sameLevel = nodes.filter((item) => {
      const itemLevel =
        item.type === "root" ? 0 : item.type === "main" ? 1 : 2;
      return itemLevel === level;
    });

    const sameIndex = sameLevel.findIndex(
      (item) => item.id === node.id
    );

    return {
      id: node.id,
      data: { label: node.label },
      type: "default",
      position: {
        x:
          level === 0
            ? 420
            : level === 1
            ? 120 + sameIndex * 240
            : 100 + sameIndex * 210,
        y: level === 0 ? 30 : level === 1 ? 180 : 330,
      },
      className:
        node.type === "root"
          ? "root-node"
          : node.type === "main"
          ? "main-node"
          : "concept-node",
    };
  });
}

function buildFlowEdges(edges = []) {
  return edges.map((edge, index) => ({
    id: edge.id || `study-pack-edge-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label || "",
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#475569",
    },
    style: {
      stroke: "#475569",
      strokeWidth: 2,
    },
    labelStyle: {
      fill: "#334155",
      fontSize: 11,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: "#ffffff",
      fillOpacity: 0.95,
    },
    labelBgPadding: [5, 2],
    labelBgBorderRadius: 4,
  }));
}

export default function StudyPack({ content, fileName = "" }) {
  const [studyPack, setStudyPack] = useState(null);
  const [activeContent, setActiveContent] = useState(content || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicMap, setTopicMap] = useState(null);
  const [topicLoading, setTopicLoading] = useState(false);

  const [saveMessage, setSaveMessage] = useState("");

  const [savedStudyPacks, setSavedStudyPacks] = useState([]);
  const [savedPacksLoading, setSavedPacksLoading] = useState(true);
  const [savedPacksError, setSavedPacksError] = useState("");

  const [openingPackId, setOpeningPackId] = useState(null);
  const [deletingPackId, setDeletingPackId] = useState(null);

  useEffect(() => {
    if (content) {
      setActiveContent(content);
    }
  }, [content]);

  const flowNodes = useMemo(
    () => buildFlowNodes(studyPack?.nodes || []),
    [studyPack]
  );

  const flowEdges = useMemo(
    () => buildFlowEdges(studyPack?.edges || []),
    [studyPack]
  );

  const loadSavedStudyPacks = async () => {
    try {
      setSavedPacksLoading(true);
      setSavedPacksError("");

      const response = await fetch(`${API_BASE}/api/study-packs`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not load saved Study Packs."
        );
      }

      setSavedStudyPacks(data.study_packs || []);
    } catch (loadError) {
      console.error("Saved Study Packs error:", loadError);
      setSavedPacksError(
        loadError.message || "Could not load saved Study Packs."
      );
    } finally {
      setSavedPacksLoading(false);
    }
  };

  useEffect(() => {
    loadSavedStudyPacks();
  }, []);

  const resetStudyState = () => {
    setQuizIndex(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);

    setFlashcardIndex(0);
    setRevealed(false);

    setAskQuestion("");
    setAskAnswer("");

    setSelectedTopic(null);
    setTopicMap(null);

    setError("");
    setSaveMessage("");
  };

  const generateStudyPack = async () => {
    if (!activeContent.trim()) {
      setError(
        "Please upload a chapter PDF/DOCX or enter study material first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setSaveMessage("");
    setStudyPack(null);

    resetStudyState();

    try {
      const response = await fetch(
        `${API_BASE}/api/generate-study-pack`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: activeContent,
            quiz_count: 10,
            flashcard_count: 10,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not generate the study pack."
        );
      }

      setStudyPack(data.study_pack);
    } catch (generationError) {
      console.error("Study pack error:", generationError);
      setError(
        generationError.message ||
          "Could not generate the study pack."
      );
    } finally {
      setLoading(false);
    }
  };

  const answerQuiz = (answer) => {
    if (quizAnswer !== null || quizFinished) return;

    setQuizAnswer(answer);

    if (
      answer ===
      studyPack.quiz[quizIndex]?.correct_answer
    ) {
      setQuizScore((score) => score + 1);
    }
  };

  const nextQuiz = () => {
    if (quizIndex >= studyPack.quiz.length - 1) {
      setQuizFinished(true);
      return;
    }

    setQuizIndex((index) => index + 1);
    setQuizAnswer(null);
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const nextFlashcard = () => {
    if (!studyPack.flashcards.length) return;

    setFlashcardIndex(
      (index) =>
        (index + 1) % studyPack.flashcards.length
    );

    setRevealed(false);
  };

  const previousFlashcard = () => {
    if (!studyPack.flashcards.length) return;

    setFlashcardIndex(
      (index) =>
        (index - 1 + studyPack.flashcards.length) %
        studyPack.flashcards.length
    );

    setRevealed(false);
  };

  const askAI = async () => {
    if (!askQuestion.trim()) {
      setError("Please enter a question about the chapter.");
      return;
    }

    if (!activeContent.trim()) {
      setError("Chapter content is not available.");
      return;
    }

    setAskLoading(true);
    setAskAnswer("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/ask-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: activeContent,
            question: askQuestion,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not get an AI answer."
        );
      }

      setAskAnswer(data.answer);
    } catch (askError) {
      setError(
        askError.message || "Could not get an AI answer."
      );
    } finally {
      setAskLoading(false);
    }
  };

  const generateTopicMap = async (topic) => {
    if (!activeContent.trim()) {
      setError("Chapter content is not available.");
      return;
    }

    setSelectedTopic(topic.title);
    setTopicLoading(true);
    setTopicMap(null);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/study-pack-topic-map`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: activeContent,
            question: topic.title,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not generate the topic map."
        );
      }

      setTopicMap(data.map);
    } catch (topicError) {
      setError(
        topicError.message ||
          "Could not generate the topic map."
      );
    } finally {
      setTopicLoading(false);
    }
  };

  const saveStudyPack = async () => {
    if (!studyPack) return;

    setSaveMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/save-study-pack`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title:
              studyPack.chapter_title ||
              fileName ||
              "Chapter Study Pack",
            content: activeContent,
            study_pack: studyPack,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not save the study pack."
        );
      }

      setSaveMessage(
        `Study Pack saved successfully! ID: ${data.study_pack_id}`
      );

      await loadSavedStudyPacks();
    } catch (saveError) {
      setError(
        saveError.message ||
          "Could not save the study pack."
      );
    }
  };

  const openSavedStudyPack = async (id) => {
    setOpeningPackId(id);
    setSavedPacksError("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/study-packs/${id}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not open Study Pack."
        );
      }

      const savedPack = data.study_pack;

      const loadedStudyPack =
        savedPack.study_pack ||
        savedPack.data ||
        savedPack;

      const loadedContent =
        savedPack.content ||
        "";

      setActiveContent(loadedContent);

      setStudyPack(loadedStudyPack);

      setQuizIndex(0);
      setQuizAnswer(null);
      setQuizScore(0);
      setQuizFinished(false);

      setFlashcardIndex(0);
      setRevealed(false);

      setAskQuestion("");
      setAskAnswer("");

      setSelectedTopic(null);
      setTopicMap(null);

      setSaveMessage(
        `Opened saved Study Pack: ${
          loadedStudyPack.chapter_title ||
          savedPack.title ||
          "Study Pack"
        }`
      );

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    } catch (openError) {
      console.error("Open Study Pack error:", openError);
      setSavedPacksError(
        openError.message ||
          "Could not open Study Pack."
      );
    } finally {
      setOpeningPackId(null);
    }
  };

  const deleteSavedStudyPack = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this Study Pack?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingPackId(id);
    setSavedPacksError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/study-packs/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not delete Study Pack."
        );
      }

      setSavedStudyPacks((current) =>
        current.filter(
          (studyPackItem) =>
            studyPackItem.id !== id
        )
      );

      setSaveMessage("Study Pack deleted successfully.");
    } catch (deleteError) {
      console.error(
        "Delete Study Pack error:",
        deleteError
      );

      setSavedPacksError(
        deleteError.message ||
          "Could not delete Study Pack."
      );
    } finally {
      setDeletingPackId(null);
    }
  };

  const exportStudyPack = () => {
    if (!studyPack) return;

    const pdf = new jsPDF();

    let y = 20;

    const addText = (
      text,
      size = 11,
      gap = 7
    ) => {
      pdf.setFontSize(size);

      const lines = pdf.splitTextToSize(
        String(text || ""),
        175
      );

      lines.forEach((line) => {
        if (y > 275) {
          pdf.addPage();
          y = 20;
        }

        pdf.text(line, 18, y);
        y += gap;
      });

      y += 3;
    };

    addText(
      studyPack.chapter_title ||
        "AI Study Pack",
      20,
      9
    );

    addText(
      "Summary",
      15,
      8
    );

    addText(
      studyPack.summary,
      11,
      7
    );

    addText(
      "Important Concepts",
      15,
      8
    );

    (studyPack.key_points || []).forEach(
      (point, index) =>
        addText(
          `${index + 1}. ${point}`
        )
    );

    addText(
      "Topics",
      15,
      8
    );

    (studyPack.topics || []).forEach(
      (topic) =>
        addText(
          `${topic.title}: ${
            (topic.subtopics || []).join(
              ", "
            )
          }`
        )
    );

    addText(
      "Quiz",
      15,
      8
    );

    (studyPack.quiz || []).forEach(
      (question, index) =>
        addText(
          `${index + 1}. ${
            question.question
          }\nAnswer: ${
            question.correct_answer
          }`
        )
    );

    addText(
      "Flashcards",
      15,
      8
    );

    (studyPack.flashcards || []).forEach(
      (card, index) =>
        addText(
          `${index + 1}. ${
            card.question
          }\n${card.answer}`
        )
    );

    const safeName = (
      studyPack.chapter_title ||
      "study-pack"
    ).replace(
      /[^a-z0-9-_]+/gi,
      "-"
    );

    pdf.save(
      `${safeName}-study-pack.pdf`
    );
  };

  const currentQuestion =
    studyPack?.quiz?.[quizIndex];

  const currentCard =
    studyPack?.flashcards?.[flashcardIndex];

  return (
    <section
      className="options-panel"
      style={{ marginTop: "25px" }}
    >
      <div className="detail-header">
        <div>
          <h3>
            📚 AI Chapter Study Pack
          </h3>

          <p>
            Turn a complete chapter into a
            mind map, summary, quiz,
            flashcards and AI study assistant.
          </p>
        </div>
      </div>

      <div
        className="generate-actions"
        style={{ marginTop: "15px" }}
      >
        <button
          className="generate-button"
          onClick={generateStudyPack}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Analyzing Chapter...
            </>
          ) : (
            "📚 Generate Complete Study Pack"
          )}
        </button>
      </div>

      {error && (
        <div
          className="error-message"
          style={{ marginTop: "12px" }}
        >
          <span>⚠️</span>
          {error}
        </div>
      )}

      {saveMessage && (
        <div
          className="selected-file"
          style={{ marginTop: "12px" }}
        >
          ✅ {saveMessage}
        </div>
      )}

      {studyPack && (
        <div style={{ marginTop: "25px" }}>
          <div
            style={{ marginBottom: "20px" }}
          >
            <span className="section-tag">
              CHAPTER ANALYZED
            </span>

            <h2 style={{ marginTop: "8px" }}>
              {studyPack.chapter_title}
            </h2>
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
            }}
          >
            <div className="feature-icon">
              📝
            </div>

            <div>
              <h3>Summary</h3>
              <p>{studyPack.summary}</p>
            </div>
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
            }}
          >
            <div className="feature-icon">
              ⭐
            </div>

            <div
              style={{ width: "100%" }}
            >
              <h3>
                Important Concepts
              </h3>

              <ul
                style={{
                  marginBottom: 0,
                  paddingLeft: "20px",
                }}
              >
                {(studyPack.key_points ||
                  []).map(
                  (point, index) => (
                    <li
                      key={index}
                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      {point}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
            }}
          >
            <div className="feature-icon">
              🗂️
            </div>

            <div
              style={{ width: "100%" }}
            >
              <h3>
                Chapter Topics
              </h3>

              {(studyPack.topics ||
                []).map(
                (topic, index) => (
                  <div
                    key={index}
                    style={{
                      marginTop: "10px",
                    }}
                  >
                    <strong>
                      {topic.title}
                    </strong>

                    <div
                      style={{
                        marginTop: "4px",
                      }}
                    >
                      {(
                        topic.subtopics ||
                        []
                      ).join(" • ")}
                    </div>

                    <button
                      className="clear-button"
                      style={{
                        marginTop: "8px",
                      }}
                      onClick={() =>
                        generateTopicMap(
                          topic
                        )
                      }
                      disabled={
                        topicLoading
                      }
                    >
                      {topicLoading &&
                      selectedTopic ===
                        topic.title
                        ? "Generating..."
                        : "🌳 Topic Map"}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
              display: "block",
            }}
          >
            <h3>
              🧠 Chapter Mind Map
            </h3>

            <div
              style={{
                height: "430px",
                marginTop: "12px",
                border:
                  "1px solid #e2e8f0",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                fitView
                fitViewOptions={{
                  padding: 0.2,
                }}
                minZoom={0.2}
                maxZoom={1.8}
              >
                <Background
                  gap={24}
                  size={1}
                />

                <Controls />

                <MiniMap
                  pannable
                  zoomable
                />
              </ReactFlow>
            </div>
          </div>

          {topicMap && (
            <div
              className="feature"
              style={{
                marginBottom: "16px",
                display: "block",
              }}
            >
              <h3>
                🌳 {topicMap.title}
              </h3>

              <p>
                {topicMap.summary}
              </p>

              <div
                style={{
                  height: "360px",
                  marginTop: "12px",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <ReactFlow
                  nodes={buildFlowNodes(
                    topicMap.nodes
                  )}
                  edges={buildFlowEdges(
                    topicMap.edges
                  )}
                  fitView
                  fitViewOptions={{
                    padding: 0.2,
                  }}
                  minZoom={0.2}
                  maxZoom={1.8}
                >
                  <Background
                    gap={24}
                    size={1}
                  />

                  <Controls />
                </ReactFlow>
              </div>
            </div>
          )}

          <div
            className="feature"
            style={{
              marginBottom: "16px",
              display: "block",
            }}
          >
            <h3>
              ❓ Chapter Quiz
            </h3>

            {!quizFinished &&
            currentQuestion ? (
              <div
                style={{
                  marginTop: "12px",
                }}
              >
                <p>
                  <strong>
                    Question{" "}
                    {quizIndex + 1} of{" "}
                    {
                      studyPack.quiz
                        .length
                    }
                  </strong>
                </p>

                <h4>
                  {
                    currentQuestion.question
                  }
                </h4>

                {currentQuestion.options.map(
                  (option, index) => {
                    const correct =
                      option ===
                      currentQuestion.correct_answer;

                    const selected =
                      option ===
                      quizAnswer;

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() =>
                          answerQuiz(
                            option
                          )
                        }
                        disabled={
                          quizAnswer !==
                          null
                        }
                        style={{
                          display:
                            "block",
                          width: "100%",
                          textAlign:
                            "left",
                          marginBottom:
                            "8px",
                          padding:
                            "10px 12px",
                          borderRadius:
                            "8px",
                          border:
                            "1px solid #cbd5e1",
                          background:
                            quizAnswer !==
                              null &&
                            correct
                              ? "#dcfce7"
                              : quizAnswer !==
                                  null &&
                                selected
                              ? "#fee2e2"
                              : "#fff",
                        }}
                      >
                        {String.fromCharCode(
                          65 + index
                        )}
                        . {option}
                      </button>
                    );
                  }
                )}

                {quizAnswer !==
                  null && (
                  <p
                    style={{
                      marginTop:
                        "10px",
                    }}
                  >
                    {quizAnswer ===
                    currentQuestion.correct_answer
                      ? "✅ Correct!"
                      : `❌ Correct answer: ${currentQuestion.correct_answer}`}
                    {" — "}
                    {
                      currentQuestion.explanation
                    }
                  </p>
                )}

                {quizAnswer !==
                  null && (
                  <button
                    className="clear-button"
                    onClick={
                      nextQuiz
                    }
                  >
                    Next Question
                  </button>
                )}
              </div>
            ) : (
              <div>
                <h4>
                  🎉 Quiz Complete
                </h4>

                <p>
                  You scored{" "}
                  <strong>
                    {quizScore}
                  </strong>{" "}
                  out of{" "}
                  <strong>
                    {
                      studyPack.quiz
                        .length
                    }
                  </strong>
                  .
                </p>

                <button
                  className="clear-button"
                  onClick={
                    resetQuiz
                  }
                >
                  🔄 Restart Quiz
                </button>
              </div>
            )}
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
              display: "block",
            }}
          >
            <h3>
              🃏 Flashcards
            </h3>

            {currentCard && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "20px",
                  border:
                    "1px solid #cbd5e1",
                  borderRadius: "10px",
                  background: "#fff",
                  minHeight: "130px",
                }}
              >
                <strong>
                  {currentCard.question}
                </strong>

                {revealed && (
                  <p
                    style={{
                      marginTop:
                        "18px",
                    }}
                  >
                    {currentCard.answer}
                  </p>
                )}

                <div
                  className="edit-actions"
                  style={{
                    marginTop:
                      "15px",
                  }}
                >
                  <button
                    onClick={
                      previousFlashcard
                    }
                  >
                    ← Previous
                  </button>

                  <button
                    className="save-edit"
                    onClick={() =>
                      setRevealed(
                        !revealed
                      )
                    }
                  >
                    {revealed
                      ? "Hide Answer"
                      : "Reveal Answer"}
                  </button>

                  <button
                    onClick={
                      nextFlashcard
                    }
                  >
                    Next →
                  </button>
                </div>

                <p
                  style={{
                    marginTop:
                      "10px",
                  }}
                >
                  Card{" "}
                  {flashcardIndex +
                    1}{" "}
                  of{" "}
                  {
                    studyPack
                      .flashcards
                      .length
                  }
                </p>
              </div>
            )}
          </div>

          <div
            className="feature"
            style={{
              marginBottom: "16px",
              display: "block",
            }}
          >
            <h3>
              💬 Ask AI About This
              Chapter
            </h3>

            <textarea
              value={askQuestion}
              onChange={(event) =>
                setAskQuestion(
                  event.target.value
                )
              }
              placeholder="Ask something about this chapter..."
              style={{
                width: "100%",
                minHeight: "90px",
                marginTop: "10px",
                padding: "12px",
                borderRadius: "8px",
                border:
                  "1px solid #cbd5e1",
                boxSizing:
                  "border-box",
                fontFamily:
                  "inherit",
              }}
            />

            <button
              className="clear-button"
              style={{
                marginTop: "10px",
              }}
              onClick={askAI}
              disabled={askLoading}
            >
              {askLoading
                ? "🤖 Thinking..."
                : "✨ Ask AI"}
            </button>

            {askAnswer && (
              <p
                style={{
                  marginTop:
                    "15px",
                }}
              >
                <strong>
                  AI Answer:
                </strong>{" "}
                {askAnswer}
              </p>
            )}
          </div>

          <div
            className="generate-actions"
            style={{
              marginTop: "18px",
            }}
          >
            <button
              className="clear-button"
              onClick={
                saveStudyPack
              }
            >
              💾 Save Study Pack
            </button>

            <button
              className="clear-button"
              onClick={
                exportStudyPack
              }
            >
              📄 Export Study Pack PDF
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "35px",
          padding: "24px",
          borderRadius: "18px",
          border:
            "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              📚 Saved Study Packs
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              View and reopen your
              previously saved study
              materials.
            </p>
          </div>

          <button
            onClick={
              loadSavedStudyPacks
            }
            disabled={
              savedPacksLoading
            }
            style={{
              padding:
                "9px 14px",
              borderRadius:
                "9px",
              border:
                "1px solid #cbd5e1",
              background:
                "#ffffff",
              color:
                "#334155",
              cursor:
                savedPacksLoading
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {savedPacksLoading && (
          <div
            style={{
              padding: "25px",
              textAlign:
                "center",
              color:
                "#64748b",
            }}
          >
            Loading saved Study
            Packs...
          </div>
        )}

        {!savedPacksLoading &&
          savedPacksError && (
            <div
              style={{
                padding:
                  "14px",
                borderRadius:
                  "10px",
                background:
                  "#fef2f2",
                color:
                  "#b91c1c",
                marginBottom:
                  "15px",
                fontSize:
                  "14px",
              }}
            >
              {savedPacksError}
            </div>
          )}

        {!savedPacksLoading &&
          !savedPacksError &&
          savedStudyPacks.length ===
            0 && (
            <div
              style={{
                padding:
                  "30px",
                textAlign:
                  "center",
                border:
                  "1px dashed #cbd5e1",
                borderRadius:
                  "12px",
                color:
                  "#64748b",
              }}
            >
              <div
                style={{
                  fontSize:
                    "30px",
                  marginBottom:
                    "8px",
                }}
              >
                📚
              </div>

              <div
                style={{
                  fontWeight:
                    600,
                  color:
                    "#334155",
                  marginBottom:
                    "5px",
                }}
              >
                No saved Study
                Packs yet
              </div>

              <div
                style={{
                  fontSize:
                    "14px",
                }}
              >
                Generate a Study
                Pack and click Save
                Study Pack to see it
                here.
              </div>
            </div>
          )}

        {!savedPacksLoading &&
          !savedPacksError &&
          savedStudyPacks.length >
            0 && (
            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap: "10px",
              }}
            >
              {savedStudyPacks.map(
                (savedPack) => (
                  <div
                    key={
                      savedPack.id
                    }
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                      padding:
                        "16px",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        "12px",
                      background:
                        "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "16px",
                          fontWeight:
                            700,
                          color:
                            "#0f172a",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        📖{" "}
                        {savedPack.title ||
                          "Untitled Study Pack"}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          fontSize:
                            "12px",
                          color:
                            "#64748b",
                        }}
                      >
                        Saved:{" "}
                        {savedPack.created_at
                          ? new Date(
                              savedPack.created_at
                            ).toLocaleString()
                          : "Unknown date"}
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        gap: "8px",
                        flexShrink:
                          0,
                      }}
                    >
                      <button
                        onClick={() =>
                          openSavedStudyPack(
                            savedPack.id
                          )
                        }
                        disabled={
                          openingPackId ===
                          savedPack.id
                        }
                        style={{
                          padding:
                            "8px 13px",
                          borderRadius:
                            "8px",
                          border:
                            "none",
                          background:
                            "#2563eb",
                          color:
                            "#ffffff",
                          cursor:
                            openingPackId ===
                            savedPack.id
                              ? "not-allowed"
                              : "pointer",
                          fontWeight:
                            600,
                        }}
                      >
                        {openingPackId ===
                        savedPack.id
                          ? "Opening..."
                          : "📂 Open"}
                      </button>

                      <button
                        onClick={() =>
                          deleteSavedStudyPack(
                            savedPack.id
                          )
                        }
                        disabled={
                          deletingPackId ===
                          savedPack.id
                        }
                        style={{
                          padding:
                            "8px 13px",
                          borderRadius:
                            "8px",
                          border:
                            "1px solid #fecaca",
                          background:
                            "#ffffff",
                          color:
                            "#dc2626",
                          cursor:
                            deletingPackId ===
                            savedPack.id
                              ? "not-allowed"
                              : "pointer",
                          fontWeight:
                            600,
                        }}
                      >
                        {deletingPackId ===
                        savedPack.id
                          ? "Deleting..."
                          : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
      </div>
    </section>
  );
}