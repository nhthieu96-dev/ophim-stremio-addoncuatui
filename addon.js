// Entry point để chạy addon như 1 server bình thường (dùng cho local dev,
// Render, Docker/Fly.io/Back4app...). Trên Vercel dùng file api/index.js thay
// thế vì Vercel chạy theo mô hình serverless (xem README phần Vercel).

const { serveHTTP } = require("stremio-addon-sdk");
const builder = require("./lib/addon-builder");

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`OPhim Stremio add-on đang chạy tại http://127.0.0.1:${PORT}/manifest.json`);
