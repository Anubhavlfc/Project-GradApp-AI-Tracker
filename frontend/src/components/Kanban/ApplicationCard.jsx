import { Calendar, Trash2, ExternalLink } from 'lucide-react';

/**
 * Application Card Component
 * 
 * Displays a single application as a draggable card.
 * Shows school name, program, deadline, and decision status.
 */

// Decision badge styling
const DECISION_STYLES = {
  accepted: 'decision-accepted',
  rejected: 'decision-rejected',
  waitlisted: 'decision-waitlisted',
  pending: 'decision-pending'
};

const DECISION_LABELS = {
  accepted: '✅ Accepted',
  rejected: '❌ Rejected',
  waitlisted: '⏳ Waitlisted',
  pending: '⏱️ Pending'
};

function ApplicationCard({ application, onDragStart, onDragEnd, onDelete }) {
  const { 
    school_name, 
    program_name, 
    degree_type, 
    deadline, 
    status, 
    decision, 
    notes 
  } = application;

  // Format deadline
  const formattedDeadline = deadline 
    ? new Date(deadline).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : null;

  // Check if deadline is approaching (within 14 days)
  const isDeadlineNear = deadline 
    ? (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24) <= 14
    : false;

  // Check if deadline has passed
  const isDeadlinePassed = deadline 
    ? new Date(deadline) < new Date()
    : false;

  return (
    <div
      className={`kanban-card status-${status} animate-fade-in-up`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-gray-900 text-lg">{school_name}</h4>
          <p className="text-sm text-gray-600 font-medium mt-0.5">{program_name}</p>
        </div>
        <span className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold shadow-soft">
          {degree_type}
        </span>
      </div>

      {/* Deadline */}
      {formattedDeadline && (
        <div className={`flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg ${
          isDeadlinePassed
            ? 'text-gray-400 line-through bg-gray-50'
            : isDeadlineNear
              ? 'text-orange-700 font-bold bg-gradient-to-r from-orange-50 to-red-50 shadow-soft'
              : 'text-gray-600 bg-gray-50 font-medium'
        }`}>
          <Calendar size={16} />
          <span>{formattedDeadline}</span>
          {isDeadlineNear && !isDeadlinePassed && (
            <span className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-full ml-auto font-bold shadow-soft animate-bounce-soft">
              Soon!
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2 bg-gradient-to-r from-gray-50 to-blue-50 px-3 py-2 rounded-lg font-medium">
          {notes}
        </p>
      )}

      {/* Decision Badge (for decision column) */}
      {status === 'decision' && decision && (
        <div className={`inline-block text-xs px-3 py-1.5 rounded-full mb-3 font-bold shadow-soft ${DECISION_STYLES[decision]}`}>
          {DECISION_LABELS[decision]}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200/50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.google.com/search?q=${encodeURIComponent(school_name + ' ' + program_name + ' admissions')}`, '_blank');
          }}
          className="text-gray-400 hover:text-primary-500 transition-all hover:scale-110 p-1.5 rounded-lg hover:bg-primary-50"
          title="Search program"
        >
          <ExternalLink size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-400 hover:text-red-500 transition-all hover:scale-110 p-1.5 rounded-lg hover:bg-red-50"
          title="Delete application"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default ApplicationCard;
