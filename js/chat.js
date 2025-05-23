// Check authentication
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
    window.location.href = 'index.html';
}

// Initialize Ably with user ID as clientId
const ably = new Ably.Realtime({
    key: config.ablyApiKey,
    clientId: user.id
});
const channel = ably.channels.get('global-chat');

const presence = channel.presence;
// Enter presence with username and id
presence.enter({ username: user.username, id: user.id });

// DOM Elements
const messageContainer = document.getElementById('messageContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageInput = document.getElementById('imageInput');
const logoutBtn = document.getElementById('logoutBtn');
const onlineCount = document.getElementById('onlineCount');

const menuBtn = document.getElementById('menuBtn');
const sidebarMenu = document.getElementById('sidebarMenu');
const profileId = document.getElementById('profileId');
const profileUsername = document.getElementById('profileUsername');
const groupChatBtn = document.getElementById('groupChatBtn');
const addUserBtn = document.getElementById('addUserBtn');
const addUserSection = document.getElementById('addUserSection');
const searchUserInput = document.getElementById('searchUserInput');
const searchUserBtn = document.getElementById('searchUserBtn');
const searchResults = document.getElementById('searchResults');

let currentChannel = channel; // Start with group chat channel
let currentChannelName = 'global-chat';

// Show profile info
profileId.textContent = `ID: ${user.id}`;
profileUsername.textContent = `Username: ${user.username}`;

// Menu toggle
menuBtn.addEventListener('click', () => {
    if (sidebarMenu.classList.contains('-translate-x-full')) {
        sidebarMenu.classList.remove('-translate-x-full');
    } else {
        sidebarMenu.classList.add('-translate-x-full');
    }
});

// Switch to group chat
groupChatBtn.addEventListener('click', () => {
    switchToChannel('global-chat');
    sidebarMenu.classList.add('-translate-x-full');
});

// Show add user section
addUserBtn.addEventListener('click', () => {
    addUserSection.classList.toggle('hidden');
});

// Search user by ID or username
searchUserBtn.addEventListener('click', () => {
    const query = searchUserInput.value.trim().toLowerCase();
    if (!query) {
        searchResults.innerHTML = '<p class="text-gray-500">Masukkan ID atau nama pengguna untuk mencari.</p>';
        return;
    }
    searchResults.innerHTML = '<p class="text-gray-500">Mencari...</p>';

    // Get presence members and filter by ID or username
    currentChannel.presence.get((err, members) => {
        if (err) {
            searchResults.innerHTML = '<p class="text-red-500">Terjadi kesalahan saat mencari.</p>';
            return;
        }
        const results = members.filter(m => 
            m.clientId.toLowerCase().includes(query) || 
            (m.data && m.data.username && m.data.username.toLowerCase().includes(query))
        );
        if (results.length === 0) {
            searchResults.innerHTML = '<p class="text-gray-500">Tidak ditemukan pengguna.</p>';
            return;
        }
        searchResults.innerHTML = '';
        results.forEach(m => {
            const div = document.createElement('div');
            div.className = 'p-2 border-b cursor-pointer hover:bg-gray-100';
            div.textContent = `${m.data?.username || ''} (${m.clientId})`;
            div.addEventListener('click', () => {
                startPrivateChat(m.clientId, m.data?.username || '');
                sidebarMenu.classList.add('-translate-x-full');
                addUserSection.classList.add('hidden');
                searchResults.innerHTML = '';
                searchUserInput.value = '';
            });
            searchResults.appendChild(div);
        });
    });
});

// Switch to a channel (group or private)
function switchToChannel(channelName) {
    if (currentChannelName === channelName) return;

    // Unsubscribe from current channel
    currentChannel.unsubscribe();
    currentChannel.presence.leave();

    // Get new channel
    currentChannel = ably.channels.get(channelName);
    currentChannelName = channelName;

    // Clear messages
    messageContainer.innerHTML = '';
    displayedMessageIds.clear();

    // Subscribe to new channel messages
    currentChannel.subscribe('message', (message) => {
        addMessageToUI(message);
    });

    // Enter presence
    currentChannel.presence.enter({ username: user.username, id: user.id });

    // Update UI title
    if (channelName === 'global-chat') {
        document.getElementById('chatTitle').textContent = 'WhatsApp NFBS - Ruang Obrolan Global';
        updateOnlineCount();
    } else {
        document.getElementById('chatTitle').textContent = `Chat dengan ${channelName}`;
        onlineCount.textContent = '';
    }
}

// Start private chat with userId and username
function startPrivateChat(userId, username) {
    const privateChannelName = `private-${[user.id, userId].sort().join('-')}`;
    switchToChannel(privateChannelName);
}

// Update online count for group chat
function updateOnlineCount() {
    currentChannel.presence.get((err, members) => {
        if (!err) {
            onlineCount.textContent = `${members.length} online`;
        }
    });
}

// Track message IDs to prevent duplicates in UI
const displayedMessageIds = new Set();

function addMessageToUI(message, isHistory = false) {
    if (displayedMessageIds.has(message.id)) {
        console.log('Duplicate message ignored in UI:', message.id);
        return;
    }
    displayedMessageIds.add(message.id);

    const messageDiv = document.createElement('div');
    const isSent = message.clientId === user.id;
    
    messageDiv.className = `message p-3 rounded-lg mb-2 ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id || message.timestamp; // unique id for message div
    
    let content = '';
    if (message.data.type === 'image') {
        content = `<img src="${message.data.content}" alt="Shared image" class="mb-1">`;
    } else if (message.data.type === 'audio') {
        content = `<audio controls src="${message.data.content}" class="mb-1" style="max-width: 100%;"></audio>`;
    } else if (message.data.type === 'video') {
        content = `<video controls src="${message.data.content}" class="mb-1" style="max-width: 100%; max-height: 300px;"></video>`;
    } else {
        content = `<p class="message-text">${escapeHtml(message.data.content)}</p>`;
    }
    
    let actionButtons = '';
    if (isSent) {
        actionButtons = `
            <div class="flex space-x-2 mt-1">
                <button class="edit-btn text-blue-500 text-xs hover:underline">Edit</button>
                <button class="delete-btn text-red-500 text-xs hover:underline">Delete</button>
            </div>
        `;
    }
    
    messageDiv.innerHTML = `
        ${content}
        ${actionButtons}
        <div class="text-xs text-gray-500 mt-1">
            ${isSent ? 'You' : escapeHtml(message.clientId)} • ${formatTime(message.timestamp)}
        </div>
    `;
    
    messageContainer.appendChild(messageDiv);
    if (!isHistory) {
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    if (isSent) {
        // Add event listeners for edit and delete buttons
        const editBtn = messageDiv.querySelector('.edit-btn');
        const deleteBtn = messageDiv.querySelector('.delete-btn');

        editBtn.addEventListener('click', () => {
            startEditingMessage(messageDiv, message);
        });

        deleteBtn.addEventListener('click', () => {
            deleteMessage(messageDiv, message);
        });
    }
}

// Start editing a message
function startEditingMessage(messageDiv, message) {
    const messageTextP = messageDiv.querySelector('.message-text');
    if (!messageTextP) return;

    const originalText = messageTextP.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'w-full border rounded px-2 py-1 text-sm';

    messageDiv.replaceChild(input, messageTextP);
    input.focus();

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishEditingMessage(messageDiv, message, input.value);
        } else if (e.key === 'Escape') {
            cancelEditingMessage(messageDiv, originalText);
        }
    });

    input.addEventListener('blur', () => {
        cancelEditingMessage(messageDiv, originalText);
    });
}

function finishEditingMessage(messageDiv, message, newText) {
    if (newText.trim() === '') {
        cancelEditingMessage(messageDiv, message.data.content);
        return;
    }
    // Update UI
    const p = document.createElement('p');
    p.className = 'message-text';
    p.textContent = newText;
    const input = messageDiv.querySelector('input');
    if (input) {
        messageDiv.replaceChild(p, input);
    }

    // Send edit event via Ably
    const editMessage = {
        id: message.id,
        clientId: user.id,
        data: {
            type: 'text',
            content: newText
        },
        timestamp: Date.now(),
        event: 'edit'
    };
    channel.publish('message', editMessage);

    // Update localStorage
    updateLocalMessage(editMessage);
}

function cancelEditingMessage(messageDiv, originalText) {
    const input = messageDiv.querySelector('input');
    if (!input) return;
    const p = document.createElement('p');
    p.className = 'message-text';
    p.textContent = originalText;
    messageDiv.replaceChild(p, input);
}

function deleteMessage(messageDiv, message) {
    // Remove from UI
    messageDiv.remove();

    // Send delete event via Ably
    const deleteMessage = {
        id: message.id,
        clientId: user.id,
        event: 'delete',
        timestamp: Date.now()
    };
    channel.publish('message', deleteMessage);

    // Update localStorage
    removeLocalMessage(message.id);
}

// Update message in localStorage
function updateLocalMessage(editedMessage) {
    let history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
    history = history.map(msg => {
        if (msg.id === editedMessage.id) {
            return {
                ...msg,
                data: editedMessage.data,
                timestamp: editedMessage.timestamp
            };
        }
        return msg;
    });
    localStorage.setItem('messageHistory', JSON.stringify(history));
}

// Remove message from localStorage
function removeLocalMessage(messageId) {
    let history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
    history = history.filter(msg => msg.id !== messageId);
    localStorage.setItem('messageHistory', JSON.stringify(history));
}

// Modify subscription to handle edit and delete events
channel.subscribe('message', (message) => {
    if (message.data.event === 'edit') {
        // Find message div and update content
        const msgDiv = document.querySelector(`[data-message-id="${message.id}"]`);
        if (msgDiv) {
            const p = msgDiv.querySelector('.message-text');
            if (p) {
                p.textContent = message.data.content;
            }
        }
        updateLocalMessage(message);
    } else if (message.data.event === 'delete') {
        // Find message div and remove
        const msgDiv = document.querySelector(`[data-message-id="${message.id}"]`);
        if (msgDiv) {
            msgDiv.remove();
        }
        removeLocalMessage(message.id);
    } else {
        addMessageToUI(message);
    }
});

// Request notification permission on load
if ('Notification' in window) {
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Load message history from localStorage
function loadMessageHistory() {
    const history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
    history.forEach(message => addMessageToUI(message, true));
    messageContainer.scrollTop = messageContainer.scrollHeight;

    // Add image click event delegation for preview
    messageContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.closest('.message')) {
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            modalImage.src = e.target.src;
            modal.classList.remove('hidden');
        }
    });

    // Close modal button
    const closeModalBtn = document.getElementById('closeModalBtn');
    closeModalBtn.addEventListener('click', () => {
        const modal = document.getElementById('imageModal');
        modal.classList.add('hidden');
        const modalImage = document.getElementById('modalImage');
        modalImage.src = '';
    });

    // Close modal on outside click
    const modal = document.getElementById('imageModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            const modalImage = document.getElementById('modalImage');
            modalImage.src = '';
        }
    });
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

// Prevent multiple sends
let isSending = false;

// Send button click handler
sendBtn.addEventListener('click', () => {
    console.log('Send button clicked');
    if (isSending) return;
    const message = messageInput.value.trim();
    if (message) {
        console.log('Sending message:', message);
        isSending = true;
        sendMessage(message).finally(() => {
            isSending = false;
        });
        messageInput.value = '';
    }
});

// Enter key handler
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('Enter key pressed');
        if (isSending) return;
        const message = messageInput.value.trim();
        if (message) {
            console.log('Sending message:', message);
            isSending = true;
            sendMessage(message).finally(() => {
                isSending = false;
            });
            messageInput.value = '';
        }
    }
});

// Track last sent message to prevent duplicates
let lastSentMessage = {
    content: null,
    timestamp: 0,
    id: null
};

// Update sendMessage to return a Promise
function sendMessage(content, type = 'text') {
    console.log('sendMessage called with:', content);
    const now = Date.now();

    // Check for duplicate message sent within 0.5 to 1 second
    if (
        lastSentMessage.content === content &&
        now - lastSentMessage.timestamp >= 500 &&
        now - lastSentMessage.timestamp < 1000
    ) {
        console.log('Duplicate message detected, preventing send:', lastSentMessage.id);
        // Prevent sending the second message
        return Promise.reject('Duplicate message prevented');
    }

    const message = {
        id: generateUUID(),
        content,
        type,
        timestamp: now
    };

    lastSentMessage = {
        content,
        timestamp: now,
        id: message.id
    };

    return new Promise((resolve, reject) => {
        channel.publish('message', message, (err) => {
            if (err) {
                console.error('Error sending message:', err);
                reject(err);
                return;
            }

            // Store in history
            const history = JSON.parse(localStorage.getItem('messageHistory') || '[]');
            history.push({
                id: message.id,
                clientId: user.username,
                data: { type: message.type, content: message.content },
                timestamp: message.timestamp
            });
            localStorage.setItem('messageHistory', JSON.stringify(history.slice(-100))); // Keep last 100 messages

            // Set timeout to delete duplicate message if sent within 0.5 seconds
            if (
                lastSentMessage.content === content &&
                now - lastSentMessage.timestamp < 500
            ) {
                if (duplicateDeleteTimeouts[message.id]) {
                    clearTimeout(duplicateDeleteTimeouts[message.id]);
                }
                duplicateDeleteTimeouts[message.id] = setTimeout(() => {
                    const deleteMessage = {
                        id: message.id,
                        clientId: user.username,
                        event: 'delete',
                        timestamp: Date.now()
                    };
                    channel.publish('message', deleteMessage);
                    removeLocalMessage(message.id);
                    delete duplicateDeleteTimeouts[message.id];
                }, 1000);
            }

            resolve();
        });
    });
}

// UUID generator for message IDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Image upload handler
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImage = document.getElementById('imagePreview');
    const clearBtn = document.getElementById('clearImagePreview');

    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        e.target.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size should be less than 5MB');
        e.target.value = '';
        return;
    }

    try {
        const base64 = await convertToBase64(file);
        previewImage.src = base64;
        previewContainer.classList.remove('hidden');

        clearBtn.onclick = () => {
            previewImage.src = '';
            previewContainer.classList.add('hidden');
            imageInput.value = '';
        };

        // Send image on send button click or enter key
        sendBtn.onclick = () => {
            if (previewImage.src) {
                sendMessage(previewImage.src, 'image');
                previewImage.src = '';
                previewContainer.classList.add('hidden');
                imageInput.value = '';
                messageInput.value = '';
            }
        };

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && previewImage.src) {
                e.preventDefault();
                sendBtn.click();
            }
        });

    } catch (error) {
        console.error('Error processing image:', error);
        alert('Error uploading image. Please try again.');
        e.target.value = '';
    }
});

// Audio and Video recording logic
let mediaRecorder;
let recordedChunks = [];
let recordingType = null; // 'audio' or 'video'
let currentStream = null;

const voiceBtn = document.getElementById('voiceBtn');
const videoBtn = document.getElementById('videoBtn');

voiceBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }
    recordingType = 'audio';
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentStream = stream;
        startRecording(stream);
    } catch (err) {
        alert('Gagal mengakses mikrofon: ' + err.message);
    }
});

videoBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }
    recordingType = 'video';
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        currentStream = stream;
        startRecording(stream);
    } catch (err) {
        alert('Gagal mengakses kamera dan mikrofon: ' + err.message);
    }
});

function startRecording(stream) {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: recordingType === 'audio' ? 'audio/webm' : 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            sendMessage(reader.result, recordingType);
        };
        reader.readAsDataURL(blob);
        // Stop all tracks
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    };
    mediaRecorder.start();
    alert(`Merekam ${recordingType}... Klik tombol lagi untuk berhenti.`);
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    // Leave presence channel immediately
    presence.leave(() => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });
});

// Inactivity logout after 15 minutes of no activity
let inactivityTimeout;
const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
        alert('You have been logged out due to inactivity.');
        presence.leave(() => {
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }, INACTIVITY_LIMIT);
}

// Reset timer on user interactions
['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    window.addEventListener(event, resetInactivityTimer);
});

// Start the timer initially
resetInactivityTimer();

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
</create_file>
