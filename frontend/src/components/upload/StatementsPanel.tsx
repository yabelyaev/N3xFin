import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';

interface StatementFile {
    fileKey: string;
    filename: string;
    size: number;
    lastModified: string;
}

interface Props {
    onStatementsChanged?: () => void;
}

export const StatementsPanel = ({ onStatementsChanged }: Props) => {
    const [files, setFiles] = useState<StatementFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortDesc, setSortDesc] = useState(true); // newest first by default

    const sortedFiles = [...files].sort((a, b) => {
        const diff = new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        return sortDesc ? diff : -diff;
    });

    const loadFiles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiService.listFiles();
            setFiles((response.data as any).files || []);
        } catch {
            setError('Failed to load statements');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const handleDeleteOne = async (fileKey: string) => {
        setDeletingKey(fileKey);
        setConfirmDeleteKey(null);
        try {
            await apiService.deleteStatement(fileKey);
            setFiles(prev => prev.filter(f => f.fileKey !== fileKey));
            onStatementsChanged?.();
        } catch {
            setError('Failed to delete statement');
        } finally {
            setDeletingKey(null);
        }
    };

    const handleDeleteAll = async () => {
        setDeletingAll(true);
        setConfirmDeleteAll(false);
        try {
            await apiService.deleteStatement();
            setFiles([]);
            onStatementsChanged?.();
        } catch {
            setError('Failed to delete all statements');
        } finally {
            setDeletingAll(false);
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const formatSize = (bytes: number) =>
        bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    const cleanName = (raw: string) => raw.replace(/^\d{8}-\d{6}-[a-f0-9]+-/, '');
    const fileType = (name: string) => name.split('.').pop()?.toUpperCase() ?? 'FILE';

    if (loading) {
        return (
            <div className="w-full max-w-2xl mx-auto mt-6">
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-48" />
                            <div className="h-4 bg-gray-200 rounded w-10 ml-2" />
                            <div className="h-4 bg-gray-200 rounded w-28 ml-2" />
                            <div className="h-6 bg-gray-200 rounded w-16 ml-auto" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (files.length === 0 && !error) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-6">
            {error && (
                <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex justify-between">
                    {error}
                    <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">✕</button>
                </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">
                        Uploaded Statements
                        <span className="ml-2 text-xs font-normal text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                    </h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSortDesc(d => !d)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                            title={sortDesc ? 'Sorted: newest first' : 'Sorted: oldest first'}
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {sortDesc
                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                }
                            </svg>
                            {sortDesc ? 'Newest' : 'Oldest'}
                        </button>
                        {confirmDeleteAll ? (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-600">Delete all {files.length} statements?</span>
                                <button onClick={handleDeleteAll} className="text-red-600 font-semibold hover:text-red-800">Yes</button>
                                <button onClick={() => setConfirmDeleteAll(false)} className="text-gray-500 hover:text-gray-700">No</button>
                            </div>
                        ) : files.length > 0 && (
                            <button
                                onClick={() => setConfirmDeleteAll(true)}
                                disabled={deletingAll}
                                className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                                {deletingAll ? 'Deleting…' : 'Delete all'}
                            </button>
                        )}
                    </div>
                </div>

                {/* File rows */}
                <div className="divide-y divide-gray-50">
                    {sortedFiles.map(file => {
                        const name = cleanName(file.filename);
                        const type = fileType(name);
                        const isDeleting = deletingKey === file.fileKey;
                        const confirming = confirmDeleteKey === file.fileKey;

                        return (
                            <div key={file.fileKey} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                                {/* PDF/CSV icon */}
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${type === 'PDF' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                    {type}
                                </span>

                                {/* Filename */}
                                <span className="flex-1 text-sm text-gray-800 truncate" title={name}>{name}</span>

                                {/* Date */}
                                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(file.lastModified)}</span>

                                {/* Size */}
                                <span className="text-xs text-gray-400 whitespace-nowrap w-14 text-right">{formatSize(file.size)}</span>

                                {/* Delete */}
                                {confirming ? (
                                    <div className="flex items-center gap-2 text-xs ml-2">
                                        <button
                                            onClick={() => handleDeleteOne(file.fileKey)}
                                            disabled={isDeleting}
                                            className="text-red-600 font-semibold hover:text-red-800 disabled:opacity-50"
                                        >
                                            {isDeleting ? '…' : 'Delete'}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteKey(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteKey(file.fileKey)}
                                        disabled={!!deletingKey}
                                        className="ml-2 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                                        title="Delete statement"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
