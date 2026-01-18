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
        // Load Art
        const artFilename = item.dataset.art;
        if (artFilename) {
            const blobUrl = await fetchArtBlob(artFilename);
            if (blobUrl) {
                const img = item.querySelector('.track-art');
                if (img) img.src = blobUrl;
            }
        }

        // Add click listener (Logging only for now)
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            console.log('Track clicked:', trackId, '(Audio Player not connected yet)');
        });
    });
}

/**
 * Render albums grid
 */
export function renderAlbums() {
    const container = document.getElementById('albums-grid');
    // Guard clause if container is missing (e.g. if HTML structure changed)
    if (!container) return;

    const albums = Object.values(state.albums);

    if (albums.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No albums found</p></div>';
        return;
    }

    // Generate HTML
    container.innerHTML = Object.entries(state.albums).map(([albumId, album]) => {
        return `
            <div class="album-card" data-album-id="${albumId}" data-art="${album.art || ''}">
                <img class="album-art" src="" alt="${album.name}" loading="lazy" onerror="this.style.display='none'">
                <div class="album-name">${escapeHtml(album.name)}</div>
                <div class="album-artist">${escapeHtml(album.artist || 'Unknown Artist')}</div>
            </div>
        `;
    }).join('');

    // Load images and add listeners
    container.querySelectorAll('.album-card').forEach(async (card) => {
        // Load Art
        const artFilename = card.dataset.art;
        if (artFilename) {
            const blobUrl = await fetchArtBlob(artFilename);
            if (blobUrl) {
                const img = card.querySelector('.album-art');
                if (img) img.src = blobUrl;
            }
        }

        // Click Listener (TODO: Detail view to be implemented)
        card.addEventListener('click', () => {
            const albumId = card.dataset.albumId;
            showAlbumDetail(albumId);
        });
    });
}

/**
 * Show album detail view
 */
async function showAlbumDetail(albumId) {
    const album = state.albums[albumId];
    if (!album) return;

    // Get tracks specific to this album using the State helper
    const tracks = state.getAlbumTracks(albumId);

    // Fetch high-res art
    const artUrl = album.art ? await fetchArtBlob(album.art) : null;

    // UI Toggle: Hide grid, show detail
    document.getElementById('albums-grid').style.display = 'none';
    const detailView = document.getElementById('album-detail');
    detailView.style.display = 'block';

    // Render album header info
    document.getElementById('album-info').innerHTML = `
        <img class="album-detail-art" src="${artUrl || ''}" alt="${album.name}" onerror="this.style.display='none'">
        <div class="album-detail-text">
            <div class="album-detail-name">${escapeHtml(album.name)}</div>
            <div class="album-detail-artist">${escapeHtml(album.artist || 'Unknown Artist')}</div>
            ${album.year ? `<div class="album-detail-year">${album.year}</div>` : ''}
        </div>
    `;

    // Render album tracks list
    const tracksContainer = document.getElementById('album-tracks');
    tracksContainer.innerHTML = tracks.map(track => {
        const duration = formatDuration(track.duration);
        // TODO: Playing state logic to be implemented

        return `
            <div class="track-item" data-track-id="${track.id}">
                <div class="track-info">
                    <div class="track-title">${escapeHtml(track.title)}</div>
                </div>
                <div class="track-duration">${duration}</div>
            </div>
        `;
    }).join('');

    // Add click listeners to tracks (Logging for now)
    tracksContainer.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            console.log('Album Track clicked:', trackId);
        });
    });

    // Back button
    document.getElementById('back-to-albums').addEventListener('click', () => {
        detailView.style.display = 'none';
        document.getElementById('albums-grid').style.display = 'grid';
    }, { once: true });
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

/**
 * Setup view tabs
 */
export function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;

            // Update active tab
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active view
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');

            // Render content
            if (viewName === 'albums') {
                renderAlbums();
            } else {
                renderTracks();
            }
        });
    });
}
