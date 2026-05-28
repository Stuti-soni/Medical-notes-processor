"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/timeline";

interface Task {
  task_type: string;
  task_name: string;
  confidence_score: number;
}

interface Event {
  event_type: string;
  message: string;
  created_at: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  LAB_TEST: "Lab Test",
  RADIOLOGY: "Radiology",
  FOLLOW_UP: "Follow-Up",
};

const TASK_TYPE_COLORS: Record<string, string> = {
  LAB_TEST: "bg-purple-50 text-purple-700 border-purple-200",
  RADIOLOGY: "bg-blue-50 text-blue-700 border-blue-200",
  FOLLOW_UP: "bg-green-50 text-green-700 border-green-200",
};

const TASK_TYPE_ICONS: Record<string, string> = {
  LAB_TEST: "🧪",
  RADIOLOGY: "🩻",
  FOLLOW_UP: "📅",
};

export function ResultsTabs({ tasks, events }: { tasks: Task[]; events: Event[] }) {
  const counts = {
    LAB_TEST: tasks.filter(t => t.task_type === "LAB_TEST").length,
    RADIOLOGY: tasks.filter(t => t.task_type === "RADIOLOGY").length,
    FOLLOW_UP: tasks.filter(t => t.task_type === "FOLLOW_UP").length,
  };

  return (
    <Tabs defaultValue="summary">
      <TabsList className="bg-gray-100">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-4">
        <div className="grid grid-cols-3 gap-4">
          {(["LAB_TEST", "RADIOLOGY", "FOLLOW_UP"] as const).map(type => (
            <Card key={type} className="border-0 shadow-sm">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{TASK_TYPE_ICONS[type]}</span>
                  <span className="text-sm text-gray-500">{TASK_TYPE_LABELS[type]}</span>
                </div>
                <p className="text-4xl font-bold text-gray-900">{counts[type]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {tasks.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No tasks extracted yet</p>
        )}
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-2">
            {tasks.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No tasks extracted yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-gray-500">Task</th>
                    <th className="pb-3 font-medium text-gray-500">Type</th>
                    <th className="pb-3 font-medium text-gray-500">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-800">{t.task_name}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TASK_TYPE_COLORS[t.task_type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {TASK_TYPE_ICONS[t.task_type]} {TASK_TYPE_LABELS[t.task_type] ?? t.task_type}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(t.confidence_score * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="text-gray-500 text-xs">{(t.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="timeline" className="mt-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <Timeline events={events} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
