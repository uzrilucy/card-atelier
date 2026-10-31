// ─────────────────────────────────────────────────────────────
//  spec.js — 프로젝트 모델 ↔ 실리태번 포맷 변환
//   · 캐릭터 카드 V2 (chara) / V3 (ccv3)
//   · 월드인포(로어북) JSON  ↔  카드 내장 character_book
//   · 정규식 스크립트 JSON
//  원칙: "모르는 필드는 버리지 않는다" — 가져온 카드의 미지원 필드는
//  extra 에 보관했다가 내보낼 때 그대로 되돌려 놓습니다.
// ─────────────────────────────────────────────────────────────
import { uuid } from './codec.js';

export const APP_FORMAT = 'card-atelier-backup';
export const APP_FORMAT_VERSION = 1;

/* ── 월드인포 상수 ─────────────────────────────────────────── */
export const WI_POSITIONS = [
  { v: 0, label: '캐릭터 정의 앞', short: '↑Char' },
  { v: 1, label: '캐릭터 정의 뒤', short: '↓Char' },
  { v: 5, label: '예시 대화 앞', short: '↑EM' },
  { v: 6, label: '예시 대화 뒤', short: '↓EM' },
  { v: 2, label: '작가 노트 앞', short: '↑AN' },
  { v: 3, label: '작가 노트 뒤', short: '↓AN' },
  { v: 4, label: '깊이 지정 삽입', short: '@D' },
  { v: 7, label: '아웃렛 (Outlet)', short: 'Out' },
];
export const WI_LOGIC = [
  { v: 0, label: 'AND ANY — 보조 키워드 중 하나라도' },
  { v: 3, label: 'AND ALL — 보조 키워드 전부' },
  { v: 2, label: 'NOT ANY — 보조 키워드가 하나도 없을 때' },
  { v: 1, label: 'NOT ALL — 보조 키워드 전부가 함께 있진 않을 때' },
];
export const ROLES = [
  { v: 0, label: '시스템' },
  { v: 1, label: '사용자' },
  { v: 2, label: 'AI' },
];
export const REGEX_PLACEMENTS = [
  { v: 1, label: '사용자 입력' },
  { v: 2, label: 'AI 출력' },
  { v: 3, label: '슬래시 명령' },
  { v: 5, label: '월드 인포' },
  { v: 6, label: '추론(Reasoning)' },
];
export const REGEX_SUBST = [
  { v: 0, label: '치환 안 함' },
  { v: 1, label: '원문 그대로 (Raw)' },
  { v: 2, label: '이스케이프 (Escaped)' },
];

/* ── 기본값 팩토리 ─────────────────────────────────────────── */
export function newWorldEntry(uid, over = {}) {
  return {
    uid,
    key: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    vectorized: false,
    selective: true,
    selectiveLogic: 0,
    addMemo: true,
    order: 100,
    position: 0,
    disable: false,
    ignoreBudget: false,
    excludeRecursion: false,
    preventRecursion: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    outletName: '',
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: null,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    triggers: [],
    displayIndex: 0,
    characterFilter: { isExclude: false, names: [], tags: [] },
    ...over,
  };
}

export function newRegexScript(over = {}) {
  return {
    id: uuid(),
    scriptName: '새 정규식',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
    ...over,
  };
}

export function newCard(over = {}) {
  return {
    name: '',
    nickname: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    alternate_greetings: [],
    group_only_greetings: [],
    system_prompt: '',
    post_history_instructions: '',
    creator_notes: '',
    creator: '',
    character_version: '1.0.0',
    tags: [],
    depth_prompt: { prompt: '', depth: 4, role: 'system' },
    talkativeness: 0.5,
    fav: false,
    extraData: {},        // 미지원 data.* 필드 보존
    extraExtensions: {},  // 미지원 data.extensions.* 필드 보존
    ...over,
  };
}

export function newLorebook(over = {}) {
  return {
    name: '',
    description: '',
    scan_depth: null,
    token_budget: null,
    recursive_scanning: null,
    entries: [],
    extraTop: {},   // 월드 파일 최상위 미지원 필드
    extraBook: {},  // character_book 미지원 필드
    indexUid: null, // 자동 인덱스 엔트리 uid
    ...over,
  };
}

export function newProject(over = {}) {
  const now = Date.now();
  return {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    title: '',
    version: '1.0.0',
    imageId: null,
    card: newCard(),
    lorebook: newLorebook(),
    regex: [],
    notes: [],
    samples: {},  // 정규식 테스트 샘플 (내보내지 않음)
    exportOptions: {
      embedLorebook: true,
      embedRegex: true,
      fileNamePattern: '{name}_v{version}',
    },
    ...over,
  };
}

/* ── 유틸 ──────────────────────────────────────────────────── */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const pick = (obj, keys) => {
  const rest = {};
  for (const [k, v] of Object.entries(obj || {})) if (!keys.includes(k)) rest[k] = v;
  return rest;
};

export function nextUid(entries) {
  return entries.reduce((m, e) => Math.max(m, Number(e.uid) || 0), -1) + 1;
}

/* ── 월드인포 JSON ─────────────────────────────────────────── */

/** 실리 월드 파일 → 로어북 모델 */
export function worldFromJson(json, name = '') {
  if (!isObj(json) || !isObj(json.entries) && !Array.isArray(json.entries)) {
    throw new Error('월드인포 형식이 아닙니다 (entries 없음).');
  }
  const raw = Array.isArray(json.entries) ? json.entries : Object.values(json.entries);
  const entries = raw.map((e, i) => normalizeWorldEntry(e, i));
  entries.sort((a, b) => (a.displayIndex ?? 0) - (b.displayIndex ?? 0));
  const { entries: _, originalData: __, ...extraTop } = json;
  return newLorebook({
    name: name || str(json.name),
    entries,
    extraTop: pick(extraTop, ['name']),
  });
}

function normalizeWorldEntry(e, i) {
  const base = newWorldEntry(Number.isFinite(Number(e.uid)) ? Number(e.uid) : i);
  const out = { ...base, ...e };
  out.uid = base.uid;
  out.key = arr(e.key ?? e.keys).map(str);
  out.keysecondary = arr(e.keysecondary ?? e.secondary_keys).map(str);
  out.comment = str(e.comment);
  out.content = str(e.content);
  if (out.displayIndex == null) out.displayIndex = i;
  return out;
}

/** 로어북 모델 → 실리 월드 파일 */
export function worldToJson(book) {
  const entries = {};
  book.entries.forEach((e, i) => {
    const copy = { ...e, displayIndex: i };
    entries[String(e.uid)] = copy;
  });
  return { ...book.extraTop, entries };
}

/* ── character_book (카드 내장 로어북) ─────────────────────── */

/** 월드 엔트리 → character_book 엔트리 (실리 내장 변환과 동일한 매핑) */
function entryToBook(e, i) {
  const ext = {
    position: e.position,
    exclude_recursion: e.excludeRecursion,
    display_index: i,
    probability: e.probability ?? null,
    useProbability: e.useProbability ?? false,
    depth: e.depth ?? 4,
    selectiveLogic: e.selectiveLogic ?? 0,
    outlet_name: e.outletName ?? '',
    group: e.group ?? '',
    group_override: e.groupOverride ?? false,
    group_weight: e.groupWeight ?? null,
    prevent_recursion: e.preventRecursion ?? false,
    delay_until_recursion: e.delayUntilRecursion ?? false,
    scan_depth: e.scanDepth ?? null,
    match_whole_words: e.matchWholeWords ?? null,
    use_group_scoring: e.useGroupScoring ?? null,
    case_sensitive: e.caseSensitive ?? null,
    automation_id: e.automationId ?? '',
    role: e.role ?? null,
    vectorized: e.vectorized ?? false,
    sticky: e.sticky ?? null,
    cooldown: e.cooldown ?? null,
    delay: e.delay ?? null,
    match_persona_description: e.matchPersonaDescription ?? false,
    match_character_description: e.matchCharacterDescription ?? false,
    match_character_personality: e.matchCharacterPersonality ?? false,
    match_character_depth_prompt: e.matchCharacterDepthPrompt ?? false,
    match_scenario: e.matchScenario ?? false,
    match_creator_notes: e.matchCreatorNotes ?? false,
    triggers: e.triggers ?? [],
    ignore_budget: e.ignoreBudget ?? false,
  };
  if (e.characterFilter) ext.character_filter = e.characterFilter;
  return {
    id: e.uid,
    keys: e.key || [],
    secondary_keys: e.keysecondary || [],
    comment: e.comment || '',
    content: e.content || '',
    constant: !!e.constant,
    selective: !!e.selective,
    insertion_order: e.order ?? 100,
    enabled: !e.disable,
    position: e.position === 0 ? 'before_char' : 'after_char',
    use_regex: true,
    extensions: { ...(isObj(e.extensions) ? e.extensions : {}), ...ext },
  };
}

/** character_book 엔트리 → 월드 엔트리 */
function bookToEntry(b, i) {
  const x = isObj(b.extensions) ? b.extensions : {};
  const has = (k) => Object.prototype.hasOwnProperty.call(x, k);
  const pos = has('position') ? x.position : b.position === 'before_char' ? 0 : 1;
  const known = ['position', 'exclude_recursion', 'display_index', 'probability', 'useProbability', 'depth',
    'selectiveLogic', 'outlet_name', 'group', 'group_override', 'group_weight', 'prevent_recursion',
    'delay_until_recursion', 'scan_depth', 'match_whole_words', 'use_group_scoring', 'case_sensitive',
    'automation_id', 'role', 'vectorized', 'sticky', 'cooldown', 'delay', 'match_persona_description',
    'match_character_description', 'match_character_personality', 'match_character_depth_prompt',
    'match_scenario', 'match_creator_notes', 'triggers', 'ignore_budget', 'character_filter'];
  const restExt = pick(x, known);
  const e = newWorldEntry(Number.isFinite(Number(b.id)) ? Number(b.id) : i, {
    key: arr(b.keys).map(str),
    keysecondary: arr(b.secondary_keys).map(str),
    comment: str(b.comment || b.name),
    content: str(b.content),
    constant: !!b.constant,
    selective: b.selective ?? true,
    order: b.insertion_order ?? 100,
    disable: b.enabled === false,
    position: pos,
    excludeRecursion: x.exclude_recursion ?? false,
    preventRecursion: x.prevent_recursion ?? false,
    delayUntilRecursion: x.delay_until_recursion ?? false,
    displayIndex: x.display_index ?? i,
    probability: x.probability ?? 100,
    useProbability: x.useProbability ?? true,
    depth: x.depth ?? 4,
    selectiveLogic: x.selectiveLogic ?? 0,
    outletName: x.outlet_name ?? '',
    group: x.group ?? '',
    groupOverride: x.group_override ?? false,
    groupWeight: x.group_weight ?? 100,
    scanDepth: x.scan_depth ?? null,
    caseSensitive: x.case_sensitive ?? null,
    matchWholeWords: x.match_whole_words ?? null,
    useGroupScoring: x.use_group_scoring ?? null,
    automationId: x.automation_id ?? '',
    role: x.role ?? null,
    vectorized: x.vectorized ?? false,
    sticky: has('sticky') ? x.sticky : 0,
    cooldown: has('cooldown') ? x.cooldown : 0,
    delay: has('delay') ? x.delay : 0,
    matchPersonaDescription: x.match_persona_description ?? false,
    matchCharacterDescription: x.match_character_description ?? false,
    matchCharacterPersonality: x.match_character_personality ?? false,
    matchCharacterDepthPrompt: x.match_character_depth_prompt ?? false,
    matchScenario: x.match_scenario ?? false,
    matchCreatorNotes: x.match_creator_notes ?? false,
    triggers: Array.isArray(x.triggers) ? x.triggers : [],
    ignoreBudget: x.ignore_budget ?? false,
  });
  if (isObj(x.character_filter)) e.characterFilter = x.character_filter;
  else delete e.characterFilter;
  if (Object.keys(restExt).length) e.extensions = restExt;
  return e;
}

export function lorebookToCharacterBook(book) {
  const out = {
    ...book.extraBook,
    name: book.name || '',
    entries: book.entries.map(entryToBook),
    extensions: isObj(book.extraBook?.extensions) ? book.extraBook.extensions : {},
  };
  if (book.description) out.description = book.description;
  if (book.scan_depth != null) out.scan_depth = book.scan_depth;
  if (book.token_budget != null) out.token_budget = book.token_budget;
  if (book.recursive_scanning != null) out.recursive_scanning = book.recursive_scanning;
  return out;
}

export function characterBookToLorebook(cb, fallbackName = '') {
  if (!isObj(cb)) return newLorebook({ name: fallbackName });
  const entries = arr(cb.entries).map(bookToEntry);
  entries.sort((a, b) => (a.displayIndex ?? 0) - (b.displayIndex ?? 0));
  const { entries: _, name, description, scan_depth, token_budget, recursive_scanning, ...extraBook } = cb;
  return newLorebook({
    name: str(name) || fallbackName,
    description: str(description),
    scan_depth: scan_depth ?? null,
    token_budget: token_budget ?? null,
    recursive_scanning: recursive_scanning ?? null,
    entries,
    extraBook,
  });
}

/* ── 정규식 ────────────────────────────────────────────────── */
export function normalizeRegex(r) {
  const base = newRegexScript();
  const out = { ...base, ...r };
  out.id = str(r.id) || base.id;
  out.scriptName = str(r.scriptName) || '이름 없는 정규식';
  out.findRegex = str(r.findRegex);
  out.replaceString = str(r.replaceString);
  out.trimStrings = arr(r.trimStrings).map(str);
  out.placement = arr(r.placement).map(Number).filter((n) => Number.isFinite(n));
  return out;
}

export function regexFromJson(json) {
  if (Array.isArray(json)) return json.filter((x) => isObj(x) && 'findRegex' in x).map(normalizeRegex);
  if (isObj(json) && 'findRegex' in json) return [normalizeRegex(json)];
  if (isObj(json) && Array.isArray(json.regex_scripts)) return regexFromJson(json.regex_scripts);
  throw new Error('정규식 스크립트 형식이 아닙니다.');
}

/* ── 캐릭터 카드 ───────────────────────────────────────────── */
const DATA_KNOWN = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
  'creator_notes', 'system_prompt', 'post_history_instructions', 'alternate_greetings', 'character_book',
  'tags', 'creator', 'character_version', 'extensions', 'group_only_greetings', 'nickname', 'assets',
  'creator_notes_multilingual', 'source', 'creation_date', 'modification_date'];
const EXT_KNOWN = ['talkativeness', 'fav', 'world', 'depth_prompt', 'regex_scripts'];

/**
 * 프로젝트 → { v2, v3 } 카드 JSON 객체
 * @param {object} p   project
 * @param {object} opt { embedLorebook, embedRegex }
 */
export function buildCard(p, opt = {}) {
  const c = p.card;
  const embedBook = opt.embedLorebook ?? true;
  const embedRegex = opt.embedRegex ?? true;
  const hasBook = embedBook && p.lorebook.entries.length > 0;
  const bookName = p.lorebook.name || c.name || p.title || 'Lorebook';

  const extensions = {
    ...c.extraExtensions,
    talkativeness: Number(c.talkativeness ?? 0.5),
    fav: !!c.fav,
    world: hasBook ? bookName : (c.extraExtensions?.world ?? ''),
    depth_prompt: {
      prompt: str(c.depth_prompt?.prompt),
      depth: Number(c.depth_prompt?.depth ?? 4),
      role: c.depth_prompt?.role || 'system',
    },
  };
  if (embedRegex && p.regex.length) {
    extensions.regex_scripts = p.regex.map((r) => ({ ...r }));
  } else if (c.extraExtensions?.regex_scripts && !embedRegex) {
    delete extensions.regex_scripts;
  }

  const data = {
    ...c.extraData,
    name: str(c.name),
    description: str(c.description),
    personality: str(c.personality),
    scenario: str(c.scenario),
    first_mes: str(c.first_mes),
    mes_example: str(c.mes_example),
    creator_notes: str(c.creator_notes),
    system_prompt: str(c.system_prompt),
    post_history_instructions: str(c.post_history_instructions),
    tags: [...(c.tags || [])],
    creator: str(c.creator),
    character_version: str(c.character_version),
    alternate_greetings: [...(c.alternate_greetings || [])],
    extensions,
  };
  if (hasBook) {
    const cb = lorebookToCharacterBook(p.lorebook);
    cb.name = bookName;
    data.character_book = cb;
  }

  const legacy = {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    first_mes: data.first_mes,
    mes_example: data.mes_example,
    creatorcomment: data.creator_notes,
    avatar: 'none',
    talkativeness: String(extensions.talkativeness),
    fav: extensions.fav,
    tags: data.tags,
  };

  const v2 = { ...legacy, spec: 'chara_card_v2', spec_version: '2.0', data: stripV3(data) };

  const nowSec = Math.floor(Date.now() / 1000);
  const v3data = {
    ...data,
    group_only_greetings: [...(c.group_only_greetings || [])],
    nickname: str(c.nickname) || undefined,
    assets: Array.isArray(c.extraData?.assets) && c.extraData.assets.length
      ? c.extraData.assets
      : [{ type: 'icon', uri: 'ccdefault:', name: 'main', ext: 'png' }],
    creation_date: c.extraData?.creation_date ?? Math.floor((p.createdAt || Date.now()) / 1000),
    modification_date: nowSec,
  };
  if (v3data.nickname === undefined) delete v3data.nickname;
  if (v3data.character_book) {
    v3data.character_book = {
      ...v3data.character_book,
      entries: v3data.character_book.entries.map((e) => ({ ...e, use_regex: true })),
    };
  }
  const v3 = { ...legacy, spec: 'chara_card_v3', spec_version: '3.0', data: v3data };
  return { v2, v3 };
}

function stripV3(data) {
  // V2 data 에는 V3 전용 필드를 넣지 않는다 (엄격한 V2 파서 대응)
  const { group_only_greetings, assets, nickname, creator_notes_multilingual, source,
    creation_date, modification_date, ...rest } = data;
  return rest;
}

/**
 * 어떤 카드 JSON(V1/V2/V3)이든 프로젝트 조각으로 정규화
 * @returns {{card, lorebook, regex}}
 */
export function parseCard(json) {
  if (!isObj(json)) throw new Error('카드 JSON이 아닙니다.');
  const isV2plus = isObj(json.data) && /chara_card_v[23]/.test(str(json.spec));
  const d = isV2plus ? json.data : {
    // V1 (평면 구조) 호환
    name: json.name, description: json.description, personality: json.personality,
    scenario: json.scenario, first_mes: json.first_mes, mes_example: json.mes_example,
    creator_notes: json.creatorcomment ?? json.creator_notes, tags: json.tags,
    extensions: { talkativeness: json.talkativeness, fav: json.fav },
  };
  const ext = isObj(d.extensions) ? d.extensions : {};
  const dp = isObj(ext.depth_prompt) ? ext.depth_prompt : {};

  const card = newCard({
    name: str(d.name),
    nickname: str(d.nickname),
    description: str(d.description),
    personality: str(d.personality),
    scenario: str(d.scenario),
    first_mes: str(d.first_mes),
    mes_example: str(d.mes_example),
    alternate_greetings: arr(d.alternate_greetings).map(str),
    group_only_greetings: arr(d.group_only_greetings).map(str),
    system_prompt: str(d.system_prompt),
    post_history_instructions: str(d.post_history_instructions),
    creator_notes: str(d.creator_notes),
    creator: str(d.creator),
    character_version: str(d.character_version) || '1.0.0',
    tags: arr(d.tags).map(str).filter(Boolean),
    depth_prompt: { prompt: str(dp.prompt), depth: Number(dp.depth ?? 4), role: dp.role || 'system' },
    talkativeness: Number(ext.talkativeness ?? 0.5) || 0.5,
    fav: !!ext.fav && ext.fav !== 'false',
    extraData: pick(d, DATA_KNOWN.filter((k) => !['assets', 'creation_date', 'source', 'creator_notes_multilingual'].includes(k))),
    extraExtensions: pick(ext, EXT_KNOWN),
  });
  // V3 메타 중 보존할 것
  for (const k of ['assets', 'creation_date', 'source', 'creator_notes_multilingual']) {
    if (d[k] != null) card.extraData[k] = d[k];
  }

  const lorebook = d.character_book
    ? characterBookToLorebook(d.character_book, str(ext.world) || card.name)
    : newLorebook({ name: str(ext.world) });
  const regex = Array.isArray(ext.regex_scripts) ? ext.regex_scripts.map(normalizeRegex) : [];
  return { card, lorebook, regex };
}

/** 가져온 JSON 종류 판별 */
export function detectJsonKind(json) {
  if (isObj(json) && json.format === APP_FORMAT) return 'backup';
  if (isObj(json) && /chara_card_v[23]/.test(str(json.spec))) return 'card';
  if (isObj(json) && (isObj(json.entries) || Array.isArray(json.entries)) && !('first_mes' in json)) return 'world';
  if (Array.isArray(json) && json.length && json.every((x) => isObj(x) && 'findRegex' in x)) return 'regex';
  if (isObj(json) && 'findRegex' in json) return 'regex';
  if (isObj(json) && 'first_mes' in json && 'name' in json) return 'card';
  return 'unknown';
}

/* ── 토큰 추정 ─────────────────────────────────────────────── */
/**
 * 실제 토크나이저가 아닌 근사치입니다(모델마다 다름).
 * 한글/한자 ≈ 글자당 0.9토큰, 라틴 ≈ 4글자당 1토큰, 공백·기호 보정.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  let cjk = 0, other = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3130 && c <= 0x318f) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3040 && c <= 0x30ff)) cjk++;
    else other++;
  }
  return Math.round(cjk * 0.9 + other / 3.8);
}

/* ── 정규식 미리보기 (실리 regexFromString / runRegexScript 근사) ── */
export function regexFromString(input) {
  try {
    const m = String(input).match(/(\/?)(.+)\1([a-z]*)/is);
    if (!m) return null;
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixsuyd]+$/.test(m[3])) return new RegExp(input);
    return new RegExp(m[2], m[3]);
  } catch (err) {
    return { error: err.message };
  }
}

export function runRegex(script, input, macros = {}) {
  const re = regexFromString(script.findRegex);
  if (!re || re.error) return { output: input, error: re?.error || '패턴이 비어 있습니다.', count: 0 };
  const sub = (s) => s.replace(/\{\{(user|char)\}\}/gi, (_, k) => macros[k.toLowerCase()] ?? `{{${k}}}`);
  const trim = (s) => (script.trimStrings || []).reduce((acc, t) => (t ? acc.split(sub(t)).join('') : acc), s);
  let count = 0;
  const output = input.replace(re, function (...args) {
    count++;
    const groups = typeof args[args.length - 1] === 'object' ? args[args.length - 1] : undefined;
    const rep = String(script.replaceString).replace(/\{\{match\}\}/gi, '$0');
    const out = rep.replace(/\$(\d+)|\$<([^>]+)>/g, (_, num, name) => {
      let v;
      if (num) v = args[Number(num)];
      else if (name) v = groups && groups[name];
      if (v == null || typeof v !== 'string') return '';
      return trim(v);
    });
    return sub(out);
  });
  return { output, error: null, count };
}

/**
 * HTML 치환문자열 한 줄 압축 — 보수적 방식.
 * 개행이 낀 공백만 정리하고, 같은 줄 안의 공백·본문 텍스트는 건드리지 않습니다.
 */
export function minifyHtml(s) {
  return String(s)
    .replace(/>\s*\r?\n\s*</g, '><')
    .replace(/[ \t]*\r?\n[ \t]*/g, ' ')
    .trim();
}
