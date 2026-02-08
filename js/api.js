/**
 * API Layer - Handles all requests to Cloudflare Worker
 *
 * Features:
 * - Auth token management (localStorage/sessionStorage)
 * - Art caching with memory management (prevents duplicate fetches & memory leaks)
 * - Support for external URL art (no B2 fetch needed)
 * - Metadata caching
 */

// TODO: Update with your Worker URL
const WORKER_URL = 'https://music-proxy.ltranha.workers.dev';

/**
 * In-memory cache for art blob URLs
 * Maps: artKey -> { url: string, refCount: number, isExternal: boolean }
 */
const artCache = new Map();

/**
 * Metadata cache to avoid refetching db.json on every render
 */
let metadataCache = null;
let metadataCacheTime = 0;
const METADATA_CACHE_TTL = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

/**
 * Check if a string is an external URL (http/https)
 */
function isExternalUrl(str) {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Get art URL - uses cache, supports external URLs
 * @param {string} artSource - Either a filename (fetched from B2) or an external URL
 * @returns {Promise<string|null>} - Object URL or external URL
 */
export async function getArtUrl(artSource) {
    if (!artSource) return null;

    // Check cache first
    if (artCache.has(artSource)) {
        const cached = artCache.get(artSource);
        cached.refCount++;
        return cached.url;
    }

    // External URL - use directly, no fetch needed (saves B2 Class B!)
    if (isExternalUrl(artSource)) {
        artCache.set(artSource, { url: artSource, refCount: 1, isExternal: true });
        return artSource;
    }

    // Local file - fetch from B2 via Worker
    try {
        const safeFilename = encodeURIComponent(artSource);
        const response = await fetchWithAuth(`/art/${safeFilename}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        artCache.set(artSource, { url: blobUrl, refCount: 1, isExternal: false });
        return blobUrl;
    } catch (error) {
        console.error(`Error loading art (${artSource}):`, error);
        return null;
    }
}

/**
 * Release a reference to an art URL (for memory management)
 * Call this when an image is removed from DOM
 */
export function releaseArtUrl(artSource) {
    if (!artSource || !artCache.has(artSource)) return;

    const cached = artCache.get(artSource);
    cached.refCount--;

    // Don't auto-revoke - let clearArtCache handle cleanup
    // This prevents issues with shared art across multiple views
}

/**
 * Clear all cached art (call on logout or manual cache clear)
 * Properly revokes blob URLs to free memory
 */
export function clearArtCache() {
    for (const [key, cached] of artCache) {
        if (!cached.isExternal && cached.url) {
            URL.revokeObjectURL(cached.url);
        }
    }
    artCache.clear();
    console.log('Art cache cleared');
}

/**
 * Get cache statistics (for debugging/settings display)
 */
export function getArtCacheStats() {
    let localCount = 0;
    let externalCount = 0;
    for (const cached of artCache.values()) {
        if (cached.isExternal) externalCount++;
        else localCount++;
    }
    return { total: artCache.size, local: localCount, external: externalCount };
}

/**
 * Clear metadata cache (call when uploading new db.json)
 */
export function clearMetadataCache() {
    metadataCache = null;
    metadataCacheTime = 0;
}

/**
 * Clear all caches (art + metadata)
 */
export function clearAllCaches() {
    clearArtCache();
    clearMetadataCache();
}

/**
 * Get auth token from localStorage or sessionStorage
 */
export function getAuthToken() {
    return localStorage.getItem('music_auth_token') || sessionStorage.getItem('music_auth_token');
}

/**
 * Set auth token in storage
 */
export function setAuthToken(token, persist = false) {
    if (persist) {
        localStorage.setItem('music_auth_token', token);
    } else {
        sessionStorage.setItem('music_auth_token', token);
    }
}

/**
 * Remove auth token from both storages
 */
export function clearAuthToken() {
    localStorage.removeItem('music_auth_token');
    sessionStorage.removeItem('music_auth_token');
}

/**
 * Make authenticated request to Worker
 */
async function fetchWithAuth(path, options = {}) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No auth token');
    }

    const url = `${WORKER_URL}${path}`;
    const headers = {
        'X-Auth-Token': token,
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        clearAuthToken();
        throw new Error('Unauthorized - invalid token');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
}

/**
 * Fetch music library metadata (with caching)
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 */
export async function fetchMetadata(forceRefresh = false) {
    const now = Date.now();

    // Return cached if valid and not forcing refresh
    if (!forceRefresh && metadataCache && (now - metadataCacheTime) < METADATA_CACHE_TTL) {
        return metadataCache;
    }

    const response = await fetchWithAuth('/db.json');
    metadataCache = await response.json();
    metadataCacheTime = now;
    return metadataCache;
}

/**
 * Fetch audio file as blob
 */
export async function fetchAudioBlob(filename) {
    if (!filename) {
        return null;
    }
    const safeFilename = encodeURIComponent(filename);
    const response = await fetchWithAuth(`/music/${safeFilename}`);
    return await response.blob();
}

/**
 * Get streaming URL for audio (for direct audio element use)
 * Returns the Worker URL
 */
export function getAudioStreamUrl(filename) {
    if (!filename) return null;
    const token = getAuthToken();
    const safeFilename = encodeURIComponent(filename);
    return `${WORKER_URL}/music/${safeFilename}?token=${encodeURIComponent(token)}`;
}

/**
 * Revoke object URL (for audio cleanup)
 */
export function revokeAudioUrl(url) {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

/**
 * Upload new db.json metadata
 */
export async function uploadMetadata(metadata) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No auth token');
    }

    const response = await fetch(`${WORKER_URL}/db.json`, {
        method: 'PUT',
        headers: {
            'X-Auth-Token': token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
    });

    if (response.status === 401) {
        clearAuthToken();
        throw new Error('Unauthorized - invalid token');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Clear metadata cache since we just updated it
    clearMetadataCache();

    return await response.json();
}
