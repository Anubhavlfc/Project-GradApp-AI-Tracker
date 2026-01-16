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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header apiConnected={apiConnected} />

      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-yellow-800">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
          <button 
            onClick={loadApplications}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Kanban Board */}
        <div className="flex-1 overflow-hidden border-r border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <GraduationCap className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-pulse-slow" />
                <p className="text-gray-500">Loading applications...</p>
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
        <div className="w-96 lg:w-[450px] flex-shrink-0 bg-white">
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
