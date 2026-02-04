'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

interface CameraCaptureProps {
  onCapture: (imageData: string, allImages?: string[]) => void;
  onCancel?: () => void;
  isProcessing?: boolean;
  multiple?: boolean;
  maxPhotos?: number;
}

export function CameraCapture({ 
  onCapture, 
  onCancel, 
  isProcessing = false,
  multiple = false,
  maxPhotos = 10,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check permissions or use file upload.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(startCamera, 100);
  }, [stopCamera, startCamera]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    if (multiple) {
      setCapturedImages(prev => [...prev, imageData]);
      setCurrentPreview(imageData);
      // Keep camera active for more photos
    } else {
      setCapturedImages([imageData]);
      setCurrentPreview(imageData);
      stopCamera();
    }
  }, [stopCamera, multiple]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Handle multiple files
    Array.from(files).forEach((file, index) => {
      if (capturedImages.length + index >= maxPhotos) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setCapturedImages(prev => {
          const newImages = [...prev, imageData];
          setCurrentPreview(imageData);
          return newImages;
        });
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [capturedImages.length, maxPhotos]);

  // Add more photos
  const addMorePhotos = useCallback(() => {
    setCurrentPreview(null);
    startCamera();
  }, [startCamera]);

  // Remove a photo
  const removePhoto = useCallback((index: number) => {
    setCapturedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      if (newImages.length > 0) {
        setCurrentPreview(newImages[newImages.length - 1]);
      } else {
        setCurrentPreview(null);
      }
      return newImages;
    });
  }, []);

  // Confirm and send images
  const confirmCapture = useCallback(() => {
    if (capturedImages.length > 0) {
      // Send first image for AI identification, plus all images
      onCapture(capturedImages[0], capturedImages);
    }
  }, [capturedImages, onCapture]);

  // Retake photo (single mode) or continue (multiple mode)
  const retakePhoto = useCallback(() => {
    if (multiple) {
      // In multiple mode, just continue adding
      setCurrentPreview(null);
      startCamera();
    } else {
      setCapturedImages([]);
      setCurrentPreview(null);
      startCamera();
    }
  }, [startCamera, multiple]);

  // Cancel everything
  const handleCancel = useCallback(() => {
    stopCamera();
    setCapturedImages([]);
    setCurrentPreview(null);
    onCancel?.();
  }, [stopCamera, onCancel]);
  
  const hasImages = capturedImages.length > 0;
  const canAddMore = multiple && capturedImages.length < maxPhotos;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Camera/Preview area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-white mb-4">{error}</p>
            <Button onClick={() => fileInputRef.current?.click()}>
              Upload Photo Instead
            </Button>
          </div>
        )}

        {/* Live camera feed */}
        {isCameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Captured image preview */}
        {currentPreview && !isCameraActive && (
          <img
            src={currentPreview}
            alt="Captured"
            className="w-full h-full object-contain"
          />
        )}
        
        {/* Thumbnail strip for multiple photos */}
        {hasImages && (
          <div className="absolute bottom-20 left-0 right-0 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
              {capturedImages.map((img, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={img}
                    alt={`Photo ${index + 1}`}
                    className={`w-16 h-16 object-cover rounded-lg border-2 ${
                      currentPreview === img ? 'border-emerald-500' : 'border-white/30'
                    }`}
                    onClick={() => setCurrentPreview(img)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(index);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                  >
                    ×
                  </button>
                  {index === 0 && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-500 text-white px-1 rounded">
                      AI
                    </span>
                  )}
                </div>
              ))}
              {canAddMore && !isCameraActive && (
                <button
                  onClick={addMorePhotos}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:border-white/50 hover:text-white/70"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
            {multiple && (
              <p className="text-center text-xs text-white/50 mt-1">
                {capturedImages.length}/{maxPhotos} photos • First photo used for AI identification
              </p>
            )}
          </div>
        )}

        {/* Initial state - no camera, no image */}
        {!isCameraActive && !hasImages && !error && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {multiple ? 'Capture Product Photos' : 'Capture Product Photo'}
            </h3>
            <p className="text-zinc-400 mb-6 max-w-xs">
              {multiple 
                ? `Take up to ${maxPhotos} photos. First photo is used for AI identification.`
                : 'Take a photo of the product label, front panel, or serial number for automatic identification'
              }
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={startCamera} size="lg" className="w-full">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Open Camera
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {multiple ? 'Upload Photos' : 'Upload from Gallery'}
              </Button>
            </div>
          </div>
        )}

        {/* Camera overlay guides */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner guides */}
            <div className="absolute top-8 left-8 w-16 h-16 border-l-4 border-t-4 border-white/50 rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-16 h-16 border-r-4 border-t-4 border-white/50 rounded-tr-lg" />
            <div className="absolute bottom-24 left-8 w-16 h-16 border-l-4 border-b-4 border-white/50 rounded-bl-lg" />
            <div className="absolute bottom-24 right-8 w-16 h-16 border-r-4 border-b-4 border-white/50 rounded-br-lg" />
            
            {/* Hint text */}
            <div className="absolute top-4 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                {hasImages ? `${capturedImages.length} captured - take more or tap Done` : 'Position product label in frame'}
              </span>
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">Identifying product...</p>
            <p className="text-zinc-400 text-sm">Using AI vision</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 p-4 safe-area-inset-bottom">
        {/* Camera active controls */}
        {isCameraActive && (
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={hasImages ? () => { stopCamera(); setCurrentPreview(capturedImages[capturedImages.length - 1]); } : handleCancel} className="text-white">
              {hasImages ? 'Done' : 'Cancel'}
            </Button>
            
            {/* Capture button */}
            <button
              onClick={capturePhoto}
              disabled={capturedImages.length >= maxPhotos}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-white/30 disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white border-4 border-zinc-900" />
            </button>
            
            {/* Switch camera */}
            <button
              onClick={switchCamera}
              className="p-3 text-white hover:bg-white/10 rounded-full"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}

        {/* Captured images controls (not camera active) */}
        {hasImages && !isCameraActive && !isProcessing && (
          <div className="flex items-center justify-between gap-4">
            {multiple ? (
              <>
                <Button variant="secondary" onClick={addMorePhotos} className="flex-1" disabled={!canAddMore}>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add More
                </Button>
                <Button onClick={confirmCapture} className="flex-1">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Use {capturedImages.length} Photo{capturedImages.length !== 1 ? 's' : ''}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={retakePhoto} className="flex-1">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retake
                </Button>
                <Button onClick={confirmCapture} className="flex-1">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Use Photo
                </Button>
              </>
            )}
          </div>
        )}

        {/* Initial state controls */}
        {!isCameraActive && !hasImages && !error && onCancel && (
          <Button variant="ghost" onClick={handleCancel} className="w-full text-zinc-400">
            Skip for now
          </Button>
        )}
      </div>
    </div>
  );
}
