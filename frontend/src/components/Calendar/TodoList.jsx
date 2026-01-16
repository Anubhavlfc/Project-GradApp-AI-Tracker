import { useState } from 'react'
import { Plus, Check, Trash2, Clock, Filter, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTasks } from '../../hooks/useTasks'
import { formatRelativeDate, getUrgencyLevel, getUrgencyColor, PRIORITY_CONFIG, CATEGORY_CONFIG } from '../../utils/helpers'
import TaskCard from './TaskCard'
import AddTaskModal from './AddTaskModal'

export default function TodoList() {
  const {
    tasks,
    groupedTasks,
    upcomingTasks,
    stats,
    loading,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
  } = useTasks()

  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState('all') // all, pending, completed
  const [categoryFilter, setCategoryFilter] = useState('all')

  const handleAddTask = async (data) => {
    try {
      await addTask(data)
      toast.success('Task added!')
      setShowAddModal(false)
    } catch (err) {
      toast.error('Failed to add task')
    }
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await completeTask(taskId)
      toast.success('Task completed!')
    } catch (err) {
      toast.error('Failed to complete task')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Delete this task?')) {
      try {
        await deleteTask(taskId)
        toast.success('Task deleted!')
      } catch (err) {
        toast.error('Failed to delete task')
      }
    }
  }

  // Filter tasks
  let filteredTasks = tasks
  if (filter !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.status === filter)
  }
  if (categoryFilter !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.category === categoryFilter)
  }

  // Sort by due date (urgent first)
  filteredTasks.sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date) - new Date(b.due_date)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">To-Do List</h2>
          <p className="text-slate-500 text-sm mt-1">
            Stay on top of your application tasks
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Task
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Tasks"
          value={stats?.total || 0}
          color="bg-slate-100 text-slate-700"
        />
        <StatCard
          label="Completed"
          value={stats?.by_status?.completed || 0}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          label="In Progress"
          value={stats?.by_status?.in_progress || 0}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label="Urgent"
          value={stats?.urgent || 0}
          color="bg-red-100 text-red-700"
          icon={AlertTriangle}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.emoji} {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Urgent Tasks Warning */}
      {upcomingTasks.filter(t => getUrgencyLevel(t.due_date) === 'urgent').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertTriangle className="h-5 w-5" />
            Urgent Tasks Due Soon
          </div>
          <div className="space-y-2">
            {upcomingTasks
              .filter(t => getUrgencyLevel(t.due_date) === 'urgent')
              .map(task => (
                <div key={task.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-800">{task.title}</span>
                  <span className="text-red-600">{formatRelativeDate(task.due_date)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Clock className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No tasks found</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 text-primary-500 hover:text-primary-600 text-sm font-medium"
          >
            Add your first task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => handleCompleteTask(task.id)}
              onDelete={() => handleDeleteTask(task.id)}
              onUpdate={(updates) => updateTask(task.id, updates)}
            />
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddTask}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm opacity-75">{label}</p>
        </div>
        {Icon && <Icon className="h-6 w-6 opacity-50" />}
      </div>
    </div>
  )
}
