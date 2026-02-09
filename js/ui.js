/**
 * UI Rendering and DOM Manipulation
 *
 * Features:
 * - Player controls and progress bar
 * - Track, Album views with rendering
 * - Economy mode (skip art loading)
 * - Art caching integration
 * - Settings modal and cache management
 */

import { getArtUrl, getArtCacheStats, clearAllCaches, clearAuthToken, fetchMetadata, uploadMetadata } from './api.js';
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
    state.subscribe('settings-changed', onSettingsChanged);
}

/**
 * Handle settings changes (re-render views immediately)
 */
function onSettingsChanged(data) {
    if (data && data.key === 'economyMode') {
        const headerToggle = document.getElementById('economy-toggle-header');
        const settingsToggle = document.getElementById('economy-mode-toggle');
        if (headerToggle) headerToggle.checked = data.value;
        if (settingsToggle) settingsToggle.checked = data.value;
        renderCurrentView();
    }
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

    // Initialize volume from settings
    volumeSlider.value = state.settings.volume;
    player.setVolume(state.settings.volume / 100);

    playPauseBtn.addEventListener('click', async () => {
        if (state.currentTrack) {
            await player.togglePlayPause();
        }
    });

    volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value) / 100;
        player.setVolume(volume);
        state.setSetting('volume', parseFloat(e.target.value));
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
 * Update play/pause button
 */
function updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('play-pause-btn');
    btn.textContent = isPlaying ? '⏸' : '▶';
}

function updateProgressBar(currentTime, duration) {
    if (!duration) return;
    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-fill').style.width = `${percent}%`;
    document.getElementById('progress-slider').value = percent;
    document.getElementById('current-time').textContent = player.formatTime(currentTime);
    document.getElementById('total-time').textContent = player.formatTime(duration);
}

/**
 * Re-render the currently active view
 */
export function renderCurrentView() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) return;

    const viewName = activeTab.dataset.view;
    if (viewName === 'tracks') {
        renderTracks();
    } else if (viewName === 'albums') {
        const albumDetail = document.getElementById('album-detail');
        if (!albumDetail || albumDetail.style.display === 'none') renderAlbums();
    }
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
    const economyMode = state.settings.economyMode;

    // Generate HTML
    container.innerHTML = state.filteredTracks.map(track => {
        const album = state.albums[track.albumId] || {};
        const duration = formatDuration(track.duration);
        const isPlaying = state.currentTrack?.id === track.id;
        const albumName = album.name || 'Unknown Album';
        const artistName = album.artist || 'Unknown Artist';

        const artHtml = economyMode ? '' : `
            <div class="track-art-container" data-art="${escapeAttr(album.art || '')}">
                <img class="track-art" src="" alt="${escapeAttr(albumName)}" loading="lazy" onerror="this.style.visibility='hidden'">
            </div>`;

        return `
            <div class="track-item ${isPlaying ? 'playing' : ''}" data-track-id="${track.id}">
                ${artHtml}
                <div class="track-info">
                    <div class="track-title" title="${escapeAttr(track.title)}">${escapeHtml(track.title)}</div>
                    <div class="track-meta">
                        <span class="track-artist" title="${escapeAttr(artistName)}">${escapeHtml(artistName)}</span>
                        <span class="track-separator">•</span>
                        <span class="track-album" title="${escapeAttr(albumName)}">${escapeHtml(albumName)}</span>
                    </div>
                </div>
                <div class="track-duration">${duration}</div>
            </div>
        `;
    }).join('');

    // Load art asynchronously (only if economy mode is OFF)
    if (!economyMode) {
        container.querySelectorAll('.track-art-container').forEach(async (artContainer) => {
            const artSource = artContainer.dataset.art;
            if (artSource) {
                const artUrl = await getArtUrl(artSource);
                if (artUrl) {
                    const img = artContainer.querySelector('.track-art');
                    if (img) {
                        img.src = artUrl;
                        img.style.visibility = 'visible';
                    }
                }
            }
        });
    }

    // Add click listeners
    container.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => playTrack(item.dataset.trackId));
    });
}

/**
 * Render albums grid
 */
export function renderAlbums() {
    const container = document.getElementById('albums-grid');
    if (Object.keys(state.albums).length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No albums found</p></div>';
        return;
    }

    const economyMode = state.settings.economyMode;

    container.innerHTML = Object.entries(state.albums).map(([albumId, album]) => {
        const albumName = album.name || 'Unknown Album';
        const artistName = album.artist || 'Unknown Artist';

        const artHtml = economyMode
            ? `<div class="album-art-placeholder">💿</div>`
            : `<div class="album-art-container" data-art="${escapeAttr(album.art || '')}">
                <img class="album-art" src="" alt="${escapeAttr(albumName)}" loading="lazy" onerror="this.style.visibility='hidden'">
               </div>`;

        return `
            <div class="album-card" data-album-id="${albumId}">
                ${artHtml}
                <div class="album-name" title="${escapeAttr(albumName)}">${escapeHtml(albumName)}</div>
                <div class="album-artist" title="${escapeAttr(artistName)}">${escapeHtml(artistName)}</div>
            </div>
        `;
    }).join('');

    // Load art asynchronously (only if economy mode is OFF)
    if (!economyMode) {
        container.querySelectorAll('.album-art-container').forEach(async (artContainer) => {
            const artSource = artContainer.dataset.art;
            if (artSource) {
                const artUrl = await getArtUrl(artSource);
                if (artUrl) {
                    const img = artContainer.querySelector('.album-art');
                    if (img) {
                        img.src = artUrl;
                        img.style.visibility = 'visible';
                    }
                }
            }
        });
    }

    // Add click listeners
    container.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', () => showAlbumDetail(card.dataset.albumId));
    });
}

/**
 * Show album detail view
 */
async function showAlbumDetail(albumId) {
    const album = state.albums[albumId];
    if (!album) return;

    const tracks = state.getAlbumTracks(albumId);
    const artUrl = album.art ? await getArtUrl(album.art) : null;

    // Hide albums grid, show detail
    document.getElementById('albums-grid').style.display = 'none';
    const detailView = document.getElementById('album-detail');
    detailView.style.display = 'block';

    // Render album info
    document.getElementById('album-info').innerHTML = `
        <img class="album-detail-art" src="${artUrl || ''}" alt="${escapeAttr(album.name)}" onerror="this.style.display='none'">
        <div class="album-detail-text">
            <div class="album-detail-name">${escapeHtml(album.name)}</div>
            <div class="album-detail-artist">${escapeHtml(album.artist || 'Unknown Artist')}</div>
            ${album.year ? `<div class="album-detail-year">${album.year}</div>` : ''}
        </div>
    `;

    // Render album tracks
    const tracksContainer = document.getElementById('album-tracks');
    tracksContainer.innerHTML = tracks.map((track, index) => {
        const duration = formatDuration(track.duration);
        const isPlaying = state.currentTrack?.id === track.id;
        const trackNum = track.trackNumber || (index + 1);
        const trackTotal = track.trackTotal ? `/${track.trackTotal}` : '';

        return `
            <div class="track-item album-track ${isPlaying ? 'playing' : ''}" data-track-id="${track.id}">
                <div class="track-number">${trackNum}${trackTotal}</div>
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
function playTrack(trackId) {
    state.setCurrentTrack(trackId, state.filteredTracks);
}

/**
 * Handle track change
 */
async function onTrackChanged() {
    if (!state.currentTrack) return;

    // Update playing state (just toggle classes, no full re-render)
    updatePlayingState();

    // Update now playing bar
    const album = state.albums[state.currentTrack.albumId] || {};
    const artUrl = album.art ? await getArtUrl(album.art) : null;

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
 * Update visual playing state without re-rendering
 */
function updatePlayingState() {
    document.querySelectorAll('#tracks-list .track-item').forEach(item => {
        item.classList.toggle('playing', item.dataset.trackId === state.currentTrack?.id);
    });
    document.querySelectorAll('#album-tracks .track-item').forEach(item => {
        item.classList.toggle('playing', item.dataset.trackId === state.currentTrack?.id);
    });
}

/**
 * Setup view tabs (Tracks, Albums)
 */
export function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');

            hideAllDetailViews();

            if (viewName === 'albums') renderAlbums();
            else renderTracks();
        });
    });
}

/**
 * Reset view to main grids
 */
function hideAllDetailViews() {
    const albumDetail = document.getElementById('album-detail');
    const albumsGrid = document.getElementById('albums-grid');

    if (albumDetail) albumDetail.style.display = 'none';
    if (albumsGrid) albumsGrid.style.display = 'grid';
}

/**
 * Navigate to home (tracks view)
 */
export function navigateToHome() {
    const tracksTab = document.querySelector('.tab-btn[data-view="tracks"]');
    if (tracksTab) tracksTab.click();
}

/**
 * Setup header controls (logo click, economy toggle)
 */
export function setupHeaderControls() {
    const logo = document.querySelector('.logo');
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => navigateToHome());

    const headerToggle = document.getElementById('economy-toggle-header');
    if (headerToggle) {
        headerToggle.checked = state.settings.economyMode;
        headerToggle.addEventListener('change', (e) => state.setSetting('economyMode', e.target.checked));
    }
}

/**
 * Setup settings modal (economy mode, cache, upload, logout)
 */
export function setupSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close');
    const logoutBtn = document.getElementById('logout-btn');
    const economyToggle = document.getElementById('economy-mode-toggle');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const cacheStatus = document.getElementById('cache-status');
    const uploadInput = document.getElementById('db-upload-input');
    const uploadBtn = document.getElementById('db-upload-btn');
    const uploadStatus = document.getElementById('upload-status');

    if (economyToggle) economyToggle.checked = state.settings.economyMode;

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'flex';
        updateCacheStats();
    });

    closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    });

    if (economyToggle) {
        economyToggle.addEventListener('change', (e) => state.setSetting('economyMode', e.target.checked));
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            clearAllCaches();
            updateCacheStats();
            showStatus('Cache cleared! Art will reload on next view.', 'success');
        });
    }

    logoutBtn.addEventListener('click', () => {
        clearAllCaches();
        clearAuthToken();
        location.reload();
    });

    function updateCacheStats() {
        if (cacheStatus) {
            const stats = getArtCacheStats();
            cacheStatus.textContent = `Cached: ${stats.local} local, ${stats.external} external URLs`;
        }
    }

    async function handleUpload(file) {
        if (!file) { showStatus('Please select a file', 'error'); return; }

        try {
            const text = await file.text();
            const json = JSON.parse(text);

            if (!json.tracks || !json.albums) {
                showStatus('Invalid db.json: missing tracks or albums', 'error');
                return;
            }

            showStatus('Uploading...', 'info');
            await uploadMetadata(json);
            showStatus('Upload successful! Refreshing...', 'success');

            setTimeout(async () => {
                clearAllCaches();
                const metadata = await fetchMetadata(true);
                state.init(metadata);
                renderCurrentView();
                settingsModal.style.display = 'none';
                uploadInput.value = '';
            }, 1000);
        } catch (error) {
            console.error('Upload error:', error);
            showStatus(error instanceof SyntaxError ? 'Invalid JSON format' : 'Upload failed: ' + error.message, 'error');
        }
    }

    uploadBtn.addEventListener('click', () => handleUpload(uploadInput.files[0]));

    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault(); e.stopPropagation();
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.json')) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    uploadInput.files = dataTransfer.files;
                    handleUpload(file);
                } else {
                    showStatus('Please drop a .json file', 'error');
                }
            }
        });
    }

    function showStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = 'upload-status ' + type;
        uploadStatus.style.display = 'block';
        if (type !== 'info') setTimeout(() => uploadStatus.style.display = 'none', 5000);
    }
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
