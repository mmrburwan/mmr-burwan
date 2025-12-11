/**
 * Image cropping utilities
 * Converts cropped area data to a File object with proper aspect ratio
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped image file from the original image and crop area
 * @param imageSrc - Source image URL or data URL
 * @param pixelCrop - Crop area in pixels
 * @param originalFile - Original file to preserve metadata
 * @param quality - Image quality (0-1), default 0.9
 * @returns Promise resolving to a File object
 */
export async function createCroppedImageFile(
  imageSrc: string,
  pixelCrop: CropArea,
  originalFile: File,
  quality: number = 0.9
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas dimensions to crop area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion of the image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }

        // Create File from blob, preserving original filename
        const fileName = originalFile.name;
        const fileExtension = fileName.split('.').pop() || 'jpg';
        const croppedFile = new File([blob], fileName, {
          type: originalFile.type || `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
          lastModified: Date.now(),
        });

        resolve(croppedFile);
      },
      originalFile.type || 'image/jpeg',
      quality
    );
  });
}

/**
 * Creates an Image object from a source URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
  });
}

/**
 * Gets the aspect ratio for 4.5×3 (which is 3:2)
 */
export const JOINT_PHOTO_ASPECT_RATIO = 3 / 2; // 4.5:3 = 3:2

/**
 * Validates if an image matches the joint photo aspect ratio (4.5×3)
 * @param file - Image file to validate
 * @returns Promise resolving to true if aspect ratio matches
 */
export async function validateJointPhotoAspectRatio(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    
    image.onload = () => {
      URL.revokeObjectURL(url);
      const aspectRatio = image.width / image.height;
      const targetRatio = JOINT_PHOTO_ASPECT_RATIO;
      const tolerance = 0.01; // Allow 1% tolerance
      const matches = Math.abs(aspectRatio - targetRatio) < tolerance;
      resolve(matches);
    };
    
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    image.src = url;
  });
}

/**
 * Compresses an image file to meet size requirements
 * @param file - Image file to compress
 * @param maxSizeBytes - Maximum file size in bytes (default 500KB)
 * @returns Promise resolving to compressed File
 */
export async function compressImageFile(
  file: File,
  maxSizeBytes: number = 500 * 1024
): Promise<File> {
  // If file is already small enough, return as-is
  if (file.size <= maxSizeBytes) {
    return file;
  }

  const image = await createImage(URL.createObjectURL(file));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Calculate new dimensions while maintaining aspect ratio
  let { width, height } = image;
  const aspectRatio = width / height;
  
  // Start with a reasonable quality and reduce if needed
  let quality = 0.9;
  let compressedFile: File;

  do {
    // If still too large, reduce dimensions
    if (quality < 0.3) {
      const scale = Math.sqrt(maxSizeBytes / file.size) * 0.9;
      width = Math.floor(image.width * scale);
      height = Math.floor(image.height / aspectRatio * scale);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    compressedFile = await new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const file = new File([blob], image.src.split('/').pop() || 'image.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(file);
        },
        'image/jpeg',
        quality
      );
    });

    quality -= 0.1;
  } while (compressedFile.size > maxSizeBytes && quality > 0.1);

  return compressedFile;
}

