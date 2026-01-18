/**
 * Main Application Entry Point
 */

import { fetchMetadata } from './api.js';
import { state } from './state.js';
import { renderTracks, setupTabs } from './ui.js';

// TODO:
// We will add UI imports and Auth checks in later steps.
// For now, we just want to prove the data layer works.

/**
 * Initialize application
 */
async function initApp() {
    try {
        // Load metadata
        const metadata = await fetchMetadata();
        state.init(metadata);

        // Initialize UI
        setupTabs();

        // Render initial view
        renderTracks();

        console.log('App initialized successfully');
        console.log('Current State:', {
            albums: state.albums,
            tracks: state.tracks,
            metadata: state.metadata
        });

    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app immediately (because we haven't setup auth yet)
initApp();
