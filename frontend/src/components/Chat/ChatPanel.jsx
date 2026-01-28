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
      content: "Hello! I'm your GradTrack AI assistant. I can help you with:\n\n• Tracking graduate school applications\n• Researching programs and deadlines\n• Analyzing essays and statements\n• Managing tasks and deadlines\n\nHow can I assist you today?",
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
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">AI Assistant</h3>
              <p className="text-xs text-gray-500">Claude 3.5 Sonnet</p>
            </div>
          </div>
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              showReasoning
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Show agent reasoning"
          >
            <Brain size={14} />
            <span>Reasoning</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            message={message}
            showReasoning={showReasoning}
          />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg flex-shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 shadow-sm">
              <div className="typing-indicator">
                <span className="bg-blue-600"></span>
                <span className="bg-blue-600"></span>
                <span className="bg-blue-600"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Prompts (show when conversation is short) */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-3 bg-gray-50">
          <p className="text-xs text-gray-600 mb-2 font-medium">Suggested prompts:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => useExamplePrompt(prompt)}
                className="text-xs bg-white hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md transition-colors font-medium border border-gray-200"
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
            placeholder="Type your message..."
            rows={1}
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-sm"
            style={{ maxHeight: '120px' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
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
    <div className={`flex items-start gap-2.5 ${
      isAssistant ? '' : 'flex-row-reverse'
    }`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className={`p-1.5 rounded-lg ${
          isAssistant
            ? 'bg-blue-600'
            : 'bg-gray-400'
        }`}>
          {isAssistant ? (
            <Bot size={16} className="text-white" />
          ) : (
            <User size={16} className="text-white" />
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isAssistant ? '' : 'flex flex-col items-end'}`}>
        {/* Tools Used Badge */}
        {isAssistant && tools_used?.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md mb-2 font-medium border border-blue-200">
            <Wrench size={12} />
            <span>Used: {tools_used.join(', ')}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={`rounded-lg px-4 py-2.5 ${
          isAssistant
            ? isError
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-white border border-gray-200 shadow-sm'
            : 'bg-blue-600 text-white'
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>

        {/* Reasoning Steps (collapsible) */}
        {showReasoning && isAssistant && reasoning_steps?.length > 0 && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
              <Brain size={14} />
              <span>Reasoning Steps</span>
            </div>
            <div className="space-y-1.5 text-blue-700">
              {reasoning_steps.map((step, i) => (
                <div key={i} className="flex gap-2 bg-white rounded-md px-2.5 py-1.5">
                  <span className="font-mono text-blue-600 font-medium">[{step.step}]</span>
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
