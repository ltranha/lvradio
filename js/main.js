/**
 * Main Application Entry Point
 */

import { fetchMetadata } from './api.js';
import { state } from './state.js';
import { renderTracks, setupTabs, initUI } from './ui.js';

/**
 * Initialize application
 */
async function initApp() {
    try {
        // Initialize UI
        const audioElement = document.getElementById('audio-player');
        initUI(audioElement);

        // Load metadata
        const metadata = await fetchMetadata();
        state.init(metadata);

        // Setup interactions
        setupTabs();

        // Render initial view
        renderTracks();

        console.log('App initialized successfully');

    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app immediately (because we haven't setup auth yet)
initApp();
