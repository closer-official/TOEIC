/**
 * part5-static.json に30問を追加する
 * 実行: node scripts/add-part5-30.js
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'data', 'part5-static.json');
const list = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const startId = list.length + 1;

const newQuestions = [
  { question: "The marketing team is known for its ( ) strategies.", options: ["innovate", "innovation", "innovative", "innovatively"], correct_index: 2, explanation: "所有格itsと名詞strategiesの間には、名詞を修飾する形容詞が入ります。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "Sales have increased ( ) since the new product launch.", options: ["substance", "substantial", "substantially", "substantiate"], correct_index: 2, explanation: "動詞句have increasedを修飾するのは副詞が正解です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) of the new policy will begin next Monday.", options: ["implement", "implementation", "implemented", "implementer"], correct_index: 1, explanation: "定冠詞Theの後ろで主語になるのは名詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "We need to ( ) our resources to improve efficiency.", options: ["consolidate", "consolidation", "consolidated", "consolidating"], correct_index: 0, explanation: "不定詞toの後ろには動詞の原形が入ります。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The consultant ( ) analyzed the market trends.", options: ["thorough", "thoroughly", "thoroughness", "thoro"], correct_index: 1, explanation: "動詞analyzedを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "All employees must submit their ( ) for the workshop.", options: ["register", "registered", "registration", "registry"], correct_index: 2, explanation: "所有格theirの後ろには名詞が入ります。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The customer service team is very ( ) to inquiries.", options: ["respond", "response", "responsive", "responsively"], correct_index: 2, explanation: "be動詞の後ろで主語の状態を表す形容詞が適切です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "Please direct your ( ) to the service desk.", options: ["inquire", "inquisitive", "inquiringly", "inquiries"], correct_index: 3, explanation: "所有格yourの後ろには名詞がきます。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The new software is ( ) more efficient than the old one.", options: ["mark", "marked", "markedly", "marker"], correct_index: 2, explanation: "形容詞比較級more efficientを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The manager gave a ( ) explanation of the project.", options: ["brief", "briefly", "brevity", "briefing"], correct_index: 0, explanation: "名詞explanationを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) of the meeting was to discuss the budget.", options: ["object", "objective", "objectively", "objectify"], correct_index: 1, explanation: "文の主語となる名詞が必要です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The candidate's references were ( ) impressive.", options: ["tremendous", "tremendously", "tremor", "tremendouslyness"], correct_index: 1, explanation: "形容詞impressiveを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The company is seeking a ( ) assistant for the CEO.", options: ["rely", "reliable", "reliability", "reliably"], correct_index: 1, explanation: "名詞assistantを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) cost of the project was higher than expected.", options: ["initial", "initially", "initiate", "initiation"], correct_index: 0, explanation: "名詞costを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "You must ( ) follow the safety protocols.", options: ["strict", "strictly", "strictness", "stricter"], correct_index: 1, explanation: "動詞followを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) of the building will take six months.", options: ["renovate", "renovation", "renovated", "renovating"], correct_index: 1, explanation: "文の主語となる名詞が必要です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) results will be announced tomorrow.", options: ["final", "finally", "finalize", "finality"], correct_index: 0, explanation: "名詞resultsを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The report was ( ) researched.", options: ["thorough", "thoroughly", "thoroughness", "thoro"], correct_index: 1, explanation: "過去分詞researchedを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "We are ( ) evaluating the current market situation.", options: ["current", "currently", "currency", "currencies"], correct_index: 1, explanation: "動詞句are evaluatingを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The CEO ( ) the staff on the successful merger.", options: ["congratulation", "congratulate", "congratulated", "congratulatory"], correct_index: 2, explanation: "文の述語となる動詞の過去形が必要です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "Each department must work ( ) to achieve the goal.", options: ["independent", "independently", "independence", "independency"], correct_index: 1, explanation: "動詞workを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) of the new technology was a success.", options: ["introduce", "introduction", "introductory", "introduced"], correct_index: 1, explanation: "定冠詞Theの後ろは名詞が正解です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "We are looking for a ( ) solution to the problem.", options: ["practice", "practical", "practically", "practiced"], correct_index: 1, explanation: "名詞solutionを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The manager asked for ( ) on the proposal.", options: ["clarify", "clarification", "clear", "clearly"], correct_index: 1, explanation: "前置詞forの後ろには名詞がきます。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The company will ( ) into new markets.", options: ["expand", "expansion", "expansive", "expansively"], correct_index: 0, explanation: "助動詞willの後ろは動詞の原形が必要です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) of the project depends on teamwork.", options: ["succeed", "success", "successful", "successfully"], correct_index: 1, explanation: "文の主語となる名詞が必要です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "Please handle the equipment ( ).", options: ["cautious", "cautiously", "caution", "cautiousness"], correct_index: 1, explanation: "動詞handleを修飾するのは副詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "All employees are ( ) for the bonus.", options: ["eligible", "eligibility", "eligibly", "eligibleness"], correct_index: 0, explanation: "be動詞の補語として形容詞が入ります。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "The ( ) budget was approved by the board.", options: ["annual", "annually", "annuality", "annualize"], correct_index: 0, explanation: "名詞budgetを修飾するのは形容詞です。", category: "品詞", difficulty: "500", vocab_map: {} },
  { question: "We must ( ) the security system.", options: ["strength", "strengthen", "strong", "strongly"], correct_index: 1, explanation: "助動詞mustの後ろには動詞の原形がきます。", category: "品詞", difficulty: "500", vocab_map: {} },
];

newQuestions.forEach((q, i) => {
  q.id = `static-${startId + i}`;
});

const merged = list.concat(newQuestions);
fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`Added ${newQuestions.length} questions. Total: ${merged.length}. IDs: static-${startId} to static-${startId + newQuestions.length - 1}.`);
