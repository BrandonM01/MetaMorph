const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const router = express.Router();

// === Folder Setup ===
const PROCESSED_DIR = path.join(__dirname, '..', 'processed');
const HISTORY_DIR   = path.join(__dirname, '..', 'public', 'static', 'history');
const ZIP_DIR       = path.join(__dirname, '..', 'public', 'static', 'processed_zips');
const UPLOADS_DIR   = path.join(__dirname, '..', 'uploads');
[PROCESSED_DIR, HISTORY_DIR, ZIP_DIR, UPLOADS_DIR].forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// === Utilities ===
function scaleRange(min, max, intensity) {
    const factor = intensity / 100;
    return Math.random() * (max - min) * factor + min * factor;
}

// === Page Routes ===
router.get('/image-processor', (req, res) => res.render('image_processor'));
router.get('/video-processor', (req, res) => res.render('video_processor'));

// === Image Processing Route ===
router.post('/process-images', async (req, res) => {
    const files = req.files?.images;
    const batchSize = parseInt(req.body.batch_size) || 5;
    const intensity = parseInt(req.body.intensity) || 30;

    const opts = {
        contrast: 'adjust_contrast' in req.body,
        brightness: 'adjust_brightness' in req.body,
        rotate: 'rotate' in req.body,
        crop: 'crop' in req.body,
        flip: 'flip_horizontal' in req.body
    };

    if (!files) return res.status(400).json({ error: 'No images uploaded' });

    const fileArray = Array.isArray(files) ? files : [files];
    const timestamp = Date.now().toString();
    const sessionFolder = path.join(PROCESSED_DIR, timestamp);
    fs.mkdirSync(sessionFolder, { recursive: true });

    for (const file of fileArray) {
        const baseName = path.parse(file.name).name;

        for (let i = 1; i <= batchSize; i++) {
            const outputName = `${baseName}_variant_${i}.jpg`;
            const outputPath = path.join(sessionFolder, outputName);
            const historyPath = path.join(HISTORY_DIR, outputName);

            let img = sharp(file.data);

            if (opts.contrast || opts.brightness) {
                const contrast = opts.contrast ? 1 + scaleRange(-0.1, 0.1, intensity) : 1;
                const brightness = opts.brightness ? 1 + scaleRange(-0.1, 0.1, intensity) : 1;
                img = img.modulate({ brightness, contrast });
            }

            if (opts.rotate) {
                const deg = scaleRange(-5, 5, intensity);
                img = img.rotate(deg);
            }

            if (opts.crop) {
                const metadata = await img.metadata();
                const w = metadata.width;
                const h = metadata.height;
                const dx = Math.floor(w * scaleRange(0.01, 0.05, intensity));
                const dy = Math.floor(h * scaleRange(0.01, 0.05, intensity));
                img = img.extract({ left: dx, top: dy, width: w - 2 * dx, height: h - 2 * dy });
            }

            if (opts.flip && Math.random() > 0.5) {
                img = img.flip().flop();
            }

            await img.toFile(outputPath);
            fs.copyFileSync(outputPath, historyPath);
        }
    }

    const zipFilename = `images_${timestamp}.zip`;
    const zipPath = path.join(ZIP_DIR, zipFilename);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    fs.readdirSync(sessionFolder).forEach(file => {
        archive.file(path.join(sessionFolder, file), { name: file });
    });
    archive.finalize();

    output.on('close', () => {
        fs.rmSync(sessionFolder, { recursive: true });
        res.json({ zip_filename: zipFilename });
    });
});

// === Video Processing Route ===
router.post('/process-videos', async (req, res) => {
    const files = req.files?.videos;
    const batchSize = parseInt(req.body.batch_size) || 5;
    const intensity = parseInt(req.body.intensity) || 30;

    const opts = {
        contrast: 'adjust_contrast' in req.body,
        brightness: 'adjust_brightness' in req.body,
        rotate: 'rotate' in req.body,
        crop: 'crop' in req.body,
        flip: 'flip_horizontal' in req.body
    };

    if (!files) return res.status(400).json({ error: 'No videos uploaded' });

    const fileArray = Array.isArray(files) ? files : [files];
    const timestamp = Date.now().toString();
    const sessionFolder = path.join(PROCESSED_DIR, timestamp);
    fs.mkdirSync(sessionFolder, { recursive: true });

    for (const file of fileArray) {
        const baseName = path.parse(file.name).name;
        const inputPath = path.join(UPLOADS_DIR, file.name);
        await file.mv(inputPath);

        for (let i = 1; i <= batchSize; i++) {
            const outName = `${baseName}_variant_${i}.mp4`;
            const outPath = path.join(sessionFolder, outName);
            const histPath = path.join(HISTORY_DIR, outName);

            let cmd = ffmpeg(inputPath);
            const vf = [];

            if (opts.contrast || opts.brightness) {
                const c = opts.contrast ? 1 + scaleRange(-0.1, 0.1, intensity) : 1;
                const b = opts.brightness ? scaleRange(-0.1, 0.1, intensity) : 0;
                vf.push(`eq=contrast=${c}:brightness=${b}`);
            }

            if (opts.rotate) {
                const angle = scaleRange(-2, 2, intensity) * (Math.PI / 180);
                vf.push(`rotate=${angle}`);
            }

            if (opts.crop) {
                vf.push(`crop=in_w*0.95:in_h*0.95`);
            }

            if (opts.flip && Math.random() > 0.5) {
                vf.push('hflip');
            }

            if (vf.length) {
                cmd = cmd.videoFilters(vf.join(','));
            }

            await new Promise((resolve, reject) => {
                cmd.outputOptions(['-c:v libx264', '-preset veryfast', '-c:a aac'])
                    .output(outPath)
                    .on('end', () => {
                        fs.copyFileSync(outPath, histPath);
                        resolve();
                    })
                    .on('error', reject)
                    .run();
            });
        }

        fs.unlinkSync(inputPath); // cleanup
    }

    const zipFilename = `videos_${timestamp}.zip`;
    const zipPath = path.join(ZIP_DIR, zipFilename);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    fs.readdirSync(sessionFolder).forEach(file => {
        archive.file(path.join(sessionFolder, file), { name: file });
    });
    archive.finalize();

    output.on('close', () => {
        fs.rmSync(sessionFolder, { recursive: true });
        res.json({ zip_filename: zipFilename });
    });
});

module.exports = router;
