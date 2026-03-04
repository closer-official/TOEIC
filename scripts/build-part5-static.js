/**
 * 既存 toeic-part5-50.json を correct_index + difficulty 形式に変換し、
 * TOEIC得点直結のチェック基準を満たす新規問題を追加して part5-static.json を生成する。
 * 実行: node scripts/build-part5-static.js
 */
const fs = require('fs');
const path = require('path');

const EXISTING_PATH = path.join(process.cwd(), 'data', 'toeic-part5-50.json');
const OUT_PATH = path.join(process.cwd(), 'data', 'part5-static.json');

const letterToIndex = (c) => ({ A: 0, B: 1, C: 2, D: 3 }[String(c).toUpperCase()] ?? 0);

// 既存50問を変換（品詞中心→500/700を割り当て、前置詞・時制は700）
const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
const converted = existing.map((q, i) => ({
  id: `static-${i + 1}`,
  question: q.question,
  options: q.options,
  correct_index: letterToIndex(q.answer),
  explanation: q.explanation ?? null,
  category: q.category || '品詞',
  difficulty: q.category === '時制' || q.category === '前置詞' ? '700' : (i < 25 ? '500' : '700'),
  vocab_map: {},
}));

// 新規50問：語彙・時制・接続詞・代名詞を補強。本番パターン・正解一意・ビジネストピック・紛らわしい選択肢を満たす
const NEW_QUESTIONS = [
  { question: 'The new hire will ____ for the marketing team.', options: ['responsible', 'be responsible', 'responsibility', 'respond'], correct_index: 1, explanation: 'willの後は動詞句', category: '語彙', difficulty: '500' },
  { question: 'We need to ____ the contract before signing.', options: ['review', 'revision', 'reviewer', 'reviewed'], correct_index: 0, explanation: 'need toの後は動詞原形', category: '品詞', difficulty: '500' },
  { question: 'The meeting was postponed ____ the director was unavailable.', options: ['because', 'despite', 'although', 'however'], correct_index: 0, explanation: '理由はbecause', category: '接続詞', difficulty: '500' },
  { question: 'All employees must submit ____ timesheets by Monday.', options: ['they', 'their', 'them', 'themselves'], correct_index: 1, explanation: '名詞の前は所有格', category: '代名詞', difficulty: '500' },
  { question: 'The report ____ by the end of this week.', options: ['will complete', 'will be completed', 'will have completed', 'completes'], correct_index: 1, explanation: '期限＋受動態は未来の受動態', category: '時制', difficulty: '700' },
  { question: 'We are pleased to ____ you that your application has been approved.', options: ['inform', 'information', 'informative', 'informed'], correct_index: 0, explanation: 'toの後は動詞原形', category: '品詞', difficulty: '500' },
  { question: 'The company is committed ____ sustainable practices.', options: ['to', 'with', 'for', 'on'], correct_index: 0, explanation: 'committed toで「〜に取り組む」', category: '前置詞', difficulty: '700' },
  { question: '____ the delay, the product launch was successful.', options: ['Despite', 'Because', 'Although', 'Since'], correct_index: 0, explanation: '名詞の前はDespite', category: '接続詞', difficulty: '700' },
  { question: 'The manager asked ____ to finish the report by Friday.', options: ['we', 'our', 'us', 'ours'], correct_index: 2, explanation: 'ask 人 toで目的格', category: '代名詞', difficulty: '500' },
  { question: 'Sales have ____ since we introduced the new line.', options: ['improved', 'improvement', 'improving', 'improve'], correct_index: 0, explanation: 'haveの後は過去分詞', category: '品詞', difficulty: '500' },
  { question: 'The client requested that the proposal ____ by noon.', options: ['is submitted', 'be submitted', 'submits', 'submitted'], correct_index: 1, explanation: 'request that 主語 (should) 動詞原形', category: '時制', difficulty: '700' },
  { question: 'The office will remain closed ____ further notice.', options: ['until', 'for', 'until to', 'by'], correct_index: 0, explanation: 'until further noticeで「追加の通知まで」', category: '前置詞', difficulty: '700' },
  { question: 'The budget has been ____ for the next quarter.', options: ['allocation', 'allocated', 'allocate', 'allocating'], correct_index: 1, explanation: '受動態で過去分詞', category: '品詞', difficulty: '500' },
  { question: 'We depend ____ our suppliers for timely delivery.', options: ['to', 'on', 'with', 'for'], correct_index: 1, explanation: 'depend onで「〜に頼る」', category: '前置詞', difficulty: '700' },
  { question: 'The board discussed ____ to expand into Asian markets.', options: ['whether', 'weather', 'either', 'rather'], correct_index: 0, explanation: 'whether toで「〜するかどうか」', category: '接続詞', difficulty: '700' },
  { question: 'Each department must submit ____ own budget proposal.', options: ['their', 'its', 'it', 'they'], correct_index: 1, explanation: 'each＋単数なのでits', category: '代名詞', difficulty: '700' },
  { question: 'The shipment ____ when we contacted the warehouse.', options: ['already left', 'had already left', 'has left', 'was leaving'], correct_index: 1, explanation: '連絡より前の完了は過去完了', category: '時制', difficulty: '700' },
  { question: 'The position requires a candidate ____ has experience in logistics.', options: ['which', 'who', 'whom', 'whose'], correct_index: 1, explanation: '人を修飾する主格はwho', category: '代名詞', difficulty: '500' },
  { question: 'The invoice should be paid ____ 30 days of receipt.', options: ['within', 'during', 'while', 'since'], correct_index: 0, explanation: 'withinで「〜以内に」', category: '前置詞', difficulty: '700' },
  { question: 'We will proceed with the plan ____ we get approval from headquarters.', options: ['although', 'provided that', 'despite', 'whereas'], correct_index: 1, explanation: 'provided thatで「〜という条件で」', category: '接続詞', difficulty: '700' },
  { question: 'The committee ____ its decision by the end of the month.', options: ['announce', 'will announce', 'has announced', 'announcing'], correct_index: 1, explanation: '未来の予定はwill', category: '時制', difficulty: '500' },
  { question: 'Please direct any inquiries ____ the customer service desk.', options: ['at', 'to', 'for', 'with'], correct_index: 1, explanation: 'direct 人 toで「〜に問い合わせる」', category: '前置詞', difficulty: '700' },
  { question: 'The contract ____ next month.', options: ['expires', 'will expire', 'has expired', 'expiring'], correct_index: 1, explanation: '未来の期限はwill', category: '時制', difficulty: '500' },
  { question: 'The software is ____ to use than the previous version.', options: ['easy', 'easier', 'easiest', 'easily'], correct_index: 1, explanation: 'thanの前は比較級', category: '品詞', difficulty: '500' },
  { question: 'The report was written by a consultant ____ we hired last year.', options: ['which', 'whom', 'who', 'whose'], correct_index: 2, explanation: '人を修飾する主格はwho', category: '代名詞', difficulty: '500' },
  { question: '____ the budget constraints, we managed to complete the project.', options: ['Despite', 'Because', 'So that', 'Unless'], correct_index: 0, explanation: '逆接はDespite', category: '接続詞', difficulty: '700' },
  { question: 'The warehouse is responsible ____ distributing all orders.', options: ['for', 'to', 'with', 'at'], correct_index: 0, explanation: 'responsible forで「〜の責任がある」', category: '前置詞', difficulty: '700' },
  { question: 'The CEO ____ to the staff about the merger yesterday.', options: ['speak', 'spoke', 'spoken', 'speaking'], correct_index: 1, explanation: 'yesterdayで過去形', category: '時制', difficulty: '500' },
  { question: 'We are looking for a candidate ____ can start immediately.', options: ['which', 'who', 'whom', 'whose'], correct_index: 1, explanation: '主格の関係代名詞はwho', category: '代名詞', difficulty: '500' },
  { question: 'The training session will be held ____ the main conference room.', options: ['at', 'in', 'on', 'to'], correct_index: 1, explanation: '部屋はin', category: '前置詞', difficulty: '500' },
  { question: 'The proposal seems ____, but we need to review the details.', options: ['promise', 'promising', 'promised', 'promisingly'], correct_index: 1, explanation: 'seemの後は形容詞（C）', category: '品詞', difficulty: '700' },
  { question: 'No one ____ the building without a valid ID.', options: ['enter', 'enters', 'entering', 'entered'], correct_index: 1, explanation: 'no oneは単数、三単現', category: '時制', difficulty: '500' },
  { question: 'The company is known ____ its innovative products.', options: ['for', 'as', 'to', 'with'], correct_index: 0, explanation: 'known forで「〜で知られている」', category: '前置詞', difficulty: '700' },
  { question: 'We must ensure ____ all safety guidelines are followed.', options: ['that', 'which', 'what', 'if'], correct_index: 0, explanation: 'ensure thatで「〜であることを確保する」', category: '接続詞', difficulty: '700' },
  { question: 'The document ____ to the wrong department by mistake.', options: ['send', 'sent', 'was sent', 'sending'], correct_index: 2, explanation: 'by mistakeで受動態', category: '時制', difficulty: '500' },
  { question: 'The director asked ____ to prepare the slides for the presentation.', options: ['I', 'me', 'my', 'myself'], correct_index: 1, explanation: 'askの目的語は目的格', category: '代名詞', difficulty: '500' },
  { question: 'The new policy will take ____ in January.', options: ['place', 'effect', 'part', 'action'], correct_index: 1, explanation: 'take effectで「効力を発する」', category: '語彙', difficulty: '700' },
  { question: 'We have been ____ with the supplier for over five years.', options: ['deal', 'dealing', 'dealt', 'deals'], correct_index: 1, explanation: 'have beenの後は現在分詞', category: '時制', difficulty: '700' },
  { question: 'The refund will be processed ____ 5 to 7 business days.', options: ['within', 'for', 'since', 'during'], correct_index: 0, explanation: '期間内はwithin', category: '前置詞', difficulty: '500' },
  { question: 'The memo was sent to all staff ____ the schedule change.', options: ['regarding', 'because', 'although', 'whereas'], correct_index: 0, explanation: 'regardingで「〜について」', category: '前置詞', difficulty: '700' },
  { question: 'The applicant ____ excellent references from previous employers.', options: ['submitted', 'submission', 'submitting', 'submit'], correct_index: 0, explanation: '過去の事実は過去形', category: '品詞', difficulty: '500' },
  { question: 'The committee will consider ____ proposal at the next meeting.', options: ['you', 'your', 'yours', 'yourself'], correct_index: 1, explanation: '名詞の前は所有格', category: '代名詞', difficulty: '500' },
  { question: 'We cannot proceed ____ we receive confirmation.', options: ['until', 'when', 'while', 'as'], correct_index: 0, explanation: 'not ... untilで「〜まで〜しない」', category: '接続詞', difficulty: '700' },
  { question: 'The contract is ____ for renewal next month.', options: ['due', 'duely', 'dues', 'durable'], correct_index: 0, explanation: 'be due forで「〜の時期である」', category: '語彙', difficulty: '700' },
  { question: 'The shipment has ____ arrived at the distribution center.', options: ['already', 'yet', 'still', 'since'], correct_index: 0, explanation: '肯定文の完了はalready', category: '時制', difficulty: '500' },
  { question: 'All expenses must be approved ____ advance.', options: ['on', 'at', 'in', 'for'], correct_index: 2, explanation: 'in advanceで「事前に」', category: '前置詞', difficulty: '700' },
  { question: 'The report ____ several important recommendations.', options: ['includes', 'including', 'included', 'include'], correct_index: 0, explanation: '現在の内容は三単現', category: '品詞', difficulty: '500' },
  { question: 'The manager suggested ____ we postpone the meeting.', options: ['that', 'which', 'what', 'if'], correct_index: 0, explanation: 'suggest thatで「〜を提案する」', category: '接続詞', difficulty: '700' },
  { question: 'The company ____ its sales target last quarter.', options: ['exceed', 'exceeded', 'exceeding', 'exceeds'], correct_index: 1, explanation: 'last quarterで過去形', category: '時制', difficulty: '500' },
  { question: 'Please refer ____ the attached document for details.', options: ['at', 'on', 'to', 'for'], correct_index: 2, explanation: 'refer toで「〜を参照する」', category: '前置詞', difficulty: '700' },
  { question: 'The new system will ____ efficiency across all departments.', options: ['improvement', 'improve', 'improving', 'improved'], correct_index: 1, explanation: 'willの後は動詞原形', category: '品詞', difficulty: '500' },
  { question: 'The candidate ____ we interviewed yesterday was very impressive.', options: ['which', 'whom', 'who', 'whose'], correct_index: 2, explanation: 'we interviewedの主語が人なのでwho', category: '代名詞', difficulty: '700' },
];

const newWithId = NEW_QUESTIONS.map((q, i) => ({
  id: `static-${converted.length + i + 1}`,
  question: q.question,
  options: q.options,
  correct_index: q.correct_index,
  explanation: q.explanation,
  category: q.category,
  difficulty: q.difficulty,
  vocab_map: {},
}));

const all = [...converted, ...newWithId];
fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`Wrote ${all.length} questions to ${OUT_PATH}`);
console.log('Categories:', all.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc; }, {}));
