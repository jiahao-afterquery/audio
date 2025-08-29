# Conversation Recording Server

This server handles secure storage of conversation recordings from the Agora Conversation Platform.

## Features

- **Secure File Upload**: Handles conversation recordings with proper validation
- **Organized Storage**: Files are stored in date-based folders (YYYY/MM/DD/)
- **Metadata Tracking**: Stores conversation metadata with each recording
- **Admin Access**: Provides endpoints for managing recordings (list, download, delete)
- **Security**: File type validation, size limits, and secure filename generation

## Setup

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

The server will start on port 3002 by default.

## API Endpoints

### Upload Recording
```
POST /api/recordings/upload
```
Uploads a conversation recording with metadata.

**Form Data:**
- `recording`: Audio file (WebM format)
- `conversationId`: Unique conversation identifier
- `userId`: User ID who made the recording
- `channel`: Agora channel name
- `timestamp`: Recording timestamp

**Response:**
```json
{
  "success": true,
  "recordingId": "unique-id",
  "filename": "conv_123_2024-01-01T12:00:00.000Z_abc123.webm",
  "message": "Recording uploaded successfully"
}
```

### List Recordings (Admin)
```
GET /api/recordings
```
Returns list of all recordings (add authentication in production).

### Download Recording (Admin)
```
GET /api/recordings/:id/download
```
Downloads a specific recording file.

### Delete Recording (Admin)
```
DELETE /api/recordings/:id
```
Deletes a recording and its file.

### Health Check
```
GET /api/health
```
Returns server status and recording count.

## File Storage

Recordings are stored in organized folders:
```
recordings/
├── 2024/
│   ├── 01/
│   │   ├── 01/
│   │   │   ├── conv_123_2024-01-01T12:00:00.000Z_abc123.webm
│   │   │   └── conv_456_2024-01-01T15:30:00.000Z_def456.webm
│   │   └── 02/
│   └── 02/
└── 2025/
```

## Security Considerations

### Production Deployment

1. **Authentication**: Add proper authentication middleware for admin endpoints
2. **HTTPS**: Use HTTPS in production
3. **Environment Variables**: Use environment variables for sensitive configuration
4. **Database**: Replace in-memory storage with a real database (PostgreSQL, MongoDB)
5. **File Storage**: Consider cloud storage (AWS S3, Google Cloud Storage) for scalability
6. **Rate Limiting**: Add rate limiting to prevent abuse
7. **CORS**: Configure CORS properly for your domain

### Example Environment Variables

```bash
PORT=3002
NODE_ENV=production
UPLOAD_PATH=/path/to/recordings
MAX_FILE_SIZE=100000000
ALLOWED_ORIGINS=https://yourdomain.com
```

## Configuration

### File Limits
- Maximum file size: 100MB
- Allowed types: Audio files and WebM
- Organized storage by date

### Security Features
- Secure filename generation with random suffixes
- File type validation
- Size limit enforcement
- CORS protection

## Monitoring

The server provides health check endpoints and logs all uploads. In production, consider:

- Logging to files or external services
- Metrics collection
- Error monitoring
- Performance monitoring

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure CORS is configured for your frontend domain
2. **File Upload Fails**: Check file size and type restrictions
3. **Storage Issues**: Ensure the recordings directory is writable
4. **Port Conflicts**: Change the port in the configuration if needed

### Logs

The server logs important events:
- Server startup
- File uploads with metadata
- Errors and exceptions
- Health check requests

## Production Checklist

- [ ] Add authentication middleware
- [ ] Configure HTTPS
- [ ] Set up proper logging
- [ ] Use environment variables
- [ ] Implement database storage
- [ ] Add rate limiting
- [ ] Configure CORS properly
- [ ] Set up monitoring
- [ ] Implement backup strategy
- [ ] Add error handling
- [ ] Test file upload limits
- [ ] Verify security measures
