// Check authentication
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
    window.location.href = 'index.html';
}

// Initialize Ably
const ably = new Ably.Realtime({
    key: config.ablyApiKey,
    clientId: user.username
});
const channel = ably.channels.get('global-chat');

// DOM Elements
const messageContainer = document.getElementById('messageContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageInput = document.getElementById('imageInput');
const logoutBtn = document.getElementById('logoutBtn');
const onlineCount = document.getElementById('onlineCount');

// Message handling
function addMessageToUI(message, isHistory = false) {
    const messageDiv = document.createElement('div');
    const isSent = message.clientId === user.username;
    
    messageDiv.className = `message p-3 rounded-lg mb-2 ${isSent ? 'sent' : 'received'}`;
    
    let content = '';
    if (message.data.type === 'image') {
        content = `<img src="${message.data.content}" alt="Shared image" class="mb-1">`;
    } else {
        content = `<p>${escapeHtml(message.data.content)}</p>`;
    }
    
    messageDiv.innerHTML = `
        ${content}
        <div class="text-xs text-gray-500 mt-1">
            ${isSent ? 'You' : escapeHtml(message.clientId)} • ${formatTime(message.timestamp)}
        </div>
    `;
    
    messageContainer.appendChild(messageDiv);
    if (!isHistory) {
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

// Subscribe to new messages
channel.subscribe('message', (message) => {
    addMessageToUI(message);
});

// Load message history from localStorage
function loadMessageHistory() {
    const history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
    history.forEach(message => addMessageToUI(message, true));
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Send message function
function sendMessage(content, type = 'text') {
    const message = {
        content,
        type,
        timestamp: Date.now()
    };

    channel.publish('message', message, (err) => {
        if (err) {
            console.error('Error sending message:', err);
            return;
        }

        // Store in history
        const history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
        history.push({
            clientId: user.username,
            data: message,
            timestamp: message.timestamp
        });
        localStorage.setItem('messageHistory', JSON.stringify(history.slice(-100))); // Keep last 100 messages
    });
}

// Send button click handler
sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        sendMessage(message);
        messageInput.value = '';
    }
});

// Enter key handler
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Image upload handler
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size should be less than 5MB');
        return;
    }

    try {
        const base64 = await convertToBase64(file);
        sendMessage(base64, 'image');
    } catch (error) {
        console.error('Error processing image:', error);
        alert('Error uploading image. Please try again.');
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

// Utility functions
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Presence handling for online users count
const presence = channel.presence;
presence.enter();

presence.subscribe('enter', () => updateOnlineCount());
presence.subscribe('leave', () => updateOnlineCount());

function updateOnlineCount() {
    presence.get((err, members) => {
        if (!err) {
            onlineCount.textContent = `${members.length} online`;
        }
    });
}

// Initialize
loadMessageHistory();
updateOnlineCount();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    presence.leave();
    ably.close();
});
