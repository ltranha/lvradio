/**
 * UI Rendering and DOM Manipulation
 */

import { fetchArtBlob } from './api.js';
import { state } from './state.js';
import AudioPlayer from './player.js';

let player = null;

/**
 * Initialize UI
 */
export function initUI(audioElement) {
    player = new AudioPlayer(audioElement);
    setupEventListeners();
    setupPlayerControls();
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Player events
    window.addEventListener('player-play', () => {
        updatePlayPauseButton(true);
    });

    window.addEventListener('player-pause', () => {
        updatePlayPauseButton(false);
    });

    window.addEventListener('player-timeupdate', (e) => {
        updateProgressBar(e.detail.currentTime, e.detail.duration);
    });

    window.addEventListener('player-metadata', (e) => {
        updateProgressBar(0, e.detail.duration);
    });

    // State events
    state.subscribe('metadata-loaded', renderTracks);
    state.subscribe('tracks-filtered', renderTracks);
    state.subscribe('track-changed', onTrackChanged);
}

/**
 * Setup player control buttons
 */
function setupPlayerControls() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const progressSlider = document.getElementById('progress-slider');

    playPauseBtn.addEventListener('click', async () => {
        if (state.currentTrack) {
            await player.togglePlayPause();
        }
    });

    volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value) / 100;
        player.setVolume(volume);
    });

    progressSlider.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        const duration = player.getDuration();
        if (duration) {
            const seekTime = (percent / 100) * duration;
            player.seekTo(seekTime);
        }
    });

    // Placeholders for future steps (queue system)
    prevBtn.addEventListener('click', () => {
        console.log('Previous track clicked - not yet implemented');
    });

    nextBtn.addEventListener('click', () => {
        console.log('Next track clicked - not yet implementated');
    });
}

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
        const isPlaying = state.currentTrack?.id === track.id;

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

    // Load images asynchronously
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

        // Add click listener
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            playTrack(trackId);
        });
    });
}

/**
 * Render albums grid
 */
export function renderAlbums() {
    const container = document.getElementById('albums-grid');
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

    // Load images asynchronously and add click listeners
    container.querySelectorAll('.album-card').forEach(async (card) => {
        const artFilename = card.dataset.art;
        if (artFilename) {
            const blobUrl = await fetchArtBlob(artFilename);
            if (blobUrl) {
                const img = card.querySelector('.album-art');
                if (img) img.src = blobUrl;
            }
        }

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

    const tracks = state.getAlbumTracks(albumId);
    const artUrl = album.art ? await fetchArtBlob(album.art) : null;

    // Hide albums grid, show detail
    document.getElementById('albums-grid').style.display = 'none';
    const detailView = document.getElementById('album-detail');
    detailView.style.display = 'block';

    // Render album info
    document.getElementById('album-info').innerHTML = `
        <img class="album-detail-art" src="${artUrl || ''}" alt="${album.name}" onerror="this.style.display='none'">
        <div class="album-detail-text">
            <div class="album-detail-name">${escapeHtml(album.name)}</div>
            <div class="album-detail-artist">${escapeHtml(album.artist || 'Unknown Artist')}</div>
            ${album.year ? `<div class="album-detail-year">${album.year}</div>` : ''}
        </div>
    `;

    // Render album tracks
    const tracksContainer = document.getElementById('album-tracks');
    tracksContainer.innerHTML = tracks.map(track => {
        const duration = formatDuration(track.duration);
        const isPlaying = state.currentTrack?.id === track.id;

        return `
            <div class="track-item ${isPlaying ? 'playing' : ''}" data-track-id="${track.id}">
                <div class="track-info">
                    <div class="track-title">${escapeHtml(track.title)}</div>
                </div>
                <div class="track-duration">${duration}</div>
            </div>
        `;
    }).join('');

    // Add click listeners
    tracksContainer.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            playTrack(trackId);
        });
    });

    // Back button
    document.getElementById('back-to-albums').addEventListener('click', () => {
        detailView.style.display = 'none';
        document.getElementById('albums-grid').style.display = 'grid';
    }, { once: true });
}

/**
 * Play a track
 */
async function playTrack(trackId) {
    state.setCurrentTrack(trackId);
}

/**
 * Handle track change
 */
async function onTrackChanged() {
    if (!state.currentTrack) return;

    // Update playing state in lists
    renderTracks();

    // Update now playing bar
    const album = state.albums[state.currentTrack.albumId] || {};
    const artUrl = album.art ? await fetchArtBlob(album.art) : null;

    // Ensure bar is visible
    document.getElementById('now-playing').style.display = 'flex';
    document.getElementById('now-playing-art-img').src = artUrl || '';
    document.getElementById('now-playing-title').textContent = state.currentTrack.title;
    document.getElementById('now-playing-artist').textContent = album.artist || 'Unknown Artist';

    // Load and play track
    try {
        await player.loadTrack(state.currentTrack);
        await player.play();
    } catch (error) {
        console.error('Error loading track:', error);
    }
}

/**
 * Update progress bar
 */
function updateProgressBar(currentTime, duration) {
    if (!duration) return;

    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-slider').value = percent;
    document.getElementById('current-time').textContent = player.formatTime(currentTime);
    document.getElementById('total-time').textContent = player.formatTime(duration);
}

/**
 * Update play/pause button
 */
function updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause-btn');
    btn.textContent = isPlaying ? '⏸' : '▶';
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
 * Escape HTML
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
