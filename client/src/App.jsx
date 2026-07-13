import { useState, useRef, useEffect } from "react";

const API = "/api"; // vite proxy /api -> http://localhost:4000

function normalize(raw) {
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : "https://" + v;
}

function timestamp() {
  return new Date().toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function App() {
  const [input, setInput] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [record, setRecord] = useState(null);

  const [mode, setMode] = useState("url"); // "url" | "file"
  const [fileMeta, setFileMeta] = useState(null);
  const [fileBlobUrl, setFileBlobUrl] = useState("");
  const [docHtml, setDocHtml] = useState("");

  const [phase, setPhase] = useState("idle"); // idle | loading | ready | exporting | captured | error
  const [errorMsg, setErrorMsg] = useState("");
  const [stampedAt, setStampedAt] = useState("");
  const captureTimer = useRef(null);
  const fileInputRef = useRef(null);
  const blobUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const resetFileState = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = "";
    }
    setFileMeta(null);
    setFileBlobUrl("");
    setDocHtml("");
  };

  const preview = async () => {
    if (!input.trim()) return;
    resetFileState();
    setMode("url");
    const url = normalize(input);
    setActiveUrl(url);
    setRecord(null);
    setPhase("loading");
    setErrorMsg("");
    try {
      const r = await fetch(`${API}/page?url=${encodeURIComponent(url)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Request failed");
      setRecord(data);
      setPhase("ready");
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("error");
    }
  };

  const exportPdf = () => {
    if (!activeUrl || mode !== "url") return;
    setPhase("exporting");
    window.location.href = `${API}/pdf?url=${encodeURIComponent(activeUrl)}`;
    clearTimeout(captureTimer.current);
    captureTimer.current = setTimeout(() => {
      setStampedAt(timestamp());
      setPhase("captured");
    }, 1800);
  };

  const onKey = (e) => e.key === "Enter" && preview();

  const openFilePicker = () => fileInputRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    resetFileState();
    setMode("file");
    setActiveUrl("");
    setRecord(null);
    setErrorMsg("");
    setPhase("loading");
    setFileMeta({ name: file.name, size: file.size, type: file.type });

    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      const blobUrl = URL.createObjectURL(file);
      blobUrlRef.current = blobUrl;
      setFileBlobUrl(blobUrl);
      setPhase("ready");
      return;
    }

    if (ext === "docx") {
      try {
        if (!window.mammoth) throw new Error("Document reader library failed to load");
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer });
        setDocHtml(result.value);
        setPhase("ready");
      } catch (err) {
        setErrorMsg("Could not read this document: " + err.message);
        setPhase("error");
      }
      return;
    }

    if (ext === "doc") {
      setErrorMsg("The older .doc format can't be read in-browser — please use .docx or PDF.");
      setPhase("error");
      return;
    }

    setErrorMsg("Unsupported file type. Upload a PDF or DOCX file.");
    setPhase("error");
  };

  return (
    <div className="h-screen flex flex-col bg-paper text-ink font-sans overflow-hidden">
      {/* Brand strip */}
      <header className="border-b border-line px-6 py-4 flex items-baseline justify-between shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-2xl tracking-tight">Folio</h1>
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Full-page capture
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted hidden sm:block">
          Record-grade PDF export
        </span>
      </header>

      {/* Control strip */}
      <div className="border-b border-line bg-white px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 flex items-center border border-line px-3 py-2.5 bg-paper">
            <span className="text-muted font-mono text-xs mr-2 select-none">URL</span>
            <input
              className="flex-1 bg-transparent outline-none font-mono text-sm text-ink placeholder:text-muted/70"
              placeholder="e.g. en.wikipedia.org/wiki/Maharana_Pratap"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
            />
          </div>
          <button
            onClick={preview}
            className="px-5 py-2.5 border border-ink text-sm font-medium tracking-wide hover:bg-ink hover:text-paper transition-colors"
          >
            Preview
          </button>
          <button
            onClick={openFilePicker}
            className="px-5 py-2.5 border border-line text-sm font-medium tracking-wide hover:border-ink transition-colors"
          >
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            onClick={exportPdf}
            disabled={!record || mode !== "url"}
            className="px-5 py-2.5 bg-navy text-paper text-sm font-medium tracking-wide hover:brightness-110 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Body — fills remaining screen height */}
      <main className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Preview pane with registration corner marks */}
        <section className="relative min-h-0 h-full">
          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-ink/40 z-10" />
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-ink/40 z-10" />
          <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-ink/40 z-10" />
          <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-ink/40 z-10" />

          <div className="border border-line bg-white h-full overflow-hidden">
            {mode === "url" && activeUrl && (
              <iframe
                src={activeUrl}
                title="preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-scripts allow-forms"
              />
            )}

            {mode === "file" && fileBlobUrl && (
              <iframe src={fileBlobUrl} title="file preview" className="w-full h-full border-0" />
            )}

            {mode === "file" && docHtml && (
              <div
                className="doc-content w-full h-full overflow-y-auto px-10 py-8"
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            )}

            {!activeUrl && !fileBlobUrl && !docHtml && (
              <div className="h-full flex items-center justify-center text-center px-10">
                <p className="text-sm text-muted leading-relaxed max-w-xs">
                  Enter a URL and select <span className="text-ink">Preview</span>, or{" "}
                  <span className="text-ink">Upload a file</span> (PDF or DOCX) to read it here.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Record / index card panel */}
        <aside className="border border-line bg-white p-5 h-full overflow-y-auto relative">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted border-b border-line pb-2 mb-4">
            Record
          </h2>

          {phase === "loading" && <p className="text-sm text-muted">Reading&hellip;</p>}

          {phase === "error" && <p className="text-sm text-seal">{errorMsg}</p>}

          {mode === "url" && record && phase !== "loading" && (
            <div className="space-y-4">
              <Field label="Title" value={record.title} serif />
              <Field label="Source" value={record.url} mono small />
              <Field label="Word count" value={record.words.toLocaleString()} mono />
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-line pb-1.5 mb-1.5">
                  Excerpt
                </div>
                <p className="text-[13px] text-muted leading-relaxed line-clamp-6">
                  {record.preview}&hellip;
                </p>
              </div>
            </div>
          )}

          {mode === "file" && fileMeta && phase !== "loading" && phase !== "error" && (
            <div className="space-y-4">
              <Field label="File name" value={fileMeta.name} serif />
              <Field label="Size" value={formatBytes(fileMeta.size)} mono />
              <Field
                label="Type"
                value={fileMeta.name.split(".").pop().toUpperCase()}
                mono
              />
              <p className="text-[13px] text-muted leading-relaxed">
                Opened directly in your browser — this file never left your device.
              </p>
            </div>
          )}

          {!record && !fileMeta && phase !== "loading" && phase !== "error" && (
            <p className="text-sm text-muted leading-relaxed">
              This panel lists page or file details once something has been opened. URL exports
              produce a faithful, full-length print of the page — not a reflowed text summary.
              Uploaded PDFs and DOCX files open for reading only.
            </p>
          )}

          {phase === "exporting" && (
            <p className="mt-4 text-xs text-muted">Rendering full page for export&hellip;</p>
          )}

          {/* Archival stamp — appears once a PDF export completes */}
          {phase === "captured" && (
            <div className="pointer-events-none absolute right-4 bottom-4 rotate-[-9deg] animate-[stampIn_0.35s_ease-out]">
              <div className="border-[3px] border-seal text-seal px-3 py-1.5 text-center">
                <div className="font-serif text-sm tracking-[0.1em] leading-none">CAPTURED</div>
                <div className="font-mono text-[9px] tracking-wide mt-1">{stampedAt}</div>
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="border-t border-line px-6 py-2.5 text-center shrink-0">
        <p className="text-[11px] text-muted">
          Some sites restrict inline preview — the panel may appear blank, but export still works
          since the PDF is rendered independently on the server.
        </p>
      </footer>

      <style>{`
        @keyframes stampIn {
          from { opacity: 0; transform: scale(1.4) rotate(-9deg); }
          to   { opacity: 1; transform: scale(1) rotate(-9deg); }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value, mono, serif, small }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted border-b border-line pb-1.5 mb-1.5">
        {label}
      </div>
      <p
        className={
          (mono ? "font-mono " : serif ? "font-serif " : "") +
          (small ? "text-[12px] break-all" : "text-sm") +
          " text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}
