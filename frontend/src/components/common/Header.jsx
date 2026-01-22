import { GraduationCap, Wifi, WifiOff, Sparkles } from 'lucide-react';

/**
 * Header Component
 *
 * Displays the application title and connection status.
 */
function Header({ apiConnected }) {
  return (
    <header className="glass border-b border-white/20 px-6 py-4 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl blur opacity-50 animate-pulse-slow"></div>
            <div className="relative bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 p-2.5 rounded-xl shadow-glow">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold gradient-text">GradTrack AI</h1>
              <Sparkles className="w-4 h-4 text-purple-500 animate-bounce-soft" />
            </div>
            <p className="text-xs text-gray-600 font-medium">Your AI-Powered Graduate School Assistant</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4">
          {/* API Connection Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-soft transition-all duration-300 ${
            apiConnected
              ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-glow'
              : 'bg-gradient-to-r from-red-400 to-rose-500 text-white'
          }`}>
            {apiConnected ? (
              <>
                <Wifi size={14} className="animate-pulse" />
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
          <div className="text-sm text-gray-600 font-medium bg-white/60 px-4 py-2 rounded-full shadow-soft">
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
