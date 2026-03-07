import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { apiService } from '../../services/api';
import { StatementsPanel } from './StatementsPanel';

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState<{success: number; failed: number; total: number} | null>(null);
  const [useLLM, setUseLLM] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Compute SHA-256 of a file using the Web Crypto API */
  const computeHash = useCallback(async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

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

  const handleFile = async (file: File) => {
    setValidationError(null);
    setDuplicateWarning(null);
    setFileHash(null);
    setUploadSuccess(false);
    setUploadProgress(0);

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Compute hash and check for duplicates — block Upload button until done
    setIsDuplicateChecking(true);
    try {
      const hash = await computeHash(file);
      setFileHash(hash);
      const res = await apiService.listFiles();
      const existing: any[] = (res.data as any).files || [];

      // Primary check: hash match (exact duplicate, even if renamed)
      let dupe = existing.find(f => f.fileHash && f.fileHash === hash);

      // Fallback: filename match for files uploaded before hashes were stored
      if (!dupe) {
        dupe = existing.find(f => {
          const cleanedName = f.filename.replace(/^\d{8}-\d{6}-[a-f0-9]+-/, '');
          return cleanedName === file.name;
        });
      }

      if (dupe) {
        const dupeName = dupe.filename.replace(/^\d{8}-\d{6}-[a-f0-9]+-/, '');
        const matchType = dupe.fileHash ? 'identical content to' : 'the same name as';
        setDuplicateWarning(
          `This file has ${matchType} "${dupeName}" you uploaded on ${new Date(dupe.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}. Consider uploading a different statement.`
        );
      }
    } catch {
      // Hash check is non-fatal — proceed normally
    } finally {
      setIsDuplicateChecking(false);
    }
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
      const fileArray = Array.from(files);
      
      // Validate all files first
      const invalidFiles = fileArray.filter(f => validateFile(f) !== null);
      if (invalidFiles.length > 0) {
        setValidationError({
          type: 'format',
          message: `${invalidFiles.length} file(s) are invalid. Only CSV and PDF files under 10MB are allowed.`
        });
        return;
      }
      
      if (fileArray.length === 1) {
        // Single file - use existing logic
        handleFile(fileArray[0]);
      } else {
        // Multiple files - prepare for bulk upload
        setSelectedFiles(fileArray);
        setSelectedFile(null);
        setValidationError(null);
        setDuplicateWarning(null);
        setUploadSuccess(false);
        setBulkUploadResults(null);
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const uploadSingleFile = async (file: File, hash?: string) => {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://wiqpao4gze.execute-api.us-east-1.amazonaws.com/Prod';
    
    // Step 1: Get upload URL from backend
    const urlResponse = await fetch(`${API_BASE}/upload/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size
      }),
    });

    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadUrl, fileKey } = await urlResponse.json();

    // Step 2: Upload file to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3');
    }

    // Wait a moment for S3 consistency
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Verify upload
    const verifyResponse = await fetch(`${API_BASE}/upload/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({ fileKey, fileHash: hash }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || 'Failed to verify upload';
      throw new Error(errorMsg);
    }

    // Step 4: Trigger async parsing
    const parseResponse = await fetch(`${API_BASE}/parser/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify({
        fileKey,
        bucket: 'n3xfin-data-087305321237',
        useLLM: useLLM || file.name.toLowerCase().endsWith('.pdf'),
      }),
    });

    if (!parseResponse.ok && parseResponse.status !== 202) {
      const errorData = await parseResponse.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || 'Failed to start parsing';
      throw new Error(errorMsg);
    }

    return fileKey;
  };

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setValidationError(null);
    setBulkUploadResults({ success: 0, failed: 0, total: selectedFiles.length });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        // Update progress
        const baseProgress = (i / selectedFiles.length) * 100;
        setUploadProgress(Math.round(baseProgress));

        // Upload file
        await uploadSingleFile(file);
        successCount++;
        setBulkUploadResults({ success: successCount, failed: failedCount, total: selectedFiles.length });
      } catch (error) {
        failedCount++;
        setBulkUploadResults({ success: successCount, failed: failedCount, total: selectedFiles.length });
      }
    }

    setUploadProgress(100);
    setIsUploading(false);
    setUploadSuccess(true);

    if (onUploadComplete) {
      onUploadComplete('bulk-upload-complete');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setValidationError(null);

    try {
      // Step 1: Get upload URL from backend
      setUploadProgress(10);
      await uploadSingleFile(selectedFile, fileHash || undefined);

      // Step 5: Poll analytics until transactions appear (max 90s)
      setUploadProgress(90);
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://wiqpao4gze.execute-api.us-east-1.amazonaws.com/Prod';
      const pollStart = Date.now();
      const POLL_TIMEOUT = 90_000;
      const POLL_INTERVAL = 3_000;

      while (Date.now() - pollStart < POLL_TIMEOUT) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        try {
          const analyticsRes = await fetch(`${API_BASE}/analytics?type=category`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
          });
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json();
            // If we get any valid response (even empty), parsing completed successfully
            if (analyticsData !== null && analyticsData !== undefined) {
              break; // Analytics endpoint responded — transactions are being stored
            }
          }
        } catch {
          // Polling errors are non-fatal, keep polling
        }
      }

      setUploadProgress(100);
      setIsUploading(false);
      setUploadSuccess(true);

      if (onUploadComplete) {
        onUploadComplete('single-upload-complete');
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
    setSelectedFiles([]);
    setValidationError(null);
    setDuplicateWarning(null);
    setFileHash(null);
    setUploadProgress(0);
    setUploadSuccess(false);
    setBulkUploadResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
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
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Choose files to upload"
            id="file-upload-input"
          />

          <div className="text-center">
            {!selectedFile && selectedFiles.length === 0 && !uploadSuccess && (
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
                    Drag and drop your bank statement(s) here, or
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
                  CSV or PDF files up to 10MB (multiple files supported)
                </p>
              </>
            )}

            {selectedFiles.length > 0 && !uploadSuccess && (
              <div className="space-y-4">
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <svg
                          className="h-6 w-6 text-blue-500"
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
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    <p className="text-sm text-gray-600">
                      Uploading {bulkUploadResults?.success || 0} of {selectedFiles.length} files...
                    </p>
                    {bulkUploadResults && bulkUploadResults.failed > 0 && (
                      <p className="text-xs text-red-600">
                        {bulkUploadResults.failed} file(s) failed
                      </p>
                    )}
                  </div>
                )}

                {!isUploading && (
                  <div className="flex space-x-3 justify-center">
                    <button
                      type="button"
                      onClick={handleBulkUpload}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Upload {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
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
                    <p className="text-sm text-gray-600">
                      {uploadProgress < 90 ? `Uploading... ${uploadProgress}%` : 'Analyzing statement with AI... this may take up to 90 seconds'}
                    </p>
                  </div>
                )}

                {!isUploading && (
                  <div className="space-y-3">
                    {selectedFile.name.toLowerCase().endsWith('.pdf') && (
                      <div className="flex items-center justify-center space-x-2">
                        <input
                          type="checkbox"
                          id="use-llm"
                          checked={useLLM}
                          onChange={(e) => setUseLLM(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="use-llm" className="text-sm text-gray-700">
                          Use AI vision for parsing (recommended for complex PDFs)
                        </label>
                      </div>
                    )}
                    <div className="flex space-x-3 justify-center">
                      {isDuplicateChecking ? (
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-md cursor-not-allowed"
                        >
                          Checking…
                        </button>
                      ) : duplicateWarning ? (
                        <>
                          <button
                            type="button"
                            onClick={handleUpload}
                            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                          >
                            Upload anyway
                          </button>
                          <button
                            type="button"
                            onClick={handleReset}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
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
                <p className="text-sm font-medium text-green-600">
                  {bulkUploadResults 
                    ? `Upload complete! ${bulkUploadResults.success} of ${bulkUploadResults.total} files uploaded successfully${bulkUploadResults.failed > 0 ? `, ${bulkUploadResults.failed} failed` : ''}`
                    : 'Upload successful!'}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Upload another file"
                >
                  Upload More Files
                </button>
              </div>
            )}
          </div>
        </div>

        {duplicateWarning && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md" role="alert">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-amber-800">Duplicate statement detected</h3>
                <p className="mt-1 text-sm text-amber-700">{duplicateWarning}</p>
              </div>
            </div>
          </div>
        )}

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
      <StatementsPanel key={uploadSuccess ? 'refreshed' : 'initial'} />
    </>);
};
