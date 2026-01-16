import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ApplicationCard from './ApplicationCard'
import { STATUS_CONFIG } from '../../utils/helpers'

export default function KanbanColumn({ status, applications, onUpdate, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  const config = STATUS_CONFIG[status]

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'ring-2 ring-primary-400 ring-opacity-50' : ''}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.emoji}</span>
          <h3 className="font-semibold text-slate-700">{config.label}</h3>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {applications.length}
        </span>
      </div>

      {/* Applications */}
      <SortableContext
        items={applications.map(a => a.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {applications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No applications here yet
            </div>
          ) : (
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
