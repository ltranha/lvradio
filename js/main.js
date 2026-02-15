/**
 * Main Application Entry Point
 *
 * Responsibilities:
 * - Authentication flow (token validation, modal)
 * - Application bootstrapping (init sequence)
 */

import { getAuthToken, setAuthToken, clearAuthToken, fetchMetadata } from './api.js';
import { state } from './state.js';
import { initUI, setupTabs, setupHeaderControls, setupSettings, setupKeyboardShortcuts } from './ui.js';

// Application startup
const token = getAuthToken();
if (!token) {
    showAuthModal();
} else {
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
    input.value = '';
    input.focus();

    // Submit handler
    const handleSubmit = async () => {
        const tokenValue = input.value.trim();
        if (!tokenValue) {
            showError('Please enter a token');
            return;
        }

        try {
            // Store valid token based on checkbox
            setAuthToken(tokenValue, rememberCheckbox.checked);

            // Fetch metadata to validate token and cache it
            const metadata = await fetchMetadata();

            modal.style.display = 'none';

            // Pass the already-fetched metadata to avoid duplicate fetch
            initApp(metadata);
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
 * @param {Object} [preloadedMetadata] - Pre-fetched metadata to avoid duplicate fetch
 */
async function initApp(preloadedMetadata = null) {
    try {
        // Show app container
        document.getElementById('app').style.display = 'flex';
        document.getElementById('auth-modal').style.display = 'none';

        // Get audio element
        const audioElement = document.getElementById('audio-player');

        // Initialize UI
        initUI(audioElement);
        setupTabs();

        // Load metadata (uses cache if available, or use preloaded)
        const metadata = preloadedMetadata || await fetchMetadata();

        // Initialize state
        state.init(metadata);

        // Setup UI components
        setupHeaderControls();
        setupSettings();
        setupKeyboardShortcuts();

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        clearAuthToken();
        showAuthModal();
    }
}
