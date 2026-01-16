import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Edit2, Trash2, MoreVertical, GraduationCap } from 'lucide-react'
import { formatDate, getDaysUntil, getUrgencyLevel, getUrgencyColor, DECISION_CONFIG } from '../../utils/helpers'
import EditApplicationModal from './EditApplicationModal'

export default function ApplicationCard({ application, onUpdate, onDelete, isDragging }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: application.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const daysUntil = getDaysUntil(application.deadline)
  const urgency = getUrgencyLevel(application.deadline)
  const urgencyColor = getUrgencyColor(urgency)

  const handleEdit = () => {
    setShowMenu(false)
    setShowEditModal(true)
  }

  const handleDelete = () => {
    setShowMenu(false)
    onDelete?.(application.id)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`kanban-card ${isSortableDragging || isDragging ? 'dragging' : ''}`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary-500" />
            <h4 className="font-medium text-slate-800 text-sm">{application.school_name}</h4>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1 hover:bg-slate-100 rounded"
            >
              <MoreVertical className="h-4 w-4 text-slate-400" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Program Name */}
        <p className="text-slate-600 text-sm mb-3">
          {application.degree_type} {application.program_name}
        </p>

        {/* Deadline */}
        {application.deadline && (
          <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full ${urgencyColor}`}>
            <Calendar className="h-3 w-3" />
            <span>{formatDate(application.deadline)}</span>
            {daysUntil !== null && (
              <span className="font-medium">
                ({daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Today!' : `${daysUntil}d left`})
              </span>
            )}
          </div>
        )}

        {/* Decision Badge (for decision column) */}
        {application.status === 'decision' && application.decision && (
          <div className={`mt-2 inline-block px-2 py-1 rounded-full text-xs font-medium ${DECISION_CONFIG[application.decision]?.color || ''}`}>
            {DECISION_CONFIG[application.decision]?.label || application.decision}
          </div>
        )}

        {/* Notes Preview */}
        {application.notes && (
          <p className="text-slate-400 text-xs mt-2 truncate" title={application.notes}>
            {application.notes}
          </p>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditApplicationModal
          application={application}
          onClose={() => setShowEditModal(false)}
          onSubmit={(data) => {
            onUpdate?.(application.id, data)
            setShowEditModal(false)
          }}
        />
      )}
    </>
  )
}
