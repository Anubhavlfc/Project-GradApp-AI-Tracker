import { X, Bell, Calendar, Clock } from 'lucide-react'
import { formatDate, formatRelativeDate, PRIORITY_CONFIG, CATEGORY_CONFIG } from '../../utils/helpers'

export default function ReminderModal({ task, onClose, onComplete }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-bold">Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Task Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-slate-800 mb-2">{task.title}</h3>

          {task.description && (
            <p className="text-sm text-slate-600 mb-3">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            {task.due_date && (
              <span className="inline-flex items-center gap-1 text-slate-600">
                <Calendar className="h-4 w-4" />
                {formatDate(task.due_date)}
              </span>
            )}

            {task.due_date && (
              <span className="inline-flex items-center gap-1 text-yellow-600 font-medium">
                <Clock className="h-4 w-4" />
                {formatRelativeDate(task.due_date)}
              </span>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_CONFIG[task.priority]?.color || ''}`}>
              {PRIORITY_CONFIG[task.priority]?.label || task.priority}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_CONFIG[task.category]?.color || ''}`}>
              {CATEGORY_CONFIG[task.category]?.emoji} {CATEGORY_CONFIG[task.category]?.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Remind Later
          </button>
          <button
            onClick={() => {
              onComplete()
              onClose()
            }}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Mark Done
          </button>
        </div>
      </div>
    </div>
  )
}
