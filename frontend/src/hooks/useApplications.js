import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

export function useApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getApplications()
      setApplications(data.applications || [])
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Failed to fetch applications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const addApplication = async (applicationData) => {
    try {
      const result = await api.createApplication(applicationData)
      await fetchApplications()
      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const updateApplication = async (id, updates) => {
    try {
      await api.updateApplication(id, updates)
      await fetchApplications()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deleteApplication = async (id) => {
    try {
      await api.deleteApplication(id)
      await fetchApplications()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const moveApplication = async (id, newStatus) => {
    try {
      await api.updateApplication(id, { status: newStatus })
      await fetchApplications()
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Group applications by status for Kanban view
  const groupedApplications = {
    researching: applications.filter(app => app.status === 'researching'),
    in_progress: applications.filter(app => app.status === 'in_progress'),
    applied: applications.filter(app => app.status === 'applied'),
    interview: applications.filter(app => app.status === 'interview'),
    decision: applications.filter(app => app.status === 'decision'),
  }

  return {
    applications,
    groupedApplications,
    loading,
    error,
    fetchApplications,
    addApplication,
    updateApplication,
    deleteApplication,
    moveApplication,
  }
}
