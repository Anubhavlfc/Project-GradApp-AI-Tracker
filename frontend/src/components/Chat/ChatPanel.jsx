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
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-1.5 rounded-lg">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">AI Assistant</h3>
              <p className="text-xs text-gray-500">Powered by GPT-4</p>
            </div>
          </div>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              showReasoning 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Show agent reasoning"
          >
            <Brain size={14} />
            <span>Reasoning</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage 
            key={index} 
            message={message} 
            showReasoning={showReasoning}
          />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="bg-gradient-to-br from-primary-500 to-purple-600 p-2 rounded-full">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Prompts (show when conversation is short) */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => useExamplePrompt(prompt)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your applications..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            style={{ maxHeight: '120px' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className={`p-2 rounded-full flex-shrink-0 ${
        isAssistant 
          ? 'bg-gradient-to-br from-primary-500 to-purple-600' 
          : 'bg-gray-200'
      }`}>
        {isAssistant ? (
          <Bot size={16} className="text-white" />
        ) : (
          <User size={16} className="text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isAssistant ? '' : 'flex flex-col items-end'}`}>
        {/* Tools Used Badge */}
        {isAssistant && tools_used?.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
            <Wrench size={12} />
            <span>Used: {tools_used.join(', ')}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={`rounded-lg px-4 py-3 ${
          isAssistant 
            ? isError 
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'chat-message-assistant' 
            : 'chat-message-user'
        }`}>
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        </div>

        {/* Reasoning Steps (collapsible) */}
        {showReasoning && isAssistant && reasoning_steps?.length > 0 && (
          <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-1 text-purple-700 font-medium mb-2">
              <Sparkles size={12} />
              <span>Agent Reasoning</span>
            </div>
            <div className="space-y-1 text-purple-600">
              {reasoning_steps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-mono text-purple-400">[{step.step}]</span>
                  <span>{step.message}</span>
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
