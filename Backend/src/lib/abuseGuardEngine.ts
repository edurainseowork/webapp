/**
 * EduRain AI Academic Mentor - Abuse & Profanity Guard Engine (Backend Mirror)
 */

export interface ModerationScanResult {
  isAbusive: boolean;
  severity: 'NONE' | 'STANDARD_ABUSE' | 'SEVERE_THREAT';
  matchedToken: string | null;
}

// NCERT Class 6-12 Biology, Chemistry & Physics Safe Whitelist (Strict Zero False Positives)
export const NCERT_SAFE_WHITELIST: string[] = [
  'sex determination', 'sexual reproduction', 'asexual reproduction', 'sex chromosome',
  'sex linked', 'secondary sexual', 'homo erectus', 'homo sapiens', 'homologous',
  'homozygous', 'independent assortment', 'assortment', 'retardation', 'cockroach',
  'periplaneta americana', 'testes', 'testis', 'ovary', 'scrotum', 'penis', 'vagina',
  'copulation', 'gonads', 'gametogenesis', 'insemination', 'fertilisation', 'fertilization',
  'parturition', 'lactation', 'contraceptive', 'analgesic', 'titration', 'assimilation',
  'assimilate', 'assessment', 'assignment', 'assistant', 'assumption', 'mass', 'class',
  'glass', 'pass', 'compass', 'potassium', 'biomass', 'bipinnaria', 'cleavage',
  'puberty', 'menstruation', 'gamete', 'zygote', 'embryo', 'fallopian'
];

export const EXACT_PROFANITY_SET: Set<string> = new Set([
  // Hindi & Hinglish Abusive Lexicon
  'chutiya', 'chutiye', 'chutiyapa', 'chut', 'bhenchod', 'behenchod', 'bahinchod',
  'madarchod', 'maadarchod', 'mc', 'bc', 'bsdk', 'bhosdike', 'bhosdi', 'bhosda',
  'gandu', 'gaandu', 'gand', 'gaand', 'randi', 'raandi', 'randwa', 'harami',
  'haramkhor', 'haramzada', 'kamina', 'kaminey', 'kutta', 'kutiye', 'kutiya',
  'suar', 'hijra', 'chakka', 'bhadwa', 'bhadwe', 'bhadva', 'dalaal', 'dalal',
  'lund', 'lauda', 'lawda', 'loda', 'lode', 'lavde', 'jhaant', 'jhatu', 'jhaatu',
  'chinal', 'chinaal', 'mutthal', 'muth', 'chudai', 'chod', 'chodna', 'chodunga',
  'gaandfaad', 'mkc', 'mkb', 'bkl', 'bkb', 'tmkc', 'tmkb',
  // English Abusive Lexicon
  'fuck', 'fucker', 'fucking', 'motherfucker', 'mf', 'bitch', 'bitches',
  'asshole', 'bastard', 'dick', 'dickhead', 'cock', 'pussy', 'cunt', 'whore',
  'slut', 'wanker', 'prick', 'bullshit', 'dumbass', 'jackass', 'stfu', 'gtfo',
  'nigger', 'nigga', 'faggot', 'retard'
]);

export const SUBSTRING_ROOT_PATTERNS: RegExp[] = [
  /chutiy/i, /bhencho/i, /behencho/i, /madarcho/i, /bhosdi/i,
  /motherfuck/i, /gaand/i, /haramkhor/i, /haramzad/i, /bhadw/i,
  /jhaat/i, /laud[ae]/i, /lawd[ae]/i
];

export const SEVERE_THREAT_PATTERNS: RegExp[] = [
  /\b(rape|rapist|kill\s+you|murder\s+you|bomb\s+blast|terrorist|balatkar|jaan\s+se\s+maar)\b/i
];

export function normalizeInputForModeration(rawInput: string): string {
  let text = rawInput.toLowerCase().normalize('NFKD');

  for (const term of NCERT_SAFE_WHITELIST) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' __ncert_safe_term__ ');
  }

  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  text = text.replace(/\b([a-z])\s*[\.\-_*]\s*([a-z])(?:\s*[\.\-_*]\s*([a-z]))?\b/gi, (match, p1, p2, p3) => {
    return p3 ? `${p1}${p2}${p3}` : `${p1}${p2}`;
  });

  const leetMap: Record<string, string> = {
    '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i',
    '0': 'o', '$': 's', '5': 's', '7': 't', '*': 'u'
  };
  text = text.replace(/([a-z0-9])[@431!0$57*]+([a-z0-9])/gi, (_match, prefix, suffix) => {
    const inner = _match.slice(prefix.length, -suffix.length);
    const decoded = inner.split('').map((char) => leetMap[char] || char).join('');
    return `${prefix}${decoded}${suffix}`;
  });

  text = text.replace(/([a-z])\1{2,}/gi, '$1');
  return text;
}

export function inspectStudentMessage(rawInput: string): ModerationScanResult {
  if (!rawInput || !rawInput.trim()) {
    return { isAbusive: false, severity: 'NONE', matchedToken: null };
  }

  for (const rx of SEVERE_THREAT_PATTERNS) {
    if (rx.test(rawInput)) {
      return { isAbusive: true, severity: 'SEVERE_THREAT', matchedToken: 'threat' };
    }
  }

  const normalized = normalizeInputForModeration(rawInput);

  for (const rx of SEVERE_THREAT_PATTERNS) {
    if (rx.test(normalized)) {
      return { isAbusive: true, severity: 'SEVERE_THREAT', matchedToken: 'threat' };
    }
  }

  const tokens = normalized.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token === '__ncert_safe_term__') continue;
    if (EXACT_PROFANITY_SET.has(token)) {
      return { isAbusive: true, severity: 'STANDARD_ABUSE', matchedToken: token };
    }
  }

  for (const rx of SUBSTRING_ROOT_PATTERNS) {
    const match = normalized.match(rx);
    if (match) {
      return { isAbusive: true, severity: 'STANDARD_ABUSE', matchedToken: match[0] };
    }
  }

  return { isAbusive: false, severity: 'NONE', matchedToken: null };
}
