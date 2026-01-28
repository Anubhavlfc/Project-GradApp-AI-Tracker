import { GraduationCap, Wifi, WifiOff, Mail } from 'lucide-react';

/**
 * Header Component
 *
 * Professional header displaying the application title and connection status.
 */
function Header({ apiConnected, onEmailSync }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between max-w-[1920px] mx-auto">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">GradTrack AI</h1>
            <p className="text-xs text-gray-500">Graduate School Application Manager</p>
          </div>
        </div>

        {/* Actions and Status */}
        <div className="flex items-center gap-3">
          {/* Email Sync Button */}
          {onEmailSync && (
            <button
              onClick={onEmailSync}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              title="Import applications from Gmail"
            >
              <Mail size={16} />
              <span className="hidden sm:inline">Email Sync</span>
            </button>
          )}

          {/* API Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
            apiConnected
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {apiConnected ? (
              <>
                <Wifi size={14} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
