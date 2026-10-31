// ─────────────────────────────────────────────────────────────
//  diff.js — 버전 비교
//   · lineDiff : 줄 단위 LCS 비교 + 변경 줄 안의 글자 단위 하이라이트
//   · projectDiff : 카드 필드 / 로어북 엔트리 / 정규식 / 이미지 단위 비교
// ─────────────────────────────────────────────────────────────

/** 줄 단위 diff → [{t:'eq'|'del'|'add', s}] */
export function lineDiff(a, b) {
  const A = String(a ?? '').split('\n');
  const B = String(b ?? '').split('\n');
  // 공통 접두/접미 제거로 비용 절감
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  const a2 = A.slice(pre, A.length - suf);
  const b2 = B.slice(pre, B.length - suf);
  const out = [];
  for (let i = 0; i < pre; i++) out.push({ t: 'eq', s: A[i] });

  const n = a2.length, m = b2.length;
  if (n * m > 4_000_000) {
    a2.forEach((s) => out.push({ t: 'del', s }));
    b2.forEach((s) => out.push({ t: 'add', s }));
  } else {
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { out.push({ t: 'eq', s: a2[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', s: a2[i++] }); }
      else { out.push({ t: 'add', s: b2[j++] }); }
    }
    while (i < n) out.push({ t: 'del', s: a2[i++] });
    while (j < m) out.push({ t: 'add', s: b2[j++] });
  }
  for (let i = A.length - suf; i < A.length; i++) out.push({ t: 'eq', s: A[i] });
  return out;
}

/** 두 줄 사이의 변경 구간 (접두/접미 공통부 제외) */
export function inlineSpan(oldLine, newLine) {
  const a = [...oldLine], b = [...newLine];
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return {
    old: [a.slice(0, p).join(''), a.slice(p, a.length - s).join(''), a.slice(a.length - s).join('')],
    neu: [b.slice(0, p).join(''), b.slice(p, b.length - s).join(''), b.slice(b.length - s).join('')],
  };
}

export const CARD_FIELDS = [
  ['name', '이름'], ['nickname', '닉네임'], ['description', '설명 (Description)'],
  ['personality', '성격 요약'], ['scenario', '시나리오'], ['first_mes', '첫 메시지'],
  ['alternate_greetings', '대체 인사말'], ['group_only_greetings', '그룹 전용 인사말'],
  ['mes_example', '예시 대화'], ['system_prompt', '메인 프롬프트 오버라이드'],
  ['post_history_instructions', '탈옥(PHI) 오버라이드'], ['depth_prompt', '캐릭터 노트'],
  ['creator_notes', '제작자 노트'], ['creator', '제작자'], ['character_version', '캐릭터 버전'],
  ['tags', '태그'], ['talkativeness', '수다 정도'],
];

const asText = (v) => {
  if (Array.isArray(v)) return v.map((x, i) => (typeof x === 'string' && x.includes('\n') ? `── #${i + 1}\n${x}` : String(x))).join('\n');
  if (v && typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v ?? '');
};

const ENTRY_FIELDS = [
  ['comment', '제목'], ['key', '키워드'], ['keysecondary', '보조 키워드'], ['content', '내용'],
  ['constant', '상시 활성'], ['disable', '비활성'], ['position', '위치'], ['depth', '깊이'],
  ['order', '순서'], ['probability', '확률'], ['selectiveLogic', '보조 논리'], ['group', '그룹'],
  ['role', '역할'], ['sticky', '지속'], ['cooldown', '쿨다운'], ['delay', '지연'],
];
const REGEX_FIELDS = [
  ['scriptName', '이름'], ['findRegex', '찾을 정규식'], ['replaceString', '치환 문자열'],
  ['trimStrings', '잘라낼 문자열'], ['placement', '적용 위치'], ['disabled', '비활성'],
  ['markdownOnly', '표시에만 적용'], ['promptOnly', '프롬프트에만 적용'], ['runOnEdit', '편집 시 실행'],
  ['substituteRegex', '매크로 치환'], ['minDepth', '최소 깊이'], ['maxDepth', '최대 깊이'],
];

function diffFields(a, b, fields) {
  const changes = [];
  for (const [k, label] of fields) {
    const x = asText(a?.[k]); const y = asText(b?.[k]);
    if (x !== y) changes.push({ key: k, label, before: x, after: y });
  }
  return changes;
}

/** 프로젝트 데이터 a(이전) → b(이후) 변경 요약 */
export function projectDiff(a, b) {
  const card = diffFields(a.card, b.card, CARD_FIELDS);
  const image = (a.imageId || null) !== (b.imageId || null);

  const ea = new Map((a.lorebook?.entries || []).map((e) => [e.uid, e]));
  const eb = new Map((b.lorebook?.entries || []).map((e) => [e.uid, e]));
  const lore = { added: [], removed: [], changed: [] };
  for (const [uid, e] of eb) {
    if (!ea.has(uid)) lore.added.push(e);
    else {
      const ch = diffFields(ea.get(uid), e, ENTRY_FIELDS);
      if (ch.length) lore.changed.push({ entry: e, changes: ch });
    }
  }
  for (const [uid, e] of ea) if (!eb.has(uid)) lore.removed.push(e);
  const loreMeta = (a.lorebook?.name || '') !== (b.lorebook?.name || '');

  const ra = new Map((a.regex || []).map((r) => [r.id, r]));
  const rb = new Map((b.regex || []).map((r) => [r.id, r]));
  const regex = { added: [], removed: [], changed: [] };
  for (const [id, r] of rb) {
    if (!ra.has(id)) regex.added.push(r);
    else {
      const ch = diffFields(ra.get(id), r, REGEX_FIELDS);
      if (ch.length) regex.changed.push({ script: r, changes: ch });
    }
  }
  for (const [id, r] of ra) if (!rb.has(id)) regex.removed.push(r);

  const total = card.length + (image ? 1 : 0) + lore.added.length + lore.removed.length + lore.changed.length
    + regex.added.length + regex.removed.length + regex.changed.length + (loreMeta ? 1 : 0);
  return { card, image, lore, loreMeta, regex, total };
}
