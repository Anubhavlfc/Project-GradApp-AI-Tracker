import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { GraduationCap, Calendar, MessageSquare, BarChart3 } from 'lucide-react'
import KanbanBoard from './components/Kanban/KanbanBoard'
import ChatInterface from './components/Chat/ChatInterface'
import CalendarView from './components/Calendar/CalendarView'
import TodoList from './components/Calendar/TodoList'

function App() {
  const [activeTab, setActiveTab] = useState('board')
  const [showChat, setShowChat] = useState(true)

  const tabs = [
    { id: 'board', label: 'Application Board', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'todos', label: 'To-Do List', icon: MessageSquare },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'board':
        return <KanbanBoard />
      case 'calendar':
        return <CalendarView />
      case 'todos':
        return <TodoList />
      default:
        return <KanbanBoard />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-primary-500 p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">GradTrack AI</h1>
                <p className="text-xs text-slate-500">Your grad school companion</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* Chat Toggle */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showChat
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">AI Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-64px)]">
        {/* Main Panel */}
        <div className={`flex-1 overflow-auto ${showChat ? 'mr-96' : ''} transition-all duration-300`}>
          <div className="p-6">
            {renderContent()}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <aside className="fixed right-0 top-16 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col">
            <ChatInterface />
          </aside>
        )}
      </main>
    </div>
  )
}

export default App
