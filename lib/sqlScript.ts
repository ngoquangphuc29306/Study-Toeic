export const SUPABASE_SQL_SCRIPT = `-- =====================================================================
-- VOCABTOEIC - PHASE 1: DATABASE SCHEMA & SEED DATA SCRIPT (UPDATED)
-- Copy and execute this script in Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. DROP EXISTING TABLES IF RE-INITIALIZING
DROP TABLE IF EXISTS public.user_vocab_progress CASCADE;
DROP TABLE IF EXISTS public.vocabularies CASCADE;
DROP TABLE IF EXISTS public.topics CASCADE;
DROP TABLE IF EXISTS public.collections CASCADE;

-- 2. CREATE TABLE: COLLECTIONS
CREATE TABLE public.collections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'FolderKanban',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE TABLE: TOPICS (SECTIONS)
CREATE TABLE public.topics (
    id TEXT PRIMARY KEY,
    collection_id TEXT REFERENCES public.collections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'BookOpen',
    category TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE TABLE: VOCABULARIES
CREATE TABLE public.vocabularies (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    phonetic_uk TEXT,
    phonetic_us TEXT,
    part_of_speech TEXT DEFAULT 'noun',
    meaning TEXT NOT NULL,
    example TEXT,
    example_translation TEXT,
    synonyms TEXT,
    collocations TEXT,
    audio_url TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE TABLE: USER_VOCAB_PROGRESS
CREATE TABLE public.user_vocab_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vocabulary_id TEXT NOT NULL REFERENCES public.vocabularies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered')),
    review_count INTEGER DEFAULT 0,
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
    last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    next_review_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_vocab UNIQUE (user_id, vocabulary_id)
);

-- 6. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabularies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocab_progress ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR READ & WRITE
CREATE POLICY "Allow full access to collections" ON public.collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to topics" ON public.topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to vocabularies" ON public.vocabularies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to user_vocab_progress" ON public.user_vocab_progress FOR ALL USING (true) WITH CHECK (true);

-- 8. SEED INITIAL COLLECTIONS
INSERT INTO public.collections (id, title, description, icon) VALUES
('col-toeic-core', 'Bộ Sưu Tập TOEIC 800+ Master', 'Tổng hợp từ vựng TOEIC trọng tâm phân loại theo các ngành nghề văn phòng và giao thương quốc tế.', 'FolderKanban'),
('col-business-english', 'Bộ Sưu Tập Tiếng Anh Thương Mại', 'Tài chính, Marketing, đàm phán hợp đồng & thuật ngữ doanh nghiệp chuyên sâu.', 'Briefcase');

-- 9. SEED INITIAL TOPICS (SECTIONS)
INSERT INTO public.topics (id, collection_id, title, description, icon, category) VALUES
('topic-contracts', 'col-toeic-core', 'Section 1: Hợp Đồng & Đàm Phán', 'Từ vựng cốt lõi về đàm phán, giao kết và điều khoản hợp đồng thương mại (Part 5 & Part 7).', 'FileText', 'Business'),
('topic-office', 'col-toeic-core', 'Section 2: Văn Phòng & Doanh Nghiệp', 'Các từ vựng thông dụng về quy trình làm việc, thiết bị văn phòng và quản lý nhân sự.', 'Briefcase', 'Corporate'),
('topic-travel', 'col-toeic-core', 'Section 3: Du Lịch & Vận Tải', 'Từ vựng lịch trình chuyến đi, đặt chỗ khách sạn, vé máy bay và logistics.', 'Plane', 'Travel'),
('topic-banking', 'col-business-english', 'Section 1: Ngân Hàng & Tài Chính', 'Khái niệm về tài khoản, báo cáo doanh thu, đầu tư và giao dịch tài chính.', 'CreditCard', 'Finance'),
('topic-marketing', 'col-business-english', 'Section 2: Marketing & Bán Hàng', 'Từ vựng chiến dịch quảng cáo, nghiên cứu thị trường và chăm sóc khách hàng.', 'TrendingUp', 'Marketing');

-- 10. SEED INITIAL VOCABULARIES
INSERT INTO public.vocabularies 
(id, topic_id, word, phonetic_uk, phonetic_us, part_of_speech, meaning, example, example_translation, synonyms, collocations, note) VALUES
-- Contracts
('vocab-101', 'topic-contracts', 'Obligation', '/ˌɒb.lɪˈɡeɪ.ʃən/', '/ˌɑː.bləˈɡeɪ.ʃən/', 'noun', 'Nghĩa vụ, bổn phận, trách nhiệm bắt buộc', 'The vendor has a legal obligation to deliver the goods on schedule.', 'Bên bán có nghĩa vụ pháp lý phải giao hàng đúng tiến độ.', 'duty, responsibility, commitment, requirement', 'fulfill an obligation, meet obligations', 'Thường đi với động từ: fulfill an obligation, meet obligations.'),
('vocab-102', 'topic-contracts', 'Abide by', '/əˈbaɪd baɪ/', '/əˈbaɪd baɪ/', 'verb', 'Tuân theo, tôn trọng (hợp đồng, quy định)', 'Both parties agreed to abide by the conditions stated in the agreement.', 'Cả hai bên đã đồng ý tuân thủ các điều khoản được nêu trong thỏa thuận.', 'comply with, conform to, adhere to', 'abide by rules, abide by contract terms', 'Đồng nghĩa: comply with, conform to, adhere to.'),
('vocab-103', 'topic-contracts', 'Covenant', '/ˈkʌv.ən.ənt/', '/ˈkʌv.ən.ənt/', 'noun', 'Cam kết, giao ước chính thức trong hợp đồng', 'The signed contract contains a restrictive covenant against competition.', 'Hợp đồng đã ký chứa một điều khoản cam kết hạn chế cạnh tranh.', 'agreement, pledge, bond', 'restrictive covenant, breach of covenant', 'Xuất hiện nhiều trong văn bản pháp lý.'),
('vocab-104', 'topic-contracts', 'Stipulation', '/ˌstɪp.jəˈleɪ.ʃən/', '/ˌstɪp.jəˈleɪ.ʃən/', 'noun', 'Quy định, điều khoản quy định sẵn', 'Pay attention to the specific stipulations regarding early cancellation fees.', 'Hãy chú ý đến các quy định cụ thể liên quan đến phí hủy hợp đồng sớm.', 'condition, clause, provision', 'contractual stipulation, key stipulations', 'Động từ tương ứng: stipulate (quy định).'),
('vocab-105', 'topic-contracts', 'Bargain', '/ˈbɑː.ɡɪn/', '/ˈbɑːr.ɡən/', 'verb', 'Mặc cả, thương lượng giá cả hoặc điều khoản', 'The purchasing manager bargained with suppliers to secure a better discount.', 'Trưởng phòng mua hàng đã thương lượng với các nhà cung cấp để có mức chiết khấu tốt hơn.', 'negotiate, haggle', 'drive a hard bargain, bargain over prices', 'Nghĩa danh từ: Món hời, sự thỏa thuận.'),

-- Office
('vocab-201', 'topic-office', 'Implement', '/ˈɪm.plɪ.ment/', '/ˈɪm.plə.ment/', 'verb', 'Thi hành, thực hiện, triển khai (kế hoạch, chính sách)', 'The company plans to implement a new remote work policy next month.', 'Công ty dự định triển khai chính sách làm việc từ xa mới vào tháng tới.', 'execute, apply, carry out', 'implement a strategy, implement a project', 'Danh từ: Implementation (sự triển khai).'),
('vocab-202', 'topic-office', 'Delegate', '/ˈdel.ɪ.ɡət/', '/ˈdel.ə.ɡət/', 'verb', 'Giao phó, ủy quyền công việc cho người khác', 'A successful manager knows how to delegate tasks effectively.', 'Một nhà quản lý thành công biết cách giao phó công việc một cách hiệu quả.', 'assign, entrust, authorize', 'delegate responsibility, delegate authority', 'Nghĩa danh từ: Đại biểu, đại diện.'),
('vocab-203', 'topic-office', 'Colleague', '/ˈkɒl.iːɡ/', '/ˈkɑː.liːɡ/', 'noun', 'Đồng nghiệp cùng cơ quan hoặc ngành nghề', 'She received warm congratulations from her colleagues on her promotion.', 'Cô ấy đã nhận được những lời chúc mừng ấm áp từ đồng nghiệp khi được thăng chức.', 'coworker, associate, teammate', 'trusted colleague, work colleagues', 'Đồng nghĩa: Co-worker, associate.'),
('vocab-204', 'topic-office', 'Supervise', '/ˈsuː.pə.vaɪz/', '/ˈsuː.pɚ.vaɪz/', 'verb', 'Giám sát, quản lý công việc hoặc nhân viên', 'Mr. David will supervise the installation of the new server equipment.', 'Ông David sẽ giám sát việc lắp đặt thiết bị máy chủ mới.', 'oversee, manage, direct', 'supervise staff, supervise operations', 'Danh từ chỉ người: Supervisor.'),
('vocab-205', 'topic-office', 'Minutes', '/ˈmɪn.ɪts/', '/ˈmɪn.ɪts/', 'noun', 'Biên bản cuộc họp (luôn ở dạng số nhiều)', 'The secretary distributed the meeting minutes to all attendees.', 'Thư ký đã gửi biên bản cuộc họp tới tất cả những người tham dự.', 'records, transcripts, notes', 'take the minutes, approve meeting minutes', 'Cụm từ: take the minutes.'),

-- Travel
('vocab-301', 'topic-travel', 'Itinerary', '/aɪˈtɪn.ər.ər.i/', '/aɪˈtɪn.ə.rer.i/', 'noun', 'Lịch trình chi tiết chuyến đi, hành trình', 'Please double-check your flight details on the attached travel itinerary.', 'Vui lòng kiểm tra kỹ chi tiết chuyến bay trên lịch trình du lịch đính kèm.', 'schedule, timetable, travel plan', 'travel itinerary, flight itinerary', 'Xuất hiện rất nhiều trong TOEIC Part 3 & Part 7.'),
('vocab-302', 'topic-travel', 'Accommodation', '/əˌkɒm.əˈdeɪ.ʃən/', '/əˌkɑː.məˈdeɪ.ʃən/', 'noun', 'Chỗ ở, phòng lưu trú (khách sạn, nhà nghỉ)', 'The conference fee includes hotel accommodation and breakfast.', 'Chi phí hội nghị đã bao gồm chỗ ở khách sạn và bữa sáng.', 'lodging, housing, shelter', 'arrange accommodation, hotel accommodation', 'Danh từ không đếm được.'),
('vocab-303', 'topic-travel', 'Boarding pass', '/ˈbɔː.dɪŋ ˌpɑːs/', '/ˈbɔːr.dɪŋ ˌpæs/', 'noun', 'Thẻ lên máy bay / tàu', 'Passengers must show their boarding pass and identity document at the gate.', 'Hành khách phải trình thẻ lên máy bay và giấy tờ tùy thân tại cổng lên tàu.', 'boarding ticket, flight pass', 'issue boarding pass, show boarding pass', 'Thường xuất hiện trong Part 4.'),
('vocab-304', 'topic-travel', 'Delay', '/dɪˈleɪ/', '/dɪˈleɪ/', 'verb', 'Trì hoãn, làm chậm trễ', 'The express train was delayed due to severe weather conditions.', 'Chuyến tàu siêu tốc đã bị hoãn do điều kiện thời tiết khắc nghiệt.', 'postpone, put off, hold up', 'unexpected delay, flight delay', 'Đồng nghĩa: Postpone, put off.'),
('vocab-305', 'topic-travel', 'Destination', '/ˌdes.tɪˈneɪ.ʃən/', '/ˌdes.təˈneɪ.ʃən/', 'noun', 'Điểm đến, nơi tới', 'Tokyo is one of the most popular business destinations in Asia.', 'Tokyo là một trong những điểm đến kinh doanh phổ biến nhất ở Châu Á.', 'end point, arrival point', 'final destination, popular destination', 'Cụm từ: final destination.'),

-- Banking
('vocab-401', 'topic-banking', 'Revenue', '/ˈrev.ən.juː/', '/ˈrev.ə.nuː/', 'noun', 'Doanh thu, tổng thu nhập của công ty', 'Annual revenue increased by fifteen percent compared to last fiscal year.', 'Doanh thu hàng năm tăng 15% so với năm tài chính trước.', 'income, earnings, proceeds', 'annual revenue, generate revenue', 'Khác với Profit (lợi nhuận).'),
('vocab-402', 'topic-banking', 'Transaction', '/trænˈzæk.ʃən/', '/trænˈzæk.ʃən/', 'noun', 'Giao dịch chuyển tiền, mua bán tài chính', 'You can monitor all account transactions via our online mobile app.', 'Bạn có thể theo dõi tất cả các giao dịch tài khoản qua ứng dụng di động.', 'deal, transfer, payment', 'financial transaction, complete a transaction', 'Động từ: Transact.'),
('vocab-403', 'topic-banking', 'Audit', '/ˈɔː.dɪt/', '/ˈɑː.dɪt/', 'noun', 'Sự kiểm toán, kiểm tra sổ sách tài chính', 'An independent auditor conducted a thorough audit of the financial statements.', 'Một kiểm toán viên độc lập đã tiến hành kiểm toán tỉ mỉ các báo cáo tài chính.', 'inspection, examination', 'financial audit, conduct an audit', 'Cả nghĩa danh từ và động từ.'),
('vocab-404', 'topic-banking', 'Deposit', '/dɪˈpɒz.ɪt/', '/dɪˈpɑː.zɪt/', 'verb', 'Gửi tiền vào tài khoản, đặt cọc', 'Please deposit the check into your savings account by Friday afternoon.', 'Vui lòng gửi séc vào tài khoản tiết kiệm của bạn trước chiều thứ Sáu.', 'pay in, save', 'deposit money, security deposit', 'Trái nghĩa: Withdraw.'),
('vocab-405', 'topic-banking', 'Expenditure', '/ɪkˈspen.dɪ.tʃər/', '/ɪkˈspen.də.tʃɚ/', 'noun', 'Khoản chi tiêu, tổng số tiền chi ra', 'The budget committee recommended cutting capital expenditures.', 'Ủy ban ngân sách đã đề xuất cắt giảm các khoản chi tiêu vốn.', 'expense, spending, outlay', 'capital expenditure, reduce expenditure', 'Danh từ của đt Spend / Expend.'),

-- Marketing
('vocab-501', 'topic-marketing', 'Campaign', '/kæmˈpeɪn/', '/kæmˈpeɪn/', 'noun', 'Chiến dịch quảng cáo, khuyến mãi hoặc vận động', 'The social media campaign generated thousands of sales leads.', 'Chiến dịch truyền thông xã hội đã tạo ra hàng nghìn khách hàng tiềm năng.', 'drive, initiative', 'marketing campaign, launch a campaign', 'Cụm từ: marketing campaign.'),
('vocab-502', 'topic-marketing', 'Consumer', '/kənˈsjuː.mər/', '/kənˈsuː.mɚ/', 'noun', 'Người tiêu dùng, người mua hàng hóa/dịch vụ', 'Consumer demand for eco-friendly products has risen dramatically.', 'Nhu cầu của người tiêu dùng đối với các sản phẩm thân thiện với môi trường đã tăng vọt.', 'buyer, customer, purchaser', 'consumer demand, consumer behavior', 'Động từ: Consume.'),
('vocab-503', 'topic-marketing', 'Promote', '/prəˈməʊt/', '/prəˈmoʊt/', 'verb', 'Quảng bá sản phẩm HOẶC Thăng chức', 'The brand launched a special discount to promote its new skincare line.', 'Thương hiệu đã tung ra chương trình giảm giá đặc biệt để quảng bá dòng sản phẩm mới.', 'advertise, endorse, publicize', 'promote a product, promoted to manager', 'Danh từ: Promotion.'),
('vocab-504', 'topic-marketing', 'Target audience', '/ˈtɑː.ɡɪt ˈɔː.di.əns/', '/ˈtɑːr.ɡət ˈɑː.di.əns/', 'phrase', 'Khách hàng / độc giả mục tiêu', 'Our target audience consists primarily of young working professionals.', 'Khách hàng mục tiêu của chúng tôi chủ yếu bao gồm những người trẻ đã đi làm.', 'target market, focus group', 'reach target audience', 'Đồng nghĩa: Target market.'),
('vocab-505', 'topic-marketing', 'Persuade', '/pəˈsweɪd/', '/pɚˈsweɪd/', 'verb', 'Thuyết phục ai đó làm gì hoặc mua hàng', 'The convincing advertisement persuaded customers to try the new brand.', 'Mẫu quảng cáo đầy thuyết phục đã khiến khách hàng muốn thử thương hiệu mới.', 'convince, influence, sway', 'persuade someone to do something', 'Tính từ: Persuasive.');
`;
