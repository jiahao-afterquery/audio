// Configuration for conversation recording server
const CONFIG = {
    // Recording server settings
    RECORDING_SERVER: {
        // Change this to your actual server URL in production
        UPLOAD_URL: 'http://localhost:3002/api/recordings/upload',
        
        // Enable/disable server uploads (set to false to use local downloads only)
        ENABLE_SERVER_UPLOADS: true,
        
        // Fallback to local download if server upload fails
        FALLBACK_TO_LOCAL: true,
        
        // Upload timeout in milliseconds
        UPLOAD_TIMEOUT: 30000, // 30 seconds
        
        // Retry settings
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000 // 2 seconds
    },
    
    // Recording settings
    RECORDING: {
        // File format
        FORMAT: 'audio/webm;codecs=opus',
        
        // Maximum file size (in bytes) - 50MB
        MAX_FILE_SIZE: 50 * 1024 * 1024,
        
        // Recording quality settings
        AUDIO_BITRATE: 128000, // 128 kbps
        SAMPLE_RATE: 48000 // 48 kHz
    },
    
    // Security settings
    SECURITY: {
        // Enable file validation
        VALIDATE_FILES: true,
        
        // Allowed file types
        ALLOWED_TYPES: ['audio/webm', 'audio/ogg', 'audio/mp4'],
        
        // Maximum filename length
        MAX_FILENAME_LENGTH: 255
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    // For browser usage
    window.CONFIG = CONFIG;
}
