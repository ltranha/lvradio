/**
 * Main Application Entry Point
 */

import { setAuthToken, getAuthToken, clearAuthToken, fetchMetadata } from './api.js';
import { state } from './state.js';
import { initUI, setupTabs, renderTracks } from './ui.js';

// Check if auth token exists
const token = getAuthToken();

if (!token) {
    // Show auth modal
    showAuthModal();
} else {
    // Initialize app
    initApp();
}

/**
 * Show authentication modal
 */
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    const input = document.getElementById('auth-token-input');
    const submitBtn = document.getElementById('auth-submit');
    const rememberCheckbox = document.getElementById('remember-token');
    const errorDiv = document.getElementById('auth-error');

    modal.style.display = 'flex';

    // Submit handler
    const handleSubmit = async () => {
        const tokenValue = input.value.trim();
        if (!tokenValue) {
            showError('Please enter a token');
            return;
        }

        // Test token by fetching metadata
        try {
            // Store valid token based on checkbox
            setAuthToken(tokenValue, rememberCheckbox.checked);
            await fetchMetadata();

            modal.style.display = 'none';
            initApp();
        } catch (error) {
            console.error('Auth error:', error);
            showError('Invalid token. Please check and try again.');
            clearAuthToken();
        }
    };

    submitBtn.addEventListener('click', handleSubmit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 5000);
    }
}

/**
 * Initialize application
 */
async function initApp() {
    try {
        // Show app container
        document.getElementById('app').style.display = 'flex';
        document.getElementById('auth-modal').style.display = 'none';

        // Get audio element
        const audioElement = document.getElementById('audio-player');

        // Initialize UI
        initUI(audioElement);
        setupTabs();

        // Load metadata
        const metadata = await fetchMetadata();
        state.init(metadata);

        // Render initial view
        renderTracks();

        // Setup settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            // Clear token and show auth modal again
            clearAuthToken();
            location.reload();
        });

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        clearAuthToken();
        showAuthModal();
    }
}
