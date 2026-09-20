import React, { useEffect, useState } from "react";
const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";
function SavedStudyPacks({ onOpenStudyPack }) {
  const [studyPacks, setStudyPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStudyPacks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE}/api/study-packs');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load saved Study Packs.");
      }

      setStudyPacks(data.study_packs || []);
    } catch (err) {
      setError(err.message || "Could not load saved Study Packs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudyPacks();
  }, []);

  const openStudyPack = async (id) => {
    try {
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/study-packs/${id}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not open Study Pack.");
      }

      if (onOpenStudyPack) {
        onOpenStudyPack(data.study_pack);
      }
    } catch (err) {
      setError(err.message || "Could not open Study Pack.");
    }
  };

  const deleteStudyPack = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this Study Pack?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `http://127.0.0.1:8000/api/study-packs/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not delete Study Pack.");
      }

      setStudyPacks((current) =>
        current.filter((studyPack) => studyPack.id !== id)
      );
    } catch (err) {
      setError(err.message || "Could not delete Study Pack.");
    }
  };

  return (
    <section
      style={{
        marginTop: "35px",
        padding: "24px",
        borderRadius: "18px",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            View and reopen your previously saved study materials.
          </p>
        </div>

        <button
          onClick={loadStudyPacks}
          style={{
            padding: "9px 14px",
            borderRadius: "9px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div
          style={{
            padding: "25px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          Loading saved Study Packs...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: "14px",
            borderRadius: "10px",
            background: "#fef2f2",
            color: "#b91c1c",
            marginBottom: "15px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && studyPacks.length === 0 && (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            border: "1px dashed #cbd5e1",
            borderRadius: "12px",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "30px", marginBottom: "8px" }}>📚</div>

          <div
            style={{
              fontWeight: 600,
              color: "#334155",
              marginBottom: "5px",
            }}
          >
            No saved Study Packs yet
          </div>

          <div style={{ fontSize: "14px" }}>
            Generate a Study Pack and click Save Study Pack to see it here.
          </div>
        </div>
      )}

      {!loading && studyPacks.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {studyPacks.map((studyPack) => (
            <div
              key={studyPack.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "15px",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                background: "#f8fafc",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  📖 {studyPack.title || "Untitled Study Pack"}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Saved:{" "}
                  {studyPack.created_at
                    ? new Date(studyPack.created_at).toLocaleString()
                    : "Unknown date"}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <button
                  onClick={() => openStudyPack(studyPack.id)}
                  style={{
                    padding: "8px 13px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  📂 Open
                </button>

                <button
                  onClick={() => deleteStudyPack(studyPack.id)}
                  style={{
                    padding: "8px 13px",
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                    background: "#ffffff",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default SavedStudyPacks;
