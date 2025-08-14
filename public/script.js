// Inisialisasi Socket.io
const socket = io();

// Elemen DOM
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const googleLoginBtn = document.getElementById('google-login');
const logoutBtn = document.getElementById('logout-btn');
const userNameElement = document.getElementById('user-name');
const contactList = document.getElementById('contact-list');
const messageContainer = document.getElementById('message-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Variabel state
let currentUser = null;
let selectedContact = null;
let contacts = [];
let messages = {};

// Event Listeners
googleLoginBtn.addEventListener('click', handleGoogleLogin);
logoutBtn.addEventListener('click', handleLogout);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Fungsi untuk handle login Google
function handleGoogleLogin() {
    // Redirect ke endpoint login Google di server
    window.location.href = '/auth/google';
}

// Fungsi untuk handle logout
function handleLogout() {
    fetch('/auth/logout', {
        method: 'POST'
    })
    .then(() => {
        // Reset state
        currentUser = null;
        selectedContact = null;
        contacts = [];
        messages = {};
        
        // Tampilkan auth container, sembunyikan chat container
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        
        // Reload halaman untuk membersihkan state
        window.location.reload();
    })
    .catch(err => {
        console.error('Logout error:', err);
        alert('Gagal logout');
    });
}

// Fungsi untuk mengirim pesan
function sendMessage() {
    if (!selectedContact || !messageInput.value.trim()) return;
    
    const message = {
        to: selectedContact.id,
        text: messageInput.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    // Kirim pesan via socket
    socket.emit('sendMessage', message);
    
    // Tambahkan pesan ke UI
    addMessageToUI({
        ...message,
        from: currentUser.id,
        senderName: currentUser.name
    }, true);
    
    // Kosongkan input
    messageInput.value = '';
}

// Fungsi untuk menambahkan pesan ke UI
function addMessageToUI(message, isSent) {
    if (!messages[message.from] && !messages[message.to]) {
        messages[isSent ? message.to : message.from] = [];
    }
    
    // Simpan pesan di state
    const chatId = isSent ? message.to : message.from;
    messages[chatId].push(message);
    
    // Jika ini adalah chat yang sedang aktif, tampilkan pesan
    if (selectedContact && ((isSent && selectedContact.id === message.to) || (!isSent && selectedContact.id === message.from))) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-content">${message.text}</div>
            <div class="message-time">${time}</div>
        `;
        
        messageContainer.appendChild(messageDiv);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    // Update last message di contact list
    updateContactLastMessage(chatId, message.text, message.timestamp);
}

// Fungsi untuk update last message di contact list
function updateContactLastMessage(contactId, text, timestamp) {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
        contact.lastMessage = text;
        contact.lastMessageTime = timestamp;
        
        // Update UI
        const contactElement = document.querySelector(`.contact-item[data-id="${contactId}"]`);
        if (contactElement) {
            const lastMessageEl = contactElement.querySelector('.contact-last-message');
            const timeEl = contactElement.querySelector('.contact-time');
            
            if (lastMessageEl) lastMessageEl.textContent = text;
            if (timeEl) timeEl.textContent = formatTime(timestamp);
        }
    }
}

// Fungsi untuk memformat waktu
function formatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    
    if (now.toDateString() === date.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Fungsi untuk memuat kontak
function loadContacts() {
    fetch('/api/contacts')
        .then(response => response.json())
        .then(data => {
            contacts = data;
            renderContacts();
        })
        .catch(err => {
            console.error('Error loading contacts:', err);
            contactList.innerHTML = '<div class="no-contacts">Gagal memuat kontak</div>';
        });
}

// Fungsi untuk render kontak
function renderContacts() {
    if (contacts.length === 0) {
        contactList.innerHTML = '<div class="no-contacts">Tidak ada kontak</div>';
        return;
    }
    
    contactList.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = `contact-item ${selectedContact?.id === contact.id ? 'active' : ''}`;
        contactElement.dataset.id = contact.id;
        
        contactElement.innerHTML = `
            <div class="contact-avatar">
                <img src="${contact.avatar || 'https://i.pravatar.cc/150?img=3'}" alt="${contact.name}">
                ${contact.online ? '<span class="online-dot"></span>' : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-last-message">${contact.lastMessage || ''}</div>
            </div>
            <div class="contact-time">${contact.lastMessageTime ? formatTime(contact.lastMessageTime) : ''}</div>
        `;
        
        contactElement.addEventListener('click', () => {
            selectContact(contact);
        });
        
        contactList.appendChild(contactElement);
    });
}

// Fungsi untuk memilih kontak
function selectContact(contact) {
    selectedContact = contact;
    
    // Update UI
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`.contact-item[data-id="${contact.id}"]`).classList.add('active');
    
    // Load pesan
    loadMessages(contact.id);
    
    // Aktifkan input pesan
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

// Fungsi untuk memuat pesan
function loadMessages(contactId) {
    if (messages[contactId]) {
        renderMessages(messages[contactId]);
        return;
    }
    
    fetch(`/api/messages/${contactId}`)
        .then(response => response.json())
        .then(data => {
            messages[contactId] = data;
            renderMessages(data);
        })
        .catch(err => {
            console.error('Error loading messages:', err);
            messageContainer.innerHTML = '<div class="no-messages">Gagal memuat pesan</div>';
        });
}

// Fungsi untuk render pesan
function renderMessages(messages) {
    messageContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messageContainer.innerHTML = '<div class="no-messages">Belum ada pesan</div>';
        return;
    }
    
    messages.forEach(message => {
        const isSent = message.from === currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-content">${message.text}</div>
            <div class="message-time">${time}</div>
        `;
        
        messageContainer.appendChild(messageDiv);
    });
    
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Socket.io Listeners
socket.on('connect', () => {
    console.log('Connected to socket server');
});

socket.on('newMessage', (message) => {
    if (message.from === selectedContact?.id || message.to === selectedContact?.id) {
        addMessageToUI(message, false);
    }
});

socket.on('userStatus', (data) => {
    const contact = contacts.find(c => c.id === data.userId);
    if (contact) {
        contact.online = data.status === 'online';
        
        const contactElement = document.querySelector(`.contact-item[data-id="${data.userId}"]`);
        if (contactElement) {
            const onlineDot = contactElement.querySelector('.online-dot');
            if (onlineDot) {
                onlineDot.style.display = contact.online ? 'block' : 'none';
            }
        }
    }
});

// Cek status login saat halaman dimuat
fetch('/api/user')
    .then(response => response.json())
    .then(user => {
        if (user) {
            currentUser = user;
            
            // Update UI
            userNameElement.textContent = user.name;
            authContainer.style.display = 'none';
            chatContainer.style.display = 'block';
            
            // Load kontak
            loadContacts();
            
            // Connect socket dengan user ID
            socket.emit('register', user.id);
        }
    })
    .catch(err => {
        console.error('Error checking auth status:', err);
    });
