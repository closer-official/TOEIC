/**
 * 句動詞・前置詞パターン30問を part5-static.json に追加
 * 実行: node scripts/add-part5-phrasal-30.js
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'data', 'part5-static.json');
const list = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const startId = list.length + 1;

const newQuestions = [
  { question: "Please ( ) the application form and submit it by Friday.", options: ["fill out", "fill in for", "fill with", "fill to"], correct_index: 0, explanation: "fill out で「（書類などに）記入する」という最頻出の句動詞です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The meeting has been ( ) due to an unexpected schedule conflict.", options: ["called off", "called for", "called in", "called on"], correct_index: 0, explanation: "call off は「中止する」を意味し、TOEICの予定変更シナリオでよく出ます。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "All staff members must ( ) with the new safety regulations.", options: ["comply", "adhere", "observe", "follow"], correct_index: 0, explanation: "「規則に従う」という際、前置詞 with とセットになるのは comply です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "The board decided to ( ) the merger until the next fiscal year.", options: ["put off", "put on", "put through", "put away"], correct_index: 0, explanation: "put off で「延期する」という意味になります。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "We are looking ( ) to meeting the new director next week.", options: ["forward", "for", "after", "through"], correct_index: 0, explanation: "look forward to ～ing で「～するのを楽しみに待つ」という定番表現です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The marketing campaign was ( ) at young professionals.", options: ["aimed", "focused", "intended", "directed"], correct_index: 0, explanation: "be aimed at で「～を対象としている、狙っている」という意味です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "Ms. Sato will ( ) for the manager while he is on vacation.", options: ["fill in", "stand by", "take over", "look after"], correct_index: 0, explanation: "fill in for 人 で「人の代理を務める」という便利な熟語です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The success of the project ( ) on the cooperation of all departments.", options: ["depends", "relies", "counts", "trusts"], correct_index: 0, explanation: "depend on で「～に依存する、～次第である」となります。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "Please ( ) the attached report before the meeting starts.", options: ["look over", "look up", "look into", "look for"], correct_index: 0, explanation: "look over は「～にざっと目を通す」という意味で、ビジネスで多用されます。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The company had to ( ) some employees due to the recession.", options: ["lay off", "set off", "take off", "show off"], correct_index: 0, explanation: "lay off で「（一時的に）解雇する」という人事関連の重要語です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "Applicants must ( ) to the guidelines stated in the handbook.", options: ["adhere", "comply", "follow", "agree"], correct_index: 0, explanation: "adhere to で「（規則などを）固守する、守る」という意味になります。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "We need to ( ) up a meeting to discuss the budget.", options: ["set", "hold", "take", "make"], correct_index: 0, explanation: "set up は「準備する、手配する」という意味で非常によく使われます。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The manager ( ) out that the sales figures were incorrect.", options: ["pointed", "showed", "marked", "indicated"], correct_index: 0, explanation: "point out で「指摘する」という論理展開に欠かせない言葉です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "Our team managed to ( ) up with a creative solution.", options: ["come", "catch", "keep", "bring"], correct_index: 0, explanation: "come up with で「（アイデアなどを）思いつく、提案する」です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The office will ( ) with the plan regardless of the cost.", options: ["proceed", "progress", "process", "prevent"], correct_index: 0, explanation: "proceed with で「～を続行する、進める」という意味です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "You should ( ) in your expenses by the end of the month.", options: ["hand", "give", "take", "turn"], correct_index: 0, explanation: "hand in で「提出する」。submit の言い換えとして頻出です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The new assistant is ( ) with our software system.", options: ["familiar", "aware", "known", "conscious"], correct_index: 0, explanation: "be familiar with で「～に精通している、詳しい」となります。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "( ) to the weather forecast, it will rain tomorrow.", options: ["According", "Depending", "Relating", "Subject"], correct_index: 0, explanation: "According to ～ で「～によれば」という情報源を示す表現です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "The company is committed ( ) providing excellent service.", options: ["to", "for", "with", "on"], correct_index: 0, explanation: "be committed to ～ing で「～することに専念している」という重要熟語です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "We will ( ) into the cause of the system failure immediately.", options: ["look", "see", "search", "watch"], correct_index: 0, explanation: "look into で「調査する」。investigate の言い換えです。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The technician ( ) out the repairs as instructed.", options: ["carried", "made", "took", "ran"], correct_index: 0, explanation: "carry out は「実行する、遂行する」という硬いビジネス語です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "Please ( ) from using mobile phones during the presentation.", options: ["refrain", "prevent", "stop", "avoid"], correct_index: 0, explanation: "refrain from で「～を控える」という丁寧な禁止表現です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "The hotel ( ) to the needs of business travelers.", options: ["caters", "serves", "provides", "assists"], correct_index: 0, explanation: "cater to で「～の要望に応える、～を対象とする」です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "Employees are ( ) for the bonus after one year of service.", options: ["eligible", "entitled", "qualified", "suitable"], correct_index: 0, explanation: "be eligible for で「～の資格がある」という人事の定番。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "The plan was canceled ( ) of the lack of funding.", options: ["because", "since", "despite", "although"], correct_index: 0, explanation: "because of 名詞 で「～の理由で」となります。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "Mr. Kim will ( ) over the department next month.", options: ["take", "get", "turn", "go"], correct_index: 0, explanation: "take over で「（職務などを）引き継ぐ」という頻出句動詞です。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "The budget was revised ( ) light of the recent audit.", options: ["in", "by", "at", "on"], correct_index: 0, explanation: "in light of で「～を考慮して、～に照らして」という高度な表現です。", category: "前置詞", difficulty: "600", vocab_map: {} },
  { question: "The products must be ( ) of properly according to the law.", options: ["disposed", "discarded", "removed", "cleared"], correct_index: 0, explanation: "dispose of で「～を処分する」という意味になります。", category: "句動詞", difficulty: "500", vocab_map: {} },
  { question: "Our prices are ( ) with those of our competitors.", options: ["consistent", "comparable", "equal", "same"], correct_index: 1, explanation: "be comparable with/to で「～に匹敵する」という意味です。", category: "前置詞", difficulty: "500", vocab_map: {} },
  { question: "( ) behalf of the company, I would like to thank you all.", options: ["On", "In", "At", "By"], correct_index: 0, explanation: "On behalf of で「～を代表して」という挨拶の定型句です。", category: "前置詞", difficulty: "500", vocab_map: {} },
];

newQuestions.forEach((q, i) => {
  q.id = `static-${startId + i}`;
});

const merged = list.concat(newQuestions);
fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`Added ${newQuestions.length} questions. Total: ${merged.length}. IDs: static-${startId} to static-${startId + newQuestions.length - 1}.`);
