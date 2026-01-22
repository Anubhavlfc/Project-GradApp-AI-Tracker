import { useState, useMemo } from 'react';
import KanbanColumn from './KanbanColumn';
import ApplicationCard from './ApplicationCard';
import AddApplicationModal from './AddApplicationModal';
import { updateApplicationStatus, deleteApplication } from '../../api';
import { Plus } from 'lucide-react';

/**
 * Kanban Board Component
 * 
 * Displays applications organized by status in columns.
 * Supports drag-and-drop between columns.
 */

// Status columns configuration
const COLUMNS = [
  { 
    id: 'researching', 
    title: 'Researching', 
    emoji: '📚',
    description: 'Schools you\'re exploring'
  },
  { 
    id: 'in_progress', 
    title: 'In Progress', 
    emoji: '✏️',
    description: 'Working on application'
  },
  { 
    id: 'applied', 
    title: 'Applied', 
    emoji: '📨',
    description: 'Submitted applications'
  },
  { 
    id: 'interview', 
    title: 'Interview', 
    emoji: '🎤',
    description: 'Interview invitations'
  },
  { 
    id: 'decision', 
    title: 'Decision', 
    emoji: '✅',
    description: 'Final decisions'
  }
];

function KanbanBoard({ applications, onUpdate, onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedApp, setDraggedApp] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Group applications by status
  const applicationsByStatus = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach(col => {
      grouped[col.id] = applications.filter(app => app.status === col.id);
    });
    return grouped;
  }, [applications]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: applications.length,
    accepted: applications.filter(a => a.decision === 'accepted').length,
    pending: applications.filter(a => a.decision === 'pending').length,
    rejected: applications.filter(a => a.decision === 'rejected').length
  }), [applications]);

  // Handle drag start
  const handleDragStart = (e, app) => {
    setDraggedApp(app);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay to show the dragging state
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedApp(null);
    setDragOverColumn(null);
  };

  // Handle drag over column
  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // Handle drop on column
  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedApp || draggedApp.status === columnId) {
      return;
    }

    // Optimistic update
    const updatedApps = applications.map(app =>
      app.id === draggedApp.id ? { ...app, status: columnId } : app
    );
    onUpdate(updatedApps);

    // Update on server
    try {
      await updateApplicationStatus(draggedApp.id, columnId);
    } catch (err) {
      console.error('Failed to update status:', err);
      // Revert on error
      onRefresh();
    }
  };

  // Handle delete application
  const handleDelete = async (appId) => {
    if (!confirm('Are you sure you want to delete this application?')) {
      return;
    }

    // Optimistic update
    const updatedApps = applications.filter(app => app.id !== appId);
    onUpdate(updatedApps);

    try {
      await deleteApplication(appId);
    } catch (err) {
      console.error('Failed to delete:', err);
      onRefresh();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-white/80 to-white/60 border-b border-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Applications Dashboard</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-medium shadow-soft">
                {stats.total} total
              </span>
              <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-medium shadow-soft">
                {stats.accepted} accepted
              </span>
              <span className="px-3 py-1 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-full font-medium shadow-soft">
                {stats.pending} pending
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all duration-300 font-medium btn-glow transform hover:scale-105"
          >
            <Plus size={20} />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 h-full min-w-max">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              applications={applicationsByStatus[column.id] || []}
              isDragOver={dragOverColumn === column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {(applicationsByStatus[column.id] || []).map(app => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onDragStart={(e) => handleDragStart(e, app)}
                  onDragEnd={handleDragEnd}
                  onDelete={() => handleDelete(app.id)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </div>

      {/* Add Application Modal */}
      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

export default KanbanBoard;
