import React from 'react';
import type { MeetingTask } from '../../types/meetingAssistant';

interface ResultsViewProps {
  minutes: string | null;
  tasks: MeetingTask[];
}

const getStatusColor = (status: MeetingTask['status']) => {
  switch (status) {
    case '未着手':
      return 'bg-yellow-800/50 text-yellow-300 border-yellow-700';
    case '進行中':
      return 'bg-blue-800/50 text-blue-300 border-blue-700';
    case '完了':
      return 'bg-green-800/50 text-green-300 border-green-700';
    default:
      return 'bg-gray-700 text-gray-300 border-gray-600';
  }
};

export const ResultsView: React.FC<ResultsViewProps> = ({ minutes, tasks }) => {
  return (
    <div className="mt-8 space-y-8 animate-fade-in">
      {minutes && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-teal-200 mb-4">議事録</h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{minutes}</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-teal-200 mb-4">アクションアイテム</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">タスク内容</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">担当者</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ステータス</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800/50 divide-y divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-300">{task.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{task.assignedTo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
