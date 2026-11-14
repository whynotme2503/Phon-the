# Huyen Dieu học Phồn

Web ôn thi TOCFL chữ Phồn thể, đi từ Band A lên B rồi C trong 70 ngày.

## Mở web

Bật GitHub Pages: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, thư mục `/ (root)` → Save**.
Sau khoảng một phút, web chạy tại `https://whynotme2503.github.io/Phon-the/`.

## Các file

| File | Nội dung | Khi nào sửa |
|---|---|---|
| `data.js` | Toàn bộ nội dung học: bộ thẻ chữ, từ vựng Đài Loan, bài nghe, bài đọc, đề thi thử Band A | Sửa hằng ngày khi thêm bài |
| `app.js` | Cách web hoạt động: lộ trình, thẻ nhớ, chấm điểm, giọng đọc | Khi muốn đổi tính năng |
| `style.css` | Màu sắc, cỡ chữ, bố cục | Khi muốn đổi giao diện |
| `index.html` | Khung trang, tên web | Hiếm khi |
| `t2s.js` | Bảng chữ Phồn → Giản, tạo tự động | Không cần sửa |
| `manifest.webmanifest`, `sw.js`, `icons/` | Phần giúp web cài được như app và mở được khi mất mạng | Không cần sửa |

## Thêm nội dung trong `data.js`

Đáp án đúng luôn viết **đầu tiên**, web tự xáo trộn khi hiển thị.

- **Thêm chữ vào bộ thẻ** (`RAW_DECKS`): mỗi cặp gồm chữ Giản rồi chữ Phồn viết liền, các cặp cách nhau một dấu cách. Ví dụ: `爱愛 欢歡`.
- **Thêm từ vựng Đài Loan** (`VOCAB`): mỗi dòng `Đại lục|Đài Loan|nghĩa`.
- **Thêm bài nghe** (`LISTEN`): `{b:"B", l:["男：…","女：…"], qs:[["câu hỏi",["đúng","sai","sai","sai"]]]}`. `b` là band A, B hoặc C.
- **Thêm bài đọc** (`READ`): `{b:"C", t:"tiêu đề", x:"nội dung", qs:[[…]]}`.
- **Thêm câu điền từ** (`GAPS`): `{b:"B", s:"câu có ＿＿", o:["đúng","sai","sai","sai"]}`.

## Cài như app

- **Android, máy tính (Chrome, Edge):** mở web, bấm nút **Cài app vào máy** ở thanh bên, hoặc vào menu trình duyệt chọn *Cài đặt ứng dụng*.
- **iPhone, iPad (Safari):** mở web, bấm nút Chia sẻ, chọn *Thêm vào Màn hình chính*.

App tự lấy bản mới mỗi khi mở lúc có mạng. Mất mạng thì dùng bản đã lưu lần trước.

## Lưu ý

- Tiến độ học lưu riêng trên từng thiết bị. Dùng mục **Sao lưu tiến độ** ở trang Hôm nay để tải file sao lưu và nhập sang máy khác.
- Giọng đọc dùng giọng tiếng Trung có sẵn của trình duyệt. Chrome và Edge trên máy tính cho kết quả tốt nhất.
- Đề thi thử do Claude soạn theo khung đề chính thức, không phải đề của Ủy ban TOCFL.
