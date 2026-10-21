// Never derive account-email URLs from untrusted request Host headers.
function appBaseUrl(env = process.env) {
  const raw = env.APP_BASE_URL || env.RENDER_EXTERNAL_URL;
  let url;
  try { url = new URL(raw); } catch {
    throw new Error('Set APP_BASE_URL to the public website origin.');
  }
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    || url.hostname === '[::1]' || /^127\./.test(url.hostname)
    || /^(0\.0\.0\.0|\[::\])$/.test(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash
      || (env.NODE_ENV === 'production' && (url.protocol !== 'https:' || local))) {
    throw new Error('APP_BASE_URL must be a website origin; production requires public HTTPS, without localhost, paths, or credentials.');
  }
  return url.origin;
}

module.exports = { appBaseUrl };
