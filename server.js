const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const ExcelJS = require("exceljs");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Koneksi ke database
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "donatmania"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ Terhubung ke database!");
});

// Simpan pesanan
app.post("/pesanan", (req, res) => {
  const { nama, alamat, catatan, metode, keranjang, total } = req.body;
  const sql = "INSERT INTO pesanan (nama, alamat, catatan, metode, keranjang, total) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [nama, alamat, catatan, metode, JSON.stringify(keranjang), total], (err) => {
    if (err) return res.status(500).send(err);
    res.send("Pesanan berhasil disimpan!");
  });
});

// Halaman admin dengan filter nama & tanggal
app.get("/admin", (req, res) => {
  const keyword = req.query.cari || "";
  const dari = req.query.dari || "";
  const sampai = req.query.sampai || "";

  let sql = `SELECT * FROM pesanan WHERE 1`;
  const param = [];

  if (keyword) {
    sql += ` AND nama LIKE ?`;
    param.push(`%${keyword}%`);
  }

  if (dari && sampai) {
    sql += ` AND DATE(waktu) BETWEEN ? AND ?`;
    param.push(dari, sampai);
  }

  sql += ` ORDER BY waktu DESC`;

  db.query(sql, param, (err, results) => {
    if (err) return res.status(500).send("Gagal mengambil data");

    let html = `
      <html>
      <head>
        <title>Admin - Data Pesanan</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
          th { background-color: #f2a5b2; color: white; }
          ul { margin: 0; padding-left: 18px; }
          form { margin-bottom: 10px; }
          .hapus { color: red; text-decoration: none; font-weight: bold; }
          input[type="date"] { padding: 4px; }
        </style>
      </head>
      <body>
        <h1>📋 Data Pesanan DonatMania</h1>
        <form method="GET" action="/admin">
          <input type="text" name="cari" placeholder="Cari nama..." value="${keyword}" />
          <input type="date" name="dari" value="${dari}" />
          <input type="date" name="sampai" value="${sampai}" />
          <button type="submit">Cari</button>
        </form>
        <a href="/export?cari=${keyword}&dari=${dari}&sampai=${sampai}" style="display:inline-block; margin-bottom:10px; background:#28a745; color:#fff; padding:8px 12px; text-decoration:none; border-radius:4px;">
          ⬇️ Download Excel
        </a>
        <table>
          <tr>
            <th>ID</th>
            <th>Waktu</th>
            <th>Nama</th>
            <th>Alamat</th>
            <th>Metode</th>
            <th>Total</th>
            <th>Catatan</th>
            <th>Keranjang</th>
            <th>Aksi</th>
          </tr>
    `;

    results.forEach(row => {
      html += `
        <tr>
          <td>${row.id}</td>
          <td>${row.waktu}</td>
          <td>${row.nama}</td>
          <td>${row.alamat}</td>
          <td>${row.metode}</td>
          <td>Rp ${row.total.toLocaleString("id-ID")}</td>
          <td>${row.catatan || '-'}</td>
          <td>
            <ul>
              ${JSON.parse(row.keranjang).map(item => `
                <li>${item.nama} x${item.jumlah} (Rp ${item.harga})</li>
              `).join("")}
            </ul>
          </td>
          <td><a href="/hapus?id=${row.id}" class="hapus" onclick="return confirm('Yakin hapus pesanan ini?')">Hapus</a></td>
        </tr>
      `;
    });

    html += `</table></body></html>`;
    res.send(html);
  });
});

// Hapus pesanan
app.get("/hapus", (req, res) => {
  const id = req.query.id;
  if (!id) return res.send("ID tidak ditemukan");

  db.query("DELETE FROM pesanan WHERE id = ?", [id], err => {
    if (err) return res.send("Gagal menghapus data");
    res.redirect("/admin");
  });
});

// Ekspor ke Excel dengan filter
app.get("/export", (req, res) => {
  const { cari = "", dari = "", sampai = "" } = req.query;

  let sql = `SELECT * FROM pesanan WHERE 1`;
  const param = [];

  if (cari) {
    sql += ` AND nama LIKE ?`;
    param.push(`%${cari}%`);
  }

  if (dari && sampai) {
    sql += ` AND DATE(waktu) BETWEEN ? AND ?`;
    param.push(dari, sampai);
  }

  sql += ` ORDER BY waktu DESC`;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pesanan");

  worksheet.columns = [
    { header: "ID", key: "id", width: 5 },
    { header: "Waktu", key: "waktu", width: 20 },
    { header: "Nama", key: "nama", width: 20 },
    { header: "Alamat", key: "alamat", width: 30 },
    { header: "Metode", key: "metode", width: 15 },
    { header: "Total", key: "total", width: 10 },
    { header: "Catatan", key: "catatan", width: 25 },
    { header: "Keranjang", key: "keranjang", width: 40 },
  ];

  db.query(sql, param, (err, rows) => {
    if (err) return res.status(500).send("Gagal mengambil data");

    rows.forEach(row => {
      worksheet.addRow({
        ...row,
        keranjang: JSON.parse(row.keranjang).map(i => `${i.nama} x${i.jumlah}`).join(", ")
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=pesanan_donatmania.xlsx");

    workbook.xlsx.write(res).then(() => res.end());
  });
});

// Jalankan server
app.listen(3000, () => console.log("🚀 Server jalan di http://localhost:3000"));
