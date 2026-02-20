import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInterface } from './ChatInterface';
import { apiService } from '../../services/api';
import type { AxiosResponse } from 'axios';

vi.mock('../../services/api', () => ({
  apiService: {
    askQuestion: vi.fn(),
  },
}));

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state with welcome message', () => {
    render(<ChatInterface />);
    
    expect(screen.getByText('Financial Assistant')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
  });

  it('displays user message when submitted', async () => {
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'How much did I spend?' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('How much did I spend?')).toBeInTheDocument();
    });
  });

  it('displays assistant response after API call', async () => {
    const mockResponse: AxiosResponse = {
      data: {
        answer: 'You spent $500 last month.',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    vi.mocked(apiService.askQuestion).mockResolvedValueOnce(mockResponse);
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'How much did I spend?' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('You spent $500 last month.')).toBeInTheDocument();
    });
  });

  it('shows loading state while waiting for response', async () => {
    const mockResponse: AxiosResponse = {
      data: {
        answer: 'Response',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    vi.mocked(apiService.askQuestion).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    );
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    expect(screen.getByText('Sending...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Response')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const mockError = {
      response: {
        data: {
          error: {
            message: 'Service unavailable',
          },
        },
      },
    };
    
    vi.mocked(apiService.askQuestion).mockRejectedValueOnce(mockError);
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Service unavailable/)).toBeInTheDocument();
    });
  });

  it('handles unanswerable queries with suggestions', async () => {
    const mockError = {
      response: {
        data: {
          error: {
            message: 'Not enough data available',
            isUnanswerable: true,
            suggestedQuestions: [
              'How much did I spend last month?',
              'What are my top spending categories?',
            ],
          },
        },
      },
    };
    
    vi.mocked(apiService.askQuestion).mockRejectedValueOnce(mockError);
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Unanswerable question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText(/I'm sorry, I cannot answer that question/)).toBeInTheDocument();
      expect(screen.getByText(/How much did I spend last month?/)).toBeInTheDocument();
    });
  });

  it('clears input after sending message', async () => {
    const mockResponse: AxiosResponse = {
      data: {
        answer: 'Response',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    vi.mocked(apiService.askQuestion).mockResolvedValueOnce(mockResponse);
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...') as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('disables input and button while loading', async () => {
    const mockResponse: AxiosResponse = {
      data: {
        answer: 'Response',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    vi.mocked(apiService.askQuestion).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    );
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...') as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
    
    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
    
    // Button is disabled because input is now empty
    expect(sendButton).toBeDisabled();
  });

  it('prevents submission of empty messages', () => {
    render(<ChatInterface />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    expect(sendButton).toBeDisabled();
    
    const input = screen.getByPlaceholderText('Ask a question...');
    fireEvent.change(input, { target: { value: '   ' } });
    
    expect(sendButton).toBeDisabled();
  });

  it('displays multiple messages in conversation history', async () => {
    const mockResponse1: AxiosResponse = {
      data: {
        answer: 'First response',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    const mockResponse2: AxiosResponse = {
      data: {
        answer: 'Second response',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };
    
    vi.mocked(apiService.askQuestion)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);
    
    render(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Ask a question...');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    // First message
    fireEvent.change(input, { target: { value: 'First question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('First response')).toBeInTheDocument();
    });
    
    // Second message
    fireEvent.change(input, { target: { value: 'Second question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Second response')).toBeInTheDocument();
    });
    
    // Both messages should be visible
    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.getByText('First response')).toBeInTheDocument();
    expect(screen.getByText('Second question')).toBeInTheDocument();
    expect(screen.getByText('Second response')).toBeInTheDocument();
  });
});
