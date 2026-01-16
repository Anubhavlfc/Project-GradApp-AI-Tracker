import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

export function useTasks(applicationId = null) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      let data
      if (applicationId) {
        data = await api.getTasks({ application_id: applicationId })
      } else {
        data = await api.getTasks()
      }
      setTasks(data.tasks || [])
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getTaskStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch task stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchStats()
  }, [fetchTasks, fetchStats])

  const addTask = async (taskData) => {
    try {
      const result = await api.createTask(taskData)
      await fetchTasks()
      await fetchStats()
      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const updateTask = async (id, updates) => {
    try {
      await api.updateTask(id, updates)
      await fetchTasks()
      await fetchStats()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const completeTask = async (id) => {
    try {
      await api.completeTask(id)
      await fetchTasks()
      await fetchStats()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deleteTask = async (id) => {
    try {
      await api.deleteTask(id)
      await fetchTasks()
      await fetchStats()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Group tasks by status
  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  }

  // Get upcoming tasks
  const upcomingTasks = tasks
    .filter(t => t.status !== 'completed' && t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 10)

  return {
    tasks,
    groupedTasks,
    upcomingTasks,
    stats,
    loading,
    error,
    fetchTasks,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
  }
}
