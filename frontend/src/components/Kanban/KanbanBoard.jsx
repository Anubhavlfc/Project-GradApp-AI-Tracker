import { useState } from 'react'
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import KanbanColumn from './KanbanColumn'
import ApplicationCard from './ApplicationCard'
import AddApplicationModal from './AddApplicationModal'
import { useApplications } from '../../hooks/useApplications'
import { STATUS_CONFIG } from '../../utils/helpers'

const COLUMNS = ['researching', 'in_progress', 'applied', 'interview', 'decision']

export default function KanbanBoard() {
  const {
    groupedApplications,
    loading,
    error,
    addApplication,
    updateApplication,
    deleteApplication,
    moveApplication,
  } = useApplications()

  const [activeId, setActiveId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    // Check if dropped on a column
    if (COLUMNS.includes(overId)) {
      // Find the application
      const app = Object.values(groupedApplications)
        .flat()
        .find(a => a.id === activeId)

      if (app && app.status !== overId) {
        try {
          await moveApplication(activeId, overId)
          toast.success(`Moved to ${STATUS_CONFIG[overId].label}`)
        } catch (err) {
          toast.error('Failed to move application')
        }
      }
    }
  }

  const handleAddApplication = async (data) => {
    try {
      await addApplication(data)
      toast.success('Application added!')
      setShowAddModal(false)
    } catch (err) {
      toast.error('Failed to add application')
    }
  }

  const handleUpdateApplication = async (id, data) => {
    try {
      await updateApplication(id, data)
      toast.success('Application updated!')
    } catch (err) {
      toast.error('Failed to update application')
    }
  }

  const handleDeleteApplication = async (id) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await deleteApplication(id)
        toast.success('Application deleted!')
      } catch (err) {
        toast.error('Failed to delete application')
      }
    }
  }

  // Find the active application for drag overlay
  const activeApplication = activeId
    ? Object.values(groupedApplications)
        .flat()
        .find(a => a.id === activeId)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Loading applications...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Application Board</h2>
          <p className="text-slate-500 text-sm mt-1">
            Drag and drop to update application status
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Application
        </button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              applications={groupedApplications[status] || []}
              onUpdate={handleUpdateApplication}
              onDelete={handleDeleteApplication}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApplication ? (
            <ApplicationCard
              application={activeApplication}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Application Modal */}
      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddApplication}
        />
      )}
    </div>
  )
}
