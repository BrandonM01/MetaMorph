const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('settings');
});

router.post('/', (req, res) => {
    // No DB updates yet, just pretend
    req.flash('success', '✅ Settings updated.');
    res.redirect('/settings');
});

module.exports = router;
