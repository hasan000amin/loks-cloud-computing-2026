const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Buat folder uploads jika belum ada
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads/'),
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const email = req.body.email || 'unknown';
        const cleanEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${timestamp}_${cleanEmail}_${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Hanya file JPG/PNG yang diperbolehkan'));
        }
    }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ============ ENDPOINTS ============

// GET / - Menampilkan form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// POST /upload - Menerima upload file
app.post('/upload', upload.single('foto'), (req, res) => {
    const { nama, email } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).send(`
            <h1>❌ Gagal!</h1>
            <p>Tidak ada file yang diupload</p>
            <a href="/">Kembali</a>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Berhasil</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: green;">✅ Upload Berhasil!</h1>
            <p><strong>Terima kasih ${nama}</strong>, data Anda telah tersimpan.</p>
            <p>Email: ${email}</p>
            <p>Nama File: ${file.filename}</p>
            <p>Ukuran: ${(file.size / 1024).toFixed(2)} KB</p>
            <a href="/">📝 Daftar Lagi</a>
            &nbsp;|&nbsp;
            <a href="/list">📋 Lihat Semua Data</a>
        </body>
        </html>
    `);
});

// GET /list - Menampilkan semua file yang sudah diupload
app.get('/list', (req, res) => {
    fs.readdir('./uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Error membaca folder uploads');
        }

        let html = `
            <!DOCTYPE html>
            <html>
            <head><title>Daftar Upload</title></head>
            <body style="font-family: Arial; padding: 20px;">
                <h1>📁 Daftar File yang Telah Diupload</h1>
                <table border="1" cellpadding="10" style="border-collapse: collapse;">
                    <tr style="background: #667eea; color: white;">
                        <th>No</th>
                        <th>Nama File</th>
                        <th>Preview</th>
                    </tr>
        `;

        files.forEach((file, index) => {
            const ext = path.extname(file).toLowerCase();
            const isImage = ext === '.jpg' || ext === '.jpeg' || ext === '.png';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${file}</td>
                    <td>
                        ${isImage ? `<img src="/uploads/${file}" width="50" height="50" style="object-fit: cover;">` : '-'}
                    </td>
                </tr>
            `;
        });

        html += `
                </table>
                <br>
                <a href="/">← Kembali ke Form</a>
            </body>
            </html>
        `;
        res.send(html);
    });
});

// Serve file statis dari folder uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Method tidak diizinkan (405)
app.all('*', (req, res) => {
    res.status(405).send(`
        <h1>405 Method Not Allowed</h1>
        <p>Server hanya menerima metode GET dan POST.</p>
        <a href="/">Kembali ke Home</a>
    `);
});

// Jalankan server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server berjalan di http://localhost:${PORT}`);
    console.log(`📱 Akses dari: http://<IP-EC2>:${PORT}`);
});