// VERSI PENGUJIAN TANPA BCRYPT

const express = require("express");
const { Pool } = require("pg");
// const bcrypt = require("bcryptjs"); // bcryptjs sengaja dinonaktifkan untuk tes
const cors = require("cors");
const session = require("express-session");

const app = express();

// --- KONFIGURASI PENTING UNTUK PRODUKSI ---

// 1. Memberitahu Express untuk mempercayai proxy dari Railway
app.set("trust proxy", 1);

// 2. Konfigurasi CORS untuk frontend Vercel Anda
app.use(
  cors({
    origin: [
      "https://tugas-rpl-pi.vercel.app",
      "https://tugas-aks44l0ya-tians-projects-fb33f0ce.vercel.app",
    ],
    credentials: true,
  })
);

// 3. Middleware untuk membaca body JSON
app.use(express.json());

// 4. Konfigurasi koneksi ke database Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 5. Konfigurasi Sesi untuk Lintas Domain
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // Sesi berlaku 1 hari
    },
  })
);

// --- KUMPULAN API ENDPOINTS ---

app.get("/api", (req, res) => {
  res
    .status(200)
    .json({ message: "Backend API is running in TEST MODE (without bcrypt)!" });
});

// Endpoint Login dengan perbandingan teks biasa
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM admin WHERE username = $1",
      [username]
    );
    const user = rows[0];
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Username salah." });
    }

    // === PERUBAHAN UTAMA: Membandingkan password langsung (plain text) ===
    if (password === user.password) {
      req.session.user = { id: user.id, username: user.username };
      req.session.save(() => {
        res.json({ success: true, message: "Login berhasil (Mode Tes)." });
      });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Password salah." });
    }
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// Endpoint untuk mengecek sesi (profil)
app.get("/api/profile", (req, res) => {
  if (req.session && req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Endpoint Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Gagal logout." });
    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logout berhasil." });
  });
});

// Endpoint untuk mendapatkan semua produk
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
    // Pastikan setiap produk punya properti 'active'
    const products = result.rows.map((row) => ({
      id: row.id,
      nama_produk: row.nama_produk,
      harga: row.harga,
      deskripsi: row.deskripsi,
      gambar_url: row.gambar_url, // pastikan field ini ada di database
      active: row.active,
    }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// Edit harga produk - DIPERBAIKI
app.put("/api/products/:id/price", async (req, res) => {
  const productId = parseInt(req.params.id);
  const { price } = req.body;

  if (!price || isNaN(price) || price <= 0) {
    return res.status(400).json({ error: "Harga tidak valid" });
  }

  try {
    await pool.query("UPDATE products SET harga = $1 WHERE id = $2", [
      price,
      productId,
    ]);
    res.json({ message: "Harga produk berhasil diubah" });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengubah harga produk" });
  }
});

// Aktif/nonaktifkan produk
app.put("/api/products/:id/active", async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  try {
    await pool.query("UPDATE products SET active = $1 WHERE id = $2", [
      active,
      id,
    ]);
    res.json({ message: "Status produk berhasil diubah" });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengubah status produk" });
  }
});

// Tambahan: Endpoint untuk menambah produk baru
app.post("/api/products", async (req, res) => {
  const { nama_produk, harga, deskripsi } = req.body;

  if (!nama_produk || !harga) {
    return res.status(400).json({
      success: false,
      message: "Nama produk dan harga wajib diisi.",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO products (nama_produk, harga, deskripsi, active) VALUES ($1, $2, $3, true) RETURNING *",
      [nama_produk, harga, deskripsi || ""]
    );

    res.status(201).json({
      success: true,
      message: "Produk berhasil ditambahkan.",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: "Gagal menambah produk." });
  }
});

// Tambahan: Endpoint untuk menghapus produk
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan.",
      });
    }

    res.json({
      success: true,
      message: "Produk berhasil dihapus.",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE PRODUCT ERROR:", err);
    res
      .status(500)
      .json({ success: false, message: "Gagal menghapus produk." });
  }
});

// --- Menjalankan Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
