const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('home');
});

router.get('/history', (req, res) => {
    // Mock history for now
    res.render('history', { files: [], page: 1, total_pages: 1 });
});

module.exports = router;
