import React, { useRef, useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import FilePreview from './FilePreview';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
  existingFiles?: Array<{ name: string; url?: string; type?: string }>;
  onRemoveFile?: (index: number) => void;
  error?: string;
  label?: string;
  helperText?: string;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  accept = 'image/*,.pdf',
  maxSize = 250 * 1024, // 250KB default
  maxFiles = 10,
  onFilesChange,
  existingFiles = [],
  onRemoveFile,
  error,
  label,
  helperText,
  disabled = false,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
    }
    return `${Math.round(bytes / 1024)}KB`;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)} limit. Please compress or resize the file.`;
    }
    // Additional validation can be added here
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];
    const errors: Record<number, string> = {};

    fileArray.forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        errors[index] = error;
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length + files.length + existingFiles.length > maxFiles) {
      setUploadErrors({ ...uploadErrors, _max: `Maximum ${maxFiles} files allowed` });
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setUploadErrors(errors);
    onFilesChange?.([...files, ...validFiles]);
  }, [files, existingFiles.length, maxFiles, onFilesChange, uploadErrors]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    const newErrors = { ...uploadErrors };
    delete newErrors[index];
    setUploadErrors(newErrors);
    onFilesChange?.(newFiles);
  };

  const allFiles = [...existingFiles, ...files];

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        onClick={disabled ? undefined : () => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center
          transition-all duration-200
          ${disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : isDragging
              ? 'border-gold-500 bg-gold-50 cursor-pointer'
              : error
                ? 'border-rose-300 bg-rose-50 cursor-pointer'
                : 'border-gray-300 hover:border-gold-400 hover:bg-gold-50/30 cursor-pointer'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center
            ${isDragging ? 'bg-gold-100' : 'bg-gray-100'}
            transition-colors
          `}>
            <Upload size={24} className={isDragging ? 'text-gold-600' : 'text-gray-400'} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">
              {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {accept} (max {formatFileSize(maxSize)} per file)
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-2 text-sm text-rose-600 flex items-center gap-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      {/* Helper Text */}
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-500">{helperText}</p>
      )}

      {/* File Previews */}
      {allFiles.length > 0 && (
        <div className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {existingFiles.map((file, index) => (
              <div key={`existing-${index}`}>
                <FilePreview
                  file={file}
                  onRemove={onRemoveFile ? () => onRemoveFile(index) : undefined}
                  showRemove={!!onRemoveFile}
                />
              </div>
            ))}
            {files.map((file, index) => (
              <div key={`new-${index}`}>
                <FilePreview
                  file={file}
                  onRemove={() => removeFile(index)}
                />
                {uploadErrors[index] && (
                  <p className="mt-1 text-xs text-rose-600">{uploadErrors[index]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Max Files Error */}
      {uploadErrors._max && (
        <p className="mt-2 text-sm text-rose-600 flex items-center gap-1">
          <AlertCircle size={14} />
          {uploadErrors._max}
        </p>
      )}
    </div>
  );
};

export default FileUpload;

