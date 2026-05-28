"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

interface Upload {
  upload_id: string;
  file_name: string;
  status: string;
  created_at: string;
}

export function UploadsTable({ uploads }: { uploads: Upload[] }) {
  if (uploads.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">No uploads yet</p>
        <p className="text-gray-400 text-xs mt-1">Upload your first medical note to get started</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="pb-3 font-medium text-gray-500">File</th>
          <th className="pb-3 font-medium text-gray-500">Status</th>
          <th className="pb-3 font-medium text-gray-500">Uploaded</th>
          <th className="pb-3 font-medium text-gray-500 text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {uploads.map(u => (
          <tr key={u.upload_id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="max-w-xs truncate font-medium text-gray-800">{u.file_name}</span>
              </div>
            </td>
            <td className="py-3"><StatusBadge status={u.status} /></td>
            <td className="py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleString()}</td>
            <td className="py-3 text-right">
              <Link
                href={`/results/${u.upload_id}`}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
              >
                View results →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
