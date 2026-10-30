/**
 * Verification & QA Test Suite: EduRain AI Academic Mentor Master Specification
 * Tests Pre-Send Filter, NCERT Whitelist, Strike Progression (1, 2, 3 -> 24h Lock),
 * Zero-Quota Routing (Greetings/Off-Topic), and KaTeX Stream Stabilization.
 */

import assert from 'node:assert';

// -------------------------------------------------------------
// Mirror of abuse guard logic for standalone Node verification
// -------------------------------------------------------------
const NCERT_SAFE_WHITELIST = [
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

const EXACT_PROFANITY_SET = new Set([
  'chutiya', 'chutiye', 'chutiyapa', 'chut', 'bhenchod', 'behenchod', 'bahinchod',
  'madarchod', 'maadarchod', 'mc', 'bc', 'bsdk', 'bhosdike', 'bhosdi', 'bhosda',
  'gandu', 'gaandu', 'gand', 'gaand', 'randi', 'raandi', 'randwa', 'harami',
  'haramkhor', 'haramzada', 'kamina', 'kaminey', 'kutta', 'kutiye', 'kutiya',
  'suar', 'hijra', 'chakka', 'bhadwa', 'bhadwe', 'bhadva', 'dalaal', 'dalal',
  'lund', 'lauda', 'lawda', 'loda', 'lode', 'lavde', 'jhaant', 'jhatu', 'jhaatu',
  'chinal', 'chinaal', 'mutthal', 'muth', 'chudai', 'chod', 'chodna', 'chodunga',
  'gaandfaad', 'mkc', 'mkb', 'bkl', 'bkb', 'tmkc', 'tmkb',
  'fuck', 'fucker', 'fucking', 'motherfucker', 'mf', 'bitch', 'bitches',
  'asshole', 'bastard', 'dick', 'dickhead', 'cock', 'pussy', 'cunt', 'whore',
  'slut', 'wanker', 'prick', 'bullshit', 'dumbass', 'jackass', 'stfu', 'gtfo',
  'nigger', 'nigga', 'faggot', 'retard'
]);

const SUBSTRING_ROOT_PATTERNS = [
  /chutiy/i, /bhencho/i, /behencho/i, /madarcho/i, /bhosdi/i,
  /motherfuck/i, /gaand/i, /haramkhor/i, /haramzad/i, /bhadw/i,
  /jhaat/i, /laud[ae]/i, /lawd[ae]/i
];

const SEVERE_THREAT_PATTERNS = [
  /\b(rape|rapist|kill\s+you|murder\s+you|bomb\s+blast|terrorist|balatkar|jaan\s+se\s+maar)\b/i
];

function normalizeInputForModeration(rawInput) {
  let text = rawInput.toLowerCase().normalize('NFKD');
  for (const term of NCERT_SAFE_WHITELIST) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' __ncert_safe_term__ ');
  }
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  text = text.replace(/\b([a-z])\s*[\.\-_*]\s*([a-z])(?:\s*[\.\-_*]\s*([a-z]))?\b/gi, (match, p1, p2, p3) => {
    return p3 ? `${p1}${p2}${p3}` : `${p1}${p2}`;
  });
  const leetMap = {
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

function inspectStudentMessage(rawInput) {
  if (!rawInput || !rawInput.trim()) return { isAbusive: false, severity: 'NONE', matchedToken: null };
  for (const rx of SEVERE_THREAT_PATTERNS) {
    if (rx.test(rawInput)) return { isAbusive: true, severity: 'SEVERE_THREAT', matchedToken: 'threat' };
  }
  const normalized = normalizeInputForModeration(rawInput);
  for (const rx of SEVERE_THREAT_PATTERNS) {
    if (rx.test(normalized)) return { isAbusive: true, severity: 'SEVERE_THREAT', matchedToken: 'threat' };
  }
  const tokens = normalized.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token === '__ncert_safe_term__') continue;
    if (EXACT_PROFANITY_SET.has(token)) return { isAbusive: true, severity: 'STANDARD_ABUSE', matchedToken: token };
  }
  for (const rx of SUBSTRING_ROOT_PATTERNS) {
    const match = normalized.match(rx);
    if (match) return { isAbusive: true, severity: 'STANDARD_ABUSE', matchedToken: match[0] };
  }
  return { isAbusive: false, severity: 'NONE', matchedToken: null };
}

function stabilizeLatexStream(raw, isStreaming = false) {
  if (!raw) return { cleanMarkdown: '', pendingEquation: null };
  let normalized = raw
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `$${eq.trim()}$`);
  if (!isStreaming) return { cleanMarkdown: normalized, pendingEquation: null };
  const blockDelimiters = normalized.match(/\$\$/g) || [];
  if (blockDelimiters.length % 2 !== 0) {
    const lastIdx = normalized.lastIndexOf('$$');
    return {
      cleanMarkdown: normalized.slice(0, lastIdx),
      pendingEquation: normalized.slice(lastIdx + 2).trim() || 'Formulating equation...',
    };
  }
  return { cleanMarkdown: normalized, pendingEquation: null };
}

const API_BASE = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('='.repeat(70));
  console.log('  EDURAIN AI ACADEMIC MENTOR — MASTER SYSTEM VERIFICATION');
  console.log('='.repeat(70));

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total} FAILED] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total} FAILED] ${name}:`, err.message);
      throw err;
    }
  }

  // 1. NCERT Whitelist Tests
  test('NCERT Biology & Physics Whitelist: "sex determination" must NOT be flagged', () => {
    const res = inspectStudentMessage('Explain sex determination in humans and chromosomes');
    assert.strictEqual(res.isAbusive, false, 'sex determination should be clean');
  });

  test('NCERT Whitelist: "retardation in physics" must NOT be flagged', () => {
    const res = inspectStudentMessage('Calculate the retardation of a vehicle coming to rest');
    assert.strictEqual(res.isAbusive, false, 'retardation should be clean');
  });

  test('NCERT Whitelist: "fertilisation in flowering plants" must NOT be flagged', () => {
    const res = inspectStudentMessage('What is double fertilisation and role of ovary?');
    assert.strictEqual(res.isAbusive, false, 'fertilisation and ovary should be clean');
  });

  // 2. Anti-Evasion Profanity Detection Tests
  test('Profanity Detection: Direct abusive word', () => {
    const res = inspectStudentMessage('kya be chutiya samajh rakha hai');
    assert.strictEqual(res.isAbusive, true);
    assert.strictEqual(res.severity, 'STANDARD_ABUSE');
  });

  test('Anti-Evasion: Dotted evasion "b.c."', () => {
    const res = inspectStudentMessage('chal b.c. yahan se');
    assert.strictEqual(res.isAbusive, true);
  });

  test('Anti-Evasion: Leetspeak "ch*tiya" & "m@darchod"', () => {
    const res1 = inspectStudentMessage('tu ch*tiya hai');
    assert.strictEqual(res1.isAbusive, true);
    const res2 = inspectStudentMessage('teri m@darchod harkatein');
    assert.strictEqual(res2.isAbusive, true);
  });

  test('Anti-Evasion: Character repetition "chuuuutiya"', () => {
    const res = inspectStudentMessage('chuuuutiya question hai');
    assert.strictEqual(res.isAbusive, true);
  });

  // 3. KaTeX Stream-Safe LaTeX Buffer Tests
  test('Stream-Safe LaTeX Buffer: Complete equation passes directly', () => {
    const text = 'Formula is $$\\Phi_B = B A \\cos\\theta$$ for magnetic flux.';
    const out = stabilizeLatexStream(text, true);
    assert.strictEqual(out.pendingEquation, null);
    assert(out.cleanMarkdown.includes('$$\\Phi_B = B A \\cos\\theta$$'));
  });

  test('Stream-Safe LaTeX Buffer: Incomplete $$ token is held in buffer without breaking parser', () => {
    const partial = '### 2. Formula\n$$\\Phi_B = \\vec{B} \\cdot';
    const out = stabilizeLatexStream(partial, true);
    assert.notStrictEqual(out.pendingEquation, null);
    assert.strictEqual(out.cleanMarkdown.trim(), '### 2. Formula');
  });

  // 4. Backend Endpoints Integration Tests
  const uniqueId = Math.floor(Math.random() * 800) + 100;
  const testHeaders = {
    'Content-Type': 'application/json',
    'x-forwarded-for': `10.10.10.${uniqueId}`,
  };

  await testAsync('Backend /quota endpoint returns hybrid quota & lockout info', async () => {
    const res = await fetch(`${API_BASE}/ai/doubt/quota`, { headers: testHeaders });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert(json.data.questionsLimit === 30);
    assert(json.data.minutesLimit === 60);
    assert.strictEqual(json.data.lockStatus.isLocked, false);
  });

  await testAsync('Backend Moderation Strike Escalation: Strike 1 -> Strike 2 -> Strike 3 (24h Ban)', async () => {
    // Strike 1
    const res1 = await fetch(`${API_BASE}/ai/moderation/strike`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ prompt: 'chutiya question', studentName: 'Test Student' }),
    });
    assert.strictEqual(res1.status, 400);
    const json1 = await res1.json();
    assert.strictEqual(json1.data.strikeCount, 1);
    assert.strictEqual(json1.data.action, 'WARN_1');
    assert(json1.data.message.includes('Warning 1/2'));

    // Strike 2
    const res2 = await fetch(`${API_BASE}/ai/moderation/strike`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ prompt: 'phir se madarchod bola', studentName: 'Test Student' }),
    });
    assert.strictEqual(res2.status, 400);
    const json2 = await res2.json();
    assert.strictEqual(json2.data.strikeCount, 2);
    assert.strictEqual(json2.data.action, 'WARN_2');
    assert(json2.data.message.includes('Final Warning 2/2'));

    // Strike 3 -> 24h Lockout
    const res3 = await fetch(`${API_BASE}/ai/moderation/strike`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ prompt: 'teesri baar bhenchod bola', studentName: 'Test Student' }),
    });
    assert.strictEqual(res3.status, 403);
    const json3 = await res3.json();
    assert.strictEqual(json3.data.strikeCount, 3);
    assert.strictEqual(json3.data.action, 'LOCKED_24H');
    assert.strictEqual(json3.data.isLocked, true);
    assert(json3.data.lockoutUntil > Date.now());

    // Subsequent stream request must immediately return 403 Forbidden
    const streamRes = await fetch(`${API_BASE}/ai/doubt/stream`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ prompt: 'now trying to ask doubt' }),
    });
    assert.strictEqual(streamRes.status, 403, 'Locked user must receive HTTP 403 Forbidden');
    const streamJson = await streamRes.json();
    assert.strictEqual(streamJson.error, 'Access Suspended');
  });

  const cleanHeaders = {
    'Content-Type': 'application/json',
    'x-forwarded-for': `10.20.30.${uniqueId}`,
  };

  await testAsync('Zero-Quota Routing: "hi" greeting streams Guru welcome without quota deduction', async () => {
    const qBeforeRes = await fetch(`${API_BASE}/ai/doubt/quota`, { headers: cleanHeaders });
    const qBefore = (await qBeforeRes.json()).data.questionsUsed;

    const streamRes = await fetch(`${API_BASE}/ai/doubt/stream`, {
      method: 'POST',
      headers: cleanHeaders,
      body: JSON.stringify({ prompt: 'Namaste sir' }),
    });
    assert.strictEqual(streamRes.status, 200);
    const text = await streamRes.text();
    assert(text.includes('Namaste!'), 'Greeting must return Guru welcome');

    const qAfterRes = await fetch(`${API_BASE}/ai/doubt/quota`, { headers: cleanHeaders });
    const qAfter = (await qAfterRes.json()).data.questionsUsed;
    assert.strictEqual(qAfter, qBefore, 'Zero quota should be deducted for greetings');
  });

  await testAsync('Zero-Quota Routing: Off-topic query streams academic redirection without quota deduction', async () => {
    const qBeforeRes = await fetch(`${API_BASE}/ai/doubt/quota`, { headers: cleanHeaders });
    const qBefore = (await qBeforeRes.json()).data.questionsUsed;

    const streamRes = await fetch(`${API_BASE}/ai/doubt/stream`, {
      method: 'POST',
      headers: cleanHeaders,
      body: JSON.stringify({ prompt: 'Which bollywood movie should I watch?' }),
    });
    assert.strictEqual(streamRes.status, 200);
    const rawSse = await streamRes.text();
    const accumulated = rawSse
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => {
        try {
          return JSON.parse(l.slice(6)).text || '';
        } catch {
          return '';
        }
      })
      .join('');

    assert(
      accumulated.includes('EduRain Academic Mentor'),
      'Off-topic query must redirect to academic mentor'
    );

    const qAfterRes = await fetch(`${API_BASE}/ai/doubt/quota`, { headers: cleanHeaders });
    const qAfter = (await qAfterRes.json()).data.questionsUsed;
    assert.strictEqual(qAfter, qBefore, 'Zero quota should be deducted for off-topic query');
  });

  console.log('='.repeat(70));
  console.log(`  ALL ${passed}/${total} VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
  console.log('='.repeat(70));
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
