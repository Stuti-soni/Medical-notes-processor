"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { UploadForm } from "@/components/upload-form";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">MedNotes AI</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-500 mb-4 -ml-2">
              ← Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Upload Medical Note</h1>
          <p className="text-gray-500 mt-1">Upload a PDF, image, or text file to extract structured tasks</p>
        </div>
        <UploadForm />
      </main>
    </div>
  );
}
