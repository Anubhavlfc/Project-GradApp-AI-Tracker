import { Bot, Mail, BarChart3, Search, Brain, Calendar } from 'lucide-react';
import { useState } from 'react';

/**
 * Landing Page Component
 *
 * Beautiful landing page showcasing GradTrack AI features
 */
function LandingPage({ onGetStarted }) {
  const [hoveredCard, setHoveredCard] = useState(null);

  const features = [
    {
      icon: Bot,
      title: 'AI-Powered Assistant',
      description: 'Chat with Claude 3.5 Sonnet to manage applications, research programs, and get personalized recommendations powered by advanced AI.'
    },
    {
      icon: Mail,
      title: 'Smart Email Integration',
      description: 'Automatically import applications from Gmail. Our AI detects confirmations, interviews, and decisions to keep your tracker updated.'
    },
    {
      icon: BarChart3,
      title: 'Application Tracking',
      description: 'Visualize your application journey with our intuitive Kanban board. Drag and drop applications through each stage of the process.'
    },
    {
      icon: Search,
      title: 'Research Automation',
      description: 'Automatically research graduate programs, deadlines, requirements, and funding. Get program fit analysis based on your profile.'
    },
    {
      icon: Brain,
      title: 'Decision Analysis',
      description: 'AI-powered insights analyze your acceptances and rejections to identify patterns and provide recommendations for future applications.'
    },
    {
      icon: Calendar,
      title: 'Deadline Management',
      description: 'Never miss a deadline again. Track all your application deadlines, interview dates, and important milestones in one place.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
            <Bot size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">GradTrack AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onGetStarted}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            Why Choose GradTrack AI?
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Everything you need to streamline your graduate school application process with the power of artificial intelligence
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 transition-all duration-300 ${
                  hoveredCard === index
                    ? 'transform -translate-y-2 shadow-2xl shadow-purple-500/20 border-purple-500/50'
                    : 'hover:border-gray-600/50'
                }`}
              >
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Icon size={28} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-y border-gray-700/50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              8+
            </div>
            <div className="text-gray-400 text-lg">MCP Tools Available</div>
          </div>
          <div>
            <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              AI
            </div>
            <div className="text-gray-400 text-lg">Claude 3.5 Sonnet</div>
          </div>
          <div>
            <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              100%
            </div>
            <div className="text-gray-400 text-lg">Free & Open Source</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join students who are managing their graduate school applications with AI
          </p>
          <button
            onClick={onGetStarted}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
          >
            Launch Application Dashboard
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-700/50 text-center text-gray-400">
        <p>GradTrack AI - Graduate School Application Manager</p>
        <p className="text-sm mt-2">Powered by Claude 3.5 Sonnet via OpenRouter</p>
      </footer>
    </div>
  );
}

export default LandingPage;
