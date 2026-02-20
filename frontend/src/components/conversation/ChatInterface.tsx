import { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import type { Message } from '../../types/conversation';

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || loading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.askQuestion(userMessage.content);
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date(response.data.timestamp),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to get response';
      const isUnanswerable = err.response?.data?.error?.isUnanswerable;
      const suggestedQuestions = err.response?.data?.error?.suggestedQuestions;

      setError(errorMessage);

      // Add error message as assistant response
      const errorResponse: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isUnanswerable 
          ? `I'm sorry, I cannot answer that question with the available data. ${errorMessage}${
              suggestedQuestions ? `\n\nYou might try asking:\n${suggestedQuestions.map((q: string) => `• ${q}`).join('\n')}` : ''
            }`
          : `Error: ${errorMessage}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-t-lg">
        <h2 className="text-lg sm:text-xl font-semibold">Financial Assistant</h2>
        <p className="text-xs sm:text-sm text-blue-100 mt-1">
          Ask me anything about your spending and finances
        </p>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-3xl sm:text-4xl mb-4">💬</div>
            <p className="text-base sm:text-lg font-medium">Start a conversation</p>
            <p className="text-xs sm:text-sm mt-2 px-4">
              Ask questions like "How much did I spend on dining last month?" or
              "What are my biggest expenses?"
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 sm:py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</div>
                <div
                  className={`text-xs mt-1 sm:mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <div className="border-t border-gray-200 p-3 sm:p-4">
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
            <p className="text-xs sm:text-sm text-red-800">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};
