# Huyen Dieu học Phồn

Web ôn thi TOCFL chữ Phồn thể, đi từ Band A lên B rồi C.

## Lộ trình hoạt động thế nào

- Mỗi ngày một đơn vị khoảng 300 từ, theo thứ tự của bảng từ TOCFL chính thức từ cấp thấp lên cấp cao. Ngày 1 đi theo 10 bài của sách 來學華語 第一冊.
- Mỗi ngày có 4 việc: kiểm tra từ, nghe từ chọn chữ, bài nghe theo dạng đề, bài đọc theo dạng đề.
- Web tự chấm và tự đánh dấu hoàn thành: từ vựng cần nắm 95%, bài nghe và bài đọc cần đúng 80%.
- Sau khi đi hết 25 đơn vị là vòng 2: kiểm tra lại từng đơn vị (cần đúng ngay 90%) xen với các buổi làm đề.

## Mở web

Bật GitHub Pages: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, thư mục `/ (root)` → Save**.
Sau khoảng một phút, web chạy tại `https://whynotme2503.github.io/Phon-the/`.

## Các file

| File | Nội dung | Khi nào sửa |
|---|---|---|
| `days.js` | Bài nghe và bài đọc của từng ngày trong lộ trình | Sửa hằng ngày khi thêm bài |
| `data.js` | Bộ thẻ chữ Phồn, từ riêng Đài Loan, bài nghe đọc Band B và C, đề thi thử Band A | Khi thêm bài |
| `words.js` | 7.517 từ của bảng từ TOCFL kèm nghĩa tiếng Việt, đã chia theo ngày. Tạo tự động | Không sửa tay |
| `app.js` | Cách web hoạt động: lộ trình, thẻ nhớ, chấm điểm, giọng đọc | Khi muốn đổi tính năng |
| `style.css` | Màu sắc, cỡ chữ, bố cục | Khi muốn đổi giao diện |
| `index.html` | Khung trang, tên web | Hiếm khi |
| `t2s.js` | Bảng chữ Phồn → Giản, tạo tự động | Không cần sửa |
| `manifest.webmanifest`, `sw.js`, `icons/` | Phần giúp web cài được như app và mở được khi mất mạng | Không cần sửa |

## Thêm bài cho một ngày trong `days.js`

- Bài nghe: `D(ngày, 'tên dạng bài', ['男：…','女：…'], 'câu hỏi', 'đúng|sai|sai');`
- Câu đọc: `R1(ngày, 'tên dạng bài', 'câu văn', 'câu hỏi', 'đúng|sai|sai');`
- Bảng hiệu, thông báo: `SG(ngày, 'nội dung bảng', 'đúng|sai|sai');`

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
- Đề thi thử và các bài nghe đọc do Claude soạn theo khung đề chính thức, không phải đề của Ủy ban TOCFL.

## Nguồn dữ liệu

- Bảng từ TOCFL bản 2023 của Ủy ban TOCFL (華測會), lấy qua kho [ivankra/tocfl](https://github.com/ivankra/tocfl).
- Nghĩa tiếng Việt từ [CVDICT](https://github.com/ph0ngp/CVDICT) của Phong Phan, giấy phép [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Nghĩa được chọn tự động và rút gọn; phần dữ liệu này trong `words.js` cũng theo giấy phép CC BY-SA 4.0.
- Thứ tự bài của ngày 1 theo sách 來學華語 第一冊 (Ủy ban Sự vụ Cộng đồng người Hoa hải ngoại). Web không chép lại bài khoá của sách.
