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
      className={`w-80 flex-shrink-0 flex flex-col rounded-xl transition-all duration-300 ${
        isDragOver
          ? 'bg-gradient-to-br from-primary-50 to-purple-50 ring-2 ring-primary-400 shadow-glow scale-105'
          : 'bg-gradient-to-br from-white/70 to-gray-50/70 backdrop-blur-sm'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="px-5 py-4 border-b border-white/50 bg-white/40 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl filter drop-shadow-sm">{column.emoji}</span>
            <h3 className="font-bold text-gray-800 text-base">{column.title}</h3>
          </div>
          <span className="bg-gradient-to-r from-gray-600 to-gray-700 text-white text-sm px-3 py-1 rounded-full font-bold shadow-soft">
            {applications.length}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-1.5 font-medium">{column.description}</p>
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {children}

        {/* Empty State */}
        {applications.length === 0 && (
          <div className="text-center py-12 text-gray-400 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-3xl opacity-50">{column.emoji}</span>
            </div>
            <p className="text-sm font-medium">No applications</p>
            <p className="text-xs mt-1">Drag applications here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanColumn;
