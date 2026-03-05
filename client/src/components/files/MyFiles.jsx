import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { Download, Trash2, FolderOpen, Upload } from 'lucide-react';

const CATEGORY_COLORS = {
  photo: 'bg-blue-50 border-blue-200 text-blue-700',
  document: 'bg-gray-50 border-gray-200 text-gray-700',
  receipt: 'bg-green-50 border-green-200 text-green-700',
  id_proof: 'bg-red-50 border-red-200 text-red-700',
  education: 'bg-purple-50 border-purple-200 text-purple-700',
  other: 'bg-yellow-50 border-yellow-200 text-yellow-700',
};

const CATEGORY_LABELS = {
  photo: 'Photo',
  document: 'Document',
  receipt: 'Receipt',
  id_proof: 'ID Proof',
  education: 'Education',
  other: 'Other',
};

export default function MyFiles() {
  const [category, setCategory] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const url = `/files/my${category ? `?category=${category}` : ''}`;
  const { data: files, loading, error, refetch } = useFetch(url, []);
  const { execute: deleteFile, loading: deleting } = useApi();
  const { execute: uploadFile, loading: uploading, error: uploadError, success } = useApi();

  const categories = ['All', 'Documents', 'Receipts', 'ID Proofs', 'Education', 'Photos', 'Other'];
  const categoryValues = [null, 'document', 'receipt', 'id_proof', 'education', 'photo', 'other'];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  };

  const handleFileUpload = async (uploadedFiles) => {
    // Validate files
    for (const file of uploadedFiles) {
      if (file.size > 15 * 1024 * 1024) {
        alert(`File "${file.name}" is too large (max 15MB)`);
        return;
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert(`File "${file.name}" is not supported (images and PDF only)`);
        return;
      }
    }

    // Upload files
    const formData = new FormData();
    uploadedFiles.forEach((file) => formData.append('file', file));

    await uploadFile(
      () => api.post('/files/upload', formData),
      'File(s) uploaded successfully!'
    );
    refetch();
  };

  const handleDelete = async (fileId, fileName) => {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;

    await deleteFile(
      () => api.delete(`/files/${fileId}`),
      'File deleted successfully'
    );
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FolderOpen className="w-8 h-8 text-blue-600" />
          My Files
        </h1>
        <p className="text-gray-600 mt-2">Upload and organize your documents, photos, and receipts</p>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {uploadError && <AlertMessage type="error" message={uploadError} />}

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-8 cursor-pointer transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-lg font-semibold text-gray-700">Drag files here to upload</p>
        <p className="text-sm text-gray-500 mt-1">or click to browse (Max 15MB per file)</p>
        <p className="text-xs text-gray-400 mt-2">Supported: Images (JPEG, PNG, WebP) and PDF</p>
        <input
          id="fileInput"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(Array.from(e.target.files))}
          accept="image/*,.pdf"
        />
      </div>

      {uploading && (
        <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-blue-700">Uploading file(s)...</span>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat, idx) => (
          <button
            key={cat}
            onClick={() => setCategory(categoryValues[idx])}
            className={`px-4 py-2 rounded-full font-medium transition ${
              category === categoryValues[idx]
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* File Grid */}
      {files.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No files yet"
          subtitle="Upload files using the upload area above"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition"
            >
              {/* Thumbnail */}
              {file.thumbnailUrl && (
                <img
                  src={file.thumbnailUrl}
                  alt={file.fileName}
                  className="w-full h-40 object-cover bg-gray-100"
                />
              )}

              {/* File Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate mb-2">{file.fileName}</h3>

                {/* Category Badge */}
                <div className="mb-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                      CATEGORY_COLORS[file.category] || CATEGORY_COLORS.other
                    }`}
                  >
                    {CATEGORY_LABELS[file.category] || 'Other'}
                  </span>
                </div>

                {/* Metadata */}
                <div className="text-sm text-gray-600 mb-3 space-y-1">
                  <p>Size: {(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Uploaded: {formatDate(file.uploadedAt)}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={file.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  <button
                    onClick={() => handleDelete(file.id, file.fileName)}
                    disabled={deleting}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Count Footer */}
      {files.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
          {files.length} file{files.length !== 1 ? 's' : ''} in {category ? CATEGORY_LABELS[category] : 'all categories'}
        </div>
      )}
    </div>
  );
}
