const express = require('express');
const mysql = require('mysql2');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Koneksi Database (Konfigurasinya di Azure Portal nanti)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// Koneksi Blob Storage
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

// Endpoint untuk submit tugas
app.post('/submit-task', upload.single('file_tugas'), async (req, res) => {
    const { nim, name, class_name, course } = req.body;
    const blobName = `${nim}_${req.file.originalname}`;

    // 1. Upload ke Azure Blob Storage
    const containerClient = blobServiceClient.getContainerClient('tugas-praktikum-057');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer);
    const fileUrl = blockBlobClient.url;

    // 2. Simpan Metadata ke MySQL
    const sql = "INSERT INTO submissions (nim, name, class, course, file_url) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [nim, name, class_name, course, fileUrl], (err) => {
        if (err) return res.status(500).send(err);
        res.redirect('/success.html');
    });
});

// Endpoint untuk melihat daftar tugas
app.get('/task-list', (req, res) => {
    const sql = "SELECT * FROM submissions ORDER BY submitted_at DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        let rows = results.map(r => `
            <tr>
                <td>${r.nim}</td>
                <td>${r.name}</td>
                <td>${r.class}</td>
                <td>${r.course}</td>
                <td><a href="${r.file_url}" target="_blank">Lihat File</a></td>
                <td><span class="badge ${r.status === 'Submitted' ? 'badge-submitted' : 'badge-pending'}">${r.status}</span></td>
                <td>${new Date(r.submitted_at).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Daftar Tugas | Cloud Computing</title>
                <style>
                    :root {
                        --primary-blue: #7ab8f5;
                        --soft-blue: #dceefb;
                        --primary-pink: #f48fb1;
                        --soft-pink: #fde0eb;
                        --dark-blue: #3a6fa8;
                        --white: #ffffff;
                    }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: var(--soft-blue);
                        min-height: 100vh;
                        padding: 2rem;
                    }
                    .container {
                        background-color: var(--white);
                        border-radius: 20px;
                        padding: 2rem;
                        box-shadow: 0 8px 24px rgba(122, 184, 245, 0.2);
                        max-width: 1000px;
                        margin: 0 auto;
                    }
                    h2 {
                        color: var(--dark-blue);
                        margin-bottom: 1.5rem;
                        font-size: 1.4rem;
                        text-align: center;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9rem;
                    }
                    th {
                        background-color: var(--soft-pink);
                        color: var(--dark-blue);
                        padding: 10px 12px;
                        text-align: left;
                        font-weight: 600;
                    }
                    td {
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--soft-blue);
                        color: #444;
                    }
                    tr:last-child td { border-bottom: none; }
                    a { color: var(--primary-blue); text-decoration: none; font-weight: 600; }
                    a:hover { color: var(--dark-blue); }
                    .badge {
                        padding: 4px 10px;
                        border-radius: 20px;
                        font-size: 0.78rem;
                        font-weight: 600;
                    }
                    .badge-submitted { background-color: #d4f5e9; color: #2e7d5e; }
                    .badge-pending { background-color: var(--soft-pink); color: #c2185b; }
                    .back-btn {
                        display: inline-block;
                        margin-bottom: 1.2rem;
                        color: var(--primary-pink);
                        font-weight: 600;
                        text-decoration: none;
                        font-size: 0.9rem;
                    }
                    .back-btn:hover { color: var(--dark-blue); }
                </style>
            </head>
            <body>
                <div class="container">
                    <a href="/" class="back-btn">Kembali ke Form</a>
                    <h2>Daftar Pengumpulan Tugas</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>NIM</th>
                                <th>Nama</th>
                                <th>Kelas</th>
                                <th>Mata Kuliah</th>
                                <th>File</th>
                                <th>Status</th>
                                <th>Waktu</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </body>
            </html>
        `);
    });
});

app.listen(process.env.PORT || 3000);
