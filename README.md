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

## Thêm nội dung trong `data.js`

Đáp án đúng luôn viết **đầu tiên**, web tự xáo trộn khi hiển thị.

- **Thêm chữ vào bộ thẻ** (`RAW_DECKS`): mỗi cặp gồm chữ Giản rồi chữ Phồn viết liền, các cặp cách nhau một dấu cách. Ví dụ: `爱愛 欢歡`.
- **Thêm từ vựng Đài Loan** (`VOCAB`): mỗi dòng `Đại lục|Đài Loan|nghĩa`.
- **Thêm bài nghe** (`LISTEN`): `{b:"B", l:["男：…","女：…"], qs:[["câu hỏi",["đúng","sai","sai","sai"]]]}`. `b` là band A, B hoặc C.
- **Thêm bài đọc** (`READ`): `{b:"C", t:"tiêu đề", x:"nội dung", qs:[[…]]}`.
- **Thêm câu điền từ** (`GAPS`): `{b:"B", s:"câu có ＿＿", o:["đúng","sai","sai","sai"]}`.

## Lưu ý

- Tiến độ học lưu trong trình duyệt (localStorage). Đổi máy hoặc xoá dữ liệu trình duyệt là mất tiến độ.
- Giọng đọc dùng giọng tiếng Trung có sẵn của trình duyệt. Chrome và Edge trên máy tính cho kết quả tốt nhất.
- Đề thi thử do Claude soạn theo khung đề chính thức, không phải đề của Ủy ban TOCFL.
