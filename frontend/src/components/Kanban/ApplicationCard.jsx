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
      className={`kanban-card status-${status}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-gray-800">{school_name}</h4>
          <p className="text-sm text-gray-600">{program_name}</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {degree_type}
        </span>
      </div>

      {/* Deadline */}
      {formattedDeadline && (
        <div className={`flex items-center gap-1.5 text-sm mb-2 ${
          isDeadlinePassed 
            ? 'text-gray-400 line-through' 
            : isDeadlineNear 
              ? 'text-orange-600 font-medium' 
              : 'text-gray-500'
        }`}>
          <Calendar size={14} />
          <span>{formattedDeadline}</span>
          {isDeadlineNear && !isDeadlinePassed && (
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded ml-1">
              Soon!
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
          {notes}
        </p>
      )}

      {/* Decision Badge (for decision column) */}
      {status === 'decision' && decision && (
        <div className={`inline-block text-xs px-2 py-1 rounded-full mb-2 ${DECISION_STYLES[decision]}`}>
          {DECISION_LABELS[decision]}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.google.com/search?q=${encodeURIComponent(school_name + ' ' + program_name + ' admissions')}`, '_blank');
          }}
          className="text-gray-400 hover:text-primary-500 transition-colors"
          title="Search program"
        >
          <ExternalLink size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Delete application"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default ApplicationCard;
