const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const PORT = 3000;

// Konfigurasi Koneksi RDS
const db = mysql.createConnection({
    host: 'db-lomba.XXX.ap-southeast-1.rds.amazonaws.com', // Lihat di menu Connectivity RDS
    user: 'admin',
    password: 'password123', // Ganti dengan password RDS Anda
    database: 'DB-ANDA' // Ganti dengan nama database yang sudah dibuat di RDS
});

// Konfigurasi S3 Client
const s3 = new S3Client({ region: "ap-southeast-1" }); // Sesuaikan region bucket Mas
const BUCKET_NAME = "BUCKET-ANDA"; // Ganti dengan nama bucket S3 Anda

db.connect((err) => {
    if (err) {
        console.error('Gagal koneksi ke RDS: ' + err.stack);
        return;
    }
    console.log('Terhubung ke RDS MySQL sebagai ID ' + db.threadId);
});

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

app.post('/upload', upload.single('foto'), async (req, res) => {
    const { nama, email } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send('File tidak ditemukan');

    const fileName = `${Date.now()}_${file.originalname}`;

    try {
        // --- 1. PROSES KE S3 ---
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: `uploads/${fileName}`,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype
        };
        await s3.send(new PutObjectCommand(s3Params));

        // URL S3 untuk disimpan ke Database
        const s3Url = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/uploads/${fileName}`;
        console.log("✅ S3 Upload Sukses:", s3Url);

        // --- 2. PROSES KE RDS ---
        // PENTING: Pastikan nama kolom di DB adalah 'foto_url'
        const sql = 'INSERT INTO peserta (nama, email, foto_url) VALUES (?, ?, ?)';

        db.query(sql, [nama, email, s3Url], (dbErr, result) => {
            if (dbErr) {
                console.error('❌ DATABASE ERROR:', dbErr.sqlMessage);
                return res.status(500).send('Gagal Simpan ke Database: ' + dbErr.sqlMessage);
            }

            console.log("✅ Berhasil Simpan ke RDS, ID:", result.insertId);

            // Hapus file sementara di EC2
            fs.unlinkSync(file.path);

            res.send(`
                <h1 style="color: green;">Semua Berhasil!</h1>
                <p>Data tersimpan di RDS dan File di S3.</p>
                <a href="/">Kembali</a> | <a href="/list">Lihat Data</a>
            `);
        });

    } catch (s3Err) {
        console.error('❌ S3 ERROR:', s3Err);
        res.status(500).send('Gagal di proses S3: ' + s3Err.message);
    }
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