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
