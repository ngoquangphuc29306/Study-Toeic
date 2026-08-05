# EasyTOEIC

EasyTOEIC là ứng dụng luyện từ vựng TOEIC cá nhân, sử dụng Supabase làm nguồn dữ liệu server và hỗ trợ học theo phiên với flashcard, SRS, quiz, luyện phát âm và từ đồng nghĩa.

## Tính năng hiện có

- Đăng ký, đăng nhập và bảo vệ ứng dụng bằng Supabase Auth.
- Dashboard với tiến độ, streak, review hôm nay, tuần hoạt động và từ khó.
- Quản lý collection, section/topic và vocabulary.
- Flashcard với các chế độ Flashcard, Trắc nghiệm, Gõ từ và Phát âm.
- Đánh giá SRS bằng Again, Hard, Good, Easy và Mastered.
- Queue học theo phiên, requeue cho Again và khôi phục phiên trong tab.
- Luyện từ đồng nghĩa với multiple choice, matching, typing và select-all.
- Import/export dữ liệu vocabulary.
- Retry có kiểm soát cho session/auth và refresh dữ liệu aggregate.

## Tech stack

- Next.js 15 App Router
- React 19
- TypeScript strict
- Tailwind CSS v4
- Supabase PostgreSQL, Auth và RLS
- Vitest
- npm và `package-lock.json`
- Vercel deployment

## Route hiện tại

- `/` — public landing page.
- `/login` — đăng nhập.
- `/signup` — đăng ký.
- `/auth/*` — auth callback.
- `/app` — ứng dụng được bảo vệ; Dashboard, Flashcard, Synonym Practice và Vocabulary Manager dùng tab state trong cùng route.

Các tab nội bộ không tạo URL riêng.

## Chạy local

Yêu cầu Node.js và npm.

```bash
npm install
```

Copy `.env.example` thành `.env.local` và điền các biến Supabase. Không commit `.env.local` và không đưa secret thật vào tài liệu.

```bash
npm run dev
```

### Biến môi trường

Các biến bắt buộc:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Các biến URL ứng dụng/auth là tùy chọn và được mô tả trong [.env.example](.env.example).

## Quality commands

```bash
npm test
npm run test:watch
npm run lint
npx tsc --noEmit
npm run build
npx supabase db lint
```

Test runner hiện tại là Vitest, chạy các unit/service tests trong repository. Project chưa có E2E browser harness, mobile automated tests hoặc multi-tab integration tests.

## Supabase local

Chỉ chạy các lệnh dưới đây với Supabase local/dev đã được xác định rõ:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint
```

**Không chạy `npx supabase db reset` trên production.** Lệnh reset có thể xóa và tạo lại dữ liệu local/dev.

## Deployment order

Khi migration thay đổi database contract, thứ tự triển khai là:

```text
database migration
→ production client deploy
→ smoke test
```

Repository không giả định một CI/CD workflow cụ thể nếu workflow đó chưa được cấu hình trong source.

## SRS authority

SRS scheduling và review log được thực hiện atomically bởi Supabase RPC `submit_vocabulary_rating`. Client gửi vocabulary, rating và idempotency key; client không tự tính lại interval hoặc `next_review_at`. `success` và `already_processed` đều là mutation success, còn aggregate refresh là best-effort và không được rollback rating.

Chi tiết implementation hiện tại nằm trong [docs/SRS_TARGET_SPEC.md](docs/SRS_TARGET_SPEC.md).
