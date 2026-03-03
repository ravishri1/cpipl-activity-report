import { useState, useCallback, useRef } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import {
  FolderOpen,
  Upload,
  Trash2,
  FileText,
  Image,
  File,
  Loader2,
  ExternalLink,
  Filter,
} from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All Files' },
  { key: 'document', label: 'Documents' },
  { key: 'receipt', label: 'Receipts' },
  { key: 'id_proof', label: 'ID Proofs' },
  { key: 'education', label: 'Education' },
  { key: 'photo', label: 'Photos' },
  { key: 'other', label: 'Other' },
];

function detectCategory(filename) {
  const lower = filename.toLowerCase();
  if (/receipt|invoice|bill/i.test(lower)) return 'receipt';
  if (/aadhaar|pan|passport|license|id/i.test(lower)) return 'id_proof';
  if (/degree|marksheet|certificate|diploma/i.test(lower)) return 'education';
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) return 'photo';
  return 'document';
}

function getFileIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-emerald-500" />;
  if (mimeType?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-blue-500" />;
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const CATEGORY_COLORS = {
  photo: 'bg-emerald-100 text-emerald-700',
  document: 'bg-blue-100 text-blue-700',
  receipt: 'bg-amber-100 text-amber-700',
  id_proof: 'bg-purple-100 text-purple-700',
  education: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function MyFiles() {
  const [category, setCategory] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);

  const url = `/files/my${category !== 'all' ? `?category=${category}` : ''}`;
  const { data: files, loading, error, refetch } = useFetch(url, []);
  const { execute, loading: uploading, error: uploadErr, success } = useApi();

  // ── Upload handler ──
  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('File too large. Maximum size is 15 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', detectCategory(file.name));

    await execute(
      () => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
      'File uploaded successfully!'
    );
    refetch();
  }, [execute, refetch]);

  // ── Drag & drop ──
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleUpload(f);
  }, [handleUpload]);

  // ── Delete handler ──
  const handleDelete = useCallback(async (fileId, fileName) => {
    if (!confirm(`Delete "${fileName}"? This will also remove it from Google Drive.`)) return;
    await execute(() => api.delete(`/files/${fileId}`), 'File deleted.');
    refetch();
  }, [execute, refetch]);

  // ── Render ──
  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Files</h1>
            <p className="text-sm text-gray-500">
              Your documents stored in Google Drive
            </p>
          </div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload File
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      {/* Messages */}
      {(success || uploadErr || error) && (
        <div className="mb-4">
          {success && <AlertMessage type="success" message={success} />}
          {(uploadErr || error) && <AlertMessage type="error" message={uploadErr || error} />}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Uploading to Google Drive...</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">
              Drag & drop a file here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Max 15 MB — Documents, images, PDFs, etc.
            </p>
          </>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              category === cat.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <EmptyState
          icon="📁"
          title={category !== 'all' ? `No ${CATEGORIES.find(c => c.key === category)?.label || 'files'}` : 'No files uploaded yet'}
          subtitle="Upload your first file using the button above or drag and drop"
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {file.thumbnailUrl ? (
                  <img
                    src={file.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    {getFileIcon(file.mimeType)}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {file.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                    CATEGORY_COLORS[file.category] || CATEGORY_COLORS.other
                  }`}>
                    {file.category?.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatFileSize(file.fileSize)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(file.uploadedAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={file.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Open in Google Drive"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(file.id, file.fileName)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {files.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
