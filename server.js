require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Konfigurasi session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 hari
    }
}));

// Inisialisasi passport
app.use(passport.initialize());
app.use(passport.session());

// Konfigurasi Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
},
(accessToken, refreshToken, profile, done) => {
    // Simpan informasi user yang diperlukan
    const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos[0].value
    };
    return done(null, user);
}));

// Serialize dan deserialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    });

app.post('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.get('/api/contacts', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Contoh data kontak (dalam aplikasi nyata, ini dari database)
    const contacts = [
        {
            id: '12345',
            name: 'John Doe',
            avatar: 'https://i.pravatar.cc/150?img=1',
            lastMessage: 'Hai, apa kabar?',
            lastMessageTime: new Date().toISOString(),
            online: true
        },
        {
            id: '67890',
            name: 'Jane Smith',
            avatar: 'https://i.pravatar.cc/150?img=2',
            lastMessage: 'Meeting besok jam 10',
            lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
            online: false
        }
    ];
    
    res.json(contacts);
});

app.get('/api/messages/:contactId', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Contoh data pesan (dalam aplikasi nyata, ini dari database)
    const messages = [
        {
            from: req.params.contactId,
            to: req.user.id,
            text: 'Hai, apa kabar?',
            timestamp: new Date(Date.now() - 60000).toISOString()
        },
        {
            from: req.user.id,
            to: req.params.contactId,
            text: 'Baik, terima kasih!',
            timestamp: new Date().toISOString()
        }
    ];
    
    res.json(messages);
});

// Socket.io Logic
const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('register', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('userStatus', { userId, status: 'online' });
        
        socket.on('disconnect', () => {
            onlineUsers.delete(userId);
            io.emit('userStatus', { userId, status: 'offline' });
        });
    });
    
    socket.on('sendMessage', (message) => {
        const recipientSocketId = onlineUsers.get(message.to);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('newMessage', message);
        }
        // Dalam aplikasi nyata, simpan pesan ke database di sini
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
