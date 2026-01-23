import { useState } from 'react';
import { X, Mail, RefreshCw, Download, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Email Sync Modal Component
 *
 * Allows users to connect Gmail and auto-import applications from emails.
 */
function EmailSyncModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('initial'); // initial, authenticating, scanning, importing, success
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectedApps, setDetectedApps] = useState([]);
  const [selectedApps, setSelectedApps] = useState(new Set());
  const [daysBack, setDaysBack] = useState(365);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleAuthenticate = async () => {
    setLoading(true);
    setError(null);
    setStep('authenticating');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/email/authenticate`);

      if (response.data.authenticated) {
        setAuthenticated(true);
        setStep('authenticated');
      } else {
        setError('Gmail authentication failed. Please check your credentials.');
        setStep('initial');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
      setStep('initial');
    } finally {
      setLoading(false);
    }
  };

  const handleScanEmails = async () => {
    setLoading(true);
    setError(null);
    setStep('scanning');

    try {
      const response = await axios.get(`${API_BASE_URL}/api/email/scan`, {
        params: { days_back: daysBack }
      });

      const apps = response.data.applications || [];
      setDetectedApps(apps);

      // Select all by default
      setSelectedApps(new Set(apps.map((_, idx) => idx)));

      if (apps.length === 0) {
        setError('No graduate school application emails found. Try increasing the time range.');
      }

      setStep('review');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to scan emails');
      setStep('authenticated');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setStep('importing');

    try {
      // Import only selected applications
      const appsToImport = detectedApps.filter((_, idx) => selectedApps.has(idx));

      // Create applications one by one
      let imported = 0;
      let failed = 0;

      for (const app of appsToImport) {
        try {
          await axios.post(`${API_BASE_URL}/api/applications`, {
            school_name: app.school_name,
            program_name: app.program_name,
            degree_type: app.degree_type || 'Other',
            deadline: app.deadline,
            status: app.status || 'researching',
            decision: app.decision,
            notes: app.notes || `Auto-imported from email (${app.email_type})`
          });
          imported++;
        } catch (err) {
          console.error(`Failed to import ${app.school_name}:`, err);
          failed++;
        }
      }

      setImportResult({ imported, failed, total: appsToImport.length });
      setStep('success');

      // Notify parent to refresh
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import applications');
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedApps(newSelected);
  };

  const selectAll = () => {
    setSelectedApps(new Set(detectedApps.map((_, idx) => idx)));
  };

  const deselectAll = () => {
    setSelectedApps(new Set());
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 to-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass rounded-2xl shadow-glow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden animate-scale-in border-2 border-white/30">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/30 bg-gradient-to-r from-white/40 to-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-glow">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-purple-600">
                Email Integration
              </h3>
              <p className="text-xs text-gray-600 font-medium">Auto-import applications from Gmail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-all hover:scale-110 p-1.5 rounded-lg hover:bg-white/60"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Error Message */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border-2 border-red-200 shadow-soft animate-fade-in mb-4 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Initial / Authenticate Step */}
          {(step === 'initial' || step === 'authenticating') && (
            <div className="text-center py-8 animate-fade-in-up">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-3">Connect Your Gmail</h4>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                We'll scan your inbox for grad school application emails and automatically create entries in your tracker.
              </p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                <p className="text-sm font-bold text-blue-800 mb-2">What we'll detect:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✓ Application confirmations</li>
                  <li>✓ Deadline reminders</li>
                  <li>✓ Interview invitations</li>
                  <li>✓ Admission decisions</li>
                  <li>✓ Status updates</li>
                </ul>
              </div>
              <button
                onClick={handleAuthenticate}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 font-bold btn-glow transform hover:scale-105 shadow-card flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    <span>Connect Gmail</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Authenticated - Scan Step */}
          {step === 'authenticated' && (
            <div className="text-center py-8 animate-fade-in-up">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-3">Gmail Connected!</h4>
              <p className="text-gray-600 mb-6">Now let's scan your inbox for application emails.</p>

              <div className="max-w-sm mx-auto mb-6">
                <label className="block text-sm font-bold text-gray-800 mb-2 text-left">
                  Scan emails from the last:
                </label>
                <select
                  value={daysBack}
                  onChange={(e) => setDaysBack(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/80 backdrop-blur-sm font-medium transition-all shadow-soft"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days (3 months)</option>
                  <option value={180}>180 days (6 months)</option>
                  <option value={365}>365 days (1 year)</option>
                  <option value={730}>730 days (2 years)</option>
                </select>
              </div>

              <button
                onClick={handleScanEmails}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 font-bold btn-glow transform hover:scale-105 shadow-card flex items-center gap-2 mx-auto"
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={20} />
                    <span>Scan Emails</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Scanning Step */}
          {step === 'scanning' && (
            <div className="text-center py-12 animate-fade-in">
              <Loader size={48} className="text-primary-500 mx-auto mb-4 animate-spin" />
              <h4 className="text-lg font-bold text-gray-800 mb-2">Scanning your inbox...</h4>
              <p className="text-gray-600">This may take a minute. We're using AI to analyze your emails.</p>
            </div>
          )}

          {/* Review Detected Apps */}
          {step === 'review' && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-800">
                  Found {detectedApps.length} Application{detectedApps.length !== 1 ? 's' : ''}
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-all font-bold"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-bold"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {detectedApps.map((app, index) => (
                  <div
                    key={index}
                    onClick={() => toggleSelection(index)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedApps.has(index)
                        ? 'border-primary-400 bg-primary-50 shadow-card'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={selectedApps.has(index)}
                            onChange={() => toggleSelection(index)}
                            className="w-4 h-4 text-primary-600 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <h5 className="font-bold text-gray-900">{app.school_name}</h5>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">{app.program_name} • {app.degree_type}</p>
                        {app.deadline && (
                          <p className="text-xs text-gray-500 ml-6 mt-1">Deadline: {app.deadline}</p>
                        )}
                        {app.email_type && (
                          <span className="inline-block ml-6 mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                            {app.email_type}
                          </span>
                        )}
                      </div>
                      {app.confidence && (
                        <span className="text-xs text-gray-500 ml-2">{app.confidence}% match</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep('authenticated')}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-800 transition-all font-bold hover:bg-white/60 rounded-xl"
                >
                  Scan Again
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedApps.size === 0 || loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 font-bold btn-glow transform hover:scale-105 shadow-card flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      <span>Import {selectedApps.size} Application{selectedApps.size !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-12 animate-fade-in-up">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600 animate-bounce-soft" />
              </div>
              <h4 className="text-2xl font-bold text-gray-800 mb-3">Import Successful!</h4>
              <p className="text-gray-600 mb-2">
                Imported {importResult?.imported} application{importResult?.imported !== 1 ? 's' : ''}
              </p>
              {importResult?.failed > 0 && (
                <p className="text-orange-600 text-sm mb-4">
                  ({importResult.failed} failed or duplicates)
                </p>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all font-bold btn-glow transform hover:scale-105 shadow-card mx-auto"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailSyncModal;
