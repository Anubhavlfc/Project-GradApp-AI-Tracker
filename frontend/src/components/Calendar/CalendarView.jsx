import { useState, useEffect } from 'react'
import Calendar from 'react-calendar'
import { format, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import { useTasks } from '../../hooks/useTasks'
import { useApplications } from '../../hooks/useApplications'
import { formatDate, getUrgencyLevel, PRIORITY_CONFIG, CATEGORY_CONFIG } from '../../utils/helpers'
import 'react-calendar/dist/Calendar.css'

export default function CalendarView() {
  const { tasks } = useTasks()
  const { applications } = useApplications()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState('month')

  // Combine tasks and application deadlines
  const allEvents = [
    ...tasks.filter(t => t.due_date).map(t => ({
      id: `task-${t.id}`,
      title: t.title,
      date: new Date(t.due_date),
      type: 'task',
      priority: t.priority,
      category: t.category,
      status: t.status,
    })),
    ...applications.filter(a => a.deadline).map(a => ({
      id: `app-${a.id}`,
      title: `${a.school_name} - ${a.program_name} Deadline`,
      date: new Date(a.deadline),
      type: 'deadline',
      school: a.school_name,
      status: a.status,
    })),
  ]

  // Get events for selected date
  const selectedEvents = allEvents.filter(event =>
    isSameDay(event.date, selectedDate)
  )

  // Get events for a specific date (for tile content)
  const getEventsForDate = (date) => {
    return allEvents.filter(event => isSameDay(event.date, date))
  }

  // Custom tile content
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null

    const events = getEventsForDate(date)
    if (events.length === 0) return null

    const hasUrgent = events.some(e => getUrgencyLevel(e.date.toISOString()) === 'urgent')
    const hasDeadline = events.some(e => e.type === 'deadline')

    return (
      <div className="flex justify-center mt-1 gap-0.5">
        {hasDeadline && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
        {hasUrgent && <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />}
        {events.length > 0 && !hasDeadline && !hasUrgent && (
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
        )}
      </div>
    )
  }

  // Custom tile class
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return ''

    const events = getEventsForDate(date)
    if (events.length === 0) return ''

    const hasDeadline = events.some(e => e.type === 'deadline')
    if (hasDeadline) return 'has-deadline'

    return 'has-event'
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Calendar</h2>
          <p className="text-slate-500 text-sm mt-1">
            View all your deadlines and tasks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileContent={tileContent}
            tileClassName={tileClassName}
            prevLabel={<ChevronLeft className="h-5 w-5" />}
            nextLabel={<ChevronRight className="h-5 w-5" />}
            className="w-full border-0"
          />

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span>Deadline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span>Urgent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Task</span>
            </div>
          </div>
        </div>

        {/* Selected Date Events */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">
            {format(selectedDate, 'MMMM d, yyyy')}
          </h3>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events on this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border ${
                    event.type === 'deadline'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">
                        {event.title}
                      </p>
                      {event.type === 'task' && (
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_CONFIG[event.priority]?.color || ''}`}>
                            {event.priority}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_CONFIG[event.category]?.color || ''}`}>
                            {CATEGORY_CONFIG[event.category]?.label || event.category}
                          </span>
                        </div>
                      )}
                    </div>
                    {event.type === 'deadline' && (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events Summary */}
      <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Upcoming This Week</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allEvents
            .filter(e => {
              const daysUntil = Math.ceil((e.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              return daysUntil >= 0 && daysUntil <= 7
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 6)
            .map(event => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${
                  event.type === 'deadline'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-xs text-slate-500 mb-1">
                  {format(event.date, 'EEE, MMM d')}
                </p>
                <p className="font-medium text-slate-800 text-sm truncate">
                  {event.title}
                </p>
              </div>
            ))}
        </div>
      </div>

      <style>{`
        .react-calendar {
          width: 100%;
          border: none;
          font-family: inherit;
        }
        .react-calendar__tile {
          padding: 0.75em 0.5em;
          position: relative;
        }
        .react-calendar__tile--active {
          background: #3b82f6 !important;
          color: white;
          border-radius: 8px;
        }
        .react-calendar__tile--now {
          background: #eff6ff;
          border-radius: 8px;
        }
        .react-calendar__tile.has-deadline {
          background: #fef2f2;
        }
        .react-calendar__tile.has-event {
          background: #f8fafc;
        }
        .react-calendar__navigation button {
          font-size: 1rem;
          font-weight: 600;
        }
        .react-calendar__month-view__weekdays {
          text-transform: uppercase;
          font-size: 0.75rem;
          color: #64748b;
        }
      `}</style>
    </div>
  )
}
