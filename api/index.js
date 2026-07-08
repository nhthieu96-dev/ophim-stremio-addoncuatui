// Entry point cho Vercel (serverless function).
// Khác với Render/Docker (server chạy liên tục dùng serveHTTP), Vercel chạy
// mỗi request như 1 hàm độc lập, nên dùng getRouter() để lấy 1 middleware
// xử lý request/response chuẩn Node.js thay vì tự mở port lắng nghe.

const { getRouter } = require("stremio-addon-sdk");
const builder = require("../lib/addon-builder");

const router = getRouter(builder.getInterface());

module.exports = (req, res) => {
  router(req, res, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
};
