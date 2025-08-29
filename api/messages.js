// Vercel API route for cross-device messaging
// This provides a simple message relay service

// In-memory message store (in production, use Redis or database)
const messageStore = new Map();
const connectedUsers = new Set();

export default function handler(req, res) {
  // Enable CORS for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Send a message
    const { type, sender, target, data, timestamp } = req.body;
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      sender,
      target,
      data,
      timestamp: timestamp || Date.now()
    };

    // Store message
    if (!messageStore.has(target)) {
      messageStore.set(target, []);
    }
    messageStore.get(target).push(message);

    // Keep only recent messages (last 50)
    const messages = messageStore.get(target);
    if (messages.length > 50) {
      messages.splice(0, messages.length - 50);
    }

    res.status(200).json({ success: true, messageId: message.id });
  } else if (req.method === 'GET') {
    // Get messages for a user
    const { uid, since } = req.query;
    
    if (!uid) {
      res.status(400).json({ error: 'User ID required' });
      return;
    }

    const messages = messageStore.get(uid) || [];
    const filteredMessages = since 
      ? messages.filter(msg => msg.timestamp > parseInt(since))
      : messages;

    res.status(200).json({ messages: filteredMessages });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
