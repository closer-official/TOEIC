/**
 * 組み込み単語リスト（REMAINING, R2）を default-vocab にマージする
 * 既存の単語は上書きせず、未登録の単語のみ追加する
 * 追加は default-vocab.json 直接編集、または vocab-user-paste.txt → parse-vocab-paste.js → merge-user-vocab.js で行う
 */

const fs = require('fs');
const path = require('path');

// 101-2000 の全エントリ [word, pos, ...meanings]
// pos: 動=動詞, 名=名詞, 形=形容詞, 副=副詞, 接=接続詞, 前=前置詞
const REMAINING = [
  // 101-200
  ['adjust','動','調整する'],['allocate','動','割り当てる'],['anticipate','動','予期する'],['assemble','動','組み立てる'],['assign','動','配属する'],['assume','動','引き受ける'],['attract','動','引きつける'],['commemorate','動','祝う'],['compile','動','編集する'],['conclude','動','締めくくる'],['confirm','動','確認する'],['delegate','動','委譲する'],['demonstrate','動','実演する'],['depart','動','出発する'],['disclose','動','公開する'],['eliminate','動','排除する'],['enclose','動','同封する'],['endorse','動','支持する'],['exhibit','動','展示する'],['expand','動','拡大する'],['facilitate','動','促進する'],['generate','動','生み出す'],['host','動','主催する'],['launch','動','発売する'],['maintain','動','維持する'],['merge','動','合併する'],['observe','動','遵守する'],['oversee','動','監督する'],['post','動','掲示する'],['utilize','動','利用する'],
  ['access','名','利用権'],['accomplishment','名','業績'],['appliance','名','電化製品'],['applicant','名','応募者'],['architect','名','建築家'],['authorization','名','許可'],['behalf','名','(on behalf ofの形で)～に代わって、～を代表して'],['benefit','名','福利厚生'],['candidate','名','候補者'],['certificate','名','証明書'],['circumstance','名','状況'],['complaint','名','苦情'],['contribution','名','貢献'],['correspondence','名','やり取り'],['deadline','名','締め切り'],['decade','名','10年間'],['description','名','説明'],['destination','名','目的地'],['dimension','名','寸法'],['distinction','名','区別'],['division','名','部門'],['estimate','名','見積書'],['facility','名','施設'],['fluctuation','名','変動'],['initiative','名','新たな計画'],['inventory','名','在庫'],['itinerary','名','旅程表'],['objective','名','目標'],['overview','名','概要'],['procedure','名','手順'],
  ['accurate','形','正確な'],['adequate','形','適切な'],['affordable','形','手ごろな価格の'],['alternative','形','代わりの'],['aware','形','気付いて'],['brief','形','手短な'],['cautious','形','用心深い'],['competitive','形','競争力のある'],['complimentary','形','無料の'],['consecutive','形','連続した'],['constructive','形','建設的な'],['convenient','形','便利な'],['crucial','形','決定的な'],['current','形','現在の'],['detailed','形','詳細な'],['durable','形','耐久性のある'],['efficient','形','効率的な'],['favorable','形','好意的な'],['financial','形','財務の'],['initial','形','初期の'],['local','形','地元の'],['minor','形','小さい方の'],['obvious','形','明らかな'],['previous','形','前の'],['urgent','形','緊急の'],
  ['abruptly','副','突然に'],['accurately','副','正確に'],['closely','副','密接に'],['consistently','副','一貫して'],['deliberately','副','意図的に'],['eagerly','副','熱望して'],['entirely','副','完全に'],['evenly','副','均等に'],['gradually','副','徐々に'],['incredibly','副','非常に'],['mutually','副','相互に'],['occasionally','副','時々'],['partially','副','部分的に'],['relatively','副','比較的'],['virtually','副','実質的に'],
  // 201-300
  ['accommodate','動','収容する'],['accumulate','動','蓄積する'],['adhere','動','遵守する'],['advertise','動','宣伝する'],['afford','動','余裕がある'],['alleviate','動','軽減する'],['amend','動','修正する'],['appraise','動','査定する'],['ascertain','動','確かめる'],['attain','動','達成する'],['authorize','動','許可する'],['calculate','動','計算する'],['collaborate','動','協力する'],['commence','動','始まる'],['compensate','動','補償する'],['comply','動','従う'],['confront','動','直面する'],['consolidate','動','統合する'],['curtail','動','削減する'],['dedicate','動','捧げる'],['defer','動','延期する'],['deteriorate','動','悪化する'],['diagnose','動','診断する'],['discontinue','動','中断する'],['distribute','動','配布する'],['duplicate','動','複製する'],['emphasize','動','強調する'],['encounter','動','遭遇する'],['expedite','動','早める'],['fluctuate','動','変動する'],
  ['agenda','名','協議事項'],['amendment','名','修正案'],['appraisal','名','評価'],['arrangement','名','手配'],['asset','名','資産'],['beverage','名','飲料'],['bid','名','入札'],['budget','名','予算'],['campaign','名','宣伝活動'],['collaboration','名','協力'],['component','名','構成要素'],['confirmation','名','確認書'],['consequence','名','結果'],['contractor','名','請負業者'],['criterion','名','基準'],['curriculum','名','教育課程'],['deficit','名','赤字'],['delegate','名','代表者'],['department','名','部署'],['discretion','名','裁量'],['disruption','名','中断'],['edition','名','版'],['executive','名','幹部'],['expenditure','名','支出'],['expertise','名','専門知識'],['function','名','行事'],['garment','名','衣類'],['handbook','名','手引書'],['incentive','名','報奨金'],['liability','名','責任'],
  ['absolute','形','絶対的な'],['abundant','形','豊富な'],['ambitious','形','野心的な'],['anonymous','形','匿名の'],['appropriate','形','適切な'],['brief','形','短い'],['broad','形','幅広い'],['capable','形','能力がある'],['coherent','形','一貫した'],['comparable','形','匹敵する'],['competent','形','有能な'],['complex','形','複雑な'],['comprehensive','形','包括的な'],['confidential','形','機密の'],['considerate','形','思いやりのある'],['content','形','満足して'],['customary','形','慣習的な'],['decisive','形','決定的な'],['delicate','形','繊細な'],['dependent','形','依存している'],['designated','形','指定された'],['distinct','形','はっきり異なる'],['economical','形','経済的な'],['eligible','形','資格がある'],['equivalent','形','同等の'],
  ['barely','副','かろうじて'],['certainly','副','確かに'],['conclusively','副','決定的に'],['considerably','副','かなり'],['drastically','副','劇的に'],['effectively','副','効果的に'],['exclusively','副','独占的に'],['fairly','副','かなり'],['formerly','副','かつて'],['greatly','副','大いに'],['hardly','副','ほとんど〜ない'],['inevitably','副','必然的に'],['largely','副','主に'],['mutually','副','相互に'],['overwhelmingly','副','圧倒的に'],
];

// 301-500 を追加（長いので別ブロックで連結）
const R2 = [
  ['acknowledge','動','受領を知らせる、(事実を)認める'],['address','動','(課題に)対処する、(聴衆に)演説する'],['affix','動','貼る'],['applaud','動','称賛する'],['appoint','動','指名する'],['assess','動','評価する'],['attribute','動','(結果を)～のせいにする(attribute A to B)'],['broaden','動','広げる'],['certify','動','証明する'],['clarify','動','明確にする'],['coincide','動','同時に起こる'],['collaborate','動','共同で行う'],['complement','動','補完する'],['comprise','動','構成する'],['consent','動','同意する'],['consult','動','相談する'],['contradict','動','矛盾する'],['convey','動','伝える'],['coordinate','動','調整する'],['curb','動','抑制する'],['decline','動','断る'],['deduct','動','差し引く'],['deem','動','みなす'],['defy','動','拒む'],['depict','動','描写する'],['derive','動','引き出す'],['designate','動','指定する'],['detect','動','見つける'],['deviate','動','逸れる'],['discard','動','捨てる'],
  ['applicant','名','応募者'],['apprentice','名','見習い'],['aspect','名','側面'],['assembly','名','組立'],['assignment','名','課題'],['assistance','名','援助'],['attachment','名','添付ファイル'],['attendance','名','出席'],['attire','名','服装'],['attribute','名','(成功などの)要因、特質'],['beverage','名','飲み物'],['blueprint','名','設計図'],['board','名','理事会'],['boundary','名','境界'],['brokerage','名','仲介'],['calculation','名','計算'],['capacity','名','収容能力'],['caterer','名','出前業者'],['checkup','名','健康診断'],['citation','名','引用'],['clerk','名','事務員'],['closure','名','閉鎖'],['column','名','柱'],['committee','名','委員会'],['commuter','名','通勤者'],['compensation','名','報酬'],['compliance','名','遵守'],['component','名','部品'],['congestion','名','渋滞'],['consent','名','同意'],
  ['eventual','形','最終的な'],['exceptional','形','非常に優れた'],['excessive','形','過度の'],['exclusive','形','専用の'],['exemplary','形','模範的な'],['existing','形','既存の'],['exotic','形','外来の'],['experienced','形','経験豊富な'],['explicit','形','明確な'],['extensive','形','広範囲な'],['external','形','外部の'],['extravagant','形','贅沢な'],['feasible','形','実現可能な'],['flexible','形','柔軟な'],['formal','形','正式な'],['fragile','形','壊れやすい'],['generic','形','一般的な'],['genuine','形','本物の'],['hazardous','形','危険な'],['hostile','形','敵対的な'],['identical','形','同一の'],['imminent','形','差し迫った'],['impartial','形','公平な'],['imperative','形','必須の'],['incidental','形','付随する'],
  ['markedly','副','著しく'],['meticulously','副','細心の注意を払って'],['mutually','副','相互に'],['namely','副','すなわち'],['narrowly','副','かろうじて'],['occasionally','副','時々'],['outwardly','副','外見上は'],['periodically','副','定期的に'],['permanently','副','永久に'],['precisely','副','正確に'],['predominantly','副','主に'],['proactively','副','先を見越して'],['profoundly','副','深く'],['regrettably','副','遺憾ながら'],['seemingly','副','見たところ'],
  // 401-500
  ['disrupt','動','中断させる'],['distinguish','動','区別する'],['divert','動','逸らす'],['dominate','動','支配する'],['drain','動','排出させる'],['elaborate','動','詳しく述べる'],['elevate','動','高める'],['eliminate','動','除去する'],['embark','動','乗り出す'],['emerge','動','現れる'],['emphasize','動','強調する'],['employ','動','採用する'],['enable','動','可能にする'],['encompass','動','取り囲む'],['encounter','動','遭遇する'],['encourage','動','奨励する'],['endeavor','動','努める'],['endorse','動','承認する'],['enforce','動','施行する'],['engage','動','従事させる'],['enhance','動','高める'],['enlarge','動','拡大する'],['enlighten','動','教える'],['enroll','動','登録する'],['entail','動','伴う'],['entitle','動','資格を与える'],['entrust','動','委託する'],['envisage','動','想像する'],['equip','動','備え付ける'],['erase','動','消去する'],
  ['constraint','名','制約'],['consultation','名','相談'],['consumption','名','消費'],['contaminant','名','汚染物質'],['contingency','名','不測の事態'],['continuity','名','継続性'],['contractor','名','請負業者'],['contribution','名','寄付'],['convenience','名','利便性'],['convention','名','会議'],['conveyance','名','輸送'],['conviction','名','確信'],['corporation','名','法人'],['correspondence','名','通信'],['corridor','名','廊下'],['council','名','議会'],['counterpart','名','対応する人'],['courier','名','宅配業者'],['coverage','名','補償範囲'],['credential','名','実績'],['criterion','名','基準'],['criticism','名','批判'],['cuisine','名','料理'],['curator','名','学芸員'],['currency','名','通貨'],['customization','名','特注化'],['database','名','データベース'],['deadline','名','締切'],['dealership','名','販売代理店'],['debit','名','引き落とし'],
  ['inclusive','形','全てを含んだ'],['inconsistent','形','矛盾した'],['indispensable','形','不可欠な'],['industrious','形','勤勉な'],['inevitable','形','避けられない'],['inferior','形','劣った'],['influential','形','影響力のある'],['informative','形','有益な'],['inherent','形','固有の'],['initial','形','初期の'],['innocuous','形','無害な'],['innovative','形','革新的な'],['inquisitive','形','知りたがる'],['insignificant','形','わずかな'],['insolvent','形','支払い不能の'],['instructive','形','教育的な'],['insufficient','形','不十分な'],['intact','形','損なわれていない'],['integral','形','不可欠な'],['intensive','形','集中的な'],['intent','形','熱心な'],['interactive','形','双方向の'],['interim','形','暫定的な'],['interior','形','内装の'],['intermittent','形','断続的な'],
  ['severely','副','ひどく'],['significantly','副','かなり'],['simultaneously','副','同時に'],['solely','副','単独で'],['specifically','副','具体的に'],['steadily','副','着実に'],['strategically','副','戦略的に'],['strictly','副','厳格に'],['subsequently','副','その後に'],['substantially','副','大幅に'],['successfully','副','無事に'],['sufficiently','副','十分に'],['superficially','副','表面上は'],['supposedly','副','おそらく'],['surprisingly','副','驚くほど'],
];

function toEntry(arr) {
  return { word: arr[0], pos: arr[1], meanings: arr.slice(2).filter(Boolean) };
}

function main() {
  const dataPath = path.join(process.cwd(), 'data', 'default-vocab.json');
  const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const seen = new Set(existing.map((e) => e.word.toLowerCase()));

  const allRemaining = [...REMAINING, ...R2];
  let added = 0;
  for (const row of allRemaining) {
    const w = row[0].toLowerCase();
    if (!seen.has(w)) {
      existing.push(toEntry(row));
      seen.add(w);
      added++;
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(existing) + '\n', 'utf8');
  console.log(`Merged: ${added} new entries. Total: ${existing.length}`);
}

main();
