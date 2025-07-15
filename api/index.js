const express = require("express");
const { Pool } = require('pg');
const bcrypt = require("bcryptjs");
const cors = require("cors");
const session = require("express-session");

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || "https://tugas-rpl-pi.vercel.app",
    credentials: true
}));

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Diperlukan karena Railway menggunakan proxy
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// === API ENDPOINTS ===

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
            return res.json({ success: true });
        } else {
            return res.status(401).json({ success: false, message: "Username/password salah." });
        }
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

app.get("/api/profile", (req, res) => {
    if (req.session.user) {
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

app.post("/api/products", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    const { nama_produk, harga, deskripsi } = req.body;
    try {
        const { rows } = await pool.query('INSERT INTO products (nama_produk, harga, deskripsi) VALUES ($1, $2, $3) RETURNING id', [nama_produk, harga, deskripsi]);
        res.status(201).json({ success: true, id: rows[0].id });
    } catch (err) {
        console.error("CREATE PRODUCT ERROR:", err);
        res.status(500).json({ message: "Gagal menambah produk." });
    }
});

app.put("/api/products/:id", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { id } = req.params;
        const { nama_produk, harga, deskripsi } = req.body;
        await pool.query('UPDATE products SET nama_produk = $1, harga = $2, deskripsi = $3 WHERE id = $4', [nama_produk, harga, deskripsi, id]);
        res.json({ success: true });
    } catch (err) {
        console.error("UPDATE PRODUCT ERROR:", err);
        res.status(500).json({ message: "Gagal update produk." });
    }
});

app.delete("/api/products/:id", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE PRODUCT ERROR:", err);
        res.status(500).json({ message: "Gagal hapus produk." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
