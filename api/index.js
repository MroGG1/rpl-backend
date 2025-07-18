// VERSI PENGUJIAN DENGAN BCRYPT

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");

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

// Konfigurasi Multer untuk upload gambar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Static folder untuk akses gambar
app.use("/uploads", express.static("uploads"));

// --- KUMPULAN API ENDPOINTS ---

app.get("/api", (req, res) => {
  res
    .status(200)
    .json({ message: "Backend API is running in TEST MODE (without bcrypt)!" });
});

// Endpoint Login dengan bcrypt
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

    // Membandingkan password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      req.session.user = { id: user.id, username: user.username };
      req.session.save(() => {
        res.json({ success: true, message: "Login berhasil." });
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

// Endpoint tambah produk dengan upload gambar
app.post("/api/products", upload.single("gambar_file"), async (req, res) => {
  const { nama_produk, harga, deskripsi } = req.body;
  const gambar_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!nama_produk || !harga || !gambar_url) {
    return res.status(400).json({
      success: false,
      message: "Nama produk, harga, dan gambar wajib diisi.",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO products (nama_produk, harga, deskripsi, gambar_url, active) VALUES ($1, $2, $3, $4, true) RETURNING *",
      [nama_produk, harga, deskripsi || "", gambar_url]
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

// Endpoint ambil semua produk
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// Endpoint hapus produk
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus produk" });
  }
});

// Endpoint edit produk (tanpa gambar)
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { nama_produk, harga, deskripsi } = req.body;
  try {
    await pool.query(
      "UPDATE products SET nama_produk = $1, harga = $2, deskripsi = $3 WHERE id = $4",
      [nama_produk, harga, deskripsi, id]
    );
    res.json({ message: "Produk berhasil diubah" });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengubah produk" });
  }
});

// Endpoint edit harga produk
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

// Endpoint aktif/nonaktif produk
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

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API berjalan di port ${PORT}`);
});
