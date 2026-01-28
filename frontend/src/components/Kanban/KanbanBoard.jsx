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
    description: 'Exploring and researching schools'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    description: 'Working on application materials'
  },
  {
    id: 'applied',
    title: 'Applied',
    description: 'Submitted and awaiting response'
  },
  {
    id: 'interview',
    title: 'Interview',
    description: 'Interview scheduled or completed'
  },
  {
    id: 'decision',
    title: 'Decision',
    description: 'Received final decision'
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
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Applications Dashboard</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md font-medium border border-blue-200">
                {stats.total} Total
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md font-medium border border-green-200">
                {stats.accepted} Accepted
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md font-medium border border-gray-200">
                {stats.pending} Pending
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={18} />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
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
