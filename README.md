# OPhim Stremio Add-on

Add-on Stremio không chính thức, lấy dữ liệu phim từ **OPhim**:
- API dữ liệu: `https://ophim1.com`
- Trang gốc: `https://ophim17.cc`

Bao gồm 5 danh mục: Mới cập nhật, Phim lẻ, Phim bộ, Hoạt hình, TV Shows, và hỗ trợ tìm kiếm theo từ khoá.

## 1. Cài đặt

Yêu cầu: [Node.js](https://nodejs.org) >= 16.

```bash
cd ophim-stremio-addon
npm install
```

## 2. Chạy add-on

```bash
npm start
```

Mặc định add-on chạy tại: `http://127.0.0.1:7000/manifest.json`

Có thể đổi cổng:

```bash
PORT=8080 npm start
```

## 3. Cài vào Stremio

1. Mở Stremio (desktop/web/mobile).
2. Vào **Add-ons** → biểu tượng 🧩 → khung "Add-on Repository URL" ở trên cùng.
3. Dán vào: `http://127.0.0.1:7000/manifest.json` (nếu chạy trên máy khác/mạng LAN thì thay `127.0.0.1` bằng IP máy chạy add-on).
4. Nhấn **Install**.

Nếu muốn dùng ở nơi khác qua Internet, bạn cần deploy add-on lên một server công khai
(VD: Fly.io, Render, VPS...) rồi dùng URL public thay cho `127.0.0.1`.

## 4. Deploy lên Vercel (miễn phí, không cần thẻ, không bị cold-start lâu)

Vercel chạy theo mô hình **serverless** (mỗi request là 1 hàm chạy độc lập,
không phải 1 server luôn bật), rất hợp với add-on nhẹ như thế này.

### Cách A: Qua Dashboard (web, không cần cài gì)

1. Đưa code lên GitHub như hướng dẫn ở trên (đảm bảo có đủ file `api/index.js`,
   `lib/addon-builder.js`, `vercel.json`).
2. Vào [vercel.com](https://vercel.com) → **Sign up** bằng tài khoản GitHub (không cần thẻ).
3. Trong Dashboard, bấm **Add New... → Project**.
4. Chọn **Import** repo `ophim-stremio-addon` từ danh sách (nếu chưa thấy, bấm
   **Adjust GitHub App Permissions** để cấp quyền truy cập repo).
5. Ở màn hình cấu hình:
   - **Framework Preset**: để **Other** (Vercel tự nhận diện Node.js)
   - **Root Directory**: để mặc định (gốc repo)
   - Không cần sửa Build/Output settings
6. Bấm **Deploy**.

Sau khi deploy xong (thường chỉ mất ~30 giây), Vercel cho bạn URL dạng:

```
https://ophim-stremio-addon.vercel.app
```

Add-on chạy tại: `https://ophim-stremio-addon.vercel.app/manifest.json` → dán vào Stremio.

### Cách B: Deploy lại khi có commit mới

Mặc định Vercel đã tự bật **auto-deploy**: mỗi lần bạn sửa file trên GitHub
(web) và Commit vào nhánh `main`, Vercel tự build và deploy lại — không cần
làm gì thêm.

### Xem log khi có lỗi

Vào Vercel Dashboard → chọn project → tab **Deployments** → chọn lần deploy
mới nhất → tab **Functions** (hoặc **Logs**) → xem log runtime khi có request
gọi tới (thử tìm kiếm phim trong Stremio rồi refresh log).

### Lưu ý khi dùng Vercel

- Gói **Hobby** (miễn phí) giới hạn mỗi hàm serverless chạy tối đa khoảng
  **10 giây**. Code tìm kiếm đã tối ưu gọi song song (tối đa ~6 giây) nên nằm
  trong giới hạn này.
- Vercel **không giữ được kết nối lâu dài** kiểu WebSocket, nhưng add-on
  Stremio chỉ dùng HTTP request/response bình thường nên không bị ảnh hưởng.
- Không có khái niệm "cold start" kiểu Render (máy ngủ 15 phút) — Vercel dùng
  hạ tầng edge riêng, độ trễ khởi động hàm thường dưới 1 giây kể cả khi lâu
  không có request.



### Bước 1: Cài Fly CLI

## 5. (Tuỳ chọn) Deploy lên Fly.io - lưu ý cần thẻ xác minh

> Fly.io hiện yêu cầu thêm thẻ thanh toán để xác minh tài khoản, kể cả dùng
> trong hạn mức miễn phí. Nếu không muốn cung cấp thẻ, dùng Vercel (mục 4)
> hoặc Render + cron-job.org (mục 8) thay thế.

### Bước 1: Cài Fly CLI

- macOS/Linux:
  ```bash
  curl -L https://fly.io/install.sh | sh
  ```
- Windows (PowerShell):
  ```powershell
  pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
  ```

### Bước 2: Đăng nhập / đăng ký

```bash
fly auth signup     # nếu chưa có tài khoản
# hoặc
fly auth login       # nếu đã có tài khoản
```

Fly.io yêu cầu thêm thẻ để xác minh danh tính (chống spam), nhưng gói free
(3 VM nhỏ, 160GB băng thông/tháng) sẽ **không bị tính phí** nếu bạn ở trong hạn mức này.

### Bước 3: Đổi tên app (bắt buộc, vì tên phải duy nhất toàn cầu)

Mở `fly.toml`, sửa dòng:

```toml
app = "ophim-stremio-addon"
```

thành một tên riêng, ví dụ `app = "ophim-addon-cuaban123"`.

### Bước 4: Deploy

Đứng tại thư mục dự án (nơi có `Dockerfile` và `fly.toml`):

```bash
fly launch --no-deploy   # tạo app trên Fly.io dựa theo fly.toml có sẵn (chọn "No" khi hỏi có muốn ghi đè fly.toml)
fly deploy                # build Docker image và deploy
```

Sau khi deploy xong, Fly sẽ cho bạn URL dạng:

```
https://ophim-addon-cuaban123.fly.dev
```

Add-on chạy tại: `https://ophim-addon-cuaban123.fly.dev/manifest.json`

### Bước 5: Cài vào Stremio

Dán URL sau vào ô "Add-on Repository URL" trong Stremio:

```
https://ophim-addon-cuaban123.fly.dev/manifest.json
```

Hoặc mở link cài đặt trực tiếp:

```
stremio://ophim-addon-cuaban123.fly.dev/manifest.json
```

### Theo dõi log khi có lỗi

```bash
fly logs
```

### Vì sao chọn Fly.io thay vì Render free?

Cấu hình `fly.toml` đã đặt `min_machines_running = 1` và `auto_stop_machines = false`,
nghĩa là **luôn có ít nhất 1 máy chạy 24/7**, không bị "ngủ" sau vài phút không có
request như Render free tier → không còn tình trạng tìm kiếm load mãi vì cold-start.

Region mặc định là `sin` (Singapore) - gần Việt Nam, độ trễ thấp. Có thể đổi trong
`fly.toml` (`primary_region`) nếu muốn dùng region khác.

## 6. Cấu trúc dự án

```
ophim-stremio-addon/
├── addon.js       # Toàn bộ logic addon (catalog / meta / stream)
├── package.json
└── README.md
```

## 7. Ghi chú kỹ thuật

- Catalog: gọi `GET {API_BASE}/danh-sach/{loại}?page=N` (loại: `phim-moi-cap-nhat`,
  `phim-le`, `phim-bo`, `hoat-hinh`, `tv-shows`).
- Tìm kiếm: `GET {API_BASE}/tim-kiem?keyword=...&page=N`.
- Chi tiết phim & danh sách tập: `GET {API_BASE}/phim/{slug}`.
- Link xem phim ưu tiên `link_m3u8` (HLS phát trực tiếp trong Stremio); nếu phim chỉ có
  `link_embed` thì add-on trả về dạng "externalUrl" (mở trình duyệt) vì đó là link nhúng,
  không phải link stream trực tiếp.
- Một số server phát HLS yêu cầu header `Referer` đúng domain gốc, add-on đã tự gắn
  `Referer: https://ophim17.cc` vào stream (`behaviorHints.proxyHeaders`) — tính năng này
  chỉ được hỗ trợ đầy đủ trên Stremio Desktop/Android, bản Web có thể bị chặn do CORS.

## 8. Giới hạn / Lưu ý

- Đây là add-on **không chính thức**, phụ thuộc hoàn toàn vào việc API `ophim1.com` còn
  hoạt động và cấu trúc dữ liệu không đổi. Nếu OPhim đổi domain hoặc cấu trúc API, cần cập
  nhật lại hằng số `API_BASE` / `SITE_URL` trong `addon.js`.
- Nội dung phim do bên thứ ba (OPhim) cung cấp; Anthropic/Claude không lưu trữ hay phát
  hành nội dung này.
