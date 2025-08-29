# Conversation Platform

A sophisticated Agora-based application that enables up to 1000 users to join a platform and automatically match with other users for voice conversations. Each conversation is automatically recorded and can be downloaded as separate audio files.

## Features

### 🎯 Core Functionality
- **Scalable Platform**: Supports up to 1000 concurrent users
- **Automatic Matching**: Users are automatically paired when available
- **Real-time Conversations**: Instant voice communication between matched users
- **Automatic Recording**: Every conversation is recorded from start to finish
- **Manual Control**: Users can end conversations at any time
- **User Status Management**: Real-time status updates (available, waiting, in-conversation)

### 🎙️ Audio Features
- **High-Quality Audio**: Uses Agora's music_standard encoder for optimal voice quality
- **Mute/Unmute**: Users can mute themselves during conversations
- **Automatic Recording**: Conversations are recorded in WebM format with Opus codec
- **Downloadable Recordings**: Each conversation can be downloaded as a separate audio file

### 👥 User Management
- **Real-time User List**: See all online users and their current status
- **Status Indicators**: Visual indicators for user availability
- **Manual Matching**: Users can manually request conversations with available users
- **Automatic Queue**: Users waiting for partners are automatically matched when others join

### 📊 Platform Statistics
- **Live Statistics**: Real-time counts of total users, available users, active conversations, and waiting users
- **Visual Dashboard**: Beautiful UI with gradient cards and animated elements
- **Status Tracking**: Monitor platform activity in real-time

## How It Works

### 1. User Connection
- Users connect to the platform using their Agora App ID and channel
- Each user gets a unique User ID (auto-generated if not provided)
- Users are automatically added to the platform's user list
- Users remain in "available" status until they manually start a conversation

### 2. Manual Conversation Control
- Users can manually request conversations with other available users
- No automatic matching - users have full control over when to start conversations
- Users can browse available users and choose who to talk with
- "Start Conversation" button finds the user who has been waiting longest
- Users cannot talk with themselves
- Recording only starts when a conversation is manually initiated

### 3. Conversation Management
- Once matched, both users enter "in-conversation" status
- Audio recording starts automatically
- Users can see their conversation partner's information
- Either user can end the conversation at any time

### 4. Recording System
- Each user records **only their own voice** (local audio track)
- No recording of other users' voices for privacy and security
- Recordings are saved in WebM format with Opus audio codec
- Files are automatically named with user ID, conversation ID, and timestamp
- Example filenames: `user-123-conversation-abc-2024-01-01T12:00:00.000Z.webm`
- Recordings are automatically uploaded to server (with local download fallback)
- No manual download interface - files are processed automatically

## Technical Implementation

### Architecture
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time Communication**: Agora RTC Web SDK 4.x
- **Audio Recording**: MediaRecorder API with WebM/Opus
- **UI Framework**: Bootstrap 5 with custom styling
- **State Management**: Client-side JavaScript with Map/Set data structures

### Key Components
- **User Management System**: Tracks all users and their states
- **Matching Algorithm**: FIFO-based user pairing
- **Recording Engine**: Automatic audio capture and file generation
- **Real-time Updates**: Live UI updates via WebSocket-like Agora events

### Data Structures
```javascript
// User tracking
platformUsers: Map<uid, userObject>
waitingUsers: Set<uid>
activeConversations: Map<conversationId, conversationObject>

// User object structure
{
  uid: number,
  status: "available" | "waiting" | "in-conversation",
  joinTime: timestamp,
  conversationPartner: uid | null
}
```

## Usage Instructions

### 1. Setup
1. Configure your Agora App ID and App Certificate in the main setup page
2. Navigate to the Conversation Platform example
3. Enter a channel name (or use the default "conversation-platform")

### 2. Connecting
1. Click "Connect to Platform"
2. Grant microphone permissions when prompted
3. You'll be added to the platform's user list

### 3. Starting Conversations
- **Manual Request**: Click "Talk" next to any available user in the user list
- **Auto-Find**: Click "Start Conversation" to find the user who has been waiting longest
- **No Auto-Matching**: Conversations only start when explicitly requested
- **Self-Prevention**: Users cannot start conversations with themselves

### 4. During Conversations
- Use the mute/unmute buttons to control your audio
- The conversation is automatically recorded
- Click "End Conversation" to finish the conversation for both users
- After ending, you can manually start a new conversation when ready

### 5. Recording Management
- **Each user records only their own voice** for privacy and security
- No recording of other users' voices
- Files are automatically uploaded to server when conversations end
- Fallback to local download if server upload fails
- Files are named with user ID, conversation ID, and timestamp
- Recording type: 'local' (user's own voice only)

## Browser Compatibility

- **Chrome**: 66+ (recommended)
- **Firefox**: 60+
- **Safari**: 11.1+
- **Edge**: 79+

## Requirements

- Modern web browser with WebRTC support
- Microphone access
- Agora App ID and App Certificate
- Stable internet connection

## Security Features

- Token-based authentication
- Secure WebRTC connections
- Local audio recording (no server storage)
- Automatic cleanup of audio contexts

## Performance Considerations

- Optimized for up to 1000 concurrent users
- Efficient user matching algorithm
- Minimal memory footprint for recordings
- Automatic resource cleanup

## Troubleshooting

### Common Issues
1. **Microphone not working**: Check browser permissions
2. **No audio in conversation**: Verify microphone is not muted
3. **Recording not starting**: Ensure browser supports MediaRecorder API
4. **Connection issues**: Check internet connection and Agora credentials

### Error Messages
- "Failed to create audio track": Check microphone permissions
- "Connection lost": Network issues, will auto-reconnect
- "Failed to start recording": Browser compatibility issue

## Future Enhancements

- Video support for face-to-face conversations
- Group conversations (3+ users)
- Conversation history and replay
- Advanced matching algorithms (interests, language, etc.)
- Server-side recording storage
- Analytics and usage statistics
