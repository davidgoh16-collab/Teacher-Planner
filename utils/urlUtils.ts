export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url) return '#';
  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();

  // Prevent javascript:, vbscript:, data:, file: XSS
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
  if (dangerousProtocols.some(proto => lowerUrl.startsWith(proto))) {
    return 'about:blank';
  }

  // If it already has a protocol we consider safe
  if (/^https?:\/\//i.test(trimmedUrl) || lowerUrl.startsWith('mailto:') || lowerUrl.startsWith('tel:')) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
};
