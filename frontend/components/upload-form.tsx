"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ALLOWED = [".pdf", ".txt", ".png", ".jpg", ".jpeg"];

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function validateAndSet(f: File) {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setError(`Unsupported file type. Allowed: ${ALLOWED.join(", ")}`);
      return;
    }
    setError("");
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(30);
    try {
      setProgress(60);
      const { upload_id } = await api.uploadFile(file);
      setProgress(100);
      router.push(`/results/${upload_id}`);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-xl cursor-pointer transition-all p-10 text-center
          ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          {file ? (
            <div>
              <p className="font-medium text-blue-600">{file.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">Drop your file here or <span className="text-blue-600">browse</span></p>
              <p className="text-sm text-gray-400 mt-0.5">PDF, TXT, PNG, JPG supported</p>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.png,.jpg,.jpeg"
        className="hidden"
        onChange={e => e.target.files?.[0] && validateAndSet(e.target.files[0])}
      />

      {uploading && (
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 text-center">Uploading and queuing for processing...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-blue-600 hover:bg-blue-700 h-11"
      >
        {uploading ? "Uploading..." : "Upload & Process"}
      </Button>
    </div>
  );
}
