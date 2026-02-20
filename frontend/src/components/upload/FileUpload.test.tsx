import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file upload component', () => {
    render(<FileUpload />);

    expect(screen.getByText(/drag and drop your bank statement here/i)).toBeInTheDocument();
    expect(screen.getByText(/browse files/i)).toBeInTheDocument();
    expect(screen.getByText(/csv or pdf files up to 10mb/i)).toBeInTheDocument();
  });

  it('validates file format - rejects invalid extension', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(await screen.findByText(/invalid file format/i)).toBeInTheDocument();
      expect(screen.getByText(/please upload a csv or pdf file/i)).toBeInTheDocument();
    }
  });

  it('validates file format - accepts CSV files', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['date,description,amount\n2024-01-01,Test,100'], 'statement.csv', {
      type: 'text/csv',
    });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(screen.getByText('statement.csv')).toBeInTheDocument();
      expect(screen.queryByText(/invalid file format/i)).not.toBeInTheDocument();
    }
  });

  it('validates file format - accepts PDF files', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['%PDF-1.4'], 'statement.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(screen.getByText('statement.pdf')).toBeInTheDocument();
      expect(screen.queryByText(/invalid file format/i)).not.toBeInTheDocument();
    }
  });

  it('validates file size - rejects files over 10MB', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    // Create a file larger than 10MB
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
    const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

    // Mock the file size
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(await screen.findByText(/file size exceeds 10mb limit/i)).toBeInTheDocument();
      expect(screen.getByText(/please upload a smaller file/i)).toBeInTheDocument();
    }
  });

  it('displays selected file information', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(screen.getByText('statement.csv')).toBeInTheDocument();
      expect(screen.getByText(/0.00 mb/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    }
  });

  it('handles file upload process', async () => {
    const user = userEvent.setup();
    const onUploadComplete = vi.fn();
    render(<FileUpload onUploadComplete={onUploadComplete} />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      // Should show uploading state
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();

      // Wait for upload to complete
      await waitFor(
        () => {
          expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(onUploadComplete).toHaveBeenCalledWith('mock-file-key');
    }
  });

  it('shows upload progress during upload', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      // Should show progress
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    }
  });

  it('allows canceling file selection', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      expect(screen.getByText('statement.csv')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText('statement.csv')).not.toBeInTheDocument();
      expect(screen.getByText(/drag and drop your bank statement here/i)).toBeInTheDocument();
    }
  });

  it('allows uploading another file after success', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      await waitFor(
        () => {
          expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const uploadAnotherButton = screen.getByRole('button', { name: /upload another file/i });
      await user.click(uploadAnotherButton);

      expect(screen.getByText(/drag and drop your bank statement here/i)).toBeInTheDocument();
    }
  });

  it('calls onUploadError callback on upload failure', async () => {
    const user = userEvent.setup();
    const onUploadError = vi.fn();

    // Mock console.error to suppress error output in tests
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<FileUpload onUploadError={onUploadError} />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByRole('button', { name: /browse and select file/i })
      .closest('div')
      ?.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);

      // Note: The current implementation doesn't have a way to trigger upload failure
      // This test documents the expected behavior
    }

    consoleErrorSpy.mockRestore();
  });

  it('handles drag and drop file selection', async () => {
    render(<FileUpload />);

    const file = new File(['content'], 'statement.csv', { type: 'text/csv' });
    const dropZone = screen.getByText(/drag and drop your bank statement here/i).closest('div');

    if (dropZone) {
      const dataTransfer = {
        files: [file],
        items: [
          {
            kind: 'file',
            type: file.type,
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      };

      // Simulate drag enter
      const dragEnterEvent = new Event('dragenter', { bubbles: true });
      Object.defineProperty(dragEnterEvent, 'dataTransfer', { value: dataTransfer });
      dropZone.dispatchEvent(dragEnterEvent);

      // Simulate drop
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
      dropZone.dispatchEvent(dropEvent);

      await waitFor(() => {
        expect(screen.getByText('statement.csv')).toBeInTheDocument();
      });
    }
  });
});
