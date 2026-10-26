/**
 * Utility to reliably resolve the Android APK download URL
 * Handles GitHub Pages subdirectories (e.g., https://username.github.io/to-do-list/),
 * custom domains, local development, and trailing slashes.
 */
export function getApkDownloadUrl(): string {
  if (typeof window === 'undefined') return './saral-life-os.apk';

  try {
    const cleanUrl = window.location.href.split('#')[0].split('?')[0];
    const lastSegment = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
    const hasExtension = lastSegment.includes('.');
    const baseDir = hasExtension
      ? cleanUrl.substring(0, cleanUrl.lastIndexOf('/') + 1)
      : cleanUrl.endsWith('/')
      ? cleanUrl
      : `${cleanUrl}/`;

    return new URL('saral-life-os.apk', baseDir).href;
  } catch {
    return './saral-life-os.apk';
  }
}

/**
 * Direct GitHub mirror link in case the static host has MIME-type or cache restrictions
 */
export function getGitHubRawApkUrl(): string {
  return 'https://github.com/PavanKumar-HQ/to-do-list/raw/main/public/saral-life-os.apk';
}
