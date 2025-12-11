import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import Modal from './Modal';
import Button from './Button';
import { createCroppedImageFile, JOINT_PHOTO_ASPECT_RATIO } from '../../utils/imageCrop';
import { Loader2 } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File | null;
  onCropComplete: (croppedFile: File) => void;
  onSkip?: () => void;
  aspectRatio?: number;
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  imageFile,
  onCropComplete,
  onSkip,
  aspectRatio = JOINT_PHOTO_ASPECT_RATIO, // 4.5:3 = 3:2
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load image when file changes
  React.useEffect(() => {
    if (imageFile && isOpen) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
    } else {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [imageFile, isOpen]);

  const onCropChange = useCallback((crop: Point) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCrop = async () => {
    if (!imageFile || !imageSrc || !croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);
    try {
      const croppedFile = await createCroppedImageFile(
        imageSrc,
        croppedAreaPixels,
        imageFile
      );
      onCropComplete(croppedFile);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
      // Fallback to original file if cropping fails
      onCropComplete(imageFile);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    if (onSkip && imageFile) {
      onSkip();
    } else if (imageFile) {
      onCropComplete(imageFile);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crop Joint Photograph"
      size="lg"
    >
      <div className="space-y-4 sm:space-y-6">
        <p className="text-xs sm:text-sm text-gray-600">
          Adjust the crop area to match the 4.5×3 aspect ratio for the joint photograph.
        </p>

        {imageSrc && (
          <div className="relative w-full" style={{ height: '400px', maxHeight: '60vh' }}>
            <div className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
                cropShape="rect"
                showGrid={true}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                  },
                }}
              />
            </div>
          </div>
        )}

        {/* Zoom Control */}
        {imageSrc && (
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700">
              Zoom
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold-500"
            />
            <div className="flex justify-between text-[10px] sm:text-xs text-gray-500">
              <span>1x</span>
              <span>2x</span>
              <span>3x</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4 border-t border-gray-200">
          {onSkip && (
            <Button
              variant="outline"
              size="md"
              onClick={handleSkip}
              disabled={isProcessing}
              className="flex-1"
            >
              Skip
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={handleCrop}
            disabled={isProcessing || !croppedAreaPixels}
            isLoading={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Crop & Continue'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropModal;

