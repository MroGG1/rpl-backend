// Lokasi: /proyek-rpl-backend/api/index.js

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const session = require("express-session");

const app = express();

// Konfigurasi CORS untuk menerima permintaan dari domain manapun
// Nanti, Anda bisa mengganti '*' dengan URL Vercel frontend Anda untuk keamanan lebih.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(express.json());

// Konfigurasi koneksi ke database Supabase Anda
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Konfigurasi Sesi
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // Hanya kirim cookie melalui HTTPS
      httpOnly: true, // Cookie tidak bisa diakses oleh JavaScript di client
      sameSite: "none", // Diperlukan untuk sesi lintas domain (backend & frontend beda domain)
      maxAge: 24 * 60 * 60 * 1000, // Sesi berlaku 1 hari
    },
  })
);

// Trust proxy header untuk session di belakang proxy Render
app.set("trust proxy", 1);

// === KUMPULAN API ENDPOINTS ===

// 1. Endpoint untuk Cek Status
app.get("/api", (req, res) => {
  res
    .status(200)
    .json({ message: "Backend API is running successfully on Render!" });
});

// 2. Endpoint Login
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
        .json({ success: false, message: "Username atau password salah." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.user = { id: user.id, username: user.username };
      return res.json({ success: true, message: "Login berhasil." });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Username atau password salah." });
    }
  } catch (err) {
    console.error("SERVER ERROR [LOGIN]:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// 3. Endpoint Cek Sesi (Profil)
app.get("/api/profile", (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// (Tambahkan endpoint lain seperti logout, produk, dll. di sini jika perlu)

// === BAGIAN KUNCI UNTUK RENDER ===
// Menjalankan server pada port yang diberikan oleh Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
