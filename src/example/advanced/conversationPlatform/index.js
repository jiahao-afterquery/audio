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

// Remote user recording
let remoteMediaRecorder = null;
let remoteRecordedChunks = [];

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
    
    // More aggressive cleanup for same-browser tabs
    setTimeout(() => {
        cleanupSameBrowserDuplicates();
        console.log("Same-browser duplicate cleanup completed");
    }, 2000);
    
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
        if (e.key === 'channelMessages' && isConnected) {
            console.log("Channel messages storage changed, processing messages");
            // Process new messages immediately
            handleLocalStorageMessages();
        } else if (e.key === 'sharedConversations' && isConnected) {
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

function cleanupSameBrowserDuplicates() {
    console.log("=== CLEANING UP SAME-BROWSER DUPLICATES ===");
    
    // For same-browser tabs, we need to be more aggressive about cleanup
    // Check if we have multiple users with the same UID pattern
    const userCounts = new Map();
    
    for (let [uid, user] of platformUsers.entries()) {
        // Count occurrences of each UID
        userCounts.set(uid, (userCounts.get(uid) || 0) + 1);
    }
    
    // Remove duplicates if we have more than one instance of the same user
    for (let [uid, count] of userCounts.entries()) {
        if (count > 1) {
            console.log(`Found ${count} instances of User ${uid}, removing duplicates`);
            
            // Keep only the first instance, remove the rest
            let firstFound = false;
            const usersToRemove = [];
            
            for (let [currentUid, user] of platformUsers.entries()) {
                if (currentUid === uid) {
                    if (!firstFound) {
                        firstFound = true;
                    } else {
                        usersToRemove.push(currentUid);
                    }
                }
            }
            
            // Remove duplicate instances
            usersToRemove.forEach(uidToRemove => {
                platformUsers.delete(uidToRemove);
                waitingUsers.delete(uidToRemove);
                console.log(`Removed duplicate instance of User ${uidToRemove}`);
            });
        }
    }
    
    // Also clean up any stale localStorage data that might be causing issues
    try {
        const storedUserStatuses = JSON.parse(localStorage.getItem('sharedUserStatuses') || '{}');
        const currentTime = Date.now();
        const staleTimeout = 2 * 60 * 1000; // 2 minutes
        
        // Remove stale entries
        Object.keys(storedUserStatuses).forEach(uid => {
            const userStatus = storedUserStatuses[uid];
            if (userStatus.timestamp && (currentTime - userStatus.timestamp) > staleTimeout) {
                delete storedUserStatuses[uid];
                console.log(`Removed stale localStorage entry for User ${uid}`);
            }
        });
        
        localStorage.setItem('sharedUserStatuses', JSON.stringify(storedUserStatuses));
    } catch (error) {
        console.warn("Failed to clean up localStorage:", error);
    }
    
    // Update UI
    updateUserList();
    updateStats();
    
    console.log("=== SAME-BROWSER DUPLICATE CLEANUP COMPLETE ===");
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

async function connectToPlatform(retryCount = 0) {
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

        // Join the platform channel with timeout
        const joinPromise = client.join(options.appid, options.channel, options.token, options.uid);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout")), 15000); // 15 second timeout
        });
        
        await Promise.race([joinPromise, timeoutPromise]);
        
        // Create and publish local audio track
        await createAndPublishAudioTrack();
        
        // Add user to platform
        addUserToPlatform(options.uid, "available");
        
        // Broadcast our presence to all other users in the channel
        setTimeout(() => {
            console.log("Broadcasting user presence to channel");
            broadcastUserPresence();
        }, 1000);
        
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
        
        // Check for conversations with all existing users
        setTimeout(() => {
            console.log("Checking for conversations with existing users");
            for (let [uid, user] of platformUsers.entries()) {
                if (uid !== options.uid) {
                    checkForConversationWithUser(uid);
                }
            }
        }, 1500);
        
        // Send a test message to verify messaging is working
        setTimeout(async () => {
            console.log("Sending test message to verify messaging");
            await sendChannelMessage({
                type: 'test',
                uid: options.uid,
                message: 'Test message from ' + options.uid,
                timestamp: Date.now()
            });
        }, 2000);
        
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
        } else if (error.message.includes('WebSocket') || error.message.includes('connection') || error.message.includes('network')) {
            console.log("Network error details:", error);
            
            // Retry connection for network errors (up to 3 times)
            if (retryCount < 3) {
                message.warning(`Connection failed. Retrying... (${retryCount + 1}/3)`);
                setTimeout(() => {
                    if (!isConnected) {
                        connectToPlatform(retryCount + 1);
                    }
                }, 2000 * (retryCount + 1)); // Exponential backoff
                return;
            } else {
                message.error("Network connection failed after 3 retries. Please check your internet connection and try again.");
            }
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
        // Update the existing user's status directly without calling setUserStatus
        const existingUser = platformUsers.get(uid);
        existingUser.status = status;
        existingUser.timestamp = Date.now();
        
        // Update waiting users set
        if (status === "waiting") {
            waitingUsers.add(uid);
        } else {
            waitingUsers.delete(uid);
        }
        
        // Share user status with other users
        shareUserStatus(uid, status, existingUser.conversationPartner).catch(error => {
            console.error("Failed to share user status:", error);
        });
        
        updateUserList();
        updateStats();
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
    shareUserStatus(uid, status, null).catch(error => {
        console.error("Failed to share user status:", error);
    });
    
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
                    ${user.conversationPartner ? `<br><small class="text-info">Talking with User ${user.conversationPartner}</small>` : ''}
                </div>
                <div>
                    ${user.status === "available" && uid !== options.uid && !isInConversation ? 
                        `<button class="btn btn-sm btn-primary" onclick="requestConversation(${uid})">Talk</button>` : 
                        user.status === "in-conversation" && user.conversationPartner === options.uid ?
                        `<span class="badge bg-success">In conversation with you</span>` :
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
    
    // Update user statuses for both users immediately
    setUserStatus(user1Uid, "in-conversation").catch(error => {
        console.error("Failed to set user status:", error);
    });
    setUserStatus(user2Uid, "in-conversation").catch(error => {
        console.error("Failed to set user status:", error);
    });
    
    // Set conversation partners for both users immediately
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
    
    // Immediately update UI for both users by updating their local user objects
    // This ensures both users see the conversation status immediately
    const user1 = platformUsers.get(user1Uid);
    const user2 = platformUsers.get(user2Uid);
    
    if (user1) {
        user1.status = "in-conversation";
        user1.conversationPartner = user2Uid;
        user1.timestamp = Date.now();
    }
    
    if (user2) {
        user2.status = "in-conversation";
        user2.conversationPartner = user1Uid;
        user2.timestamp = Date.now();
    }
    
    // Notify other user about conversation start - this will trigger them to join
    notifyConversationStarted(user2Uid, conversationId, startTime).catch(error => {
        console.error("Failed to notify conversation start:", error);
    });
    
    // Immediate cross-device notification
    setTimeout(() => {
        broadcastConversationStatus(user2Uid);
    }, 500);
    
    // Force immediate UI update
    updateStats();
    updateUserList();
    
    // Force conversation check for the other user
    setTimeout(() => {
        forceConversationCheckForUser(user2Uid);
    }, 1000);
    
    // Send immediate conversation start message to both users
    setTimeout(() => {
        // Send to User 2
        sendChannelMessage({
            type: 'conversation_start',
            target: user2Uid,
            conversationId: conversationId,
            user1: user1Uid,
            user2: user2Uid,
            startTime: startTime,
            initiator: options.uid
        });
        
        // Also send to User 1 (for immediate UI update)
        sendChannelMessage({
            type: 'conversation_start',
            target: user1Uid,
            conversationId: conversationId,
            user1: user1Uid,
            user2: user2Uid,
            startTime: startTime,
            initiator: options.uid
        });
    }, 200);
}

async function setUserStatus(uid, status) {
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
        await shareUserStatus(uid, status, user.conversationPartner);
    }
}

async function shareUserStatus(uid, status, conversationPartner) {
    // Send message to all users in the channel
    const messageData = {
        type: 'user_status',
        uid: uid,
        status: status,
        conversationPartner: conversationPartner,
        timestamp: Date.now()
    };
    
    await sendChannelMessage(messageData);
    
    // Also store in localStorage for cross-tab communication (backup)
    try {
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
    
    console.log(`User ${options.uid} ending conversation with User ${currentConversationPartner}`);
    
    // Stop recording
    stopConversationRecording();
    
    // Update user statuses
    if (currentConversationPartner) {
        setUserStatus(options.uid, "available").catch(error => {
            console.error("Failed to set user status:", error);
        });
        setUserStatus(currentConversationPartner, "available").catch(error => {
            console.error("Failed to set user status:", error);
        });
        
        // Clear conversation partners
        if (platformUsers.has(options.uid)) {
            platformUsers.get(options.uid).conversationPartner = null;
        }
        if (platformUsers.has(currentConversationPartner)) {
            platformUsers.get(currentConversationPartner).conversationPartner = null;
        }
        
        // Notify other user that conversation ended
        notifyConversationEnded(currentConversationPartner, options.uid).catch(error => {
            console.error("Failed to notify conversation end:", error);
        });
        
        // Send immediate conversation end message to both users
        setTimeout(() => {
            // Send to the other user
            sendChannelMessage({
                type: 'conversation_end',
                target: currentConversationPartner,
                endedBy: options.uid,
                timestamp: Date.now()
            });
            
            // Also send to current user (for immediate UI update)
            sendChannelMessage({
                type: 'conversation_end',
                target: options.uid,
                endedBy: options.uid,
                timestamp: Date.now()
            });
        }, 100);
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
                
                // Download recording locally
                autoDownloadRecording(filename, url);
                
                // Clean up
                localRecordedChunks = [];
            };
            
            localMediaRecorder.start();
            console.log("Started recording local user audio:", options.uid);
        }
        
        // Start recording remote user's audio if available
        if (remoteAudioTrack) {
            startRemoteAudioRecording(conversationId);
        }
        
        console.log("Started recording for conversation:", conversationId);
        
    } catch (error) {
        console.error("Error starting recording:", error);
        message.error("Failed to start recording: " + error.message);
    }
}

function startRemoteAudioRecording(conversationId) {
    try {
        if (remoteAudioTrack) {
            const remoteStream = new MediaStream();
            remoteStream.addTrack(remoteAudioTrack.getMediaStreamTrack());
            
            remoteMediaRecorder = new MediaRecorder(remoteStream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            remoteRecordedChunks = [];
            
            remoteMediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    remoteRecordedChunks.push(event.data);
                }
            };
            
            remoteMediaRecorder.onstop = () => {
                const blob = new Blob(remoteRecordedChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `user-${currentConversationPartner}-conversation-${conversationId}-${timestamp}.webm`;
                
                // Download recording locally
                autoDownloadRecording(filename, url);
                
                // Clean up
                remoteRecordedChunks = [];
            };
            
            remoteMediaRecorder.start();
            console.log("Started recording remote user audio:", currentConversationPartner);
        }
    } catch (error) {
        console.error("Error starting remote audio recording:", error);
    }
}

function stopConversationRecording() {
    // Stop local user recording
    if (localMediaRecorder && localMediaRecorder.state !== 'inactive') {
        localMediaRecorder.stop();
        console.log("Stopped recording local user audio");
    }
    
    // Stop remote user recording
    if (remoteMediaRecorder && remoteMediaRecorder.state !== 'inactive') {
        remoteMediaRecorder.stop();
        console.log("Stopped recording remote user audio");
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// Server upload function removed - using local downloads only

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
    
    // Show success message
    console.log(`Recording downloaded: ${filename}`);
    message.success(`Recording downloaded: ${filename}`);
    
    // Clean up the URL object after a delay
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
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
        
        // If we're in a conversation, start recording the remote user's audio
        if (isInConversation && currentConversationId) {
            startRemoteAudioRecording(currentConversationId);
        }
    }
}

function handleUserUnpublished(user, mediaType) {
    if (mediaType === "audio") {
        // Stop recording remote user's audio if we were recording it
        if (remoteMediaRecorder && remoteMediaRecorder.state !== 'inactive') {
            remoteMediaRecorder.stop();
            console.log("Stopped recording remote user audio due to unpublish");
        }
        
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
    
    // Immediate cross-device conversation check
    setTimeout(() => {
        console.log("Immediate conversation check for new user:", user.uid);
        
        // Check if this user is in a conversation with us
        const newUser = platformUsers.get(user.uid);
        if (newUser && newUser.status === "in-conversation" && newUser.conversationPartner === options.uid) {
            console.log(`New user ${user.uid} is already in conversation with us`);
            checkCrossDeviceConversation(user.uid);
        }
        
        // Check if we should be in a conversation with this user
        checkForConversationWithUser(user.uid);
        
        // Force conversation reload
        checkForConversationUpdates();
    }, 200);
    
    // Additional check after a longer delay
    setTimeout(() => {
        console.log("Secondary conversation check for new user:", user.uid);
        checkForConversationWithUser(user.uid);
    }, 1000);
    
    // Broadcast our current conversation status to the new user
    if (isInConversation && currentConversationPartner) {
        setTimeout(() => {
            broadcastConversationStatus(user.uid);
        }, 1500);
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
    } else if (curState === "CONNECTING") {
        console.log("Attempting to connect to Agora servers...");
    } else if (curState === "CONNECTED") {
        console.log("Successfully connected to Agora servers");
    } else if (curState === "RECONNECTING") {
        console.log("Reconnecting to Agora servers...");
        message.info("Reconnecting to platform...");
    } else if (curState === "ABORTED") {
        console.log("Connection aborted");
        isConnected = false;
        updateUI();
        message.error("Connection aborted. Please try again.");
    }
}

function handleChannelMessage(message) {
    console.log("Raw channel message received:", message);
    
    try {
        const data = JSON.parse(message.text);
        console.log("Parsed channel message:", data);
        console.log("Current user:", options.uid, "Message type:", data.type);
        
        switch (data.type) {
            case 'test':
                console.log("Received test message from User", data.uid, ":", data.message);
                break;
            case 'conversation_start':
                console.log("Handling conversation start message");
                handleConversationStartMessage(data);
                break;
            case 'conversation_end':
                console.log("Handling conversation end message");
                handleConversationEndMessage(data);
                break;
            case 'user_status':
                console.log("Handling user status message");
                handleUserStatusMessage(data);
                break;
            default:
                console.log("Unknown message type:", data.type);
        }
    } catch (error) {
        console.error("Error parsing channel message:", error);
        console.error("Raw message text:", message.text);
    }
}

// Handle messages from localStorage
function handleLocalStorageMessages() {
    try {
        const storedMessages = JSON.parse(localStorage.getItem('channelMessages') || '[]');
        const currentTime = Date.now();
        const processedMessages = new Set();
        
        // Get previously processed messages
        const processedMessageIds = JSON.parse(sessionStorage.getItem('processedMessageIds') || '[]');
        
        for (let message of storedMessages) {
            // Skip if we've already processed this message
            if (processedMessageIds.includes(message.messageId)) {
                continue;
            }
            
            // Skip if message is too old (older than 30 seconds)
            if (currentTime - message.timestamp > 30000) {
                continue;
            }
            
            // Skip our own messages
            if (message.sender === options.uid) {
                continue;
            }
            
            console.log("Processing localStorage message:", message);
            
            switch (message.type) {
                case 'test':
                    console.log("Received test message from User", message.sender, ":", message.message);
                    break;
                case 'conversation_start':
                    console.log("Handling conversation start message from localStorage");
                    handleConversationStartMessage(message);
                    break;
                case 'conversation_end':
                    console.log("Handling conversation end message from localStorage");
                    handleConversationEndMessage(message);
                    break;
                case 'user_status':
                    console.log("Handling user status message from localStorage");
                    handleUserStatusMessage(message);
                    break;
                case 'force_conversation_check':
                    console.log("Handling force conversation check message from localStorage");
                    handleForceConversationCheckMessage(message);
                    break;
                case 'user_presence':
                    console.log("Handling user presence message from localStorage");
                    handleUserPresenceMessage(message);
                    break;
                default:
                    console.log("Unknown message type:", message.type);
            }
            
            // Mark as processed
            processedMessages.add(message.messageId);
        }
        
        // Update processed message IDs
        const newProcessedIds = [...processedMessageIds, ...Array.from(processedMessages)];
        // Keep only recent processed IDs (last 50)
        if (newProcessedIds.length > 50) {
            newProcessedIds.splice(0, newProcessedIds.length - 50);
        }
        sessionStorage.setItem('processedMessageIds', JSON.stringify(newProcessedIds));
        
    } catch (error) {
        console.error("Error handling localStorage messages:", error);
    }
}

// Handle messages from API
async function handleApiMessages() {
    try {
        const apiUrl = getApiUrl();
        const lastCheckTime = sessionStorage.getItem('lastApiCheckTime') || '0';
        
        const response = await fetch(`${apiUrl}/api/messages?uid=${options.uid}&since=${lastCheckTime}`);
        
        if (response.ok) {
            const data = await response.json();
            const currentTime = Date.now();
            
            for (let message of data.messages) {
                // Skip our own messages
                if (message.sender === options.uid) {
                    continue;
                }
                
                console.log("Processing API message:", message);
                
                // Process the message data
                const messageData = message.data;
                
                switch (messageData.type) {
                    case 'conversation_start':
                        console.log("Handling conversation start message from API");
                        handleConversationStartMessage(messageData);
                        break;
                    case 'conversation_end':
                        console.log("Handling conversation end message from API");
                        handleConversationEndMessage(messageData);
                        break;
                    case 'user_status':
                        console.log("Handling user status message from API");
                        handleUserStatusMessage(messageData);
                        break;
                    case 'force_conversation_check':
                        console.log("Handling force conversation check message from API");
                        handleForceConversationCheckMessage(messageData);
                        break;
                    case 'user_presence':
                        console.log("Handling user presence message from API");
                        handleUserPresenceMessage(messageData);
                        break;
                    default:
                        console.log("Unknown message type from API:", messageData.type);
                }
            }
            
            // Update last check time
            sessionStorage.setItem('lastApiCheckTime', currentTime.toString());
        }
    } catch (error) {
        console.warn("API message check failed:", error);
    }
}

function checkForConversationWithUser(targetUid) {
    console.log(`Checking for conversation with User ${targetUid}`);
    
    // Check if we have any active conversations that involve this user
    if (window.sharedConversations) {
        for (let [conversationId, conversation] of window.sharedConversations.entries()) {
            if ((conversation.user1 === options.uid && conversation.user2 === targetUid) ||
                (conversation.user1 === targetUid && conversation.user2 === options.uid)) {
                
                if (conversation.status === 'active' && !isInConversation) {
                    console.log(`Found active conversation ${conversationId} with User ${targetUid}`);
                    
                    // Join the conversation
                    const partnerUid = conversation.user1 === options.uid ? conversation.user2 : conversation.user1;
                    
                    // Update local state
                    currentConversationPartner = partnerUid;
                    isInConversation = true;
                    conversationStartTime = conversation.startTime;
                    currentConversationId = conversationId;
                    
                    // Update user status
                    setUserStatus(options.uid, "in-conversation").catch(error => {
                        console.error("Failed to set user status:", error);
                    });
                    if (platformUsers.has(options.uid)) {
                        platformUsers.get(options.uid).conversationPartner = partnerUid;
                    }
                    
                    // Start recording
                    startConversationRecording(conversationId);
                    
                    // Update UI
                    updateConversationStatus(`In conversation with User ${partnerUid}`);
                    showConversationControls();
                    
                    // Add to active conversations
                    activeConversations.set(conversationId, conversation);
                    
                    updateStats();
                    updateUserList();
                    
                    message.success(`Conversation started with User ${partnerUid}!`);
                    
                    return;
                }
            }
        }
    }
    
    // Also check localStorage for cross-device conversations
    try {
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        for (let [conversationId, conversation] of Object.entries(storedConversations)) {
            if ((conversation.user1 === options.uid && conversation.user2 === targetUid) ||
                (conversation.user1 === targetUid && conversation.user2 === options.uid)) {
                
                if (conversation.status === 'active' && !isInConversation) {
                    console.log(`Found active localStorage conversation ${conversationId} with User ${targetUid}`);
                    
                    // Join the conversation
                    const partnerUid = conversation.user1 === options.uid ? conversation.user2 : conversation.user1;
                    
                    // Update local state
                    currentConversationPartner = partnerUid;
                    isInConversation = true;
                    conversationStartTime = conversation.startTime;
                    currentConversationId = conversationId;
                    
                    // Update user status
                    setUserStatus(options.uid, "in-conversation").catch(error => {
                        console.error("Failed to set user status:", error);
                });
                    if (platformUsers.has(options.uid)) {
                        platformUsers.get(options.uid).conversationPartner = partnerUid;
                    }
                    
                    // Start recording
                    startConversationRecording(conversationId);
                    
                    // Update UI
                    updateConversationStatus(`In conversation with User ${partnerUid}`);
                    showConversationControls();
                    
                    // Add to active conversations
                    activeConversations.set(conversationId, conversation);
                    
                    updateStats();
                    updateUserList();
                    
                    message.success(`Conversation started with User ${partnerUid}!`);
                    
                    return;
                }
            }
        }
    } catch (error) {
        console.error("Error checking localStorage conversations:", error);
    }
    
    // Cross-device conversation detection using user status
    checkCrossDeviceConversation(targetUid);
}

function checkCrossDeviceConversation(targetUid) {
    console.log(`Checking cross-device conversation with User ${targetUid}`);
    
    // Check if the target user is in a conversation with us
    const targetUser = platformUsers.get(targetUid);
    if (targetUser && targetUser.status === "in-conversation" && targetUser.conversationPartner === options.uid) {
        console.log(`Found cross-device conversation: User ${targetUid} is in conversation with us`);
        
        // Create a conversation ID for this cross-device conversation
        const conversationId = generateConversationId();
        
        // Update local state
        currentConversationPartner = targetUid;
        isInConversation = true;
        conversationStartTime = Date.now();
        currentConversationId = conversationId;
        
        // Update user status
        setUserStatus(options.uid, "in-conversation").catch(error => {
            console.error("Failed to set user status:", error);
        });
        if (platformUsers.has(options.uid)) {
            platformUsers.get(options.uid).conversationPartner = targetUid;
        }
        
        // Start recording
        startConversationRecording(conversationId);
        
        // Update UI
        updateConversationStatus(`In conversation with User ${targetUid}`);
        showConversationControls();
        
        // Create conversation object
        const conversation = {
            user1: Math.min(options.uid, targetUid),
            user2: Math.max(options.uid, targetUid),
            startTime: conversationStartTime,
            status: 'active'
        };
        
        // Add to active conversations
        activeConversations.set(conversationId, conversation);
        
        updateStats();
        updateUserList();
        
        message.success(`Cross-device conversation started with User ${targetUid}!`);
    }
}

function broadcastConversationStatus(targetUid) {
    console.log(`Broadcasting conversation status to User ${targetUid}`);
    
    // Update our status to indicate we're in a conversation
    if (isInConversation && currentConversationPartner) {
        setUserStatus(options.uid, "in-conversation").catch(error => {
            console.error("Failed to broadcast conversation status:", error);
        });
        
        // Also update the target user's status if they're our partner
        if (currentConversationPartner === targetUid) {
            const targetUser = platformUsers.get(targetUid);
            if (targetUser) {
                targetUser.status = "in-conversation";
                targetUser.conversationPartner = options.uid;
                targetUser.timestamp = Date.now();
                
                // Share this status update
                shareUserStatus(targetUid, "in-conversation", options.uid).catch(error => {
                    console.error("Failed to share target user status:", error);
                });
            }
        }
    }
}

function forceConversationCheckForUser(targetUid) {
    console.log(`Forcing conversation check for User ${targetUid}`);
    
    // Send a direct message to force the user to check for conversations
    sendChannelMessage({
        type: 'force_conversation_check',
        targetUid: targetUid,
        initiatorUid: options.uid,
        timestamp: Date.now()
    }).catch(error => {
        console.error("Failed to send force conversation check message:", error);
    });
    
    // Also trigger a conversation check for this specific user
    setTimeout(() => {
        checkForConversationWithUser(targetUid);
    }, 500);
}

function broadcastUserPresence() {
    console.log("Broadcasting user presence to all users in channel");
    
    // Send a presence message to all users
    sendChannelMessage({
        type: 'user_presence',
        uid: options.uid,
        status: "available",
        timestamp: Date.now(),
        channel: options.channel
    }).catch(error => {
        console.error("Failed to broadcast user presence:", error);
    });
    
    // Also send via user status system
    setUserStatus(options.uid, "available").catch(error => {
        console.error("Failed to set user status during presence broadcast:", error);
    });
}

function handleConversationStartMessage(data) {
    const { conversationId, user1, user2, startTime, initiator } = data;
    
    console.log(`Received conversation start message: ${conversationId} between ${user1} and ${user2}`);
    
    // Check if this involves the current user
    if (user1 === options.uid || user2 === options.uid) {
        const partnerUid = user1 === options.uid ? user2 : user1;
        
        // Only join if we're not already in a conversation
        if (!isInConversation) {
            console.log(`Joining conversation ${conversationId} with User ${partnerUid}`);
            
            // Update local state
            currentConversationPartner = partnerUid;
            isInConversation = true;
            conversationStartTime = startTime;
            currentConversationId = conversationId;
            
            // Update user status
            setUserStatus(options.uid, "in-conversation").catch(error => {
                console.error("Failed to set user status:", error);
            });
            if (platformUsers.has(options.uid)) {
                platformUsers.get(options.uid).conversationPartner = partnerUid;
            }
            
            // Start recording
            startConversationRecording(conversationId);
            
            // Update UI
            updateConversationStatus(`In conversation with User ${partnerUid}`);
            showConversationControls();
            
            // Add to active conversations
            activeConversations.set(conversationId, {
                user1: user1,
                user2: user2,
                startTime: startTime
            });
            
            updateStats();
            updateUserList();
            
            message.success(`Conversation started with User ${partnerUid}!`);
        }
    } else {
        // Update UI for other users' conversations (so we can see their status)
        const user1Obj = platformUsers.get(user1);
        const user2Obj = platformUsers.get(user2);
        
        if (user1Obj) {
            user1Obj.status = "in-conversation";
            user1Obj.conversationPartner = user2;
            user1Obj.timestamp = Date.now();
        }
        
        if (user2Obj) {
            user2Obj.status = "in-conversation";
            user2Obj.conversationPartner = user1;
            user2Obj.timestamp = Date.now();
        }
        
        updateUserList();
        updateStats();
    }
}

function handleConversationEndMessage(data) {
    const { conversationId, user1, user2, endedBy } = data;
    
    console.log(`Received conversation end message: ${conversationId} ended by ${endedBy}`);
    
    // Check if this involves the current user
    if (user1 === options.uid || user2 === options.uid) {
        const partnerUid = user1 === options.uid ? user2 : user1;
        
        if (isInConversation && currentConversationPartner === partnerUid) {
            console.log(`Ending conversation ${conversationId} as requested by User ${endedBy}`);
            
            // Stop recording
            stopConversationRecording();
            
            // Update user statuses
            setUserStatus(options.uid, "available").catch(error => {
                console.error("Failed to set user status:", error);
            });
            setUserStatus(partnerUid, "available").catch(error => {
                console.error("Failed to set user status:", error);
            });
            
            // Clear conversation partners
            if (platformUsers.has(options.uid)) {
                platformUsers.get(options.uid).conversationPartner = null;
            }
            if (platformUsers.has(partnerUid)) {
                platformUsers.get(partnerUid).conversationPartner = null;
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
            
            // Update UI
            updateConversationStatus("Conversation ended by other user.");
            showAvailableControls();
            updateStats();
            updateUserList();
            
            message.info("Conversation ended by other user.");
        }
    } else {
        // Update UI for other users' conversation endings (so we can see their status)
        const user1Obj = platformUsers.get(user1);
        const user2Obj = platformUsers.get(user2);
        
        if (user1Obj) {
            user1Obj.status = "available";
            user1Obj.conversationPartner = null;
            user1Obj.timestamp = Date.now();
        }
        
        if (user2Obj) {
            user2Obj.status = "available";
            user2Obj.conversationPartner = null;
            user2Obj.timestamp = Date.now();
        }
        
        updateUserList();
        updateStats();
    }
}

function handleUserStatusMessage(data) {
    const { uid, status, conversationPartner, timestamp } = data;
    
    // Skip our own status updates
    if (uid === options.uid) return;
    
    console.log(`Received user status message: User ${uid} is now ${status}`);
    
    // Update local user status
    const localUser = platformUsers.get(uid);
    if (localUser) {
        localUser.status = status;
        localUser.conversationPartner = conversationPartner;
        localUser.timestamp = timestamp;
        
        // Update waiting users set
        if (status === "waiting") {
            waitingUsers.add(uid);
        } else {
            waitingUsers.delete(uid);
        }
        
        console.log(`Updated user status: User ${uid} is now ${status}`);
    } else {
        // Add new user if they don't exist locally
        const newUser = {
            uid: uid,
            status: status,
            conversationPartner: conversationPartner,
            joinTime: timestamp,
            timestamp: timestamp
        };
        
        platformUsers.set(uid, newUser);
        
        if (status === "waiting") {
            waitingUsers.add(uid);
        }
        
        console.log(`Added new user: User ${uid} with status ${status}`);
    }
    
    updateUserList();
    updateStats();
}

function handleForceConversationCheckMessage(data) {
    const { targetUid, initiatorUid, timestamp } = data;
    
    // Skip if this message is not for us
    if (targetUid !== options.uid) return;
    
    console.log(`Received force conversation check from User ${initiatorUid}`);
    
    // Force an immediate conversation check
    setTimeout(() => {
        console.log("Forcing conversation check due to received message");
        checkForConversationUpdates();
        checkForConversationWithUser(initiatorUid);
    }, 100);
}

function handleUserPresenceMessage(data) {
    const { uid, status, timestamp, channel } = data;
    
    // Skip our own presence messages
    if (uid === options.uid) return;
    
    console.log(`Received user presence message: User ${uid} is ${status} in channel ${channel}`);
    
    // Add or update user in our local platform
    if (!platformUsers.has(uid)) {
        console.log(`Adding new user ${uid} from presence message`);
        addUserToPlatform(uid, status);
    } else {
        console.log(`Updating user ${uid} status to ${status}`);
        const user = platformUsers.get(uid);
        user.status = status;
        user.timestamp = timestamp;
        updateUserList();
        updateStats();
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

// Cross-device communication using API for reliable messaging
// This uses a server API for cross-device communication with localStorage backup
async function sendChannelMessage(messageData) {
    try {
        console.log("Sending message via API system:", messageData);
        
        // Approach 1: API-based messaging (works across all devices)
        if (messageData.target) {
            try {
                const apiUrl = getApiUrl();
                const response = await fetch(`${apiUrl}/api/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: messageData.type,
                        sender: options.uid,
                        target: messageData.target,
                        data: messageData,
                        timestamp: Date.now()
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log("Message sent via API successfully:", result);
                } else {
                    console.warn("API message failed, falling back to user status");
                }
            } catch (apiError) {
                console.warn("API unavailable, falling back to user status:", apiError);
            }
        }
        
        // Approach 2: User status system (fallback)
        if (messageData.type === 'conversation_start') {
            const targetUid = messageData.target;
            await setUserStatus(options.uid, "in-conversation");
            
            // Update target user's status in local map
            const targetUser = platformUsers.get(targetUid);
            if (targetUser) {
                targetUser.status = "in-conversation";
                targetUser.conversationPartner = options.uid;
                targetUser.timestamp = Date.now();
                console.log(`Updated local status for User ${targetUid} to in-conversation`);
            }
            
        } else if (messageData.type === 'conversation_end') {
            await setUserStatus(options.uid, "available");
            
        } else if (messageData.type === 'user_status') {
            console.log("User status message sent via status system");
        }
        
        // Approach 3: localStorage for same-browser tabs (backup)
        try {
            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const messageWithId = {
                ...messageData,
                messageId: messageId,
                sender: options.uid,
                timestamp: Date.now()
            };
            
            const storedMessages = JSON.parse(localStorage.getItem('channelMessages') || '[]');
            storedMessages.push(messageWithId);
            
            if (storedMessages.length > 100) {
                storedMessages.splice(0, storedMessages.length - 100);
            }
            
            localStorage.setItem('channelMessages', JSON.stringify(storedMessages));
            
            // Trigger storage event for immediate notification
            const event = new StorageEvent('storage', {
                key: 'channelMessages',
                newValue: localStorage.getItem('channelMessages'),
                oldValue: null,
                storageArea: localStorage
            });
            window.dispatchEvent(event);
            
            console.log("Also sent message via localStorage for same-browser tabs");
        } catch (localStorageError) {
            console.warn("localStorage backup failed:", localStorageError);
        }
        
        console.log("Successfully sent message via API system:", messageData);
    } catch (error) {
        console.error("Failed to send message:", error);
        console.error("Error details:", error.message);
    }
}

// Get API URL based on environment
function getApiUrl() {
    // For Vercel deployment
    if (window.location.hostname.includes('vercel.app')) {
        return `https://${window.location.hostname}`;
    }
    // For local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    // For other deployments, use the current origin
    return window.location.origin;
}

// Conversation coordination using cross-device messaging
async function notifyConversationStarted(targetUid, conversationId, startTime) {
    // Send message to all users in the channel
    const messageData = {
        type: 'conversation_start',
        conversationId: conversationId,
        user1: Math.min(options.uid, targetUid),
        user2: Math.max(options.uid, targetUid),
        startTime: startTime,
        initiator: options.uid,
        target: targetUid,
        timestamp: Date.now()
    };
    
    await sendChannelMessage(messageData);
    
    // Also store in localStorage for cross-tab communication (backup)
    try {
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
        
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        storedConversations[conversationId] = conversationData;
        localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
    } catch (error) {
        console.warn("Failed to store conversation in localStorage:", error);
    }
    
    console.log(`Notified conversation started: ${conversationId} between ${options.uid} and ${targetUid}`);
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
        
        // If we're not in a conversation but someone is trying to talk to us, check for conversations
        if (userStatus.status === "in-conversation" && userStatus.conversationPartner === options.uid && !isInConversation) {
            console.log(`User ${uid} is trying to talk to us, forcing conversation check`);
            setTimeout(() => checkForConversationUpdates(), 50);
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
    }
    
    // Always reload conversations from localStorage for cross-device sync
    try {
        const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
        const currentTime = Date.now();
        const recentTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Clear existing conversations and reload from localStorage
        window.sharedConversations.clear();
        
        Object.entries(storedConversations).forEach(([id, data]) => {
            // Only load recent conversations
            if (data.timestamp && (currentTime - data.timestamp) < recentTimeout) {
                window.sharedConversations.set(id, data);
                console.log(`Loaded conversation ${id} from localStorage`);
            } else {
                console.log(`Skipping old conversation ${id}, age: ${currentTime - data.timestamp}ms`);
            }
        });
        
        console.log(`Loaded ${window.sharedConversations.size} conversations from localStorage`);
    } catch (error) {
        console.warn("Failed to load conversations from localStorage:", error);
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
        const isRecentConversation = conversation.timestamp && (Date.now() - conversation.timestamp) < 30000; // Within 30 seconds
        
        console.log(`Conversation check: isUserInConversation=${isUserInConversation}, isActiveConversation=${isActiveConversation}, isNotAlreadyInConversation=${isNotAlreadyInConversation}, isRecentConversation=${isRecentConversation}`);
        
        if (isUserInConversation && isActiveConversation && isNotAlreadyInConversation && isRecentConversation) {
            
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
            setUserStatus(options.uid, "in-conversation").catch(error => {
                console.error("Failed to set user status:", error);
            });
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
            
            // Keep conversation active so both users can join
            // Don't mark as processed until both users have joined
            console.log(`User ${options.uid} joined conversation ${conversationId}`);
            
            // Update localStorage to reflect the joined status
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

async function notifyConversationEnded(targetUid, fromUid) {
    console.log(`Notifying User ${targetUid} that conversation ended by User ${fromUid}`);
    
    // Find the conversation to get the conversation ID
    let conversationId = null;
    if (window.sharedConversations) {
        for (let [convId, conversation] of window.sharedConversations.entries()) {
            if ((conversation.user1 === targetUid || conversation.user2 === targetUid) && 
                (conversation.user1 === fromUid || conversation.user2 === fromUid)) {
                conversationId = convId;
                break;
            }
        }
    }
    
    if (conversationId) {
        // Send message to all users in the channel
        const messageData = {
            type: 'conversation_end',
            conversationId: conversationId,
            user1: Math.min(targetUid, fromUid),
            user2: Math.max(targetUid, fromUid),
            endedBy: fromUid,
            timestamp: Date.now()
        };
        
        await sendChannelMessage(messageData);
        
        // Also update localStorage for cross-tab communication (backup)
        try {
            if (window.sharedConversations && window.sharedConversations.has(conversationId)) {
                const conversation = window.sharedConversations.get(conversationId);
                conversation.status = 'ended';
                
                const storedConversations = JSON.parse(localStorage.getItem('sharedConversations') || '{}');
                if (storedConversations[conversationId]) {
                    storedConversations[conversationId].status = 'ended';
                    localStorage.setItem('sharedConversations', JSON.stringify(storedConversations));
                }
            }
        } catch (error) {
            console.warn("Failed to update conversation in localStorage:", error);
        }
        
        console.log(`Notified conversation ended: ${conversationId}`);
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
        handleLocalStorageMessages(); // Check for new messages
        handleApiMessages(); // Check for API messages
        
        // Aggressive cross-device conversation detection
        for (let [uid, user] of platformUsers.entries()) {
            if (uid !== options.uid) {
                // Check if this user is in a conversation with us
                if (user.status === "in-conversation" && user.conversationPartner === options.uid && !isInConversation) {
                    console.log(`Cross-device detection: User ${uid} is in conversation with us`);
                    checkCrossDeviceConversation(uid);
                }
                
                // Check if we should be in a conversation with this user
                if (!isInConversation) {
                    checkForConversationWithUser(uid);
                }
            }
        }
        
        // Force conversation check for all users every few seconds
        if (!isInConversation) {
            for (let [uid, user] of platformUsers.entries()) {
                if (uid !== options.uid) {
                    // Check if this user is trying to talk to us
                    if (user.status === "in-conversation" && user.conversationPartner === options.uid) {
                        console.log(`Force check: User ${uid} is trying to talk to us`);
                        setTimeout(() => {
                            checkCrossDeviceConversation(uid);
                        }, 100);
                    }
                }
            }
        }
        
        // GitHub Pages specific: More aggressive detection for cross-device communication
        if (!isInConversation) {
            for (let [uid, user] of platformUsers.entries()) {
                if (uid !== options.uid && user.status === "in-conversation") {
                    // Check if this user is in a conversation with us (cross-device)
                    if (user.conversationPartner === options.uid) {
                        console.log(`GitHub Pages detection: User ${uid} is in conversation with us`);
                        setTimeout(() => {
                            checkCrossDeviceConversation(uid);
                        }, 50);
                    }
                }
            }
        }
    }
}, 300); // Check every 300ms for even more responsive cross-device communication on GitHub Pages

// Periodic presence broadcast to ensure users stay visible
setInterval(() => {
    if (isConnected && !isInConversation) {
        // Broadcast presence every 10 seconds to ensure other users can see us
        broadcastUserPresence();
    }
}, 10000); // Every 10 seconds

// Debug: Log shared conversations every 5 seconds
setInterval(() => {
    if (isConnected && window.sharedConversations) {
        console.log("Shared conversations:", Array.from(window.sharedConversations.entries()));
        
        // Also force a conversation check every 5 seconds for cross-device sync
        if (!isInConversation) {
            checkForConversationUpdates();
        }
    }
}, 5000);

// Periodic cleanup of stale data
setInterval(() => {
    if (isConnected) {
        cleanupStaleData();
        cleanupDuplicateUsers();
    }
}, 30000); // Every 30 seconds
