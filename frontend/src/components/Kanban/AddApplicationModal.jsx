import { useState } from 'react';
import { X } from 'lucide-react';
import { createApplication } from '../../api';

/**
 * Add Application Modal Component
 * 
 * Modal form for creating a new application.
 */

const DEGREE_TYPES = ['PhD', 'MS', 'MBA', 'MEng', 'MA', 'Other'];
const STATUS_OPTIONS = [
  { value: 'researching', label: '📚 Researching' },
  { value: 'in_progress', label: '✏️ In Progress' },
  { value: 'applied', label: '📨 Applied' },
  { value: 'interview', label: '🎤 Interview' },
  { value: 'decision', label: '✅ Decision' }
];

function AddApplicationModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    school_name: '',
    program_name: '',
    degree_type: 'MS',
    deadline: '',
    status: 'researching',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.school_name || !formData.program_name) {
      setError('School name and program name are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createApplication(formData);
      onSuccess();
    } catch (err) {
      console.error('Failed to create application:', err);
      setError('Failed to create application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 to-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass rounded-2xl shadow-glow-lg w-full max-w-lg mx-4 animate-scale-in border-2 border-white/30">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/30 bg-gradient-to-r from-white/40 to-purple-50/40 rounded-t-2xl">
          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-purple-600">Add New Application</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-all hover:scale-110 p-1.5 rounded-lg hover:bg-white/60"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border-2 border-red-200 shadow-soft animate-fade-in">
              {error}
            </div>
          )}

          {/* School Name */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              School Name *
            </label>
            <input
              type="text"
              name="school_name"
              value={formData.school_name}
              onChange={handleChange}
              placeholder="e.g., Stanford University"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
              required
            />
          </div>

          {/* Program Name */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Program Name *
            </label>
            <input
              type="text"
              name="program_name"
              value={formData.program_name}
              onChange={handleChange}
              placeholder="e.g., Computer Science"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
              required
            />
          </div>

          {/* Degree Type and Deadline Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Degree Type
              </label>
              <select
                name="degree_type"
                value={formData.degree_type}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
              >
                {DEGREE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Deadline
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any notes about this application..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-800 transition-all font-bold hover:bg-white/60 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold btn-glow transform hover:scale-105 shadow-card"
            >
              {loading ? 'Creating...' : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddApplicationModal;
