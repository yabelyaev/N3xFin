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
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiService.listFiles();
            setFiles((response.data as any).files || []);
        } catch (err: any) {
            setError('Failed to load statements');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    const handleDeleteOne = async (fileKey: string) => {
        try {
            setDeletingKey(fileKey);
            setConfirmDeleteKey(null);
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
        try {
            setDeletingAll(true);
            setConfirmDeleteAll(false);
            await apiService.deleteStatement();
            setFiles([]);
            onStatementsChanged?.();
        } catch {
            setError('Failed to delete all statements');
        } finally {
            setDeletingAll(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const stripPrefix = (filename: string) =>
        filename.replace(/^\d{8}-\d{6}-[a-f0-9]+-/, '');

    if (loading) {
        return (
            <div className="statements-panel">
                <h3 className="statements-title">Uploaded Statements</h3>
                <div className="statements-skeleton">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-row" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="statements-panel">
            <div className="statements-header">
                <h3 className="statements-title">
                    Uploaded Statements
                    {files.length > 0 && <span className="statements-count">{files.length}</span>}
                </h3>
                {files.length > 0 && (
                    <button
                        className="btn-delete-all"
                        onClick={() => setConfirmDeleteAll(true)}
                        disabled={deletingAll}
                    >
                        {deletingAll ? 'Deleting…' : '🗑 Delete All'}
                    </button>
                )}
            </div>

            {error && (
                <div className="statements-error">
                    {error}
                    <button onClick={() => setError(null)} className="dismiss-btn">✕</button>
                </div>
            )}

            {/* Confirm delete all */}
            {confirmDeleteAll && (
                <div className="confirm-dialog">
                    <p>Delete all {files.length} statements and their transaction data?</p>
                    <div className="confirm-actions">
                        <button className="btn-confirm-delete" onClick={handleDeleteAll}>Yes, delete all</button>
                        <button className="btn-cancel" onClick={() => setConfirmDeleteAll(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {files.length === 0 ? (
                <div className="statements-empty">
                    <span className="empty-icon">📄</span>
                    <p>No statements uploaded yet</p>
                </div>
            ) : (
                <div className="statements-list">
                    {files.map(file => (
                        <div key={file.fileKey} className="statement-row">
                            <div className="statement-info">
                                <span className="statement-icon">📄</span>
                                <div className="statement-details">
                                    <span className="statement-name">{stripPrefix(file.filename)}</span>
                                    <span className="statement-meta">
                                        {formatDate(file.lastModified)} · {formatSize(file.size)}
                                    </span>
                                </div>
                            </div>

                            {confirmDeleteKey === file.fileKey ? (
                                <div className="confirm-inline">
                                    <span className="confirm-text">Delete this statement?</span>
                                    <button
                                        className="btn-confirm-delete-sm"
                                        onClick={() => handleDeleteOne(file.fileKey)}
                                        disabled={deletingKey === file.fileKey}
                                    >
                                        {deletingKey === file.fileKey ? '…' : 'Yes'}
                                    </button>
                                    <button
                                        className="btn-cancel-sm"
                                        onClick={() => setConfirmDeleteKey(null)}
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="btn-delete-row"
                                    onClick={() => setConfirmDeleteKey(file.fileKey)}
                                    disabled={!!deletingKey}
                                    title="Delete statement"
                                >
                                    🗑
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
