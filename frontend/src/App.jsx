import { useState, useEffect, useCallback } from 'react';
import KanbanBoard from './components/Kanban/KanbanBoard';
import ChatPanel from './components/Chat/ChatPanel';
import Header from './components/common/Header';
import { getApplications, checkHealth } from './api';
import { GraduationCap, AlertCircle } from 'lucide-react';

/**
 * GradTrack AI - Main Application Component
 * 
 * This is the root component that:
 * - Manages global application state
 * - Renders the Kanban board and Chat panel
 * - Handles API health checks
 */
function App() {
  // Application state
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);

  // Fetch applications on mount
  useEffect(() => {
    loadApplications();
    checkApiHealth();
  }, []);

  // Check API health
  const checkApiHealth = async () => {
    try {
      await checkHealth();
      setApiConnected(true);
    } catch (err) {
      setApiConnected(false);
      console.error('API health check failed:', err);
    }
  };

  // Load applications from API
  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await getApplications();
      setApplications(data.applications || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load applications:', err);
      setError('Failed to load applications. Is the backend running?');
      // Use demo data if API is unavailable
      setApplications(getDemoApplications());
    } finally {
      setLoading(false);
    }
  };

  // Callback to refresh applications (used after chat actions)
  const refreshApplications = useCallback(() => {
    loadApplications();
  }, []);

  // Update applications state (used by Kanban for optimistic updates)
  const updateApplicationsState = useCallback((newApplications) => {
    setApplications(newApplications);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex flex-col">
      {/* Header */}
      <Header apiConnected={apiConnected} />

      {/* Error Banner */}
      {error && (
        <div className="glass-dark border-b border-yellow-400/30 px-4 py-3 flex items-center gap-2 text-yellow-100 animate-slide-down shadow-soft">
          <AlertCircle size={18} className="text-yellow-300" />
          <span className="text-sm font-medium">{error}</span>
          <button
            onClick={loadApplications}
            className="ml-auto text-sm px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Panel - Kanban Board */}
        <div className="flex-1 overflow-hidden glass rounded-2xl shadow-soft">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center animate-fade-in-up">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <GraduationCap className="w-16 h-16 text-primary-500 mx-auto mb-4 relative animate-float" />
                </div>
                <p className="text-gray-600 font-medium text-lg">Loading applications...</p>
                <div className="flex justify-center mt-3 gap-1">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          ) : (
            <KanbanBoard
              applications={applications}
              onUpdate={updateApplicationsState}
              onRefresh={refreshApplications}
            />
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="w-96 lg:w-[450px] flex-shrink-0 glass rounded-2xl shadow-soft overflow-hidden">
          <ChatPanel
            onApplicationChange={refreshApplications}
          />
        </div>
      </main>
    </div>
  );
}

// Demo data for when API is unavailable
function getDemoApplications() {
  return [
    {
      id: 1,
      school_name: 'MIT',
      program_name: 'PhD Computer Science',
      degree_type: 'PhD',
      deadline: '2026-12-15',
      status: 'researching',
      decision: 'pending',
      notes: 'Strong AI research program'
    },
    {
      id: 2,
      school_name: 'Stanford',
      program_name: 'MS Computer Science',
      degree_type: 'MS',
      deadline: '2026-12-01',
      status: 'in_progress',
      decision: 'pending',
      notes: 'Working on SOP'
    },
    {
      id: 3,
      school_name: 'UC Berkeley',
      program_name: 'PhD EECS',
      degree_type: 'PhD',
      deadline: '2026-12-15',
      status: 'applied',
      decision: 'pending',
      notes: 'Submitted on Nov 30'
    },
    {
      id: 4,
      school_name: 'Carnegie Mellon',
      program_name: 'MS Machine Learning',
      degree_type: 'MS',
      deadline: '2026-12-10',
      status: 'interview',
      decision: 'pending',
      notes: 'Interview scheduled for Jan 20'
    },
    {
      id: 5,
      school_name: 'Georgia Tech',
      program_name: 'PhD Computer Science',
      degree_type: 'PhD',
      deadline: '2026-12-15',
      status: 'decision',
      decision: 'accepted',
      notes: 'Received acceptance! 🎉'
    }
  ];
}

export default App;
