document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    // Validate inputs
    if (!username || !password) {
        showError('Please fill in all fields');
        return;
    }

    // Check password
    if (password !== 'Ratubagus') {
        showError('Invalid credentials');
        return;
    }

    // Generate 5-character alphanumeric ID
    function generateUserId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 5; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    const userId = generateUserId();

    // Store user data with ID
    localStorage.setItem('user', JSON.stringify({ username, id: userId }));

    // Redirect to chat
    window.location.href = 'chat.html';
});

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 3000);
}

// Check if user is already logged in
window.addEventListener('load', () => {
    const user = localStorage.getItem('user');
    if (user) {
        window.location.href = 'chat.html';
    }
});
