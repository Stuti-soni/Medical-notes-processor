"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isAuthenticated, clearToken } from "@/lib/auth";
import { UploadsTable } from "@/components/uploads-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];

export default function DashboardPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUploads = useCallback(async () => {
    try {
      const data = await api.listUploads();
      setUploads(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchUploads();
  }, [fetchUploads, router]);

  useEffect(() => {
    const hasActive = uploads.some(u => ACTIVE_STATUSES.includes(u.status));
    if (!hasActive) return;
    const interval = setInterval(fetchUploads, 4000);
    return () => clearInterval(interval);
  }, [uploads, fetchUploads]);

  const completed = uploads.filter(u => u.status === "COMPLETED").length;
  const processing = uploads.filter(u => ACTIVE_STATUSES.includes(u.status)).length;

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">MedNotes AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/upload">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Note
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={handleLogout} className="text-gray-500">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage and review your processed medical notes</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Uploads</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{uploads.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{completed}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Processing</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{processing}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {loading
              ? <p className="text-gray-400 text-sm py-4 text-center">Loading...</p>
              : <UploadsTable uploads={uploads} />
            }
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
