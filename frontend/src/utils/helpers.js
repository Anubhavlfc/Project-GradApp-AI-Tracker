import { format, formatDistance, isToday, isTomorrow, isPast, addDays } from 'date-fns'

// Date formatting helpers
export function formatDate(dateString) {
  if (!dateString) return 'No date'
  const date = new Date(dateString)
  return format(date, 'MMM d, yyyy')
}

export function formatDateTime(dateString) {
  if (!dateString) return 'No date'
  const date = new Date(dateString)
  return format(date, 'MMM d, yyyy h:mm a')
}

export function formatRelativeDate(dateString) {
  if (!dateString) return 'No date'
  const date = new Date(dateString)

  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'

  return formatDistance(date, new Date(), { addSuffix: true })
}

export function getDaysUntil(dateString) {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getUrgencyLevel(dateString) {
  if (!dateString) return 'planned'
  const daysUntil = getDaysUntil(dateString)

  if (daysUntil === null) return 'planned'
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 3) return 'urgent'
  if (daysUntil <= 7) return 'upcoming'
  return 'planned'
}

export function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'overdue': return 'text-red-600 bg-red-50'
    case 'urgent': return 'text-red-600 bg-red-50'
    case 'upcoming': return 'text-yellow-600 bg-yellow-50'
    case 'planned': return 'text-green-600 bg-green-50'
    default: return 'text-slate-600 bg-slate-50'
  }
}

// Status helpers
export const STATUS_CONFIG = {
  researching: {
    label: 'Researching',
    emoji: '📚',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  in_progress: {
    label: 'In Progress',
    emoji: '✏️',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  applied: {
    label: 'Applied',
    emoji: '📨',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  interview: {
    label: 'Interview',
    emoji: '🎤',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  decision: {
    label: 'Decision',
    emoji: '✅',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

export const DECISION_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-slate-200 text-slate-700',
  },
  accepted: {
    label: 'Accepted',
    color: 'bg-green-500 text-white',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500 text-white',
  },
  waitlisted: {
    label: 'Waitlisted',
    color: 'bg-yellow-500 text-white',
  },
}

export const PRIORITY_CONFIG = {
  high: {
    label: 'High',
    color: 'bg-red-100 text-red-700',
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-100 text-yellow-700',
  },
  low: {
    label: 'Low',
    color: 'bg-green-100 text-green-700',
  },
}

export const CATEGORY_CONFIG = {
  essay: {
    label: 'Essay',
    emoji: '📝',
    color: 'bg-blue-100 text-blue-700',
  },
  lor: {
    label: 'LOR',
    emoji: '✉️',
    color: 'bg-purple-100 text-purple-700',
  },
  test_scores: {
    label: 'Test Scores',
    emoji: '📊',
    color: 'bg-green-100 text-green-700',
  },
  forms: {
    label: 'Forms',
    emoji: '📋',
    color: 'bg-orange-100 text-orange-700',
  },
  interview: {
    label: 'Interview',
    emoji: '🎤',
    color: 'bg-yellow-100 text-yellow-700',
  },
  other: {
    label: 'Other',
    emoji: '📌',
    color: 'bg-slate-100 text-slate-700',
  },
}

// Validation helpers
export function isValidDate(dateString) {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// String helpers
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Array helpers
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key]
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {})
}

// Local storage helpers
export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

export function loadFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
    return defaultValue
  }
}
