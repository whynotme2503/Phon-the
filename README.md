# Huyen Dieu học Phồn

Web ôn thi TOCFL chữ Phồn thể, đi từ Band A lên B rồi C.

## Lộ trình hoạt động thế nào

- Mỗi ngày một đơn vị khoảng 300 từ, theo thứ tự của bảng từ TOCFL chính thức từ cấp thấp lên cấp cao. Ngày 1 và 2 đi theo từng bài của sách 來學華語 quyển 1 và quyển 2.
- Mỗi ngày có 4 việc: kiểm tra từ, nghe từ chọn chữ, bài nghe theo dạng đề, bài đọc theo dạng đề.
- Web tự chấm và tự đánh dấu hoàn thành: từ vựng cần nắm 95%, bài nghe và bài đọc cần đúng 80%.
- Câu hỏi của quyển 4, 5, 6 và bài đọc Band B có nhãn độ khó: dễ, vừa, khó.
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
| `fflate.js` | Thư viện đọc file zip (fflate, giấy phép MIT) | Không cần sửa |
| `config.js` | Địa chỉ máy chủ tài khoản | Sửa một lần sau khi dựng Worker |
| `server/worker.js` | Code máy chủ, dán lên Cloudflare Worker | Khi đổi cách hoạt động của tài khoản |
| `server/schema.sql` | Bảng dữ liệu, chạy một lần trên D1 | Hầu như không |
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

## Tài khoản và đồng bộ

Mặc định web chỉ lưu tiến độ trên từng máy. Muốn tiến độ đi theo người học giữa điện thoại và máy tính thì dựng một máy chủ nhỏ trên Cloudflare, miễn phí, làm một lần: xem `server/HUONG-DAN.md`.

Dựng xong thì có hai vai:

- **Giáo viên** vào `#quan-tri`, nhập `ADMIN_KEY`, cấp mã cho học viên và xem số tài khoản, lượt truy cập, ai học đến đâu. Web không cho tự mở tài khoản, mã chỉ do giáo viên cấp.
- **Học viên** vào mục Tài khoản, nhập mã và mật khẩu được cấp. Mỗi tài khoản giữ một bản tiến độ riêng trên máy, nên hai người dùng chung một máy không lẫn nhau.

Mật khẩu được băm PBKDF2-SHA256 trước khi lưu, nên quên là phải cấp lại chứ không xem lại được. Sai mật khẩu 20 lần trong một giờ thì mã đó bị khoá tạm.

Tài khoản chỉ dùng để lưu tiến độ, không khoá nội dung: web tĩnh thì bài học nằm trong file mà trình duyệt phải tải về, ai cũng đọc được.

## File nghe của sách

Các bài nghe có nhãn "giọng thật" dùng file nghe của bộ sách 來學華語: bài khoá quyển 1 đến 6, cùng phần nghe hiểu của sách bài tập quyển 2, 3 và 4. Tổng cộng 111 track. Kho này không chứa các file đó. Mỗi thiết bị nạp một lần ở trang Hôm nay, mục File nghe của sách: chọn file zip gọn (111 track, đã cắt bớt phần đọc lại và nén nhẹ, khoảng 71 MB), hoặc chính các file zip gốc của sách. File được giữ trong trình duyệt của thiết bị đó, không gửi đi đâu.

Tên file trong gói gọn chính là mã track (`B5-L03-T.mp3`, `W4-L07-6.mp3`); tên gốc của sách (`B5-L03-1-Text.mp3`, `B4-L07-6-workbook Part IV.mp3`) cũng được nhận. File nào không khớp mã nào thì web bỏ qua.

Trong `days.js`, một bài dùng file nghe của sách viết bằng `BK(ngày, 'tên', 'khoá track', 'tên hiện trên trình phát', giây bắt đầu, giây kết thúc, [[câu hỏi, 'đúng|sai|sai']], 1 nếu câu hỏi có sẵn trong file nghe)`.

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
- Band A đi theo bộ sách 來學華語 quyển 1 đến 4, Band B theo quyển 5 và 6 (Ủy ban Sự vụ Cộng đồng người Hoa hải ngoại). Web không chép lại bài khoá và không chứa file nghe của sách. Quyển 5 và 6 không có sách bài tập tiếng Việt nên phần bài tập đọc của Band B do Claude soạn mới theo khung đề TOCFL.
