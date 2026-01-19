/**
 * Main Application Entry Point
 */

import { fetchMetadata } from './api.js';
import { state } from './state.js';
import { renderTracks, setupTabs } from './ui.js';
import AudioPlayer from './player.js';

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

        // Initialize Player
        const audioElement = document.getElementById('audio-player');
        const player = new AudioPlayer(audioElement);

        // Define test track
        const testTrack = { fileName: 'song1.mp3', title: 'Test Song' };

        console.log("Click anywhere on the page to start the audio test.");

        // Add a one-time click listener to satisfy browser Autoplay Policy
        document.addEventListener('click', async () => {
            console.log("Interaction detected. Starting test...");
            try {
                console.log("Loading track...");
                await player.loadTrack(testTrack);

                console.log("Playing...");
                await player.play();
            } catch (err) {
                console.error("Test failed:", err);
            }
        }, { once: true });

    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app immediately (because we haven't setup auth yet)
initApp();
