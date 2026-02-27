import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface FileUploadProps {
  onUploadComplete?: (key: string) => void;
  onUploadError?: (error: string) => void;
}

interface ValidationError {
  type: 'format' | 'size';
  message: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['text/csv', 'application/pdf', 'application/vnd.ms-excel'];
const ALLOWED_EXTENSIONS = ['.csv', '.pdf'];

export const FileUpload = ({ onUploadComplete, onUploadError }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): ValidationError | null => {
    // Check file extension
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return {
        type: 'format',
        message: `Invalid file format. Please upload a CSV or PDF file.`,
      };
    }

    // Check MIME type
    if (!ALLOWED_FORMATS.includes(file.type) && file.type !== '') {
      return {
        type: 'format',
        message: `Invalid file format. Please upload a CSV or PDF file.`,
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        type: 'size',
        message: `File size exceeds 10MB limit. Please upload a smaller file.`,
      };
    }

    return null;
  };

  const handleFile = (file: File) => {
    setValidationError(null);
    setUploadSuccess(false);
    setUploadProgress(0);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setValidationError(null);

    try {
      // Step 1: Get upload URL from backend
      setUploadProgress(10);
      const urlResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://wiqpao4gze.execute-api.us-east-1.amazonaws.com/Prod'}/upload/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ 
          filename: selectedFile.name,
          fileSize: selectedFile.size 
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, key } = await urlResponse.json();
      
      // Step 2: Upload file to S3
      setUploadProgress(30);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      setUploadProgress(60);

      // Step 3: Verify upload
      const verifyResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://wiqpao4gze.execute-api.us-east-1.amazonaws.com/Prod'}/upload/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ key }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify upload');
      }

      setUploadProgress(80);

      // Step 4: Parse the statement
      const parseResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://wiqpao4gze.execute-api.us-east-1.amazonaws.com/Prod'}/parser/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ key }),
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse statement');
      }

      setUploadProgress(100);
      setIsUploading(false);
      setUploadSuccess(true);

      if (onUploadComplete) {
        onUploadComplete(key);
      }
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setValidationError({
        type: 'format',
        message: errorMessage,
      });
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadProgress(0);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
          ${validationError ? 'border-red-300 bg-red-50' : ''}
          ${uploadSuccess ? 'border-green-300 bg-green-50' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="region"
        aria-label="File upload area"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf"
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="Choose file to upload"
          id="file-upload-input"
        />

        <div className="text-center">
          {!selectedFile && !uploadSuccess && (
            <>
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Drag and drop your bank statement here, or
                </p>
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                  aria-label="Browse and select file"
                >
                  browse files
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                CSV or PDF files up to 10MB
              </p>
            </>
          )}

          {selectedFile && !uploadSuccess && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <svg
                  className="h-8 w-8 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2" role="status" aria-live="polite">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                      role="progressbar"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Upload progress"
                    />
                  </div>
                  <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                </div>
              )}

              {!isUploading && (
                <div className="flex space-x-3 justify-center">
                  <button
                    type="button"
                    onClick={handleUpload}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {uploadSuccess && (
            <div className="space-y-4" role="status" aria-live="polite">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-green-600">Upload successful!</p>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Upload another file"
              >
                Upload Another File
              </button>
            </div>
          )}
        </div>
      </div>

      {validationError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
              <p className="mt-1 text-sm text-red-700">{validationError.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
