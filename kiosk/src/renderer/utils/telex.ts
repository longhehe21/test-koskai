// ===== Telex Engine (Vietnamese diacritics + tones) =====
// Port từ UI repo virtual-keyboard.ts (phần Telex).

const DIACRITIC_MAP: Record<string, Record<string, string>> = {
  a: { a: 'â', w: 'ă' },
  A: { a: 'Â', w: 'Ă' },
  e: { e: 'ê' },
  E: { e: 'Ê' },
  o: { o: 'ô', w: 'ơ' },
  O: { o: 'Ô', w: 'Ơ' },
  u: { w: 'ư' },
  U: { w: 'Ư' },
  d: { d: 'đ' },
  D: { d: 'Đ' },
};

// s=sắc, f=huyền, r=hỏi, x=ngã, j=nặng
const TONE_MAP: Record<string, Record<string, string>> = {
  s: {
    a: 'á', A: 'Á', ă: 'ắ', Ă: 'Ắ', â: 'ấ', Â: 'Ấ',
    e: 'é', E: 'É', ê: 'ế', Ê: 'Ế',
    i: 'í', I: 'Í',
    o: 'ó', O: 'Ó', ô: 'ố', Ô: 'Ố', ơ: 'ớ', Ơ: 'Ớ',
    u: 'ú', U: 'Ú', ư: 'ứ', Ư: 'Ứ',
    y: 'ý', Y: 'Ý',
  },
  f: {
    a: 'à', A: 'À', ă: 'ằ', Ă: 'Ằ', â: 'ầ', Â: 'Ầ',
    e: 'è', E: 'È', ê: 'ề', Ê: 'Ề',
    i: 'ì', I: 'Ì',
    o: 'ò', O: 'Ò', ô: 'ồ', Ô: 'Ồ', ơ: 'ờ', Ơ: 'Ờ',
    u: 'ù', U: 'Ù', ư: 'ừ', Ư: 'Ừ',
    y: 'ỳ', Y: 'Ỳ',
  },
  r: {
    a: 'ả', A: 'Ả', ă: 'ẳ', Ă: 'Ẳ', â: 'ẩ', Â: 'Ẩ',
    e: 'ẻ', E: 'Ẻ', ê: 'ể', Ê: 'Ể',
    i: 'ỉ', I: 'Ỉ',
    o: 'ỏ', O: 'Ỏ', ô: 'ổ', Ô: 'Ổ', ơ: 'ở', Ơ: 'Ở',
    u: 'ủ', U: 'Ủ', ư: 'ử', Ư: 'Ử',
    y: 'ỷ', Y: 'Ỷ',
  },
  x: {
    a: 'ã', A: 'Ã', ă: 'ẵ', Ă: 'Ẵ', â: 'ẫ', Â: 'Ẫ',
    e: 'ẽ', E: 'Ẽ', ê: 'ễ', Ê: 'Ễ',
    i: 'ĩ', I: 'Ĩ',
    o: 'õ', O: 'Õ', ô: 'ỗ', Ô: 'Ỗ', ơ: 'ỡ', Ơ: 'Ỡ',
    u: 'ũ', U: 'Ũ', ư: 'ữ', Ư: 'Ữ',
    y: 'ỹ', Y: 'Ỹ',
  },
  j: {
    a: 'ạ', A: 'Ạ', ă: 'ặ', Ă: 'Ặ', â: 'ậ', Â: 'Ậ',
    e: 'ẹ', E: 'Ẹ', ê: 'ệ', Ê: 'Ệ',
    i: 'ị', I: 'Ị',
    o: 'ọ', O: 'Ọ', ô: 'ộ', Ô: 'Ộ', ơ: 'ợ', Ơ: 'Ợ',
    u: 'ụ', U: 'Ụ', ư: 'ự', Ư: 'Ự',
    y: 'ỵ', Y: 'Ỵ',
  },
};

// Reverse map: toned → base
const TONED_TO_BASE: Record<string, string> = {};
for (const toneKey of Object.keys(TONE_MAP)) {
  const map = TONE_MAP[toneKey];
  for (const [base, toned] of Object.entries(map)) {
    TONED_TO_BASE[toned] = base;
  }
}

const ALL_VOWEL_BASES = new Set<string>([
  'a', 'A', 'ă', 'Ă', 'â', 'Â',
  'e', 'E', 'ê', 'Ê',
  'i', 'I',
  'o', 'O', 'ô', 'Ô', 'ơ', 'Ơ',
  'u', 'U', 'ư', 'Ư',
  'y', 'Y',
  ...Object.keys(TONED_TO_BASE),
]);

function isVowel(ch: string): boolean {
  return ALL_VOWEL_BASES.has(ch);
}

function getBaseVowel(ch: string): string {
  return TONED_TO_BASE[ch] ?? ch;
}

function findToneTarget(text: string): number {
  let lastVowelIdx = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (isVowel(text[i])) {
      lastVowelIdx = i;
      let clusterStart = i;
      while (clusterStart > 0 && isVowel(text[clusterStart - 1])) {
        clusterStart--;
      }
      const clusterLen = i - clusterStart + 1;
      if (clusterLen >= 3) return clusterStart + 1;
      if (clusterLen === 2) {
        const afterCluster = i + 1 < text.length ? text[i + 1] : '';
        if (afterCluster && !isVowel(afterCluster)) return clusterStart;
        return clusterStart + 1;
      }
      return lastVowelIdx;
    }
  }
  return lastVowelIdx;
}

export interface TelexResult {
  text: string;
  cursorPos: number;
  consumed: boolean;
}

export function processTelex(
  currentText: string,
  cursorPos: number,
  key: string,
): TelexResult {
  const lowerKey = key.toLowerCase();
  const beforeCursor = currentText.slice(0, cursorPos);
  const afterCursor = currentText.slice(cursorPos);

  let wordStart = beforeCursor.length;
  while (
    wordStart > 0 &&
    beforeCursor[wordStart - 1] !== ' ' &&
    beforeCursor[wordStart - 1] !== '\n'
  ) {
    wordStart--;
  }
  const currentWord = beforeCursor.slice(wordStart);

  // 1. Diacritic combos (aa→â, aw→ă, ee→ê, oo→ô, ow→ơ, uw→ư, dd→đ)
  if (currentWord.length > 0) {
    const lastChar = currentWord[currentWord.length - 1];
    const baseLookup = getBaseVowel(lastChar);
    const baseLookupLower = baseLookup.toLowerCase();

    if (DIACRITIC_MAP[baseLookupLower]) {
      const transformMap = DIACRITIC_MAP[baseLookup] ?? DIACRITIC_MAP[baseLookupLower];
      if (transformMap && transformMap[lowerKey]) {
        const transformed = transformMap[lowerKey];
        if (lastChar !== transformed) {
          const isUpper =
            lastChar === lastChar.toUpperCase() && lastChar !== lastChar.toLowerCase();
          let result = isUpper
            ? DIACRITIC_MAP[lastChar.toUpperCase()]?.[lowerKey] ?? transformed.toUpperCase()
            : transformed;

          // Nếu base đã có tone → apply diacritic trên base rồi reapply tone
          if (TONED_TO_BASE[lastChar]) {
            const base = TONED_TO_BASE[lastChar];
            const baseLk = base.toLowerCase();
            if (DIACRITIC_MAP[baseLk]?.[lowerKey]) {
              const newBase =
                DIACRITIC_MAP[base]?.[lowerKey] ?? DIACRITIC_MAP[baseLk][lowerKey];
              for (const toneKey of Object.keys(TONE_MAP)) {
                if (
                  TONE_MAP[toneKey][base] === lastChar ||
                  TONE_MAP[toneKey][baseLk] === lastChar.toLowerCase()
                ) {
                  result =
                    TONE_MAP[toneKey][newBase] ??
                    TONE_MAP[toneKey][newBase.toLowerCase()] ??
                    newBase;
                  break;
                }
              }
            }
          }
          const newBefore = beforeCursor.slice(0, -1) + result;
          return { text: newBefore + afterCursor, cursorPos: newBefore.length, consumed: true };
        }
      }
    }
  }

  // 2. Tone marks (s, f, r, x, j)
  if (['s', 'f', 'r', 'x', 'j'].includes(lowerKey) && currentWord.length > 0) {
    const toneTargetIdx = findToneTarget(currentWord);
    if (toneTargetIdx >= 0) {
      const targetChar = currentWord[toneTargetIdx];
      const baseChar = getBaseVowel(targetChar);
      const toneMap = TONE_MAP[lowerKey];

      if (toneMap) {
        const toned = toneMap[baseChar];
        if (toned) {
          const absoluteIdx = wordStart + toneTargetIdx;
          const newBefore =
            beforeCursor.slice(0, absoluteIdx) + toned + beforeCursor.slice(absoluteIdx + 1);
          return { text: newBefore + afterCursor, cursorPos, consumed: true };
        }
      }
    }
  }

  // 3. 'z' remove tone
  if (lowerKey === 'z' && currentWord.length > 0) {
    for (let i = currentWord.length - 1; i >= 0; i--) {
      const ch = currentWord[i];
      if (TONED_TO_BASE[ch]) {
        const absoluteIdx = wordStart + i;
        const base = TONED_TO_BASE[ch];
        const newBefore =
          beforeCursor.slice(0, absoluteIdx) + base + beforeCursor.slice(absoluteIdx + 1);
        return { text: newBefore + afterCursor, cursorPos, consumed: true };
      }
    }
  }

  return { text: currentText, cursorPos, consumed: false };
}
