import { describe, it, expect } from 'vitest';
import { ImageService } from '../../src/application/image.service';

describe('ImageService', () => {
  it('converts dataUrl to binary Blob', () => {
    const dummyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = ImageService.dataUrlToBlob(dummyPngDataUrl);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles fallback in non-browser / headless environment', async () => {
    const dummyBlob = new Blob(['mock binary image'], { type: 'image/png' });
    const result = await ImageService.processImageBlob(dummyBlob);
    expect(result.dataUrl).toBeTruthy();
    expect(result.dimensions.width).toBeGreaterThan(0);
  });
});
