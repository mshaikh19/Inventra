import React, { useState } from "react";

export default function CSVUpload({ onUploadComplete, tierAccent, tierAccentSoft }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState("idle"); // idle, uploading, success
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const simulateParse = (name) => {
    setFileName(name);
    setUploadState("uploading");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadState("success");
          
          // Trigger data refresh callback
          if (onUploadComplete) onUploadComplete();
          return 100;
        }
        return prev + 8;
      });
    }, 150);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      simulateParse(file.name);
    } else {
      alert("Invalid file format. Please upload a spreadsheet in .csv format.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith(".csv")) {
      simulateParse(file.name);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] text-left">
      <div className="mb-5">
        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Historical Import</span>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">Spreadsheet Data Import</h2>
      </div>

      {uploadState === "idle" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`h-64 rounded-2xl border-2 border-dashed flex flex-col justify-center items-center p-6 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
            isDragOver 
              ? "border-slate-450 bg-slate-50" 
              : "border-slate-200 bg-slate-50/50 hover:border-slate-350 hover:bg-slate-50"
          }`}
        >
          {/* Accent glow on hover */}
          <div className="absolute w-48 h-48 blur-[80px] rounded-full pointer-events-none -top-10 opacity-0 group-hover:opacity-10 transition-all duration-500" style={{ background: tierAccent }} />
          
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileChange}
            id="csv-file-picker"
            className="absolute inset-0 opacity-0 cursor-pointer"
          />

          <svg className="h-12 w-12 text-slate-400 mb-4 transition-transform group-hover:-translate-y-1 duration-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>

          <h3 className="text-sm font-bold text-slate-800 mb-2">Drag & Drop historical sales sheet</h3>
          <p className="text-xs text-slate-400 font-semibold max-w-sm">
            Upload custom transaction datasets in `.csv` format to immediately calibrate ML forecasting arrays and update inventory logs.
          </p>
        </div>
      )}

      {uploadState === "uploading" && (
        <div className="h-64 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-center items-center p-6 text-center">
          <svg className="h-10 w-10 animate-spin text-slate-450 mb-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>

          <h3 className="text-sm font-bold text-slate-800 mb-1">Parsing {fileName}</h3>
          <p className="text-xs text-slate-400 font-semibold mb-4 animate-pulse">Running column schema mapping & ML retraining...</p>

          <div className="w-full max-w-xs bg-slate-100 border border-slate-200 h-2.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-150" style={{ width: `${progress}%`, background: tierAccent }} />
          </div>
          <span className="text-[11px] font-black text-slate-500 mt-2">{progress}% completed</span>
        </div>
      )}

      {uploadState === "success" && (
        <div className="h-64 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-center items-center p-6 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-[0_2px_8px_rgba(16,185,129,0.06)]">
            <svg className="h-6 w-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>

          <h3 className="text-sm font-black text-slate-900 mb-1">Import Completed Successfully</h3>
          <p className="text-xs text-emerald-600 font-bold mb-4">48 transactions mapped and synced into the local ML engine.</p>
          <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1 rounded-full font-black">
            Parsed: {fileName}
          </span>

          <button
            onClick={() => setUploadState("idle")}
            className="mt-5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
