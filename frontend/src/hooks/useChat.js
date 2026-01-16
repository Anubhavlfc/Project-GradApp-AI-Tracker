import { useState, useCallback } from 'react'
import { api } from '../utils/api'

export function useChat() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your GradTrack AI assistant. I can help you manage your graduate school applications, research programs, analyze your essays, and keep track of deadlines. What would you like to do today?"
    }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const sendMessage = useCallback(async (content) => {
    // Add user message immediately
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content
    }
    setMessages(prev => [...prev, userMessage])
    setLoading(true)
    setError(null)

    try {
      const response = await api.sendChatMessage(content)

      // Add assistant response
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err.message)
      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again.",
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [])

  const resetChat = useCallback(async () => {
    try {
      await api.resetChat()
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: "Chat reset! How can I help you with your grad school applications?"
        }
      ])
    } catch (err) {
      setError(err.message)
    }
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    resetChat,
  }
}
