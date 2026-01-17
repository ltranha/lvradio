/**
 * Main Application Entry Point
 */

import { fetchMetadata } from './api.js';
import { state } from './state.js';

// TODO:
// We will add UI imports and Auth checks in later steps.
// For now, we just want to prove the data layer works.

/**
 * Initialize application
 */
async function initApp() {
    console.log('Starting App Initialization...');
    try {
        // 1. Fetch metadata from API (or local db.json)
        console.log('Fetching metadata...');
        const metadata = await fetchMetadata();

        // 2. Initialize State with the fetched data
        state.init(metadata);

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
