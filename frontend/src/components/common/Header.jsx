import { GraduationCap, Wifi, WifiOff } from 'lucide-react';

/**
 * Header Component
 * 
 * Displays the application title and connection status.
 */
function Header({ apiConnected }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-2 rounded-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">GradTrack AI</h1>
            <p className="text-xs text-gray-500">Your AI Graduate School Assistant</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4">
          {/* API Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            apiConnected 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {apiConnected ? (
              <>
                <Wifi size={14} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Current Date */}
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
