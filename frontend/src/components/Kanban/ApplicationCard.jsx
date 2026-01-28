import { Calendar, Trash2, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * Application Card Component
 *
 * Professional card displaying application details with clean design.
 */

// Decision badge styling
const DECISION_STYLES = {
  accepted: 'bg-green-100 text-green-800 border border-green-300',
  rejected: 'bg-red-100 text-red-800 border border-red-300',
  waitlisted: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  pending: 'bg-gray-100 text-gray-700 border border-gray-300'
};

const DECISION_LABELS = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  pending: 'Pending'
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
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 cursor-move"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-base">{school_name}</h4>
          <p className="text-sm text-gray-600 mt-0.5">{program_name}</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-medium border border-gray-200 ml-2 flex-shrink-0">
          {degree_type}
        </span>
      </div>

      {/* Deadline */}
      {formattedDeadline && (
        <div className={`flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-md ${
          isDeadlinePassed
            ? 'bg-gray-50 text-gray-400 border border-gray-200'
            : isDeadlineNear
              ? 'bg-orange-50 text-orange-700 border border-orange-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          <Calendar size={14} className="flex-shrink-0" />
          <span className={isDeadlinePassed ? 'line-through' : ''}>{formattedDeadline}</span>
          {isDeadlineNear && !isDeadlinePassed && (
            <AlertCircle size={14} className="ml-auto flex-shrink-0" />
          )}
        </div>
      )}

      {/* Notes */}
      {notes && notes !== 'None' && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
          {notes}
        </p>
      )}

      {/* Decision Badge (for decision column) */}
      {status === 'decision' && decision && (
        <div className={`inline-flex items-center text-xs px-3 py-1 rounded-md mb-3 font-medium ${DECISION_STYLES[decision]}`}>
          {DECISION_LABELS[decision]}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.google.com/search?q=${encodeURIComponent(school_name + ' ' + program_name + ' admissions')}`, '_blank');
          }}
          className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 rounded hover:bg-blue-50"
          title="Search program"
        >
          <ExternalLink size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-red-50"
          title="Delete application"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default ApplicationCard;
