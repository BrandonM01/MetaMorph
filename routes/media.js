const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const router = express.Router();

// Ensure folders exist
const PROCESSED_DIR = path.join(__dirname, '..', 'processed');
const HISTORY_DIR   = path.join(__dirname, '..', 'public', 'static', 'history');
const ZIP_DIR       = path.join(__dirname, '..', 'public', 'static', 'processed_zips');
const UPLOADS_DIR   = path.join(__dirname, '..', 'uploads');
[PROCESSED_DIR, HISTORY_DIR, ZIP_DIR, UPLOADS_DIR].forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// GET pages
router.get('/image-processor', (req, res) => {
    res.render('image_processor');
});
router.get('/video-processor', (req, res) => {
    res.render('video_processor');
});

// POST /media/process-images
router.post('/process-images', async (req, res) => {
    const files = req.files?.images;
    const batchSize = parseInt(req.body.batch_size) || 5;
    const intensity = parseInt(req.body.intensity) || 30;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }

    // For now, just copy files into history and return zip mock
    const timestamp = Date.now().toString();
    const zipFilename = `images_${timestamp}.zip`;
    const zipPath = path.join(ZIP_DIR, zipFilename);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        res.json({ zip_filename: zipFilename });
    });

    archive.pipe(output);

    const fileArray = Array.isArray(files) ? files : [files];
    for (const file of fileArray) {
        for (let i = 1; i <= batchSize; i++) {
            const newFilename = `${path.parse(file.name).name}_variant_${i}.jpg`;
            const savePath = path.join(HISTORY_DIR, newFilename);
            await file.mv(savePath);
            archive.file(savePath, { name: newFilename });
        }
    }

    archive.finalize();
});

// POST /media/process-videos
router.post('/process-videos', async (req, res) => {
    const files = req.files?.videos;
    const batchSize = parseInt(req.body.batch_size) || 5;
    const intensity = parseInt(req.body.intensity) || 30;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No videos uploaded' });
    }

    const timestamp = Date.now().toString();
    const zipFilename = `videos_${timestamp}.zip`;
    const zipPath = path.join(ZIP_DIR, zipFilename);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        res.json({ zip_filename: zipFilename });
    });

    archive.pipe(output);

    const fileArray = Array.isArray(files) ? files : [files];
    for (const file of fileArray) {
        for (let i = 1; i <= batchSize; i++) {
            const newFilename = `${path.parse(file.name).name}_variant_${i}.mp4`;
            const savePath = path.join(HISTORY_DIR, newFilename);
            await file.mv(savePath);
            archive.file(savePath, { name: newFilename });
        }
    }

    archive.finalize();
});

module.exports = router;
