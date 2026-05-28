const STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  PENDING:    { dot: "bg-yellow-400", text: "text-yellow-700", label: "Pending" },
  PROCESSING: { dot: "bg-blue-500 animate-pulse", text: "text-blue-700", label: "Processing" },
  COMPLETED:  { dot: "bg-green-500", text: "text-green-700", label: "Completed" },
  FAILED:     { dot: "bg-red-500", text: "text-red-700", label: "Failed" },
  RETRYING:   { dot: "bg-orange-400 animate-pulse", text: "text-orange-700", label: "Retrying" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { dot: "bg-gray-400", text: "text-gray-600", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
