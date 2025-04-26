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
        clientId: user.username,
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
        clientId: user.username,
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

// Subscribe to new messages
channel.subscribe('message', (message) => {
    addMessageToUI(message);

    // Show notification if window is not focused and message is not from self
    if (document.hidden && message.clientId !== user.username && Notification.permission === 'granted') {
        let notificationOptions = {
            body: message.data.type === 'text' ? message.data.content : 'Sent an image',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg' // WhatsApp logo icon
        };
        new Notification(`New message from ${message.clientId}`, notificationOptions);
    }
});

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

let duplicateDeleteTimeouts = {};

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

// Modify subscription to handle edit and delete events
channel.subscribe('message', (message) => {
    console.log('Received message event:', message);
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

// Enter key handler
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isSending) return;
        const message = messageInput.value.trim();
        if (message) {
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
    const now = Date.now();

    // Check for duplicate message sent within 1 second
    if (
        lastSentMessage.content === content &&
        now - lastSentMessage.timestamp < 1000
    ) {
        // Send delete event for the duplicate message
        if (lastSentMessage.id) {
            const deleteMessage = {
                id: lastSentMessage.id,
                clientId: user.username,
                event: 'delete',
                timestamp: now
            };
            channel.publish('message', deleteMessage);
            removeLocalMessage(lastSentMessage.id);
        }
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
