interface TimelineEvent {
  event_type: string;
  message: string;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-400",
  STARTED: "bg-blue-500",
  COMPLETED: "bg-green-500",
  RETRYING: "bg-orange-400",
  FAILED: "bg-red-500",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {events.map((e, i) => (
        <li key={i} className="ml-6">
          <span className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ${EVENT_COLORS[e.event_type] ?? "bg-gray-400"}`} />
          <p className="font-medium text-sm">{e.event_type}</p>
          <p className="text-gray-500 text-sm">{e.message}</p>
          <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
