// Conversation Platform Application
// Supports up to 1000 users with automatic matching and conversation recording

AgoraRTC.enableLogUpload();

// Global variables
let client = null;
let localAudioTrack = null;
let remoteAudioTrack = null;
let isConnected = false;
let isInConversation = false;
let isMuted = false;
let currentConversationPartner = null;
let conversationStartTime = null;
let mediaRecorder = null;
let recordedChunks = [];
let conversationId = null;
let currentConversationId = null;

// User management
let platformUsers = new Map(); // uid -> user object
let waitingUsers = new Set();
let activeConversations = new Map(); // conversationId -> {user1, user2, startTime}

// Audio recording setup
let audioContext = null;
let audioStream = null;
let recordingStream = null;

// Local user recording only
let localMediaRecorder = null;
let localRecordedChunks = [];

// Options from local storage
let options = getOptionsFromLocal();

// Initialize the application
$(document).ready(function() {
    // Force complete cleanup for fresh start
    forceFreshStart();
    
    // Additional cleanup to ensure no duplicates
    setTimeout(() => {
        cleanupDuplicateUsers();
        console.log("Additional cleanup completed after page load");
    }, 1000);
    
    // Force conversation check after connection
    setTimeout(() => {
        if (isConnected) {
            console.log("Forcing conversation check after connection");
            checkForConversationUpdates();
        }
    }, 2000);
    
    initializeEventListeners();
    updateStats();
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', function(e) {
        if (e.key === 'sharedConversations' && isConnected) {
            console.log("Storage changed, checking for conversation updates");
            // Reload shared conversations from localStorage
            try {
                const storedConversations = JSON.parse(e.newValue || '{}');
                window.sharedConversations = new Map();
                Object.entries(storedConversations).forEach(([id, data]) => {
                    window.sharedConversations.set(id, data);
                });
                // Check for updates immediately
                checkForConversationUpdates();
            } catch (error) {
                console.warn("Failed to process storage change:", error);
            }
        } else if (e.key === 'conversationTrigger' && isConnected) {
            console.log("Conversation trigger detected, forcing conversation check");
            // Force immediate conversation check
            setTimeout(() => {
                checkForConversationUpdates();
            }, 50);
        } else if (e.key === 'sharedUserStatuses' && isConnected) {
            console.log("Storage changed, checking for user status updates");
            // Reload shared user statuses from localStorage
            try {
                const storedUserStatuses = JSON.parse(e.newValue || '{}');
                window.sharedUserStatuses = new Map();
                Object.entries(storedUserStatuses).forEach(([uid, data]) => {
                    window.sharedUserStatuses.set(uid, data);
                });
                // Check for updates immediately
                checkForUserStatusUpdates();
            } catch (error) {
                console.warn("Failed to process user status storage change:", error);
            }
        }
    });
});

function cleanupOldSessionData() {
    const sessionId = generateSessionId();
    const currentTime = Date.now();
    const sessionTimeout = 5 * 60 * 1000; // 5 minutes
    
    console.log("Starting cleanup of old session data...");
    console.log("Current time:", new Date(currentTime).toISOString());
    
    // Clean up old user statuses
    try {
        const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
        console.log("Found stored user statuses:", Object.keys(storedUserStatuses));
        
        const cleanedUserStatuses = {};
        
        Object.entries(storedUserStatuses).forEach(([uid, data]) => {
            console.log(`Checking user ${uid}, timestamp: ${data.timestamp}, age: ${currentTime - data.timestamp}ms`);
            // Keep only recent statuses (within 5 minutes)
            if (data.timestamp && (currentTime - data.timestamp) < sessionTimeout) {
                cleanedUserStatuses[uid] = data;
                console.log(`Keeping user ${uid}`);
            } else {
                console.log(`Removing old user ${uid}`);
            }
        });
        
        localStorage.setItem('sharedUserStatuses', JSON.stringify(cleanedUserStatuses));
        console.log("Cleaned up old user statuses. Remaining:", Object.keys(cleanedUserStatuses));
    } catch (error) {
        console.warn("Failed to clean up user statuses:", error);
    }
    
    // Clean up old conversations
    try {
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        console.log("Found stored conversations:", Object.keys(storedConversations));
        
        const cleanedConversations = {};
        
        Object.entries(storedConversations).forEach(([id, data]) => {
            console.log(`Checking conversation ${id}, timestamp: ${data.timestamp}, age: ${currentTime - data.timestamp}ms`);
            // Keep only recent conversations (within 5 minutes)
            if (data.timestamp && (currentTime - data.timestamp) < sessionTimeout) {
                cleanedConversations[id] = data;
                console.log(`Keeping conversation ${id}`);
            } else {
                console.log(`Removing old conversation ${id}`);
            }
        });
        
        localStorage.setItem('sharedConversations', JSON.stringify(cleanedConversations));
        console.log("Cleaned up old conversations. Remaining:", Object.keys(cleanedConversations));
    } catch (error) {
        console.warn("Failed to clean up conversations:", error);
    }
    
    // Clear local data structures
    platformUsers.clear();
    waitingUsers.clear();
    activeConversations.clear();
    
    // Initialize shared data structures
    window.sharedUserStatuses = new Map();
    window.sharedConversations = new Map();
    
    console.log("Cleared local data structures and initialized shared maps");
    console.log("Cleanup complete!");
}

function forceFreshStart() {
    console.log("=== FORCING FRESH START ===");
    
    // Completely clear all shared data
    localStorage.removeItem('sharedUserStatuses');
    localStorage.removeItem('sharedConversations');
    
    // Clear local data structures
    platformUsers.clear();
    waitingUsers.clear();
    activeConversations.clear();
    
    // Initialize fresh shared data structures
    window.sharedUserStatuses = new Map();
    window.sharedConversations = new Map();
    
    // Force UI update to show empty state
    updateStats();
    updateUserList();
    
    // Clean up any remaining duplicates
    cleanupDuplicateUsers();
    
    console.log("=== FRESH START COMPLETE ===");
    console.log("All data cleared, starting with empty state");
    
    // Also clear any sessionStorage that might contain old data
    sessionStorage.clear();
    
    // Log the current state to verify cleanup
    console.log("After cleanup - platformUsers size:", platformUsers.size);
    console.log("After cleanup - waitingUsers size:", waitingUsers.size);
    console.log("After cleanup - activeConversations size:", activeConversations.size);
    
    // Force a complete reset of the shared data structures
    window.sharedUserStatuses = new Map();
    window.sharedConversations = new Map();
}

function cleanupDuplicateUsers() {
    console.log("=== CLEANING UP DUPLICATE USERS ===");
    
    const seenUsers = new Set();
    const usersToRemove = [];
    
    // Find duplicate users
    for (let [uid, user] of platformUsers.entries()) {
        if (seenUsers.has(uid)) {
            usersToRemove.push(uid);
            console.log(`Found duplicate user: ${uid}`);
        } else {
            seenUsers.add(uid);
        }
    }
    
    // Remove duplicates
    usersToRemove.forEach(uid => {
        platformUsers.delete(uid);
        waitingUsers.delete(uid);
        console.log(`Removed duplicate user: ${uid}`);
    });
    
    // Update UI
    updateUserList();
    updateStats();
    
    console.log("=== DUPLICATE CLEANUP COMPLETE ===");
    console.log("Remaining users:", Array.from(platformUsers.keys()));
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function cleanupUserData(uid) {
    // Remove user from shared user statuses
    if (window.sharedUserStatuses) {
        window.sharedUserStatuses.delete(uid);
    }
    
    // Remove user from shared conversations
    if (window.sharedConversations) {
        for (let [conversationId, conversation] of window.sharedConversations.entries()) {
            if (conversation.user1 === uid || conversation.user2 === uid) {
                window.sharedConversations.delete(conversationId);
            }
        }
    }
    
    // Update localStorage
    try {
        // Clean up user statuses
        const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
        delete storedUserStatuses[uid];
        localStorage.setItem('sharedUserStatuses', JSON.stringify(storedUserStatuses));
        
        // Clean up conversations involving this user
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        Object.keys(storedConversations).forEach(conversationId => {
            const conversation = storedConversations[conversationId];
            if (conversation.user1 === uid || conversation.user2 === uid) {
                delete storedConversations[conversationId];
            }
        });
        localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
        
        console.log(`Cleaned up data for User ${uid}`);
    } catch (error) {
        console.warn("Failed to clean up user data from localStorage:", error);
    }
}

function cleanupStaleData() {
    const currentTime = Date.now();
    const staleTimeout = 1 * 60 * 1000; // 1 minute - more aggressive
    
    // Clean up stale user statuses
    if (window.sharedUserStatuses) {
        for (let [uid, userStatus] of window.sharedUserStatuses.entries()) {
            if (userStatus.timestamp && (currentTime - userStatus.timestamp) > staleTimeout) {
                window.sharedUserStatuses.delete(uid);
                console.log(`Removed stale user status for User ${uid}`);
            }
        }
    }
    
    // Clean up stale conversations
    if (window.sharedConversations) {
        for (let [conversationId, conversation] of window.sharedConversations.entries()) {
            if (conversation.timestamp && (currentTime - conversation.timestamp) > staleTimeout) {
                window.sharedConversations.delete(conversationId);
                console.log(`Removed stale conversation: ${conversationId}`);
            }
        }
    }
    
    // Update localStorage with cleaned data
    try {
        const cleanedUserStatuses = {};
        if (window.sharedUserStatuses) {
            for (let [uid, userStatus] of window.sharedUserStatuses.entries()) {
                cleanedUserStatuses[uid] = userStatus;
            }
        }
        localStorage.setItem('sharedUserStatuses', JSON.stringify(cleanedUserStatuses));
        
        const cleanedConversations = {};
        if (window.sharedConversations) {
            for (let [conversationId, conversation] of window.sharedConversations.entries()) {
                cleanedConversations[conversationId] = conversation;
            }
        }
        localStorage.setItem('sharedConversations', JSON.stringify(cleanedConversations));
    } catch (error) {
        console.warn("Failed to update localStorage with cleaned data:", error);
    }
}

function initializeEventListeners() {
    // Connection controls
    $("#btn-connect").click(connectToPlatform);
    $("#btn-disconnect").click(disconnectFromPlatform);
    
    // Conversation controls
    $("#btn-end-conversation").click(endConversation);
    $("#btn-mute").click(muteAudio);
    $("#btn-unmute").click(unmuteAudio);
    $("#btn-request-conversation").click(requestConversationWithAnyone);
    
    // Form submission
    $("#connection-form").submit(function(e) {
        e.preventDefault();
        connectToPlatform();
    });
    

}

async function connectToPlatform() {
    try {
        if (isConnected) {
            message.warning("Already connected to platform");
            return;
        }
        
        // Clean up any stale data before connecting
        cleanupStaleData();
        cleanupDuplicateUsers();

        // Get connection parameters
        options.channel = $("#channel").val() || "conversation-platform";
        
        // Generate a unique UID to avoid conflicts
        if ($("#uid").val()) {
            options.uid = Number($("#uid").val());
        } else {
            // Generate a truly unique UID
            options.uid = generateUniqueUID();
        }
        
        // Update the UID field with the generated value
        $("#uid").val(options.uid);
        
        const token = $("#token").val();
        if (token) {
            options.token = token;
        } else {
            try {
                options.token = await agoraGetAppData(options);
            } catch (tokenError) {
                console.warn("Token generation failed, trying without token:", tokenError.message);
                // For testing purposes, try without token (only works in development mode)
                options.token = null;
            }
        }

        // Create and configure client
        client = AgoraRTC.createClient({
            mode: "rtc",
            codec: "vp8"
        });

        // Set up event handlers
        setupClientEventHandlers();

        // Join the platform channel
        await client.join(options.appid, options.channel, options.token, options.uid);
        
        // Create and publish local audio track
        await createAndPublishAudioTrack();
        
        // Add user to platform
        addUserToPlatform(options.uid, "available");
        
        // Clean up any duplicates that might have been created during connection
        setTimeout(() => {
            cleanupDuplicateUsers();
            console.log("Post-connection cleanup completed");
        }, 500);
        
        isConnected = true;
        updateUI();
        message.success("Connected to conversation platform!");
        
        // Show available controls instead of auto-matching
        showAvailableControls();
        updateConversationStatus("Connected! You can manually request conversations with available users.");
        
        // Force conversation check after successful connection
        setTimeout(() => {
            console.log("Checking for existing conversations after connection");
            checkForConversationUpdates();
        }, 1000);
        
    } catch (error) {
        console.error("Connection error:", error);
        
        // Provide specific error messages
        if (error.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
            message.error("Authentication failed. Please check your App ID and App Certificate in the setup page.");
        } else if (error.code === 'UID_CONFLICT') {
            message.error("User ID conflict. Generating new ID and retrying...");
            // Generate a new UID and retry once
            options.uid = generateUniqueUID();
            $("#uid").val(options.uid);
            setTimeout(() => {
                if (!isConnected) {
                    connectToPlatform();
                }
            }, 1000);
            return;
        } else if (error.message.includes('token')) {
            message.error("Token error. Please configure your Agora credentials in the setup page.");
        } else {
            message.error("Failed to connect: " + error.message);
        }
    }
}

function setupClientEventHandlers() {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    client.on("connection-state-change", handleConnectionStateChange);
}

async function createAndPublishAudioTrack() {
    try {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "music_standard"
        });
        
        await client.publish(localAudioTrack);
        console.log("Local audio track published");
        
    } catch (error) {
        console.error("Error creating audio track:", error);
        message.error("Failed to create audio track: " + error.message);
    }
}

function addUserToPlatform(uid, status) {
    // Check if user already exists
    if (platformUsers.has(uid)) {
        console.log(`User ${uid} already exists, updating status to ${status}`);
        setUserStatus(uid, status);
        return;
    }
    
    const user = {
        uid: uid,
        status: status, // available, waiting, in-conversation
        joinTime: Date.now(),
        conversationPartner: null,
        timestamp: Date.now()
    };
    
    platformUsers.set(uid, user);
    
    if (status === "waiting") {
        waitingUsers.add(uid);
    }
    
    // Share user status with other users
    shareUserStatus(uid, status, null);
    
    updateUserList();
    updateStats();
}

function removeUserFromPlatform(uid) {
    const user = platformUsers.get(uid);
    if (user) {
        if (user.status === "waiting") {
            waitingUsers.delete(uid);
        }
        
        // End any active conversation
        if (user.conversationPartner) {
            endConversationForUser(uid);
        }
        
        platformUsers.delete(uid);
        
        // Remove user status from shared storage
        if (window.sharedUserStatuses) {
            window.sharedUserStatuses.delete(uid);
        }
        
        // Also remove from localStorage
        try {
            const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
            delete storedUserStatuses[uid];
            localStorage.setItem('sharedUserStatuses', JSON.stringify(storedUserStatuses));
        } catch (error) {
            console.warn("Failed to remove user status from localStorage:", error);
        }
        
        updateUserList();
        updateStats();
    }
}

function updateUserList() {
    const container = $("#users-container");
    container.empty();
    
    if (platformUsers.size === 0) {
        container.append('<p class="text-muted">No users online yet...</p>');
        return;
    }
    
    // Use a Set to track displayed users and prevent duplicates
    const displayedUsers = new Set();
    
    platformUsers.forEach((user, uid) => {
        // Skip if we've already displayed this user
        if (displayedUsers.has(uid)) {
            console.log(`Skipping duplicate display for User ${uid}`);
            return;
        }
        
        displayedUsers.add(uid);
        
        const userElement = $(`
            <div class="user-item ${user.status}">
                <div>
                    <strong>User ${uid}</strong>
                    <br>
                    <small class="text-muted">${getStatusText(user.status)}</small>
                </div>
                <div>
                    ${user.status === "available" && uid !== options.uid ? 
                        `<button class="btn btn-sm btn-primary" onclick="requestConversation(${uid})">Talk</button>` : 
                        `<span class="badge bg-secondary">${user.status}</span>`
                    }
                </div>
            </div>
        `);
        container.append(userElement);
    });
}

function getStatusText(status) {
    switch (status) {
        case "available": return "🟢 Available for conversation";
        case "waiting": return "🟡 Waiting for partner";
        case "in-conversation": return "🔴 In conversation";
        default: return "Unknown";
    }
}

function updateStats() {
    const totalUsers = platformUsers.size;
    const availableUsers = Array.from(platformUsers.values()).filter(u => u.status === "available").length;
    const waitingUsersCount = waitingUsers.size;
    const activeConversationsCount = activeConversations.size;
    
    $("#total-users").text(totalUsers);
    $("#available-users").text(availableUsers);
    $("#waiting-users").text(waitingUsersCount);
    $("#active-conversations").text(activeConversationsCount);
}

function attemptUserMatching() {
    if (!isConnected || isInConversation) return;
    
    // Only attempt matching if user has been waiting for a while
    // This prevents immediate matching when users just want to browse
    const availableUsers = Array.from(platformUsers.values())
        .filter(user => user.status === "available" && user.uid !== options.uid);
    
    if (availableUsers.length > 0) {
        // Find the user who has been waiting the longest
        const oldestUser = availableUsers.reduce((oldest, current) => 
            current.joinTime < oldest.joinTime ? current : oldest
        );
        
        // Only start conversation if the other user has been waiting for more than 5 seconds
        const waitTime = Date.now() - oldestUser.joinTime;
        if (waitTime > 5000) {
            startConversation(options.uid, oldestUser.uid);
        } else {
            // Go to waiting state instead of forcing immediate match
            setUserStatus(options.uid, "waiting");
            updateConversationStatus("Available for conversation. Other users can request to talk with you.");
        }
    } else {
        // No available users, go to waiting state
        setUserStatus(options.uid, "waiting");
        updateConversationStatus("Waiting for another user to join...");
    }
}

function requestConversation(targetUid) {
    if (!isConnected || isInConversation) return;
    
    const targetUser = platformUsers.get(targetUid);
    if (targetUser && targetUser.status === "available") {
        startConversation(options.uid, targetUid);
    }
}

function requestConversationWithAnyone() {
    if (!isConnected || isInConversation) return;
    
    const availableUsers = Array.from(platformUsers.values())
        .filter(user => user.status === "available" && user.uid !== options.uid);
    
    if (availableUsers.length > 0) {
        // Find the user who has been waiting the longest
        const oldestUser = availableUsers.reduce((oldest, current) => 
            current.joinTime < oldest.joinTime ? current : oldest
        );
        
        startConversation(options.uid, oldestUser.uid);
        message.success("Starting conversation with User " + oldestUser.uid);
    } else {
        message.info("No other users available. You'll be notified when someone joins.");
        setUserStatus(options.uid, "waiting");
        updateConversationStatus("Waiting for another user to join...");
    }
}

function startConversation(user1Uid, user2Uid) {
    // Clean up any existing conversations between these users
    cleanupExistingConversations(user1Uid, user2Uid);
    
    const conversationId = generateConversationId();
    const startTime = Date.now();
    
    console.log(`Starting conversation ${conversationId} between User ${user1Uid} and User ${user2Uid}`);
    
    // Update user statuses
    setUserStatus(user1Uid, "in-conversation");
    setUserStatus(user2Uid, "in-conversation");
    
    // Set conversation partners
    platformUsers.get(user1Uid).conversationPartner = user2Uid;
    platformUsers.get(user2Uid).conversationPartner = user1Uid;
    
    // Remove from waiting lists
    waitingUsers.delete(user1Uid);
    waitingUsers.delete(user2Uid);
    
    // Record conversation
    activeConversations.set(conversationId, {
        user1: user1Uid,
        user2: user2Uid,
        startTime: startTime
    });
    
    // Start recording for current user
    if (user1Uid === options.uid || user2Uid === options.uid) {
        currentConversationId = conversationId; // Store the conversation ID
        startConversationRecording(conversationId);
        currentConversationPartner = user1Uid === options.uid ? user2Uid : user1Uid;
        isInConversation = true;
        conversationStartTime = startTime;
        updateConversationStatus(`In conversation with User ${currentConversationPartner}`);
        showConversationControls();
    }
    
    // Notify other user about conversation start - this will trigger them to join
    notifyConversationStarted(user2Uid, conversationId, startTime);
    
    updateStats();
    updateUserList();
}

function setUserStatus(uid, status) {
    const user = platformUsers.get(uid);
    if (user) {
        user.status = status;
        user.timestamp = Date.now();
        if (status === "waiting") {
            waitingUsers.add(uid);
        } else {
            waitingUsers.delete(uid);
        }
        
        // Share status change with other users
        shareUserStatus(uid, status, user.conversationPartner);
    }
}

function shareUserStatus(uid, status, conversationPartner) {
    // Store user status in a shared location
    if (!window.sharedUserStatuses) {
        window.sharedUserStatuses = new Map();
    }
    
    const userStatus = {
        uid: uid,
        status: status,
        conversationPartner: conversationPartner,
        timestamp: Date.now()
    };
    
    window.sharedUserStatuses.set(uid, userStatus);
    
    // Also store in localStorage for cross-tab communication
    try {
        const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
        storedUserStatuses[uid] = userStatus;
        localStorage.setItem('sharedUserStatuses', JSON.stringify(storedUserStatuses));
    } catch (error) {
        console.warn("Failed to store user status in localStorage:", error);
    }
    
    console.log(`Shared user status: User ${uid} is now ${status}`);
}

function endConversation() {
    if (!isInConversation) return;
    
    // Stop recording
    stopConversationRecording();
    
    // Update user statuses
    if (currentConversationPartner) {
        setUserStatus(options.uid, "available");
        setUserStatus(currentConversationPartner, "available");
        
        // Clear conversation partners
        platformUsers.get(options.uid).conversationPartner = null;
        platformUsers.get(currentConversationPartner).conversationPartner = null;
        
        // Notify other user that conversation ended
        notifyConversationEnded(currentConversationPartner, options.uid);
    }
    
    // Reset conversation state
    isInConversation = false;
    currentConversationPartner = null;
    conversationStartTime = null;
    currentConversationId = null;
    
    // Remove from active conversations
    for (let [convId, conv] of activeConversations.entries()) {
        if (conv.user1 === options.uid || conv.user2 === options.uid) {
            activeConversations.delete(convId);
            break;
        }
    }
    
    // Don't automatically start a new conversation
    updateConversationStatus("Conversation ended. You can manually start a new conversation or wait for someone to request one.");
    showAvailableControls();
    updateStats();
    updateUserList();
}

function endConversationForUser(uid) {
    const user = platformUsers.get(uid);
    if (user && user.conversationPartner) {
        const partner = platformUsers.get(user.conversationPartner);
        if (partner) {
            setUserStatus(user.conversationPartner, "available");
            partner.conversationPartner = null;
        }
        user.conversationPartner = null;
    }
}

function startConversationRecording(conversationId) {
    try {
        // Create audio context for recording
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Start recording local user's audio
        if (localAudioTrack) {
            const localStream = new MediaStream();
            localStream.addTrack(localAudioTrack.getMediaStreamTrack());
            
            localMediaRecorder = new MediaRecorder(localStream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            localRecordedChunks = [];
            
            localMediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    localRecordedChunks.push(event.data);
                }
            };
            
            localMediaRecorder.onstop = () => {
                const blob = new Blob(localRecordedChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `user-${options.uid}-conversation-${conversationId}-${timestamp}.webm`;
                
                // Upload local user's recording
                uploadRecordingToServer(filename, url, conversationId, options.uid, 'local');
                
                // Clean up
                localRecordedChunks = [];
            };
            
            localMediaRecorder.start();
            console.log("Started recording local user audio:", options.uid);
        }
        

        
        console.log("Started local user recording for conversation:", conversationId);
        
    } catch (error) {
        console.error("Error starting recording:", error);
        message.error("Failed to start recording: " + error.message);
    }
}

function stopConversationRecording() {
    // Stop local user recording only
    if (localMediaRecorder && localMediaRecorder.state !== 'inactive') {
        localMediaRecorder.stop();
        console.log("Stopped recording local user audio");
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

async function uploadRecordingToServer(filename, url, conversationId, userId, recordingType = 'local') {
    // Check if server uploads are enabled
    if (!window.CONFIG || !window.CONFIG.RECORDING_SERVER.ENABLE_SERVER_UPLOADS) {
        console.log('Server uploads disabled, using local download');
        autoDownloadRecording(filename, url);
        return;
    }

    let retries = 0;
    const maxRetries = window.CONFIG?.RECORDING_SERVER.MAX_RETRIES || 3;
    const retryDelay = window.CONFIG?.RECORDING_SERVER.RETRY_DELAY || 2000;

    while (retries <= maxRetries) {
        try {
            // Convert blob URL to blob object
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Validate file size
            if (blob.size > (window.CONFIG?.RECORDING.MAX_FILE_SIZE || 50 * 1024 * 1024)) {
                throw new Error('File size too large');
            }
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('recording', blob, filename);
            formData.append('conversationId', conversationId);
            formData.append('userId', userId);
            formData.append('recordingType', recordingType);
            formData.append('timestamp', new Date().toISOString());
            formData.append('channel', options.channel);
            
            // Upload to server with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 
                window.CONFIG?.RECORDING_SERVER.UPLOAD_TIMEOUT || 30000);
            
            const uploadResponse = await fetch(window.CONFIG.RECORDING_SERVER.UPLOAD_URL, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log(`Recording uploaded successfully: ${filename}`);
                message.success(`Recording uploaded: ${filename}`);
                
                // Clean up the URL object
                URL.revokeObjectURL(url);
                
                return result;
            } else {
                throw new Error(`Upload failed: ${uploadResponse.status}`);
            }
            
        } catch (error) {
            retries++;
            console.error(`Upload attempt ${retries} failed:`, error);
            
            if (retries <= maxRetries) {
                console.log(`Retrying upload in ${retryDelay}ms... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                console.error('All upload attempts failed');
                message.error(`Failed to upload recording after ${maxRetries} attempts`);
                
                // Fallback to local download if enabled
                if (window.CONFIG?.RECORDING_SERVER.FALLBACK_TO_LOCAL) {
                    console.log('Falling back to local download...');
                    autoDownloadRecording(filename, url);
                }
            }
        }
    }
}

function autoDownloadRecording(filename, url) {
    // Create a temporary link element
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    // Append to document, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up the URL object after a delay
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
    
    console.log(`Automatically downloaded: ${filename}`);
    message.success(`Recording saved: ${filename}`);
}

function addRecordingToList(filename, url, conversationId) {
    // This function is kept for backward compatibility but no longer used
    // Recordings are now automatically downloaded
    console.log(`Recording completed: ${filename} (auto-downloaded)`);
}

function muteAudio() {
    if (localAudioTrack) {
        localAudioTrack.setEnabled(false);
        isMuted = true;
        $("#btn-mute").hide();
        $("#btn-unmute").show();
        message.info("Audio muted");
    }
}

function unmuteAudio() {
    if (localAudioTrack) {
        localAudioTrack.setEnabled(true);
        isMuted = false;
        $("#btn-mute").show();
        $("#btn-unmute").hide();
        message.info("Audio unmuted");
    }
}

function updateConversationStatus(status) {
    $("#conversation-status").text(status);
}

function showConversationControls() {
    $("#conversation-controls").show();
    $("#available-controls").hide();
    $("#audio-visualizer").html('<span class="recording-indicator"></span> Recording conversation...');
}

function hideConversationControls() {
    $("#conversation-controls").hide();
    $("#available-controls").hide();
    $("#audio-visualizer").html('<span>Audio visualization will appear here during conversation</span>');
}

function showAvailableControls() {
    $("#conversation-controls").hide();
    $("#available-controls").show();
    $("#audio-visualizer").html('<span>Ready for conversation. Click "Start Conversation" to begin.</span>');
}

function updateUI() {
    if (isConnected) {
        $("#btn-connect").hide();
        $("#btn-disconnect").show();
        $("#connection-form input").prop("disabled", true);
    } else {
        $("#btn-connect").show();
        $("#btn-disconnect").hide();
        $("#connection-form input").prop("disabled", false);
    }
}

async function disconnectFromPlatform() {
    try {
        if (isInConversation) {
            endConversation();
        }
        
        if (localAudioTrack) {
            localAudioTrack.stop();
            localAudioTrack.close();
            localAudioTrack = null;
        }
        
        if (client) {
            await client.leave();
            client = null;
        }
        
        // Remove user from platform
        removeUserFromPlatform(options.uid);
        
        // Clean up user's data from shared storage
        cleanupUserData(options.uid);
        
        isConnected = false;
        updateUI();
        updateConversationStatus("Disconnected from platform");
        hideConversationControls();
        
        message.success("Disconnected from platform");
        
    } catch (error) {
        console.error("Disconnect error:", error);
        message.error("Error disconnecting: " + error.message);
    }
}

// Event handlers for remote users
async function handleUserPublished(user, mediaType) {
    if (mediaType === "audio") {
        await client.subscribe(user, mediaType);
        remoteAudioTrack = user.audioTrack;
        remoteAudioTrack.play();
        console.log("Subscribed to remote audio track");
    }
}

function handleUserUnpublished(user, mediaType) {
    if (mediaType === "audio") {
        remoteAudioTrack = null;
        console.log("Remote audio track unpublished");
    }
}

function handleUserJoined(user) {
    console.log("User joined:", user.uid);
    addUserToPlatform(user.uid, "available");
    

    
    // If we're waiting, show available controls instead of auto-matching
    if (platformUsers.get(options.uid)?.status === "waiting") {
        setUserStatus(options.uid, "available");
        showAvailableControls();
        updateConversationStatus("New user joined! You can request a conversation.");
    }
}

function handleUserLeft(user) {
    console.log("User left:", user.uid);
    removeUserFromPlatform(user.uid);
    
    // If this was our conversation partner, end the conversation
    if (user.uid === currentConversationPartner) {
        endConversation();
    }
}

function handleConnectionStateChange(curState, prevState) {
    console.log("Connection state changed from", prevState, "to", curState);
    
    if (curState === "DISCONNECTED") {
        isConnected = false;
        updateUI();
        message.warning("Connection lost. Please reconnect.");
    }
}

function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateUniqueUID() {
    // Generate a unique UID using timestamp + random number + session-specific data
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const sessionId = sessionStorage.getItem('sessionId') || Math.random().toString(36).substr(2, 9);
    
    // Store session ID for consistency
    if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', sessionId);
    }
    
    return timestamp + random;
}

// Conversation coordination using shared state
function notifyConversationStarted(targetUid, conversationId, startTime) {
    // Store conversation info in a shared location that other users can access
    if (!window.sharedConversations) {
        window.sharedConversations = new Map();
    }
    
    const conversationData = {
        user1: Math.min(options.uid, targetUid),
        user2: Math.max(options.uid, targetUid),
        startTime: startTime,
        status: 'active',
        timestamp: Date.now(),
        initiator: options.uid,
        target: targetUid
    };
    
    window.sharedConversations.set(conversationId, conversationData);
    
    // Also store in localStorage for cross-tab communication
    try {
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        storedConversations[conversationId] = conversationData;
        localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
        
        // Force a storage event to trigger immediate updates
        localStorage.setItem('conversationTrigger', Date.now().toString());
    } catch (error) {
        console.warn("Failed to store conversation in localStorage:", error);
    }
    
    console.log(`Notified conversation started: ${conversationId} between ${options.uid} and ${targetUid}`);
    console.log("Shared conversations after notification:", Array.from(window.sharedConversations.entries()));
    
    // Force immediate check for the target user
    setTimeout(() => {
        // Trigger a storage event to ensure other users see this immediately
        const event = new StorageEvent('storage', {
            key: 'sharedConversations',
            newValue: localStorage.getItem('sharedConversations'),
            oldValue: null,
            storageArea: localStorage
        });
        window.dispatchEvent(event);
    }, 100);
}

function checkForUserStatusUpdates() {
    // Initialize shared user statuses from localStorage if needed
    if (!window.sharedUserStatuses) {
        window.sharedUserStatuses = new Map();
        try {
            const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
            
            // Only load recent user statuses (within last 2 minutes)
            const currentTime = Date.now();
            const recentTimeout = 2 * 60 * 1000; // 2 minutes
            
            Object.entries(storedUserStatuses).forEach(([uid, data]) => {
                if (data.timestamp && (currentTime - data.timestamp) < recentTimeout) {
                    // Only add if not already in the map
                    if (!window.sharedUserStatuses.has(uid)) {
                        window.sharedUserStatuses.set(uid, data);
                        console.log(`Loaded user status for User ${uid}`);
                    } else {
                        console.log(`User ${uid} already in sharedUserStatuses, skipping`);
                    }
                } else {
                    console.log(`Skipping old user status for User ${uid}, age: ${currentTime - data.timestamp}ms`);
                }
            });
        } catch (error) {
            console.warn("Failed to load user statuses from localStorage:", error);
        }
    }
    
    // Track processed users to prevent duplicates
    const processedUsers = new Set();
    
    // Check for user status updates
    for (let [uid, userStatus] of window.sharedUserStatuses.entries()) {
        // Skip our own status updates
        if (uid === options.uid) continue;
        
        // Skip if we've already processed this user in this cycle
        if (processedUsers.has(uid)) {
            console.log(`Skipping already processed user: ${uid}`);
            continue;
        }
        
        processedUsers.add(uid);
        
        // Check if this user is in a conversation with us
        if (userStatus.status === "in-conversation" && userStatus.conversationPartner === options.uid) {
            console.log(`User ${uid} is in conversation with us, checking for conversation sync`);
            // Force a conversation check to ensure we're using the same conversation ID
            setTimeout(() => checkForConversationUpdates(), 100);
        }
        
        const localUser = platformUsers.get(uid);
        if (localUser) {
            // Update local user status if it's different
            if (localUser.status !== userStatus.status || localUser.conversationPartner !== userStatus.conversationPartner) {
                localUser.status = userStatus.status;
                localUser.conversationPartner = userStatus.conversationPartner;
                localUser.timestamp = userStatus.timestamp;
                
                // Update waiting users set
                if (userStatus.status === "waiting") {
                    waitingUsers.add(uid);
                } else {
                    waitingUsers.delete(uid);
                }
                
                console.log(`Updated user status: User ${uid} is now ${userStatus.status}`);
            }
        } else {
            // Check if this is a recent user (within last 30 seconds)
            const currentTime = Date.now();
            const recentTimeout = 30 * 1000; // 30 seconds
            
            if (userStatus.timestamp && (currentTime - userStatus.timestamp) < recentTimeout) {
                // Add new user to local list
                const newUser = {
                    uid: uid,
                    status: userStatus.status,
                    joinTime: userStatus.timestamp,
                    conversationPartner: userStatus.conversationPartner,
                    timestamp: userStatus.timestamp
                };
                
                platformUsers.set(uid, newUser);
                
                if (userStatus.status === "waiting") {
                    waitingUsers.add(uid);
                }
                
                console.log(`Added new user: User ${uid} with status ${userStatus.status}`);
            } else {
                console.log(`Skipping old user status for User ${uid}, age: ${currentTime - userStatus.timestamp}ms`);
            }
        }
    }
    
    // Clean up old user statuses (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (let [uid, userStatus] of window.sharedUserStatuses.entries()) {
        if (userStatus.timestamp && userStatus.timestamp < fiveMinutesAgo) {
            window.sharedUserStatuses.delete(uid);
        }
    }
    
    // Update UI
    updateUserList();
    updateStats();
}

function checkForConversationUpdates() {
    // Initialize shared conversations from localStorage if needed
    if (!window.sharedConversations) {
        window.sharedConversations = new Map();
        try {
            const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
            Object.entries(storedConversations).forEach(([id, data]) => {
                window.sharedConversations.set(id, data);
            });
        } catch (error) {
            console.warn("Failed to load conversations from localStorage:", error);
        }
    }
    
    // Clean up old conversations (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (let [conversationId, conversation] of window.sharedConversations.entries()) {
        if (conversation.timestamp && conversation.timestamp < oneHourAgo) {
            window.sharedConversations.delete(conversationId);
            console.log(`Removed old conversation: ${conversationId}`);
        }
    }
    
    // Check if this user is part of any active conversations that were started by others
    for (let [conversationId, conversation] of window.sharedConversations.entries()) {
        console.log(`Checking conversation ${conversationId}:`, conversation);
        console.log(`Current user: ${options.uid}, isInConversation: ${isInConversation}`);
        
        // Check if this conversation involves the current user and is active
        const isUserInConversation = (conversation.user1 === options.uid || conversation.user2 === options.uid);
        const isActiveConversation = conversation.status === 'active';
        const isNotAlreadyInConversation = !isInConversation;
        
        console.log(`Conversation check: isUserInConversation=${isUserInConversation}, isActiveConversation=${isActiveConversation}, isNotAlreadyInConversation=${isNotAlreadyInConversation}`);
        
        if (isUserInConversation && isActiveConversation && isNotAlreadyInConversation) {
            
            // This user should be in this conversation (started by someone else)
            const partnerUid = conversation.user1 === options.uid ? conversation.user2 : conversation.user1;
            
            console.log(`Joining existing conversation ${conversationId} with User ${partnerUid}`);
            debugConversationState();
            
            // Update local state
            currentConversationPartner = partnerUid;
            isInConversation = true;
            conversationStartTime = conversation.startTime;
            currentConversationId = conversationId; // Store the conversation ID
            
            // Update user status
            setUserStatus(options.uid, "in-conversation");
            if (platformUsers.has(options.uid)) {
                platformUsers.get(options.uid).conversationPartner = partnerUid;
            }
            
            // Verify conversation sync before starting recording
            if (verifyConversationSync(conversationId, partnerUid)) {
                // Start recording with the SAME conversation ID
                console.log(`Starting recording with conversation ID: ${conversationId}`);
                startConversationRecording(conversationId);
            } else {
                console.error(`Failed to verify conversation sync for ${conversationId}`);
                message.error("Failed to join conversation. Please try again.");
                return;
            }
            
            // Update UI
            updateConversationStatus(`In conversation with User ${partnerUid}`);
            showConversationControls();
            
            // Add to active conversations
            activeConversations.set(conversationId, conversation);
            
            updateStats();
            updateUserList();
            
            message.success(`Conversation started with User ${partnerUid}!`);
            
            // Mark as processed
            conversation.status = 'processed';
            
            // Update localStorage to reflect the processed status
            try {
                const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
                storedConversations[conversationId] = conversation;
                localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
            } catch (error) {
                console.warn("Failed to update conversation status in localStorage:", error);
            }
        }
    }
    
    // Check for ended conversations and clean them up
    for (let [conversationId, conversation] of window.sharedConversations.entries()) {
        if ((conversation.user1 === options.uid || conversation.user2 === options.uid) && 
            conversation.status === 'ended') {
            
            if (isInConversation && currentConversationPartner === (conversation.user1 === options.uid ? conversation.user2 : conversation.user1)) {
                endConversation();
                message.info("Other user ended the conversation.");
            }
            
            // Remove ended conversations completely
            window.sharedConversations.delete(conversationId);
            
            // Also remove from localStorage
            try {
                const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
                delete storedConversations[conversationId];
                localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
            } catch (error) {
                console.warn("Failed to remove ended conversation from localStorage:", error);
            }
            
            console.log(`Removed ended conversation: ${conversationId}`);
        }
    }
}

function cleanupExistingConversations(user1Uid, user2Uid) {
    if (!window.sharedConversations) return;
    
    // Find and remove any existing conversations between these users
    for (let [conversationId, conversation] of window.sharedConversations.entries()) {
        if ((conversation.user1 === user1Uid && conversation.user2 === user2Uid) || 
            (conversation.user1 === user2Uid && conversation.user2 === user1Uid)) {
            
            console.log(`Cleaning up existing conversation: ${conversationId}`);
            window.sharedConversations.delete(conversationId);
            
            // Also remove from localStorage
            try {
                const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
                delete storedConversations[conversationId];
                localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
            } catch (error) {
                console.warn("Failed to remove existing conversation from localStorage:", error);
            }
        }
    }
}

function notifyConversationEnded(targetUid, fromUid) {
    if (!window.sharedConversations) return;
    
    // Find and mark the conversation as ended
    for (let [conversationId, conversation] of window.sharedConversations.entries()) {
        if ((conversation.user1 === targetUid || conversation.user2 === targetUid) && 
            (conversation.user1 === fromUid || conversation.user2 === fromUid)) {
            conversation.status = 'ended';
            
            // Update localStorage
            try {
                const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
                if (storedConversations[conversationId]) {
                    storedConversations[conversationId].status = 'ended';
                    localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
                }
            } catch (error) {
                console.warn("Failed to update conversation in localStorage:", error);
            }
            
            console.log(`Notified conversation ended: ${conversationId}`);
            break;
        }
    }
}

function verifyConversationSync(conversationId, partnerUid) {
    // Verify that both users are using the same conversation ID
    if (!window.sharedConversations || !window.sharedConversations.has(conversationId)) {
        console.warn(`Conversation ${conversationId} not found in shared conversations`);
        return false;
    }
    
    const conversation = window.sharedConversations.get(conversationId);
    if (conversation.user1 !== Math.min(options.uid, partnerUid) || 
        conversation.user2 !== Math.max(options.uid, partnerUid)) {
        console.warn(`Conversation ${conversationId} user mismatch`);
        return false;
    }
    
    console.log(`Conversation ${conversationId} verified for users ${options.uid} and ${partnerUid}`);
    return true;
}

function debugConversationState() {
    console.log("=== CONVERSATION DEBUG ===");
    console.log("Current user:", options.uid);
    console.log("isInConversation:", isInConversation);
    console.log("currentConversationPartner:", currentConversationPartner);
    console.log("currentConversationId:", currentConversationId);
    console.log("Shared conversations:", window.sharedConversations ? Array.from(window.sharedConversations.entries()) : "None");
    console.log("Active conversations:", Array.from(activeConversations.entries()));
    console.log("Platform users:", Array.from(platformUsers.entries()));
    console.log("Waiting users:", Array.from(waitingUsers));
    console.log("========================");
}



// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (isConnected) {
        // Clean up user data when leaving
        cleanupUserData(options.uid);
    }
});

// Auto-reconnect logic
setInterval(() => {
    if (isConnected && client && client.connectionState === "DISCONNECTED") {
        message.warning("Connection lost. Attempting to reconnect...");
        setTimeout(() => {
            if (!isConnected) {
                connectToPlatform();
            }
        }, 2000);
    }
}, 5000);

// Conversation and user status update polling mechanism
setInterval(() => {
    if (isConnected) {
        checkForConversationUpdates();
        checkForUserStatusUpdates();
    }
}, 500); // Check more frequently

// Debug: Log shared conversations every 5 seconds
setInterval(() => {
    if (isConnected && window.sharedConversations) {
        console.log("Shared conversations:", Array.from(window.sharedConversations.entries()));
    }
}, 5000);

// Periodic cleanup of stale data
setInterval(() => {
    if (isConnected) {
        cleanupStaleData();
        cleanupDuplicateUsers();
    }
}, 30000); // Every 30 seconds
