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
    origin: "https://tugas-aks44l0ya-tians-projects-fb33f0ce.vercel.app",
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
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err);
    res.status(500).json({ message: "Gagal ambil produk." });
  }
});

// Edit harga produk
app.put("/api/products/:id/price", async (req, res) => {
  const productId = parseInt(req.params.id);
  const { price } = req.body;

  if (!price || isNaN(price) || price <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Harga tidak valid." });
  }

  // Contoh update harga di database (ganti sesuai database Anda)
  try {
    // Misal pakai array products
    const product = products.find((p) => p.id === productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Produk tidak ditemukan." });
    }
    product.harga = Number(price);
    // Jika pakai database, lakukan query update di sini

    return res.json({ success: true, message: "Harga berhasil diubah." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
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
    res.json({ success: true, message: "Status produk berhasil diubah." });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Gagal mengubah status produk." });
  }
});

// --- Menjalankan Server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
