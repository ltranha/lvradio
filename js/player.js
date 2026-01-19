/**
 * Audio Player Controller
 */

import { fetchAudioBlob, revokeAudioUrl } from './api.js';
import { state } from './state.js';

class AudioPlayer {
    constructor(audioElement) {
        this.audio = audioElement;
        this.currentBlobUrl = null;
        this.isLoading = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Time update for progress bar
        this.audio.addEventListener('timeupdate', () => {
            this.onTimeUpdate();
        });

        // Loaded metadata
        this.audio.addEventListener('loadedmetadata', () => {
            this.onMetadataLoaded();
        });

        // Play/pause events
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());

        // Ended event
        this.audio.addEventListener('ended', () => this.onEnded());

        // Error handling
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.onError();
        });
    }

    /**
     * Load and play a track
     */
    async loadTrack(track) {
        if (!track) return;

        this.isLoading = true;

        try {
            // Clean up previous blob URL
            if (this.currentBlobUrl) {
                revokeAudioUrl(this.currentBlobUrl);
                this.currentBlobUrl = null;
            }

            // Pause current playback
            this.audio.pause();

            // Fetch audio blob
            const blob = await fetchAudioBlob(track.fileName);

            // Create Object URL (using native URL.createObjectURL or helper if available)
            this.currentBlobUrl = URL.createObjectURL(blob);
            this.audio.src = this.currentBlobUrl;

            // Load the audio
            await this.audio.load();
            this.isLoading = false;

        } catch (error) {
            console.error('Error loading track:', error);
            this.isLoading = false;
            throw error;
        }
    }

    /**
     * Play/Pause Controls
     */
    async play() {
        try {
            await this.audio.play();
        } catch (error) {
            console.error('Error playing:', error);
            throw error;
        }
    }

    pause() {
        this.audio.pause();
    }

    async togglePlayPause() {
        if (this.audio.paused) {
            await this.play();
        } else {
            this.pause();
        }
    }

    /**
     * Seek to position in seconds
     */
    seekTo(seconds) {
        if (this.audio.duration) {
            this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration));
        }
    }

    /**
     * Set volume (0-1)
     */
    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Getters
     */
    getCurrentTime() { return this.audio.currentTime || 0; }
    getDuration() { return this.audio.duration || 0; }
    isPlaying() { return !this.audio.paused; }

    formatTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Event handlers that dispatch to Window for UI to catch
    onTimeUpdate() {
        window.dispatchEvent(new CustomEvent('player-timeupdate', {
            detail: {
                currentTime: this.getCurrentTime(),
                duration: this.getDuration(),
            }
        }));
    }

    onMetadataLoaded() {
        window.dispatchEvent(new CustomEvent('player-metadata', {
            detail: { duration: this.getDuration() }
        }));
    }

    onPlay() { window.dispatchEvent(new CustomEvent('player-play')); }
    onPause() { window.dispatchEvent(new CustomEvent('player-pause')); }

    onEnded() {
        // Auto-play next track if available
        const nextTrack = state.getNextTrack();
        if (nextTrack) {
            state.setCurrentTrack(nextTrack.id);
            // Note: UI will react to state change and call player.loadTrack
        } else {
            window.dispatchEvent(new CustomEvent('player-ended'));
        }
    }

    onError() {
        window.dispatchEvent(new CustomEvent('player-error', {
            detail: { message: 'Failed to load audio' }
        }));
    }

    destroy() {
        if (this.currentBlobUrl) revokeAudioUrl(this.currentBlobUrl);
        this.audio.pause();
        this.audio.src = '';
    }
}

export default AudioPlayer;
