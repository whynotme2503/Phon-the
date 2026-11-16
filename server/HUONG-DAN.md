# Dựng máy chủ tài khoản

Làm một lần, khoảng 10–15 phút, toàn bấm chuột trên web, không cài gì vào máy. Miễn phí, không cần thẻ.

Sau khi xong, bạn là giáo viên: bạn cấp mã cho học viên, học viên đăng nhập trên máy nào cũng được và tiến độ tự đi theo họ.

## Vì sao phải làm bước này

GitHub Pages chỉ đưa file tĩnh cho trình duyệt, nó không chạy được code và không có chỗ lưu chung. Muốn có tài khoản thật thì phải có một chỗ chạy code và một cơ sở dữ liệu. Ở đây dùng Cloudflare Worker (chỗ chạy code) và Cloudflare D1 (cơ sở dữ liệu).

Hạn mức miễn phí: 100.000 lượt gọi mỗi ngày, 5 triệu dòng đọc và 100.000 dòng ghi mỗi ngày, 5 GB dữ liệu. Một học viên học cả ngày tốn chừng vài trăm lượt, nên vài chục học viên vẫn dư sức.

## 1. Mở tài khoản Cloudflare

Vào <https://dash.cloudflare.com/sign-up>, đăng ký bằng email. Không cần nhập thẻ, không cần có tên miền.

## 2. Tạo cơ sở dữ liệu

1. Menu trái: **Storage & Databases** → **D1 SQL Database**.
2. Bấm **Create** (hoặc **Create Database**).
3. Đặt tên: `phonthe`. Bấm tạo.
4. Mở database vừa tạo, sang tab **Console**.
5. Mở file `server/schema.sql` trong kho này, chép **toàn bộ**, dán vào ô Console, bấm chạy.

Chạy xong là có ba bảng: `accounts`, `progress`, `visit_log`.

## 3. Tạo Worker

1. Menu trái: **Compute (Workers)** → **Workers & Pages**.
2. Bấm **Create** → chọn mẫu **Hello World** → bấm tiếp.
3. Đặt tên: `phon-the`. Bấm **Deploy**.

## 4. Dán code máy chủ

1. Trong Worker vừa tạo, bấm **Edit code** (hoặc **</> Edit code**).
2. Xoá sạch nội dung mẫu đang có.
3. Mở file `server/worker.js` trong kho này, chép toàn bộ, dán vào.
4. Bấm **Deploy**.

## 5. Nối Worker với cơ sở dữ liệu

1. Vẫn trong Worker đó, vào tab **Settings** → kéo xuống mục **Bindings** → **Add**.
2. Chọn loại **D1 database**.
3. Ô tên biến điền đúng ba chữ: `DB`
4. Ô database chọn `phonthe`.
5. Lưu rồi **Deploy** lại.

Tên biến phải đúng là `DB` viết hoa, sai một chữ là máy chủ không thấy dữ liệu.

## 6. Đặt hai chuỗi bí mật

Vẫn ở **Settings**, mục **Variables and Secrets** → **Add**, loại chọn **Secret** (đừng chọn Text, Secret thì người khác xem không ra):

| Tên | Giá trị |
|---|---|
| `ADMIN_KEY` | Mật khẩu trang giáo viên. Bạn tự đặt, nên dài và lạ. Đây là thứ duy nhất chặn người khác cấp tài khoản bừa, nên đừng đặt kiểu `123456`. |
| `TOKEN_SECRET` | Một chuỗi ngẫu nhiên thật dài, dán đại 50–60 ký tự lộn xộn cũng được. Đổi chuỗi này thì mọi người đang đăng nhập bị đăng xuất hết. |

Thêm xong bấm **Deploy** lại lần nữa.

## 7. Kiểm tra

Địa chỉ Worker có dạng `https://phon-the.<tên-của-bạn>.workers.dev`. Mở thêm `/api/health` ở cuối, ví dụ:

```
https://phon-the.huyen-dieu.workers.dev/api/health
```

Phải thấy đúng bốn chữ `true`:

```json
{"ok":true,"db":true,"admin":true,"secret":true}
```

- `db:false` → chưa nối D1, hoặc tên biến không phải `DB` (quay lại bước 5)
- `admin:false` → thiếu `ADMIN_KEY` (bước 6)
- `secret:false` → thiếu `TOKEN_SECRET` (bước 6)

## 8. Báo cho web biết địa chỉ máy chủ

Mở file `config.js` ở thư mục gốc của kho, sửa dòng cuối thành địa chỉ Worker của bạn:

```js
const API='https://phon-the.huyen-dieu.workers.dev';
```

Lưu và đẩy lên GitHub. Đợi khoảng một phút cho GitHub Pages cập nhật.

## 9. Cấp tài khoản

1. Mở web, thêm `#quan-tri` vào cuối địa chỉ:
   `https://whynotme2503.github.io/phon-the/#quan-tri`
2. Nhập `ADMIN_KEY` đã đặt ở bước 6. Từ lúc này mục **Quản trị** hiện luôn trong menu trái của máy đó.
3. Mục **Cấp tài khoản mới**: điền số lượng, dán danh sách tên học viên mỗi dòng một tên, bấm **Cấp mã**.
4. Bảng hiện ra mã và mật khẩu. **Chép lại hoặc tải CSV ngay**, mật khẩu không hiện lại lần thứ hai.
5. Gửi cho mỗi học viên mã và mật khẩu của họ. Họ vào mục **Tài khoản** để đăng nhập.

Quên mật khẩu của ai thì bấm **Đổi mật khẩu** ở dòng người đó, máy chủ cấp cái mới.

## Những điều nên biết

**Mật khẩu được băm, không lưu nguyên.** Nên kể cả bạn cũng không xem lại được mật khẩu cũ, chỉ cấp mới. Đây là cách làm đúng, đổi lại là mất chút tiện.

**Trang web vẫn ai vào cũng học được.** Tài khoản chỉ để lưu và đồng bộ tiến độ, không khoá nội dung. Trên một web tĩnh thì không khoá nội dung được thật: toàn bộ bài học nằm trong file mà trình duyệt phải tải về, ai mở xem mã nguồn cũng thấy. Muốn khoá hẳn thì phải đưa bài học vào máy chủ, lúc đó là làm lại kiến trúc khác.

**Học không đăng nhập vẫn được.** Tiến độ lúc đó nằm riêng trên máy đó. Đăng nhập vào rồi thì web lấy bản trên máy chủ về; nếu máy chủ chưa có gì thì đẩy bản đang có trên máy lên.

**Hai máy cùng một mã.** Web so mốc thời gian, bản mới hơn thắng, máy cũ không ghi đè được máy mới. Nhưng đừng học song song hai máy cùng lúc trên một mã: bản nào lưu sau thì bản đó được giữ.

**Đổi mật khẩu quản trị** thì vào Cloudflare sửa lại `ADMIN_KEY` rồi Deploy.

**Xoá tài khoản là mất luôn tiến độ** của người đó, không lấy lại được. Muốn chặn tạm thì bấm **Tạm dừng**.
