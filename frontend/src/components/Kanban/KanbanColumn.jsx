/**
 * Kanban Column Component
 * 
 * Represents a single column in the Kanban board.
 * Accepts drop events for drag-and-drop functionality.
 */

function KanbanColumn({ 
  column, 
  applications, 
  children, 
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop 
}) {
  return (
    <div
      className={`w-72 flex-shrink-0 flex flex-col rounded-lg transition-colors ${
        isDragOver 
          ? 'bg-primary-50 ring-2 ring-primary-300' 
          : 'bg-gray-100'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{column.emoji}</span>
            <h3 className="font-semibold text-gray-800">{column.title}</h3>
          </div>
          <span className="bg-gray-200 text-gray-600 text-sm px-2 py-0.5 rounded-full">
            {applications.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{column.description}</p>
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {children}

        {/* Empty State */}
        {applications.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No applications</p>
            <p className="text-xs mt-1">Drag applications here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanColumn;
