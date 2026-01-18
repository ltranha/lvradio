/**
 * UI Rendering and DOM Manipulation
 */

import { fetchArtBlob } from './api.js';
import { state } from './state.js';

/**
 * Render tracks list
 */
export function renderTracks() {
    const container = document.getElementById('tracks-list');
    const emptyState = document.getElementById('empty-state');

    // Check if we have tracks
    if (!state.filteredTracks || state.filteredTracks.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Generate HTML
    container.innerHTML = state.filteredTracks.map(track => {
        const album = state.albums[track.albumId] || {};
        const duration = formatDuration(track.duration);
        // Placeholder for playing state (will be implemented later)
        const isPlaying = false;

        return `
            <div class="track-item ${isPlaying ? 'playing' : ''}" data-track-id="${track.id}" data-art="${album.art || ''}">
                <img class="track-art" src="" alt="${album.name || ''}" loading="lazy" onerror="this.style.display='none'">
                <div class="track-info">
                    <div class="track-title">${escapeHtml(track.title)}</div>
                    <div class="track-artist">${escapeHtml(album.artist || 'Unknown Artist')}</div>
                </div>
                <div class="track-duration">${duration}</div>
            </div>
        `;
    }).join('');

    // Load images asynchronously and add listeners
    container.querySelectorAll('.track-item').forEach(async (item) => {
        // 1. Load Art
        const artFilename = item.dataset.art;
        if (artFilename) {
            const blobUrl = await fetchArtBlob(artFilename);
            if (blobUrl) {
                const img = item.querySelector('.track-art');
                if (img) img.src = blobUrl;
            }
        }

        // 2. Add click listener (Logging only for now)
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            console.log('👆 Track clicked:', trackId, '(Audio Player not connected yet)');
        });
    });
}

/**
 * Format duration (seconds to MM:SS)
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
