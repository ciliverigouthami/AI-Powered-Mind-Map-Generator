import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import "./App.css";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getNodesBounds,
  getViewportForBounds,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import StudyPack from "./StudyPack";
import StudyTools from "./studyTools";
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";
function App() {
  
  const [content, setContent] = useState("");
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [selectedDocx, setSelectedDocx] = useState(null);

  const [pdfUploading, setPdfUploading] = useState(false);
  const [docxUploading, setDocxUploading] = useState(false);

  const [detailLevel, setDetailLevel] = useState("balanced");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const saveHistory = () => {
  setHistory((currentHistory) => [
    ...currentHistory,
    {
      nodes,
      edges,
    },
  ]);

  setFuture([]);
  };
  const [mapTitle, setMapTitle] = useState("");
  const [summary, setSummary] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingNode, setEditingNode] = useState(null);
  const [editingText, setEditingText] = useState("");
  
  const [appearanceNode, setAppearanceNode] = useState(null);
  const [nodeColor, setNodeColor] = useState("#ffffff");
  
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);

  const [editingEdge, setEditingEdge] = useState(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState("");

  const [searchNodeText, setSearchNodeText] = useState("");

  const [explainingNode, setExplainingNode] = useState(null);
  const [nodeExplanation, setNodeExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const [quizQuestions, setQuizQuestions] = useState([]);
  const [askAIQuestion, setAskAIQuestion] = useState("");
  const [askAIAnswer, setAskAIAnswer] = useState("");
  const [askAILoading, setAskAILoading] = useState(false);
  const [askAIOpen, setAskAIOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const [savedMindMaps, setSavedMindMaps] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pdfInputRef = useRef(null);
  const docxInputRef = useRef(null);
  const mindmapRef = useRef(null);

  const handleTextChange = (event) => {
    setContent(event.target.value);
    setError("");
  };

  const uploadPdf = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setSelectedPdf(file);
    setSelectedDocx(null);
    setPdfUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/upload-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "PDF upload failed."
        );
      }

      setContent(data.text);
    } catch (uploadError) {
      console.error("PDF upload error:", uploadError);

      setSelectedPdf(null);

      setError(
        uploadError.message ||
          "Could not upload the PDF."
      );
    } finally {
      setPdfUploading(false);
      event.target.value = "";
    }
  };

  const uploadDocx = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (
      file.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      !file.name.toLowerCase().endsWith(".docx")
    ) {
      setError("Please select a DOCX file.");
      event.target.value = "";
      return;
    }

    setSelectedDocx(file);
    setSelectedPdf(null);
    setDocxUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/upload-docx`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "DOCX upload failed."
        );
      }

      setContent(data.text);
    } catch (uploadError) {
      console.error("DOCX upload error:", uploadError);

      setSelectedDocx(null);

      setError(
        uploadError.message ||
          "Could not upload the DOCX."
      );
    } finally {
      setDocxUploading(false);
      event.target.value = "";
    }
  };

  const generateMindMap = async () => {
    if (!content.trim()) {
      setError(
        "Please enter study material or upload a PDF/DOCX file first."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/generate-mindmap`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content,
            detail_level: detailLevel,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || "Mind map generation failed."
        );
      }

      setMapTitle(
        data.title || "Generated Mind Map"
      );

      setSummary(data.summary || "");

      const generatedNodes = data.nodes || [];
      const generatedEdges = data.edges || [];

      if (generatedNodes.length === 0) {
        throw new Error(
          "AI did not return any mind-map nodes."
        );
      }

      const childrenMap = {};

      generatedNodes.forEach((node) => {
        childrenMap[node.id] = [];
      });

      generatedEdges.forEach((edge) => {
        if (childrenMap[edge.source]) {
          childrenMap[edge.source].push(
            edge.target
          );
        }
      });

      const levels = {};
      const visited = new Set();

      const queue = [
        {
          id: "root",
          level: 0,
        },
      ];

      while (queue.length > 0) {
        const current = queue.shift();

        if (visited.has(current.id)) {
          continue;
        }

        visited.add(current.id);

        if (!levels[current.level]) {
          levels[current.level] = [];
        }

        levels[current.level].push(
          current.id
        );

        const children =
          childrenMap[current.id] || [];

        children.forEach((childId) => {
          if (!visited.has(childId)) {
            queue.push({
              id: childId,
              level: current.level + 1,
            });
          }
        });
      }

      generatedNodes.forEach((node) => {
        if (!visited.has(node.id)) {
          const fallbackLevel = Math.min(
            3,
            Object.keys(levels).length
          );

          if (!levels[fallbackLevel]) {
            levels[fallbackLevel] = [];
          }

          levels[fallbackLevel].push(
            node.id
          );
        }
      });

      const nodeLookup = {};

      generatedNodes.forEach((node) => {
        nodeLookup[node.id] = node;
      });

      const positionedNodes = [];

      // Keep large mind maps compact by wrapping wide levels into rows.
      // This preserves the existing visual style while preventing very wide maps.
      const horizontalSpacing = 230;
      const verticalSpacing = 180;
      const rowSpacing = 145;
      const maxColumns = 4;
      const canvasCenterX = 700;

      Object.keys(levels)
        .sort(
          (a, b) =>
            Number(a) - Number(b)
        )
        .forEach((levelKey) => {
          const level = Number(levelKey);
          const levelNodes = levels[levelKey];

          for (let rowStart = 0; rowStart < levelNodes.length; rowStart += maxColumns) {
            const rowNodes = levelNodes.slice(
              rowStart,
              rowStart + maxColumns
            );

            const totalWidth =
              (rowNodes.length - 1) *
              horizontalSpacing;

            const rowIndex = Math.floor(
              rowStart / maxColumns
            );

            rowNodes.forEach(
              (nodeId, index) => {
                const node =
                  nodeLookup[nodeId];

                if (!node) {
                  return;
                }

                const x =
                  canvasCenterX -
                  totalWidth / 2 +
                  index * horizontalSpacing;

                const y =
                  40 +
                  level * verticalSpacing +
                  rowIndex * rowSpacing;

                positionedNodes.push({
                  id: node.id,
                  data: {
                    label: node.label,
                  },
                  type: "default",
                  position: {
                    x,
                    y,
                  },
                  className:
                    node.type === "root"
                      ? "root-node"
                      : node.type === "main"
                      ? "main-node"
                      : "concept-node",
                });
              }
            );
          }
        });

      const formattedEdges =
        generatedEdges
          .filter(
            (edge) =>
              nodeLookup[edge.source] &&
              nodeLookup[edge.target]
          )
          .map((edge, index) => ({
            id: `edge-${index}-${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            label: edge.label || "",
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "#475569",
              strokeWidth: 2.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#475569",
            },
            labelStyle: {
              fill: "#334155",
              fontSize: 12,
              fontWeight: 600,
            },
            labelBgStyle: {
              fill: "#ffffff",
              fillOpacity: 0.95,
            },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 4,
          }));

      setNodes(positionedNodes);
      setEdges(formattedEdges);

      setQuizQuestions([]);
      setQuizOpen(false);
      setQuizFinished(false);
      setQuizIndex(0);
      setSelectedAnswer(null);
      setQuizScore(0);
    } catch (generationError) {
      console.error(
        "Mind map generation error:",
        generationError
      );

      setError(
        generationError.message ||
          "Could not generate the mind map."
      );
    } finally {
      setLoading(false);
    }
  };

  const startEditing = useCallback(
    (event, node) => {
      setEditingNode(node.id);
      setEditingText(node.data.label);
    },
    []
  );

  const saveNodeEdit = () => {
    saveHistory();
    if (!editingNode) {
      return;
    }

    const newText = editingText.trim();

    if (!newText) {
      setEditingNode(null);
      setEditingText("");
      setAppearanceNode(null);
      setNodeColor("#ffffff");
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === editingNode
          ? {
              ...node,
              data: {
                ...node.data,
                label: newText,
              },
            }
          : node
      )
    );

    setEditingNode(null);
    setEditingText("");
  };

  const saveNodeAppearance = () => {
    saveHistory();
  if (!appearanceNode) {
    return;
  }

  setNodes((currentNodes) =>
    currentNodes.map((node) =>
      node.id === appearanceNode
        ? {
            ...node,
            style: {
              ...node.style,
              background: nodeColor,
            },
          }
        : node
    )
  );

  setAppearanceNode(null);
};

  const addNode = () => {
    const newNodeId = `custom-${Date.now()}`;

    const newNode = {
      id: newNodeId,
      data: {
        label: "New Concept",
      },
      type: "default",
      position: {
        x: 700,
        y: 100,
      },
      className: "concept-node",
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      newNode,
    ]);

    setEditingNode(newNodeId);
    setEditingText("New Concept");
  };

  const addChildNode = () => {
    saveHistory();
    const selectedNode = nodes.find(
      (node) => node.selected
    );

  if (!selectedNode) {
    setError(
      "Please select a node first to add a child node."
    );
    return;
  }
  saveHistory();
  const newNodeId = `child-${Date.now()}`;

  const newNode = {
    id: newNodeId,
    data: {
      label: "New Child",
    },
    type: "default",
    position: {
      x: selectedNode.position.x + 230,
      y: selectedNode.position.y + 150,
    },
    className: "concept-node",
  };

  const newEdge = {
    id: `edge-${Date.now()}`,
    source: selectedNode.id,
    target: newNodeId,
    label: "has",
    type: "smoothstep",
    animated: false,
    style: {
      stroke: "#475569",
      strokeWidth: 2.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#475569",
    },
    labelStyle: {
      fill: "#334155",
      fontSize: 12,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: "#ffffff",
      fillOpacity: 0.95,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
  };

  setNodes((currentNodes) => [
    ...currentNodes,
    newNode,
  ]);

  setEdges((currentEdges) => [
    ...currentEdges,
    newEdge,
  ]);

  setEditingNode(newNodeId);
  setEditingText("New Child");
  setError("");
  };
const saveEdgeLabel = () => {
  saveHistory();
  if (!editingEdge) {
    return;
  }

  setEdges((currentEdges) =>
    currentEdges.map((edge) =>
      edge.id === editingEdge
        ? {
            ...edge,
            label: editingEdgeLabel.trim() || "related to",
          }
        : edge
    )
  );

  setEditingEdge(null);
  setEditingEdgeLabel("");
};
const searchNode = () => {
  const query = searchNodeText.trim().toLowerCase();

  if (!query) {
    setError("Please enter a node name to search.");
    return;
  }

  const foundNode = nodes.find((node) =>
    node.data.label.toLowerCase().includes(query)
  );

  if (!foundNode) {
    setError(`No node found for "${searchNodeText}".`);
    return;
  }

  setNodes((currentNodes) =>
  currentNodes.map((node) => ({
    ...node,
    selected: node.id === foundNode.id,
    style:
  node.id === foundNode.id
    ? {
        ...node.style,
        boxShadow: "0 0 0 4px #2563eb",
      }
    : node.style,
  }))
);

if (reactFlowInstance) {
  const nodeWidth = foundNode.measured?.width || 180;
  const nodeHeight = foundNode.measured?.height || 60;

  reactFlowInstance.setCenter(
    foundNode.position.x + nodeWidth / 2,
    foundNode.position.y + nodeHeight / 2,
    {
      zoom: 1.3,
      duration: 600,
    }
  );
}

setError("");
};

const undoChanges = () => {
  if (history.length === 0) {
    return;
  }

  const previousState = history[history.length - 1];

  setFuture((currentFuture) => [
    {
      nodes,
      edges,
    },
    ...currentFuture,
  ]);

  setNodes(previousState.nodes);
  setEdges(previousState.edges);

  setHistory((currentHistory) =>
    currentHistory.slice(0, -1)
  );
};

const redoChanges = () => {
  if (future.length === 0) {
    return;
  }

  const nextState = future[0];

  setHistory((currentHistory) => [
    ...currentHistory,
    {
      nodes,
      edges,
    },
  ]);

  setNodes(nextState.nodes);
  setEdges(nextState.edges);

  setFuture((currentFuture) =>
    currentFuture.slice(1)
  );
};
  
const deleteSelectedNode = () => {
  saveHistory();
    const selectedNode = nodes.find(
      (node) => node.selected
    );

    if (!selectedNode) {
      setError(
        "Please select a node to delete."
      );
      return;
    }

    if (selectedNode.id === "root") {
      setError(
        "The root node cannot be deleted."
      );
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.filter(
        (node) =>
          node.id !== selectedNode.id
      )
    );

    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          edge.source !==
            selectedNode.id &&
          edge.target !==
            selectedNode.id
      )
    );

    setError("");
  };

  const explainNode = async (node) => {
    try {
      setExplainingNode(node);
      setNodeExplanation(null);
      setExplanationLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/explain-node`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            node_label: node.data.label,
            content: content,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not explain this node."
        );
      }

      setNodeExplanation(data.explanation);
    } catch (explanationError) {
      console.error(
        "Explain node error:",
        explanationError
      );

      setError(
        explanationError.message ||
          "Could not explain this node."
      );

      setExplainingNode(null);
    } finally {
      setExplanationLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (!content.trim()) {
      setError(
        "Please enter study material or generate a mind map first."
      );
      return;
    }

    try {
      setQuizLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/generate-quiz`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content,
            num_questions: 5,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not generate quiz."
        );
      }

      if (
        !data.questions ||
        data.questions.length === 0
      ) {
        throw new Error(
          "AI did not generate any quiz questions."
        );
      }

      setQuizQuestions(data.questions);
      setQuizIndex(0);
      setSelectedAnswer(null);
      setQuizScore(0);
      setQuizFinished(false);
      setQuizOpen(true);
    } catch (quizError) {
      console.error(
        "Generate quiz error:",
        quizError
      );

      setError(
        quizError.message ||
          "Could not generate quiz."
      );
    } finally {
      setQuizLoading(false);
    }
  };

  const askAI = async () => {
  if (!content.trim()) {
    setError(
      "Please enter study material or generate a mind map first."
    );
    return;
  }

  if (!askAIQuestion.trim()) {
    setError("Please enter a question.");
    return;
  }

  try {
    setAskAILoading(true);
    setAskAIAnswer("");
    setError("");

    const response = await fetch(
      `${API_URL}/api/ask-ai`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          question: askAIQuestion,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Could not get an AI answer."
      );
    }

    setAskAIAnswer(data.answer);
  } catch (askAIError) {
    console.error("Ask AI error:", askAIError);

    setError(
      askAIError.message ||
        "Could not get an AI answer."
    );
  } finally {
    setAskAILoading(false);
  }
};


  const selectQuizAnswer = (answer) => {
    if (selectedAnswer !== null) {
      return;
    }

    setSelectedAnswer(answer);

    const currentQuestion =
      quizQuestions[quizIndex];

    if (
      answer ===
      currentQuestion.correct_answer
    ) {
      setQuizScore(
        (currentScore) =>
          currentScore + 1
      );
    }
  };

  const nextQuizQuestion = () => {
    if (
      quizIndex <
      quizQuestions.length - 1
    ) {
      setQuizIndex(
        (currentIndex) =>
          currentIndex + 1
      );

      setSelectedAnswer(null);
    } else {
      setQuizFinished(true);
    }
  };

  const restartQuiz = () => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const closeQuiz = () => {
    setQuizOpen(false);
    setQuizFinished(false);
    setSelectedAnswer(null);
    setQuizIndex(0);
    setQuizScore(0);
  };
const handleNodeDragStart = () => {
  saveHistory();
};
  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "#475569",
              strokeWidth: 2.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#475569",
            },
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );
  const startConnectMode = () => {
  setConnectMode(true);
  setConnectSource(null);
  setError("Select the source node, then select the target node.");
};

const handleNodeClickForConnection = (event, node) => {
  if (!connectMode) {
    return;
  }

  if (!connectSource) {
    setConnectSource(node.id);
    setError("Now select the target node.");
    return;
  }
  saveHistory();
  if (connectSource === node.id) {
    setError("Please select a different target node.");
    return;
  }

  const edgeExists = edges.some(
    (edge) =>
      edge.source === connectSource &&
      edge.target === node.id
  );

  if (edgeExists) {
    setError("These nodes are already connected.");
    return;
  }

  const newEdge = {
    id: `custom-edge-${Date.now()}`,
    source: connectSource,
    target: node.id,
    label: "related to",
    type: "smoothstep",
    animated: false,
    style: {
      stroke: "#475569",
      strokeWidth: 2.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#475569",
    },
    labelStyle: {
      fill: "#334155",
      fontSize: 12,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: "#ffffff",
      fillOpacity: 0.95,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
  };

  setEdges((currentEdges) => [
    ...currentEdges,
    newEdge,
  ]);

  setConnectMode(false);
  setConnectSource(null);
  setError("");
};

  const handleEditKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveNodeEdit();
    }

    if (event.key === "Escape") {
      setEditingNode(null);
      setEditingText("");
    }
  };

  const clearAll = () => {
    setContent("");
    setSelectedPdf(null);
    setSelectedDocx(null);
    setNodes([]);
    setEdges([]);
    setMapTitle("");
    setSummary("");
    setError("");
    setEditingNode(null);
    setEditingText("");
    setExplainingNode(null);
    setNodeExplanation(null);
    setQuizQuestions([]);
    setQuizOpen(false);
    setQuizFinished(false);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
  };

  const saveMindMap = async () => {
    if (nodes.length === 0) {
      setError(
        "Please generate a mind map before saving."
      );
      return;
    }

    try {
      setError("");

      const mindMapData = {
        title:
          mapTitle || "My Mind Map",
        content: content,
        nodes: nodes,
        edges: edges,
        savedAt:
          new Date().toISOString(),
      };

      localStorage.setItem(
        "mindmap_ai_saved_map",
        JSON.stringify(mindMapData)
      );

      const response = await fetch(
        `${API_URL}/api/save-mindmap`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: mindMapData.title,
            content:
              mindMapData.content,
            nodes: mindMapData.nodes,
            edges: mindMapData.edges,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Could not save mind map to database."
        );
      }

      setError(
        `✅ Mind map saved successfully! ID: ${data.mindmap_id}`
      );

      loadSavedMindMaps();
    } catch (saveError) {
      console.error(
        "Save mind map error:",
        saveError
      );

      setError(
        saveError.message ||
          "Could not save the mind map."
      );
    }
  };

  const loadSavedMindMaps = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/api/mindmaps`
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Could not load saved mind maps."
        );
      }

      setSavedMindMaps(
        data.mindmaps || []
      );
    } catch (historyError) {
      console.error(
        "Load saved mind maps error:",
        historyError
      );

      setError(
        historyError.message ||
          "Could not load saved mind maps."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadMindMap = async (mindmapId) => {
    try {
      setHistoryLoading(true);
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/mindmaps/${mindmapId}`
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Could not load the selected mind map."
        );
      }

      const mindmap =
        data.mindmap;

      setMapTitle(
        mindmap.title || "Saved Mind Map"
      );

      setContent(
        mindmap.content || ""
      );

      setNodes(
        (mindmap.nodes || []).map(
          (node) => ({
            ...node,
            data: {
              ...node.data,
              label:
                node.data?.label ||
                node.label ||
                "Concept",
            },
          })
        )
      );

      setEdges(
        (mindmap.edges || []).map(
          (edge, index) => ({
            ...edge,
            id:
              edge.id ||
              `saved-edge-${index}`,
            type:
              edge.type ||
              "smoothstep",
            markerEnd:
              edge.markerEnd || {
                type: MarkerType.ArrowClosed,
                color: "#475569",
              },
            style:
              edge.style || {
                stroke: "#475569",
                strokeWidth: 2.5,
              },
            labelStyle:
              edge.labelStyle || {
                fill: "#334155",
                fontSize: 12,
                fontWeight: 600,
              },
            labelBgStyle:
              edge.labelBgStyle || {
                fill: "#ffffff",
                fillOpacity: 0.95,
              },
            labelBgPadding:
              edge.labelBgPadding || [
                6,
                3,
              ],
            labelBgBorderRadius:
              edge.labelBgBorderRadius ||
              4,
          })
        )
      );

      setSummary("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      setError(
        `✅ Loaded "${mindmap.title}". You can continue editing it.`
      );
    } catch (loadError) {
      console.error(
        "Load mind map error:",
        loadError
      );

      setError(
        loadError.message ||
          "Could not load the mind map."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSavedMindMaps();
  }, []);

  const deleteSavedMindMap = async (mindmapId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this saved mind map?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setHistoryLoading(true);
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/mindmaps/${mindmapId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not delete the mind map."
        );
      }

      setSavedMindMaps((currentMaps) =>
        currentMaps.filter(
          (mindmap) => mindmap.id !== mindmapId
        )
      );

      setError("✅ Mind map deleted successfully.");
    } catch (deleteError) {
      console.error(
        "Delete mind map error:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Could not delete the mind map."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const createMindMapExport = async () => {
    if (!mindmapRef.current || nodes.length === 0) {
      throw new Error("No mind map is available to export.");
    }

    const viewport =
      mindmapRef.current.querySelector(
        ".react-flow__viewport"
      );

    if (!viewport) {
      throw new Error(
        "Mind map viewport not found."
      );
    }

    // Calculate the exact bounds of every node so the export includes the
    // complete map rather than only the currently visible/zoomed area.
    const bounds = getNodesBounds(nodes);
    const padding = 60;
    const scale = Math.min(
      1.5,
      1800 / Math.max(bounds.width + padding * 2, 1),
      1200 / Math.max(bounds.height + padding * 2, 1)
    );

    const exportWidth = Math.ceil(
      (bounds.width + padding * 2) * scale
    );
    const exportHeight = Math.ceil(
      (bounds.height + padding * 2) * scale
    );

    const viewportTransform =
      getViewportForBounds(
        bounds,
        exportWidth,
        exportHeight,
        0.2,
        2,
        0
      );

    const previousTransform =
      viewport.style.transform;
    const previousWidth = viewport.style.width;
    const previousHeight = viewport.style.height;

    try {
      viewport.style.width = `${exportWidth}px`;
      viewport.style.height = `${exportHeight}px`;
      viewport.style.transform =
        `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`;

      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );

      return await toPng(
        viewport,
        {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: exportWidth,
          height: exportHeight,
          style: {
            width: `${exportWidth}px`,
            height: `${exportHeight}px`,
            transform: viewport.style.transform,
            transformOrigin: "0 0",
          },
        }
      );
    } finally {
      viewport.style.transform = previousTransform;
      viewport.style.width = previousWidth;
      viewport.style.height = previousHeight;
    }
  };

  const downloadPng = async () => {
    if (!mindmapRef.current || nodes.length === 0) {
      return;
    }

    try {
      setError("");

      const dataUrl =
        await createMindMapExport();

      const link =
        document.createElement("a");

      const safeTitle = (
        mapTitle || "mindmap"
      )
        .replace(
          /[^a-z0-9]/gi,
          "_"
        )
        .toLowerCase();

      link.download = `${safeTitle}.png`;
      link.href = dataUrl;
      link.click();
    } catch (downloadError) {
      console.error(
        "PNG download error:",
        downloadError
      );

      setError(
        "Could not download the mind map as PNG."
      );
    }
  };

  const downloadPdf = async () => {
    if (!mindmapRef.current || nodes.length === 0) {
      return;
    }

    try {
      setError("");

      const dataUrl =
        await createMindMapExport();

      const image = new Image();

      image.src = dataUrl;

      await new Promise(
        (resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        }
      );

      const pdf = new jsPDF({
        orientation:
          image.width >=
          image.height
            ? "landscape"
            : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 8;

      const maxWidth =
        pageWidth - margin * 2;

      const maxHeight =
        pageHeight - margin * 2;

      const imageRatio =
        image.width / image.height;

      let pdfWidth = maxWidth;
      let pdfHeight =
        pdfWidth / imageRatio;

      if (pdfHeight > maxHeight) {
        pdfHeight = maxHeight;
        pdfWidth =
          pdfHeight * imageRatio;
      }

      const x =
        (pageWidth - pdfWidth) / 2;

      const y =
        (pageHeight - pdfHeight) / 2;

      pdf.addImage(
        dataUrl,
        "PNG",
        x,
        y,
        pdfWidth,
        pdfHeight
      );

      const safeTitle = (
        mapTitle || "mindmap"
      )
        .replace(
          /[^a-z0-9]/gi,
          "_"
        )
        .toLowerCase();

      pdf.save(
        `${safeTitle}.pdf`
      );
    } catch (downloadError) {
      console.error(
        "PDF download error:",
        downloadError
      );

      setError(
        "Could not download the mind map as PDF."
      );
    }
  };

  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const mapStats = useMemo(
    () => [
      {
        number: nodeCount,
        label: "Concepts",
      },
      {
        number: edgeCount,
        label: "Connections",
      },
      {
        number:
          detailLevel === "quick"
            ? "Quick"
            : detailLevel ===
              "detailed"
            ? "Deep"
            : "Balanced",
        label: "Mode",
      },
    ],
    [
      nodeCount,
      edgeCount,
      detailLevel,
    ]
  );

  const currentQuizQuestion =
    quizQuestions[quizIndex];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <div className="brand-icon">
            🧠
          </div>

          <div>
            <div className="brand-name">
              MindMap AI
            </div>

            <div className="brand-subtitle">
              Smart Learning
            </div>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>
          AI Ready
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-badge">
            ✨ AI-Powered Learning
          </div>

          <h1>
            Turn knowledge into a
            <span> visual map.</span>
          </h1>

          <p>
            Transform study material into
            an interactive, structured mind
            map with Gemini AI.
          </p>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <h2>
                Create your mind map
              </h2>

              <p>
                Add your study material
                below.
              </p>
            </div>
          </div>

          <div className="input-panel">
            <div className="input-top">
              <div className="input-label">
                Study material
              </div>

              <div className="upload-actions">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={uploadPdf}
                />

                <button
                  className="upload-button"
                  onClick={() =>
                    pdfInputRef.current?.click()
                  }
                  disabled={
                    pdfUploading ||
                    docxUploading
                  }
                >
                  <span>📄</span>
                  PDF
                </button>

                <input
                  ref={docxInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  hidden
                  onChange={uploadDocx}
                />

                <button
                  className="upload-button"
                  onClick={() =>
                    docxInputRef.current?.click()
                  }
                  disabled={
                    pdfUploading ||
                    docxUploading
                  }
                >
                  <span>📝</span>
                  DOCX
                </button>
              </div>
            </div>

            <textarea
              className="study-input"
              value={content}
              onChange={handleTextChange}
              placeholder="Paste your notes, chapter, article or study material here..."
            />

            {(selectedPdf ||
              selectedDocx) && (
              <div className="selected-file">
                <span>
                  {selectedPdf
                    ? "📄"
                    : "📝"}
                </span>

                <span>
                  {selectedPdf
                    ? selectedPdf.name
                    : selectedDocx.name}
                </span>

                {(pdfUploading ||
                  docxUploading) && (
                  <span className="uploading-text">
                    Extracting text...
                  </span>
                )}
              </div>
            )}

            <div className="input-footer">
              <span className="input-hint">
                Supports text, PDF and DOCX
              </span>

              <span className="character-count">
                {content.length} characters
              </span>
            </div>
          </div>

          <div className="options-panel">
            <div className="detail-header">
              <div>
                <h3>
                  Map detail
                </h3>

                <p>
                  Choose how deeply AI should
                  analyze your material.
                </p>
              </div>
            </div>

            <div className="detail-options">
              <button
                className={
                  detailLevel === "quick"
                    ? "detail-option active"
                    : "detail-option"
                }
                onClick={() =>
                  setDetailLevel("quick")
                }
              >
                <span className="detail-icon">
                  ⚡
                </span>

                <span>
                  <strong>
                    Quick
                  </strong>

                  <small>
                    Key concepts only
                  </small>
                </span>
              </button>

              <button
                className={
                  detailLevel ===
                  "balanced"
                    ? "detail-option active recommended"
                    : "detail-option recommended"
                }
                onClick={() =>
                  setDetailLevel(
                    "balanced"
                  )
                }
              >
                <span className="detail-icon">
                  ◉
                </span>

                <span>
                  <strong>
                    Balanced
                  </strong>

                  <small>
                    Best for studying
                  </small>
                </span>

                <span className="recommended-label">
                  Recommended
                </span>
              </button>

              <button
                className={
                  detailLevel ===
                  "detailed"
                    ? "detail-option active"
                    : "detail-option"
                }
                onClick={() =>
                  setDetailLevel(
                    "detailed"
                  )
                }
              >
                <span className="detail-icon">
                  ✦
                </span>

                <span>
                  <strong>
                    Detailed
                  </strong>

                  <small>
                    Deep topic breakdown
                  </small>
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <div className="generate-actions">
            <button
              className="generate-button"
              onClick={generateMindMap}
              disabled={
                loading ||
                pdfUploading ||
                docxUploading
              }
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Generating mind map...
                </>
              ) : (
                <>
                  ✨ Generate Mind Map
                </>
              )}
            </button>

            {(content ||
              nodes.length > 0) && (
              <button
                className="clear-button"
                onClick={clearAll}
              >
                Clear
              </button>
            )}

            {nodes.length > 0 && (
              <button
                className="clear-button"
                onClick={saveMindMap}
              >
                💾 Save Mind Map
              </button>
            )}
          </div>
        </section>

        {nodes.length > 0 && (
          <section className="mindmap-section">
            <div className="mindmap-header">
              <div>
                <span className="section-tag">
                  AI GENERATED
                </span>

                <h2>
                  {mapTitle ||
                    "Your Mind Map"}
                </h2>

                {summary && (
                  <p>{summary}</p>
                )}
              </div>

              <div className="map-statistics">
                {mapStats.map(
                  (stat, index) => (
                    <div
                      className="stat-item"
                      key={index}
                    >
                      <strong>
                        {stat.number}
                      </strong>

                      <span>
                        {stat.label}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="edit-hint">
              💡 Double-click a node to edit
              its text. Use the controls to
              zoom and navigate.
            </div>

            <button
              className="clear-button"
              onClick={addNode}
            >
              ➕ Add Node
            </button>
            
            <button
              className="clear-button"
              onClick={addChildNode}
            >
              🌱 Add Child
            </button>
            <button
              className="clear-button"
              onClick={startConnectMode}
            >
              🔗 Connect Nodes
            </button>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                width: "100%",
                marginTop: "12px",
                marginBottom: "8px",
              }}
            >
              <input
                type="text"
                value={searchNodeText}
                onChange={(event) =>
                  setSearchNodeText(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    searchNode();
                  }
                }}
                placeholder="🔍 Search node..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />

              <button
                type="button"
                className="clear-button"
                onClick={searchNode}
              >
                🔍 Search
              </button>
            </div>
            <button
              className="clear-button"
              onClick={
                deleteSelectedNode
              }
            >
              🗑️ Delete Node
            </button>
            <button
              className="clear-button"
              onClick={undoChanges}
              disabled={history.length === 0}
            >
              ↩️ Undo
            </button>

            <button
              className="clear-button"
              onClick={redoChanges}
              disabled={future.length === 0}
            >
              ↪️ Redo
            </button>

            {nodes.some((node) => node.selected) && (
              <button
                className="clear-button"
                onClick={() => {
                  const selectedNode = nodes.find(
                    (node) => node.selected
                  );

                  if (selectedNode) {
                    explainNode(selectedNode);
                  }
                }}
              >
                🧠 Explain Node
              </button>
            )}
            {nodes.some((node) => node.selected) && (
              <button
                className="clear-button"
                onClick={() => {
                  const selectedNode = nodes.find(
                    (node) => node.selected
                  );

                  if (selectedNode) {
                    setAppearanceNode(selectedNode.id);
                    setNodeColor(
                      selectedNode.style?.background || "#ffffff"
                    );
                  }
                }}
              >
                🎨 Customize Node
              </button>
            )}

            <button
              className="clear-button"
              onClick={generateQuiz}
              disabled={quizLoading}
            >
              {quizLoading
                ? "🧠 Generating Quiz..."
                : "📝 Generate Quiz"}
            </button>
            <button
              className="clear-button"
              onClick={() => {
                setAskAIOpen(true);
                setAskAIAnswer("");
                setAskAIQuestion("");
                setError("");
              }}
            >
              🤖 Ask AI
            </button>

            <div
              className="mindmap-container"
              ref={mindmapRef}
            >
              <ReactFlow
              onInit={(instance) => setReactFlowInstance(instance)}
                nodes={nodes}
                edges={edges}
                onNodesChange={
                  onNodesChange
                }
                onEdgesChange={
                  onEdgesChange
                }
                onConnect={onConnect}
                onNodeDragStart={() => saveHistory()}
                onNodeDoubleClick={
                  startEditing
                }
                onNodeClick={handleNodeClickForConnection}
                onEdgeClick={(event, edge) => {
                  setEditingEdge(edge.id);
                  setEditingEdgeLabel(edge.label || "");
                }}
                fitView
                fitViewOptions={{
                  padding: 0.15,
                }}
                minZoom={0.2}
                maxZoom={2}
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

              {editingNode && (
                <div className="edit-overlay">
                  <div className="edit-box">
                    <div className="edit-title">
                      Edit concept
                    </div>

                    <input
                      autoFocus
                      value={editingText}
                      onChange={(
                        event
                      ) =>
                        setEditingText(
                          event.target
                            .value
                        )
                      }
                      onKeyDown={
                        handleEditKeyDown
                      }
                    />

                    <div className="edit-actions">
                      <button
                        onClick={() => {
                          setEditingNode(
                            null
                          );
                          setEditingText(
                            ""
                          );
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        className="save-edit"
                        onClick={
                          saveNodeEdit
                        }
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {explainingNode && (
                <div className="edit-overlay">
                  <div
                    className="edit-box"
                    style={{
                      maxWidth: "650px",
                      maxHeight: "80vh",
                      overflowY: "auto",
                    }}
                  >
                    <div className="edit-title">
                      🧠 {explainingNode.data.label}
                    </div>

                    {explanationLoading ? (
                      <p>
                        Loading explanation...
                      </p>
                    ) : nodeExplanation ? (
                      <>
                        <h4>
                          📖 Explanation
                        </h4>

                        <p>
                          {nodeExplanation.explanation}
                        </p>

                        <h4>
                          🔑 Key Points
                        </h4>

                        <ul>
                          {nodeExplanation.key_points?.map(
                            (point, index) => (
                              <li key={index}>
                                {point}
                              </li>
                            )
                          )}
                        </ul>

                        <h4>
                          💡 Example
                        </h4>

                        <p>
                          {nodeExplanation.example}
                        </p>

                        <h4>
                          🌍 Real World Application
                        </h4>

                        <p>
                          {
                            nodeExplanation.real_world_application
                          }
                        </p>
                      </>
                    ) : (
                      <p>
                        No explanation available.
                      </p>
                    )}

                    <div className="edit-actions">
                      <button
                        className="save-edit"
                        onClick={() => {
                          setExplainingNode(null);
                          setNodeExplanation(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {appearanceNode && (
                <div className="edit-overlay">
                  <div className="edit-box">
                    <div className="edit-title">
                      🎨 Customize Node
                    </div>
                  <p>
                    Choose a background color for this node.
                  </p>

                  <input
                    type="color"
                    value={nodeColor}
                    onChange={(event) =>
                      setNodeColor(event.target.value)
                    }
                    style={{
                      width: "100%",
                      height: "60px",
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                    }}
                  />

                  <div className="edit-actions">
                    <button
                      onClick={() => {
                        setAppearanceNode(null);
                      }}
                    >  
                      Cancel
                    </button>

                    <button
                      className="save-edit"
                      onClick={saveNodeAppearance}
                    >
                      Save
                    </button>
                    </div>
                  </div>
                </div>
              )}
              {editingEdge && (
                <div className="edit-overlay">
                  <div className="edit-box">
                    <div className="edit-title">
                      🔗 Edit Relationship
                    </div>

                    <p>
                      Change the relationship between these nodes.
                    </p>

                    <input
                      type="text"
                      value={editingEdgeLabel}
                      onChange={(event) =>
                        setEditingEdgeLabel(event.target.value)
                      }
                      placeholder="Example: causes, contains, depends on"
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontFamily: "inherit",
                        fontSize: "15px",
                        boxSizing: "border-box",
                      }}
                    />

                    <div className="edit-actions">
                      <button
                        onClick={() => {
                          setEditingEdge(null);
                          setEditingEdgeLabel("");
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        className="save-edit"
                        onClick={saveEdgeLabel}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
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
                onClick={downloadPng}
              >
                ⬇ Download PNG
              </button>

              <button
                className="clear-button"
                onClick={downloadPdf}
              >
                📄 Download PDF
              </button>
            </div>
          </section>
        )}

        <section
          className="saved-maps-section"
          style={{ marginTop: "35px" }}
        >
          <div className="section-heading">
            <div>
              <h2>
                📚 Saved Mind Maps
              </h2>

              <p>
                Open a previously saved
                mind map and continue
                editing.
              </p>
            </div>

            <button
              className="clear-button"
              onClick={
                loadSavedMindMaps
              }
              disabled={
                historyLoading
              }
            >
              🔄 Refresh
            </button>
          </div>

          {historyLoading &&
            savedMindMaps.length ===
              0 && (
              <div className="edit-hint">
                Loading saved mind maps...
              </div>
            )}

          {!historyLoading &&
            savedMindMaps.length ===
              0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  📚
                </div>

                <h3>
                  No saved mind maps yet
                </h3>

                <p>
                  Generate and save a mind
                  map to see it here.
                </p>
              </div>
            )}

          {savedMindMaps.length >
            0 && (
            <div className="saved-maps-list">
              {savedMindMaps.map(
                (mindmap) => (
                  <div
                    key={mindmap.id}
                    className="saved-map-item"
                  >
                    <div className="saved-map-info">
                      <h3 className="saved-map-title">
                        {mindmap.title}
                      </h3>

                      <div className="saved-map-date">
                        Saved on{" "}
                        {new Date(
                          mindmap.created_at
                        ).toLocaleString()}
                      </div>
                    </div>

                    <button
                      className="clear-button saved-map-open"
                      onClick={() =>
                        loadMindMap(
                          mindmap.id
                        )
                      }
                      disabled={
                        historyLoading
                      }
                    >
                      📂 Open
                    </button>

                    <button
                      className="clear-button"
                      onClick={() =>
                        deleteSavedMindMap(
                          mindmap.id
                        )
                      }
                      disabled={historyLoading}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <StudyPack
          content={content}
          fileName={selectedPdf?.name || selectedDocx?.name || ""}
        />

        <StudyTools
          content={content}
          mindMap={{ title: mapTitle, summary, nodes, edges }}
          savedMindMaps={savedMindMaps}
        />

        {nodes.length === 0 && (
          <section className="empty-state">
            <div className="empty-icon">
              🧠
            </div>

            <h3>
              Your mind map will appear
              here
            </h3>

            <p>
              Add study material above
              and click
              <strong>
                {" "}
                Generate Mind Map{" "}
              </strong>
              to get started.
            </p>
          </section>
        )}

        <section className="features-section">
          <div className="feature">
            <div className="feature-icon">
              ✨
            </div>

            <div>
              <h3>
                AI Powered
              </h3>

              <p>
                Gemini AI understands and
                organizes your study material.
              </p>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">
              🗂️
            </div>

            <div>
              <h3>
                Smart Structure
              </h3>

              <p>
                Automatically identifies
                topics, subtopics and
                relationships.
              </p>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">
              🖱️
            </div>

            <div>
              <h3>
                Interactive
              </h3>

              <p>
                Explore, zoom and edit your
                generated knowledge map.
              </p>
            </div>
          </div>
        </section>
      </main>

      {quizOpen && currentQuizQuestion && (
        <div className="edit-overlay">
          <div
            className="edit-box"
            style={{
              maxWidth: "700px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {!quizFinished ? (
              <>
                <div className="edit-title">
                  📝 AI Quiz
                </div>

                <p>
                  Question{" "}
                  {quizIndex + 1} of{" "}
                  {quizQuestions.length}
                </p>

                <h3>
                  {currentQuizQuestion.question}
                </h3>

                <div>
                  {currentQuizQuestion.options.map(
                    (option, index) => {
                      const isSelected =
                        selectedAnswer === option;

                      const isCorrect =
                        option ===
                        currentQuizQuestion.correct_answer;

                      let optionStyle = {
                        display: "block",
                        width: "100%",
                        marginBottom: "10px",
                        padding: "12px",
                        textAlign: "left",
                        cursor:
                          selectedAnswer === null
                            ? "pointer"
                            : "default",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        backgroundColor:
                          "#ffffff",
                      };

                      if (
                        selectedAnswer !== null &&
                        isCorrect
                      ) {
                        optionStyle = {
                          ...optionStyle,
                          backgroundColor:
                            "#dcfce7",
                          border:
                            "1px solid #16a34a",
                        };
                      } else if (
                        isSelected &&
                        option !==
                          currentQuizQuestion.correct_answer
                      ) {
                        optionStyle = {
                          ...optionStyle,
                          backgroundColor:
                            "#fee2e2",
                          border:
                            "1px solid #dc2626",
                        };
                      }

                      return (
                        <button
                          key={index}
                          style={optionStyle}
                          onClick={() =>
                            selectQuizAnswer(
                              option
                            )
                          }
                          disabled={
                            selectedAnswer !==
                            null
                          }
                        >
                          {String.fromCharCode(
                            65 + index
                          )}
                          . {option}
                        </button>
                      );
                    }
                  )}
                </div>

                {selectedAnswer !== null && (
                  <div>
                    <p>
                      {selectedAnswer ===
                      currentQuizQuestion.correct_answer
                        ? "✅ Correct!"
                        : `❌ Correct answer: ${currentQuizQuestion.correct_answer}`}
                    </p>

                    <p>
                      <strong>
                        Explanation:
                      </strong>{" "}
                      {
                        currentQuizQuestion.explanation
                      }
                    </p>
                  </div>
                )}

                <div className="edit-actions">
                  <button
                    onClick={closeQuiz}
                  >
                    Close
                  </button>

                  {selectedAnswer !== null && (
                    <button
                      className="save-edit"
                      onClick={
                        nextQuizQuestion
                      }
                    >
                      {quizIndex <
                      quizQuestions.length - 1
                        ? "Next Question"
                        : "Finish Quiz"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="edit-title">
                  🎉 Quiz Complete!
                </div>

                <h2>
                  Your Score
                </h2>

                <p>
                  You scored{" "}
                  <strong>
                    {quizScore}
                  </strong>{" "}
                  out of{" "}
                  <strong>
                    {quizQuestions.length}
                  </strong>
                </p>

                <p>
                  {quizScore ===
                  quizQuestions.length
                    ? "🏆 Excellent! Perfect score!"
                    : quizScore >=
                      quizQuestions.length / 2
                    ? "👏 Good job! Keep learning!"
                    : "📚 Keep practicing and try again!"}
                </p>

                <div className="edit-actions">
                  <button
                    onClick={closeQuiz}
                  >
                    Close
                  </button>

                  <button
                    className="save-edit"
                    onClick={restartQuiz}
                  >
                    🔄 Restart Quiz
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
            {askAIOpen && (
        <div className="edit-overlay">
          <div
            className="edit-box"
            style={{
              maxWidth: "700px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div className="edit-title">
              🤖 Ask AI
            </div>

            <p>
              Ask a question about your study material.
            </p>

            <textarea
              value={askAIQuestion}
              onChange={(event) =>
                setAskAIQuestion(event.target.value)
              }
              placeholder="Ask something about your study material..."
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: "15px",
                boxSizing: "border-box",
              }}
            />

            {askAIAnswer && (
              <div style={{ marginTop: "20px" }}>
                <h4>💡 AI Answer</h4>

                <p>
                  {askAIAnswer}
                </p>
              </div>
            )}

            <div className="edit-actions">
              <button
                onClick={() => {
                  setAskAIOpen(false);
                  setAskAIQuestion("");
                  setAskAIAnswer("");
                }}
              >
                Close
              </button>

              <button
                className="save-edit"
                onClick={askAI}
                disabled={askAILoading}
              >
                {askAILoading
                  ? "🤖 Thinking..."
                  : "✨ Ask AI"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
