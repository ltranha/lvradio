/**
 * Application State Management
 */

class AppState {
    constructor() {
        this.metadata = null;
        this.tracks = [];
        this.albums = {};
        this.filteredTracks = [];
        this.currentTrack = null;
        this.currentTrackIndex = -1;
        this.queue = [];
        this.queueIndex = -1;
        this.isShuffled = false;
        this.originalQueue = [];
        this.listeners = new Map();
    }

    /**
     * Initialize state with metadata loaded from API
     */
    init(metadata) {
        this.metadata = metadata;
        this.albums = metadata.albums || {};
        this.tracks = metadata.tracks || [];
        this.filteredTracks = [...this.tracks];
        this.notify('metadata-loaded');
    }

    /**
     * Filter tracks by search query
     */
    filterTracks(query) {
        if (!query || query.trim() === '') {
            this.filteredTracks = [...this.tracks];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredTracks = this.tracks.filter(track => {
                const album = this.albums[track.albumId];
                return (
                    track.title.toLowerCase().includes(lowerQuery) ||
                    (album && album.artist.toLowerCase().includes(lowerQuery)) ||
                    (album && album.name.toLowerCase().includes(lowerQuery))
                );
            });
        }
        this.notify('tracks-filtered');
    }

    /**
     * Get tracks for a specific album
     */
    getAlbumTracks(albumId) {
        return this.tracks.filter(track => track.albumId === albumId);
    }

    /**
     * Set the currently playing track
     */
    setCurrentTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index === -1) return false;

        this.currentTrack = this.tracks[index];
        this.currentTrackIndex = index;
        this.notify('track-changed');
        return true;
    }

    /**
     * Subscribe to state changes (UI updates)
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Notify listeners of state change
     */
    notify(event, data = null) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

// Export singleton instance
export const state = new AppState();
