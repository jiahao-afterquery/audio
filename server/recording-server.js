const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create organized folder structure: recordings/YYYY/MM/DD/
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        const uploadPath = path.join(__dirname, 'recordings', year.toString(), month, day);
        
        // Create directories if they don't exist
        fs.mkdirSync(uploadPath, { recursive: true });
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate secure filename with conversation ID and timestamp
        const conversationId = req.body.conversationId || 'unknown';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        
        const filename = `conv_${conversationId}_${timestamp}_${randomSuffix}.webm`;
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 1
    },
    fileFilter: function (req, file, cb) {
        // Only allow audio files
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

// Database simulation (in production, use a real database like PostgreSQL, MongoDB, etc.)
const recordingsDB = new Map();

// Upload endpoint
app.post('/api/recordings/upload', upload.single('recording'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No recording file provided' });
        }

        const recordingData = {
            id: crypto.randomBytes(16).toString('hex'),
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            conversationId: req.body.conversationId,
            userId: req.body.userId,
            recordingType: req.body.recordingType || 'mixed',
            channel: req.body.channel,
            timestamp: req.body.timestamp,
            uploadedAt: new Date().toISOString(),
            status: 'uploaded'
        };

        // Store recording metadata in database
        recordingsDB.set(recordingData.id, recordingData);

        // Log the upload (in production, use proper logging)
        console.log(`Recording uploaded: ${recordingData.filename} by user ${recordingData.userId} in conversation ${recordingData.conversationId}`);

        res.json({
            success: true,
            recordingId: recordingData.id,
            filename: recordingData.filename,
            message: 'Recording uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload recording' });
    }
});

// Get recordings list (admin only - in production, add proper authentication)
app.get('/api/recordings', (req, res) => {
    try {
        const recordings = Array.from(recordingsDB.values()).map(recording => ({
            id: recording.id,
            filename: recording.filename,
            conversationId: recording.conversationId,
            userId: recording.userId,
            recordingType: recording.recordingType,
            channel: recording.channel,
            timestamp: recording.timestamp,
            size: recording.size,
            status: recording.status
        }));

        res.json({
            success: true,
            recordings: recordings,
            total: recordings.length
        });

    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});

// Download recording (admin only - in production, add proper authentication)
app.get('/api/recordings/:id/download', (req, res) => {
    try {
        const recordingId = req.params.id;
        const recording = recordingsDB.get(recordingId);

        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        // Check if file exists
        if (!fs.existsSync(recording.path)) {
            return res.status(404).json({ error: 'Recording file not found' });
        }

        // Stream the file
        res.download(recording.path, recording.originalName);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download recording' });
    }
});

// Delete recording (admin only - in production, add proper authentication)
app.delete('/api/recordings/:id', (req, res) => {
    try {
        const recordingId = req.params.id;
        const recording = recordingsDB.get(recordingId);

        if (!recording) {
            return res.status(404).json({ error: 'Recording not found' });
        }

        // Delete file from filesystem
        if (fs.existsSync(recording.path)) {
            fs.unlinkSync(recording.path);
        }

        // Remove from database
        recordingsDB.delete(recordingId);

        res.json({
            success: true,
            message: 'Recording deleted successfully'
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete recording' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        recordingsCount: recordingsDB.size
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Recording server running on port ${PORT}`);
    console.log(`Upload endpoint: http://localhost:${PORT}/api/recordings/upload`);
    console.log(`Recordings will be stored in: ${path.join(__dirname, 'recordings')}`);
});

module.exports = app;
