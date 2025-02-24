export function capitalize(content: string) {
    return content.charAt(0).toUpperCase() + content.slice(1).toLowerCase();
}

export function aspectRatio(width: number, height: number, imageBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const originalWidth = image.width;
            const originalHeight = image.height;
            const desiredAspect = width / height;
            const originalAspect = originalWidth / originalHeight;

            let cropWidth, cropHeight;

            if (originalAspect > desiredAspect) {
                // Crop width (image is wider than desired aspect ratio)
                cropHeight = originalHeight;
                cropWidth = cropHeight * desiredAspect;
            } else {
                // Crop height (image is taller than desired aspect ratio)
                cropWidth = originalWidth;
                cropHeight = cropWidth / desiredAspect;
            }

            // Calculate source crop coordinates to center the crop area
            const sourceX = (originalWidth - cropWidth) / 2;
            const sourceY = (originalHeight - cropHeight) / 2;

            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not supported'));
                return;
            }

            // Draw the cropped image onto the canvas
            ctx.drawImage(
                image,
                sourceX, sourceY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            // Convert the canvas content to a base64 data URL
            resolve(canvas.toDataURL());
        };

        image.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        image.src = imageBase64;
    });
}