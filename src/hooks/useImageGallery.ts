'use client';

import { useState, useCallback } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  altText: string;
  filename?: string;
  width?: number;
  height?: number;
}

interface UseImageGalleryOptions {
  productId?: string;
  brand?: string;
  model?: string;
  initialImages?: GalleryImage[];
  onImagesChange?: (images: GalleryImage[]) => void;
}

interface UploadResult {
  success: boolean;
  images: GalleryImage[];
  errors?: string[];
}

export function useImageGallery(options: UseImageGalleryOptions = {}) {
  const { productId, brand, model, initialImages = [], onImagesChange } = options;
  
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload files
  const uploadFiles = useCallback(
    async (files: File[]): Promise<GalleryImage[]> => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));
        
        if (productId) formData.append('productId', productId);
        if (brand) formData.append('brand', brand);
        if (model) formData.append('model', model);

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
        });

        const result: UploadResult = await response.json();

        if (!response.ok) {
          throw new Error(result.errors?.[0] || 'Upload failed');
        }

        if (result.errors && result.errors.length > 0) {
          setUploadError(result.errors.join(', '));
        }

        return result.images;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setUploadError(message);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [productId, brand, model]
  );

  // Update images
  const handleImagesChange = useCallback(
    (newImages: GalleryImage[]) => {
      setImages(newImages);
      onImagesChange?.(newImages);
    },
    [onImagesChange]
  );

  // Update single image alt text
  const updateAltText = useCallback(
    (imageId: string, altText: string) => {
      const newImages = images.map((img) =>
        img.id === imageId ? { ...img, altText } : img
      );
      handleImagesChange(newImages);
    },
    [images, handleImagesChange]
  );

  // Reorder images
  const reorderImages = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newImages = [...images];
      const [movedImage] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedImage);
      handleImagesChange(newImages);
    },
    [images, handleImagesChange]
  );

  // Delete image
  const deleteImage = useCallback(
    (imageId: string) => {
      const newImages = images.filter((img) => img.id !== imageId);
      handleImagesChange(newImages);
    },
    [images, handleImagesChange]
  );

  // Delete multiple images
  const deleteImages = useCallback(
    (imageIds: string[]) => {
      const idsSet = new Set(imageIds);
      const newImages = images.filter((img) => !idsSet.has(img.id));
      handleImagesChange(newImages);
    },
    [images, handleImagesChange]
  );

  // Set primary image (move to first position)
  const setPrimaryImage = useCallback(
    (imageId: string) => {
      const index = images.findIndex((img) => img.id === imageId);
      if (index > 0) {
        reorderImages(index, 0);
      }
    },
    [images, reorderImages]
  );

  // Get URLs for API/form submission
  const getImageUrls = useCallback(() => {
    return images.map((img) => img.url);
  }, [images]);

  // Get images with alt texts for Shopify/SEO
  const getImagesForShopify = useCallback(() => {
    return images.map((img) => ({
      src: img.url,
      altText: img.altText,
    }));
  }, [images]);

  return {
    images,
    setImages: handleImagesChange,
    isUploading,
    uploadError,
    uploadFiles,
    updateAltText,
    reorderImages,
    deleteImage,
    deleteImages,
    setPrimaryImage,
    getImageUrls,
    getImagesForShopify,
  };
}

// Helper to convert existing image URLs to GalleryImage format
export function urlsToGalleryImages(
  urls: string[],
  altTexts?: string[],
  brand?: string,
  model?: string
): GalleryImage[] {
  return urls.map((url, index) => ({
    id: `img-${index}-${Date.now()}`,
    url,
    altText: altTexts?.[index] || `${brand || ''} ${model || ''} image ${index + 1}`.trim(),
    filename: url.split('/').pop(),
  }));
}
