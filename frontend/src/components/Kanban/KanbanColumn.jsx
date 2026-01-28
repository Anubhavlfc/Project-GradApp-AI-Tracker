import { Search, Edit, Send, MessageSquare, CheckCircle } from 'lucide-react';

/**
 * Kanban Column Component
 *
 * Professional column design for the Kanban board with clean styling.
 */

const COLUMN_ICONS = {
  researching: Search,
  in_progress: Edit,
  applied: Send,
  interview: MessageSquare,
  decision: CheckCircle
};

function KanbanColumn({
  column,
  applications,
  children,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop
}) {
  const Icon = COLUMN_ICONS[column.id] || Search;

  return (
    <div
      className={`w-80 flex-shrink-0 flex flex-col rounded-lg transition-all duration-200 ${
        isDragOver
          ? 'bg-blue-50 ring-2 ring-blue-400 shadow-md'
          : 'bg-gray-50'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-sm">{column.title}</h3>
          </div>
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {applications.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{column.description}</p>
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {children}

        {/* Empty State */}
        {applications.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-gray-100 flex items-center justify-center">
              <Icon size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No applications</p>
            <p className="text-xs mt-1 text-gray-400">Drag applications here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanColumn;
