const express = require("express");
const { Pool } = require('pg');
const bcrypt = require("bcryptjs");
const cors = require("cors");
const session = require("express-session");

const app = express();

// --- KONFIGURASI KRUSIAL UNTUK PRODUKSI ---

// 1. Memberitahu Express untuk mempercayai proxy dari Railway
app.set('trust proxy', 1);

// 2. Konfigurasi CORS untuk frontend Vercel Anda
app.use(cors({
    origin: "https://tugas-aks44l0ya-tians-projects-fb33f0ce.vercel.app", // URL Vercel Frontend Anda
    credentials: true
}));

// 3. Middleware untuk membaca body JSON
app.use(express.json());

// 4. Konfigurasi koneksi ke database Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// 5. Konfigurasi Sesi untuk Lintas Domain
app.use(session({
    secret: process.env.SESSION_SECRET, // Diambil dari Environment Variable Railway
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,        // Cookie hanya dikirim melalui HTTPS
        httpOnly: true,      // Mencegah akses dari JavaScript sisi klien
        sameSite: 'none',    // KUNCI UTAMA: Izinkan cookie dikirim dari domain berbeda
        maxAge: 24 * 60 * 60 * 1000 // Sesi berlaku selama 1 hari
    }
}));


// --- KUMPULAN API ENDPOINTS ---

app.get("/api", (req, res) => {
    res.status(200).json({ message: "Backend API is running!" });
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM admin WHERE username = $1', [username]);
        const user = rows[0];
        if (!user) return res.status(401).json({ success: false, message: "Username/password salah." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = { id: user.id, username: user.username };
            // Simpan sesi sebelum mengirim respons untuk memastikan cookie terkirim
            req.session.save(() => {
                res.json({ success: true });
            });
        } else {
            return res.status(401).json({ success: false, message: "Username/password salah." });
        }
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

app.get("/api/profile", (req, res) => {
    if (req.session && req.session.user) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: "Gagal logout." });
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout berhasil.' });
    });
});

app.get("/api/products", async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
        res.json(rows);
    } catch (err) {
        console.error("GET PRODUCTS ERROR:", err);
        res.status(500).json({ message: "Gagal ambil produk." });
    }
});

// --- Menjalankan Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
