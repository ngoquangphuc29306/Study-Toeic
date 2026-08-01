import Link from 'next/link';
import { BookOpen, Sparkles, Target, TrendingUp, Layers, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFF9FA] text-[#4A4A4A]">
      {/* Navigation */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 border-b border-[#FCE7F3] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] p-0.5 shadow-md shadow-pink-100">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#F472B6]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl bg-gradient-to-r from-[#F472B6] to-[#FF85A1] bg-clip-text text-transparent">
                  VocabTOEIC
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-600 hover:text-[#F472B6] transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all"
            >
              Bắt đầu học
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF1F2] border border-[#FCE7F3] rounded-full text-xs font-bold text-[#F472B6] mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Học thông minh với Spaced Repetition</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#4A4A4A] mb-6 leading-tight">
            Học từ vựng TOEIC có hệ thống,{' '}
            <span className="bg-gradient-to-r from-[#F472B6] to-[#FF85A1] bg-clip-text text-transparent">
              nhớ lâu hơn
            </span>{' '}
            mỗi ngày
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Tổ chức từ vựng theo chủ đề, ôn tập đúng thời điểm với SRS và theo dõi tiến độ học tập lâu dài.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-semibold rounded-full hover:shadow-lg hover:shadow-pink-200 transition-all flex items-center justify-center gap-2"
            >
              <span>Bắt đầu học</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-[#FCE7F3] text-[#F472B6] font-semibold rounded-full hover:border-[#F472B6] transition-all"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      {/* Core Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#4A4A4A] mb-4">
              Tại sao chọn VocabTOEIC?
            </h2>
            <p className="text-gray-600">
              Học từ vựng hiệu quả với công cụ được thiết kế cho người học TOEIC
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Benefit 1 */}
            <div className="p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl hover:shadow-lg hover:shadow-pink-100 transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-md shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <Target className="w-6 h-6 text-[#F472B6]" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-[#4A4A4A] mb-2">
                Ôn tập thông minh với SRS
              </h3>
              <p className="text-sm text-gray-600">
                Hệ thống Spaced Repetition giúp bạn ôn đúng lúc, nhớ lâu hơn và tiết kiệm thời gian học tập.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl hover:shadow-lg hover:shadow-pink-100 transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-md shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <Layers className="w-6 h-6 text-[#F472B6]" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-[#4A4A4A] mb-2">
                Tổ chức theo Collection và Topic
              </h3>
              <p className="text-sm text-gray-600">
                Phân loại từ vựng theo chủ đề TOEIC rõ ràng, dễ quản lý và học có hệ thống.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl hover:shadow-lg hover:shadow-pink-100 transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FF85A1] p-0.5 mb-4 shadow-md shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#F472B6]" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-[#4A4A4A] mb-2">
                Theo dõi tiến độ học tập
              </h3>
              <p className="text-sm text-gray-600">
                Xem số từ đã thuộc, streak hàng ngày và tiến độ học tập để duy trì động lực.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SRS Explanation */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#4A4A4A] mb-4">
              Học với Spaced Repetition
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Đánh giá mức độ nhớ sau mỗi lần học, hệ thống tự động lên lịch ôn tập phù hợp
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-6 bg-white border-2 border-red-200 rounded-2xl text-center">
              <div className="text-3xl mb-2">😞</div>
              <div className="text-sm font-bold text-red-600 mb-1">Again</div>
              <div className="text-xs text-gray-500">Chưa nhớ</div>
            </div>

            <div className="p-6 bg-white border-2 border-amber-200 rounded-2xl text-center">
              <div className="text-3xl mb-2">😐</div>
              <div className="text-sm font-bold text-amber-600 mb-1">Hard</div>
              <div className="text-xs text-gray-500">Khó nhớ</div>
            </div>

            <div className="p-6 bg-white border-2 border-emerald-200 rounded-2xl text-center">
              <div className="text-3xl mb-2">🙂</div>
              <div className="text-sm font-bold text-emerald-600 mb-1">Good</div>
              <div className="text-xs text-gray-500">Nhớ tốt</div>
            </div>

            <div className="p-6 bg-white border-2 border-blue-200 rounded-2xl text-center">
              <div className="text-3xl mb-2">😊</div>
              <div className="text-sm font-bold text-blue-600 mb-1">Easy</div>
              <div className="text-xs text-gray-500">Nhớ dễ</div>
            </div>
          </div>

          <div className="mt-8 p-6 bg-[#FFF1F2] border border-[#FCE7F3] rounded-2xl">
            <p className="text-sm text-gray-700 text-center">
              <CheckCircle2 className="w-4 h-4 inline text-[#F472B6] mr-1" />
              Hệ thống tự động tính khoảng thời gian ôn tập tối ưu dựa trên mức độ ghi nhớ của bạn
            </p>
          </div>
        </div>
      </section>

      {/* Organization Flow */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#4A4A4A] mb-4">
              Cách tổ chức từ vựng
            </h2>
            <p className="text-gray-600">
              Cấu trúc rõ ràng giúp bạn quản lý và học từ vựng hiệu quả
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="flex-1 p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-center">
              <Layers className="w-8 h-8 text-[#F472B6] mx-auto mb-3" />
              <div className="font-bold text-[#4A4A4A] mb-1">Collection</div>
              <div className="text-xs text-gray-500">Bộ sưu tập chủ đề</div>
            </div>

            <ChevronRight className="w-6 h-6 text-[#F472B6] rotate-90 md:rotate-0" />

            <div className="flex-1 p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-center">
              <BookOpen className="w-8 h-8 text-[#F472B6] mx-auto mb-3" />
              <div className="font-bold text-[#4A4A4A] mb-1">Topic</div>
              <div className="text-xs text-gray-500">Chủ đề cụ thể</div>
            </div>

            <ChevronRight className="w-6 h-6 text-[#F472B6] rotate-90 md:rotate-0" />

            <div className="flex-1 p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-center">
              <Sparkles className="w-8 h-8 text-[#F472B6] mx-auto mb-3" />
              <div className="font-bold text-[#4A4A4A] mb-1">Vocabulary</div>
              <div className="text-xs text-gray-500">Từ vựng chi tiết</div>
            </div>

            <ChevronRight className="w-6 h-6 text-[#F472B6] rotate-90 md:rotate-0" />

            <div className="flex-1 p-6 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl text-center">
              <Calendar className="w-8 h-8 text-[#F472B6] mx-auto mb-3" />
              <div className="font-bold text-[#4A4A4A] mb-1">Study Session</div>
              <div className="text-xs text-gray-500">Buổi học tập trung</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 bg-gradient-to-br from-[#F472B6] to-[#FF85A1] rounded-3xl shadow-xl shadow-pink-200">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Sẵn sàng chinh phục TOEIC?
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              Bắt đầu xây dựng vốn từ vựng vững chắc với phương pháp học thông minh ngay hôm nay
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#F472B6] font-semibold rounded-full hover:shadow-2xl transition-all"
            >
              <span>Bắt đầu miễn phí</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#FCE7F3] bg-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] p-0.5 shadow-sm shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[7px] flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-[#F472B6]" />
                </div>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-[#F472B6] to-[#FF85A1] bg-clip-text text-transparent">
                VocabTOEIC
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-md">
              Học từ vựng TOEIC có hệ thống với Spaced Repetition và quản lý tiến độ thông minh
            </p>
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} VocabTOEIC. Xây dựng để giúp bạn chinh phục TOEIC.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
