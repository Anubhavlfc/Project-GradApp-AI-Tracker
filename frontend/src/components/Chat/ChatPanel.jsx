import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench, Brain, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../../api';

/**
 * Chat Panel Component
 * 
 * The AI chat interface where users interact with the GradTrack agent.
 * Displays conversation history and shows when tools are being used.
 */

// Example prompts for users to try
const EXAMPLE_PROMPTS = [
  "Add MIT CS PhD to my list",
  "What's the deadline for Stanford?",
  "What tasks do I have coming up?",
  "Help me prepare for my CMU interview"
];

function ChatPanel({ onApplicationChange }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm your GradTrack AI assistant. I can help you:\n\n• Track your graduate school applications\n• Research programs and deadlines\n• Analyze your essays\n• Manage your to-do list\n\nHow can I help you today?",
      tools_used: [],
      reasoning_steps: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Send message to agent
  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) return;

    // Add user message
    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send to backend
      const response = await sendChatMessage(message);

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: response.response,
        tools_used: response.tools_used || [],
        reasoning_steps: response.reasoning_steps || []
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Refresh applications if a tool was used that might have changed data
      if (response.tools_used?.includes('application_database') || 
          response.tools_used?.includes('calendar_todo')) {
        onApplicationChange?.();
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please make sure the backend server is running on port 8000.",
        tools_used: [],
        reasoning_steps: [],
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Use example prompt
  const useExamplePrompt = (prompt) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-white/90 to-purple-50/50">
      {/* Chat Header */}
      <div className="px-5 py-4 border-b border-white/50 bg-gradient-to-r from-white/80 to-purple-50/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl blur opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 p-2 rounded-xl shadow-glow">
                <Bot size={20} className="text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">AI Assistant</h3>
              <p className="text-xs text-gray-600 font-medium">Powered by GPT-4</p>
            </div>
          </div>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all font-medium shadow-soft ${
              showReasoning
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-glow'
                : 'bg-white/80 text-gray-600 hover:bg-white hover:shadow-card'
            }`}
            title="Show agent reasoning"
          >
            <Brain size={14} />
            <span>Reasoning</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            message={message}
            showReasoning={showReasoning}
          />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full blur opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 p-2 rounded-full shadow-glow">
                <Bot size={18} className="text-white" />
              </div>
            </div>
            <div className="glass rounded-xl px-5 py-3 shadow-card">
              <div className="typing-indicator">
                <span className="bg-gradient-to-r from-primary-500 to-purple-500"></span>
                <span className="bg-gradient-to-r from-purple-500 to-pink-500"></span>
                <span className="bg-gradient-to-r from-pink-500 to-red-500"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Prompts (show when conversation is short) */}
      {messages.length <= 2 && !loading && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-600 mb-2.5 font-semibold">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => useExamplePrompt(prompt)}
                className="text-xs bg-gradient-to-r from-white to-gray-50 hover:from-primary-50 hover:to-purple-50 text-gray-700 hover:text-primary-700 px-4 py-2 rounded-full transition-all shadow-soft hover:shadow-card font-medium border border-gray-200 hover:border-primary-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-5 border-t border-white/50 bg-gradient-to-r from-white/80 to-purple-50/60 backdrop-blur-sm">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your applications..."
            rows={1}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none bg-white/90 backdrop-blur-sm font-medium shadow-soft transition-all"
            style={{ maxHeight: '120px' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-3 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-card btn-glow"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Chat Message Component
 */
function ChatMessage({ message, showReasoning }) {
  const { role, content, tools_used, reasoning_steps, isError } = message;
  const isAssistant = role === 'assistant';

  return (
    <div className={`flex items-start gap-3 chat-message ${
      isAssistant ? '' : 'flex-row-reverse'
    }`}>
      {/* Avatar */}
      <div className={`relative flex-shrink-0 ${
        isAssistant ? '' : ''
      }`}>
        {isAssistant && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full blur opacity-40 animate-pulse"></div>
        )}
        <div className={`relative p-2.5 rounded-full shadow-soft ${
          isAssistant
            ? 'bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500'
            : 'bg-gradient-to-br from-gray-300 to-gray-400'
        }`}>
          {isAssistant ? (
            <Bot size={18} className="text-white" />
          ) : (
            <User size={18} className="text-white" />
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isAssistant ? '' : 'flex flex-col items-end'}`}>
        {/* Tools Used Badge */}
        {isAssistant && tools_used?.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-3 py-1.5 rounded-full mb-2 font-bold shadow-soft">
            <Wrench size={13} />
            <span>Tools: {tools_used.join(', ')}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={`rounded-2xl px-5 py-3.5 shadow-card transition-all hover:shadow-card-hover ${
          isAssistant
            ? isError
              ? 'bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 text-red-700'
              : 'bg-white border border-gray-100'
            : 'bg-gradient-to-r from-primary-500 to-purple-600 text-white'
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium">{content}</p>
        </div>

        {/* Reasoning Steps (collapsible) */}
        {showReasoning && isAssistant && reasoning_steps?.length > 0 && (
          <div className="mt-3 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 text-xs shadow-card animate-fade-in">
            <div className="flex items-center gap-2 text-purple-700 font-bold mb-3">
              <Sparkles size={14} className="animate-bounce-soft" />
              <span>Agent Reasoning</span>
            </div>
            <div className="space-y-2 text-purple-700">
              {reasoning_steps.map((step, i) => (
                <div key={i} className="flex gap-2 bg-white/60 rounded-lg px-3 py-2">
                  <span className="font-mono text-purple-500 font-bold">[{step.step}]</span>
                  <span className="font-medium">{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
