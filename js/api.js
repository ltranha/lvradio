/**
 * API Layer - Handles all requests to Cloudflare Worker
 */

const WORKER_URL = 'https://music-proxy.your-username.workers.dev'; // Update with your Worker URL

/**
 * Get auth token from localStorage or sessionStorage
 */
export function getAuthToken() {
    return localStorage.getItem('music_auth_token') || sessionStorage.getItem('music_auth_token');
}

/**
 * Set auth token in localStorage
 */
export function setAuthToken(token) {
    localStorage.setItem('music_auth_token', token);
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
 * Fetch music library metadata
 */
export async function fetchMetadata() {
    // TODO: We are testing locally for now
    return await (await fetch('./db.json')).json();
    const response = await fetchWithAuth('/db.json');
    return await response.json();
}

/**
 * Get album art URL
 */
export async function fetchArtBlob(filename) {
    if (!filename) {
        return null;
    }
    const token = getAuthToken();
    if (!token) {
        return null;
    }
    try {
        const response = await fetchWithAuth(`/art/${filename}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error loading art:', error);
        return null;
    }
}

/**
 * Fetch audio file
 */
export async function fetchAudioBlob(filename) {
    const response = await fetchWithAuth(`/music/${filename}`);
    return await response.blob();
}

/**
 * Revoke object URL
 */
export function revokeAudioUrl(url) {
    URL.revokeObjectURL(url);
}
