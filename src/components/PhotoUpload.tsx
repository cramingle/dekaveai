import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

type PhotoUploadProps = {
  onUpload: (file: File) => void;
};

export function PhotoUpload({ onUpload }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Create a preview URL for the image
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      
      // Pass the file to the parent component
      onUpload(file);
    }
  }, [onUpload]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
    multiple: false,
  });
  
  return (
    <div className="w-full max-w-md mx-auto">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-black bg-gray-50 dark:border-white dark:bg-gray-900' 
            : 'border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white'
          }`}
      >
        <input {...getInputProps()} />
        
        {preview ? (
          <div className="space-y-4">
            <div className="relative w-full h-56 mx-auto">
              <Image 
                src={preview} 
                alt="Preview" 
                className="object-contain rounded-md" 
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                priority
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click or drag to replace the image
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 mx-auto text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <p className="text-base font-medium">
              {isDragActive ? 'Drop your image here' : 'Drag & drop your product photo'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              or click to browse (JPG, PNG, WebP)
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 