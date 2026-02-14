'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useCallback, DragEvent } from 'react';
import { cn } from '@/lib/utils/cn';

interface GalleryImage {
  id: string;
  url: string;
  altText: string;
  filename?: string;
  width?: number;
  height?: number;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  onUpload?: (files: File[]) => Promise<GalleryImage[]>;
  maxImages?: number;
  isUploading?: boolean;
  className?: string;
}

export function ImageGallery({
  images,
  onChange,
  onUpload,
  maxImages = 10,
  isUploading = false,
  className,
}: ImageGalleryProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingAltText, setEditingAltText] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      // Limit files based on remaining slots
      const remainingSlots = maxImages - images.length;
      const filesToUpload = files.slice(0, remainingSlots);

      if (onUpload && filesToUpload.length > 0) {
        try {
          const newImages = await onUpload(filesToUpload);
          onChange([...images, ...newImages]);
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [images, maxImages, onChange, onUpload]
  );

  // Drag and drop handlers for reordering
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newImages = [...images];
      const [draggedImage] = newImages.splice(draggedIndex, 1);
      newImages.splice(dragOverIndex, 0, draggedImage);
      onChange(newImages);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, images, onChange]);

  // Delete single image
  const handleDelete = useCallback(
    (imageId: string) => {
      onChange(images.filter((img) => img.id !== imageId));
      setSelectedImages((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    },
    [images, onChange]
  );

  // Bulk delete selected
  const handleBulkDelete = useCallback(() => {
    onChange(images.filter((img) => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
  }, [images, onChange, selectedImages]);

  // Toggle image selection
  const toggleSelection = useCallback((imageId: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  // Update alt text
  const handleAltTextChange = useCallback(
    (imageId: string, altText: string) => {
      onChange(images.map((img) => (img.id === imageId ? { ...img, altText } : img)));
    },
    [images, onChange]
  );

  // Move image to position
  const moveImage = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= images.length) return;
      const newImages = [...images];
      const [movedImage] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedImage);
      onChange(newImages);
    },
    [images, onChange]
  );

  // Set as primary (move to first)
  const setAsPrimary = useCallback(
    (index: number) => {
      if (index === 0) return;
      moveImage(index, 0);
    },
    [moveImage]
  );

  const canUploadMore = images.length < maxImages;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {images.length} of {maxImages} images
        </div>
        <div className="flex items-center gap-2">
          {selectedImages.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete {selectedImages.size} selected
            </button>
          )}
          {canUploadMore && onUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Add Images'}
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload images"
      />

      {/* Drop zone when empty */}
      {images.length === 0 && onUpload && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/10 transition-colors"
        >
          <div className="text-4xl mb-2">📷</div>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium">
            Drop images here or click to upload
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Supports JPG, PNG, WebP. Max {maxImages} images.
          </p>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'relative group rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing',
                dragOverIndex === index && 'border-emerald-500 scale-105',
                draggedIndex === index && 'opacity-50',
                selectedImages.has(image.id)
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              )}
            >
              {/* Primary badge */}
              {index === 0 && (
                <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">
                  Primary
                </div>
              )}

              {/* Selection checkbox */}
              <button
                onClick={() => toggleSelection(image.id)}
                className={cn(
                  'absolute top-2 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                  selectedImages.has(image.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/80 dark:bg-zinc-800/80 opacity-0 group-hover:opacity-100'
                )}
              >
                {selectedImages.has(image.id) && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Image */}
              <div className="aspect-square bg-zinc-100 dark:bg-zinc-800">
                { }
                <img
                  src={image.url}
                  alt={image.altText}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                {/* Top actions */}
                <div className="flex justify-end gap-1">
                  {index !== 0 && (
                    <button
                      onClick={() => setAsPrimary(index)}
                      className="p-1.5 bg-white/90 rounded-md hover:bg-white text-zinc-700"
                      title="Set as primary"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(image.id)}
                    className="p-1.5 bg-red-500 rounded-md hover:bg-red-600 text-white"
                    title="Delete image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                {/* Bottom: reorder arrows */}
                <div className="flex justify-center gap-1">
                  <button
                    onClick={() => moveImage(index, index - 1)}
                    disabled={index === 0}
                    className="p-1.5 bg-white/90 rounded-md hover:bg-white text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveImage(index, index + 1)}
                    disabled={index === images.length - 1}
                    className="p-1.5 bg-white/90 rounded-md hover:bg-white text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move right"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Alt text editor */}
              <div className="p-2 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                {editingAltText === image.id ? (
                  <input
                    type="text"
                    value={image.altText}
                    onChange={(e) => handleAltTextChange(image.id, e.target.value)}
                    onBlur={() => setEditingAltText(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingAltText(null)}
                    autoFocus
                    placeholder="Enter alt text..."
                    className="w-full text-xs bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-zinc-900 dark:text-zinc-100"
                  />
                ) : (
                  <button
                    onClick={() => setEditingAltText(image.id)}
                    className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 truncate"
                    title={image.altText || 'Click to add alt text'}
                  >
                    {image.altText || (
                      <span className="italic text-zinc-400 dark:text-zinc-500">
                        Add alt text...
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add more placeholder */}
          {canUploadMore && onUpload && images.length > 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="aspect-square border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg flex flex-col items-center justify-center text-zinc-500 hover:border-emerald-500 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Drag hint */}
      {images.length > 1 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Drag images to reorder. The first image will be the primary display image.
        </p>
      )}
    </div>
  );
}
