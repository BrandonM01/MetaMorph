const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Placeholder login check (replace with real DB check)
    if (email === 'test@example.com' && password === 'password') {
        req.session.user = email;  // Save to session
        return res.redirect('/');
    }
    req.flash('error', '❌ Login failed.');
    res.redirect('/auth/login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', (req, res) => {
    const { email, password } = req.body;
    // No DB yet, just flash success
    req.flash('success', '✅ Registered (mock)');
    res.redirect('/auth/login');
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login');
    });
});

module.exports = router;
