import { useState } from 'react'
import { Check, Trash2, Clock, Edit2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRelativeDate, formatDate, getUrgencyLevel, getUrgencyColor, PRIORITY_CONFIG, CATEGORY_CONFIG } from '../../utils/helpers'

export default function TaskCard({ task, onComplete, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    category: task.category,
  })

  const isCompleted = task.status === 'completed'
  const urgency = getUrgencyLevel(task.due_date)
  const urgencyColor = getUrgencyColor(urgency)

  const handleSaveEdit = () => {
    onUpdate(editData)
    setEditing(false)
  }

  return (
    <div className={`bg-white rounded-xl border ${isCompleted ? 'border-green-200 bg-green-50' : 'border-slate-200'} overflow-hidden`}>
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onComplete}
            disabled={isCompleted}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              isCompleted
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-slate-300 hover:border-primary-500'
            }`}
          >
            {isCompleted && <Check className="h-4 w-4" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
              />
            ) : (
              <p className={`font-medium ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                {task.title}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap gap-2 mt-2">
              {/* Due Date */}
              {task.due_date && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${urgencyColor}`}>
                  <Clock className="h-3 w-3" />
                  {formatRelativeDate(task.due_date)}
                </span>
              )}

              {/* Priority */}
              <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_CONFIG[task.priority]?.color || ''}`}>
                {PRIORITY_CONFIG[task.priority]?.label || task.priority}
              </span>

              {/* Category */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${CATEGORY_CONFIG[task.category]?.color || ''}`}>
                {CATEGORY_CONFIG[task.category]?.emoji}
                {CATEGORY_CONFIG[task.category]?.label || task.category}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          <div className="ml-9 mt-3 space-y-3">
            {/* Description */}
            {editing ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            ) : task.description ? (
              <p className="text-sm text-slate-600">{task.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No description</p>
            )}

            {/* Edit Controls */}
            {editing && (
              <div className="flex gap-3">
                <select
                  value={editData.priority}
                  onChange={(e) => setEditData(prev => ({ ...prev, priority: e.target.value }))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>

                <select
                  value={editData.category}
                  onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.emoji} {config.label}
                    </option>
                  ))}
                </select>

                <div className="flex-1" />

                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Save
                </button>
              </div>
            )}

            {/* Additional Info */}
            {!editing && (
              <div className="text-xs text-slate-400 space-y-1">
                {task.due_date && (
                  <p>Due: {formatDate(task.due_date)}</p>
                )}
                {task.completed_at && (
                  <p>Completed: {formatDate(task.completed_at)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
