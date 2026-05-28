"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { ResultsTabs } from "@/components/results-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "RETRYING"];

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusData, timelineData] = await Promise.all([
        api.getStatus(id),
        api.getTimeline(id),
      ]);
      setStatus(statusData);
      setEvents(timelineData.events);

      if (statusData.status === "COMPLETED") {
        const resultsData = await api.getResults(id);
        setTasks(resultsData.tasks);
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchData();
  }, [fetchData, router]);

  useEffect(() => {
    if (!status || !ACTIVE_STATUSES.includes(status.status)) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [status, fetchData]);

  useEffect(() => {
    if (!status || status.status === "COMPLETED" || status.status === "FAILED") return;
    const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws") ?? "ws://localhost:8000"}/ws/${id}`;
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus((prev: any) => prev ? { ...prev, status: data.status } : prev);
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        fetchData();
        socket.close();
      }
    };
    return () => socket.close();
  }, [status?.status, id, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const isActive = status && ACTIVE_STATUSES.includes(status.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">MedNotes AI</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-500 -ml-2 mb-4">
              ← Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Processing Results</h1>
            {status && <StatusBadge status={status.status} />}
          </div>
        </div>

        {isActive && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Processing your medical note...</p>
              <p className="text-xs text-blue-600 mt-0.5">This page updates automatically via WebSocket</p>
            </div>
          </div>
        )}

        {status?.status === "FAILED" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Processing failed after all retries</p>
              <p className="text-xs text-red-600 mt-0.5">Check the Timeline tab for details</p>
            </div>
          </div>
        )}

        <ResultsTabs tasks={tasks} events={events} />
      </main>
    </div>
  );
}
