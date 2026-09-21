/**
 * Helper utility to trigger clean file downloads in browser.
 * Fetches file as blob so the browser downloads it with the specified filename
 * instead of navigating to the URL or opening in a new tab.
 * Falls back to window.open if network/CORS fails.
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  if (!url) return;

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch (error) {
    console.warn('[Download] Direct blob download failed, opening URL in new tab:', error);
    // Fallback: direct window.open or link click
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
