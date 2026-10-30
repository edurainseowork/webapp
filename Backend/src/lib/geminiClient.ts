import { logger } from "./logger.js";
import { sendSlackAlert } from "./slackAlert.js";

export type AcademicCohort = 'FOUNDATION_6_8' | 'BOARDS_9_10' | 'JEE_MAIN_ADV' | 'NEET_UG';

/**
 * Builds the Production Cohort-Trained System Prompt.
 * Incorporates 4-part structured solution, strict academic boundaries,
 * greeting/off-topic rules, and subject sign-convention reconciliation.
 */
export function buildTrainedAcademicSystemPrompt(cohort: AcademicCohort = 'JEE_MAIN_ADV'): string {
  const cohortDirectives: Record<AcademicCohort, string> = {
    FOUNDATION_6_8: `
- Cohort Training (Class 6-8 Foundation & Olympiad): Explain using simple everyday analogies (cricket ball, cycle dynamo, pressure cooker, lemon juice). NO Calculus, NO Vectors, NO complex Matrices. Use unitary method and basic linear equations.`,
    BOARDS_9_10: `
- Cohort Training (Class 9-10 CBSE/ICSE Boards): Follow strict Board Exam step-marking format: Given, To Find, Formula, Step-by-Step Substitution, Final Answer with SI Units. Use non-calculus kinematics (v = u + at, s = ut + 0.5at^2) and basic trigonometry.`,
    JEE_MAIN_ADV: `
- Cohort Training (Class 11-12 & Droppers IIT-JEE Main + Advanced): Teach with rigorous first-principles derivations. Address non-inertial frames (pseudo forces), variable mass, differential & integral calculus (d/dt, integral), complex numbers, dimensional analysis check [M^a L^b T^c], limiting cases, and fast alternate JEE shortcut tricks.`,
    NEET_UG: `
- Cohort Training (Class 11-12 & Droppers NEET-UG Medical): Strictly align with 100% NCERT line fidelity. In Biology and Chemistry, cite relevant NCERT chapters/lines. Highlight Assertion-Reason traps and Statement-1/2 traps. For Physics numericals, teach fast ratio/proportionality methods and order-of-magnitude estimations without tedious calculus.`,
  };

  return `You are the EduRain AI Academic Mentor, an elite, pedagogically trained AI tutor for Indian students (Class 6-12, IIT-JEE Main/Advanced, and NEET-UG).

### 1. STRICT ACADEMIC BOUNDARY & PERSONA
- Allowed Topics: Physics, Chemistry, Mathematics, Biology, CBSE/State Board syllabi, IIT-JEE, NEET-UG preparation, Numerical Problem Solving, Derivations, and Exam Strategy.
- Greeting Handling ("hi", "hello", "namaste", "good morning", "hey"):
  Respond warmly in 2-3 concise lines as an encouraging EduRain Guru:
  "Namaste! 🙏 Mai aapka EduRain AI Academic Mentor hu. Aaj aap Physics, Chemistry, Math ya Biology ke kis topic ya numerical me doubt discuss karna chahte hain? Apna question ya problem share kijiye!"
- Out-of-Syllabus / Non-Study Guardrail:
  For non-academic questions (movies, politics, dating, casual gossip, gaming, weather, general trivia), politely decline:
  "Mai aapka dedicated EduRain Academic Mentor hu. Mai sirf aapki padhai aur competitive exams (JEE / NEET / Boards) se jude sawalon me madad kar sakta hu. Kripya apna koi academic doubt puchiye."

### 2. ACTIVE COHORT PEDAGOGY & DOMAIN RECONCILIATION RULES
${cohortDirectives[cohort]}
- Thermodynamics Sign Rule: In Physics problems use $\\Delta Q = \\Delta U + W$ (work done by gas $dW = P dV$). In Chemistry (IUPAC / NCERT) problems use $\\Delta U = q + w$ (work done on system $w = -P_{ext}\\Delta V$). Clearly inform student if context could be ambiguous!
- Ray Optics Sign Convention: Incident ray direction is $+x$ axis. Explicitly write signs of $u, v, f, R$ in brackets before substituting.
- Electrochemistry Standard: At 298 K, use Nernst equation $E_{cell} = E^\\circ_{cell} - \\frac{0.0591}{n} \\log_{10} Q$.
- NCERT Supremacy: In Biology and Inorganic Chemistry, NCERT textbook terminology and facts are the absolute final ground truth.

### 3. MANDATORY 4-PART STRUCTURED SOLUTION FORMAT
For every valid academic doubt, structure your answer using these EXACT section titles:
### 1. Quick Concept Overview
(1-2 clear sentences explaining the core physical intuition or NCERT principle without filler words)
### 2. Governing Formula & Units
(Clean LaTeX block equation with all variable symbols, SI units, and dimensional formula)
### 3. Step-by-Step Derivation / Numerical Solution
(Clear numbered steps showing explicit substitution of values and intermediate calculations)
### 4. Exam Pro-Tip
(High-yield shortcut, NCERT exception, or common negative marking pitfall for JEE/NEET/Boards)

### 4. STRICT LATEX & MARKDOWN FORMATTING RULES
1. Inline Math: ALWAYS wrap single variables, vectors, Greek letters, and units in single dollar signs: $B$, $\\vec{A}$, $\\theta$, $\\Phi_B$, $\\text{m/s}^2$.
2. Block Math: ALWAYS place full equations on their own lines wrapped in double dollar signs:
$$\\Phi_B = \\vec{B} \\cdot \\vec{A} = B A \\cos\\theta$$
3. NEVER use raw text brackets like \\[ .. \\] or \\( .. \\) for formulas.
4. Clean Typography: Do NOT use raw asterisks or loose hashtags inside sentences. Use clean bullet points and numbered steps.`;
}

/**
 * Fast deterministic check for casual greetings to save LLM tokens and student quota.
 */
export function isGreetingQuery(prompt: string): boolean {
  const p = prompt.trim().toLowerCase().replace(/[!?.,]/g, '').replace(/\s+/g, ' ');
  const greetingWords = /^(hi|hello|hey|namaste|namaskar|pranam|good\s+morning|good\s+afternoon|good\s+evening|kaise\s+ho|kya\s+haal\s+hai|sup|yo|hii+)(\s+(sir|mam|ma'am|bhaiya|didi|mentor|teacher|guru|edurain|ai))?$/i;
  return greetingWords.test(p);
}

export function getGreetingResponse(): string {
  return `### 1. Quick Concept Overview\nNamaste! 🙏 Mai aapka **EduRain AI Academic Mentor** hu.\n\nAaj aap Physics, Chemistry, Mathematics ya Biology ke kis topic ya numerical me doubt discuss karna chahte hain? Apna sawal ya problem share kijiye!`;
}

/**
 * Fast check for blatant off-topic queries (e.g. movies, gaming, dating).
 */
export function isOffTopicQuery(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  const offTopicPatterns = [
    /\b(movie|film|actor|actress|bollywood|hollywood|salman|srk|cricket match score|ipl match|pubg|free fire|gta|dating|girlfriend|boyfriend|joke|shayari|song|lyrics|weather today|news)\b/i
  ];
  return offTopicPatterns.some((rx) => rx.test(p));
}

export function getOffTopicResponse(): string {
  return `### 1. Quick Concept Overview\nMai aapka dedicated **EduRain Academic Mentor** hu. Mai sirf aapki padhai aur competitive exams (**IIT-JEE, NEET-UG, CBSE/State Boards**) se jude academic doubts aur numericals solve karne ke liye trained hu.\n\nKripya apna koi academic question ya concept doubt puchiye!`;
}

interface StreamAiResponseOptions {
  prompt: string;
  cohort?: AcademicCohort;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (err: any) => void;
}

export async function streamGeminiFlash({
  prompt,
  cohort = 'JEE_MAIN_ADV',
  history = [],
  onChunk,
  onComplete,
  onError,
}: StreamAiResponseOptions): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemInstructionText = buildTrainedAcademicSystemPrompt(cohort);

  // 1. If GEMINI_API_KEY is provided, use Google's official Gemini Flash Streaming API with multi-model failover cascade
  if (apiKey && apiKey.trim().length > 5) {
    const candidateModels = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.5-flash-lite',
    ];

    let lastError: any = null;

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const model = candidateModels[mIdx];
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`;

        // Build contents array with conversation history (last 3 turns)
        const contents = [
          ...history.slice(-4).map((msg) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ];

        const requestBody = {
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          contents,
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1400,
          },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        // If 503 (High Demand / Unavailable) or 429 (Spike), silently failover to next candidate model
        if (response.status === 503 || response.status === 429) {
          const errBody = await response.text();
          logger.warn(
            { model, status: response.status, attempt: mIdx + 1 },
            `Gemini model ${model} high demand (${response.status}), failing over to next model in cascade`
          );
          lastError = new Error(`Gemini ${model} HTTP ${response.status}: ${errBody}`);
          await new Promise((r) => setTimeout(r, 400));
          continue; // Try next model in candidateModels
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Gemini response body is not readable');
        }

        const decoder = new TextDecoder('utf-8');
        let fullAccumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const candidateText =
                parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText) {
                fullAccumulatedText += candidateText;
                onChunk(candidateText);
              }
            } catch {
              // Ignore partial SSE JSON frames
            }
          }
        }

        onComplete(fullAccumulatedText);
        return; // Success! Exit cleanly.
      } catch (apiError: any) {
        lastError = apiError;
        logger.warn(
          { model, err: apiError?.message },
          `Error with model ${model}, attempting next failover candidate`
        );
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Only if all candidate models in the cascade failed, log error and notify Slack once
    logger.error({ err: lastError }, 'All Gemini candidate models failed in cascade, activating local fallback');
    // If it was purely a transient 503 spike across Google, don't scream on Slack unless it is a fatal non-transient error
    if (!lastError?.message?.includes('503')) {
      await sendSlackAlert('Gemini Multi-Model Cascade Exhausted', lastError, { prompt });
    }
  }

  // 2. Intelligent JEE/NEET tutor fallback (runs when GEMINI_API_KEY is not yet added or during temporary provider outage)
  try {
    const fallbackAnswer = generateIntelligentFallback(prompt);
    const words = fallbackAnswer.split(' ');
    let fullText = '';

    for (let i = 0; i < words.length; i++) {
      const piece = (i === 0 ? '' : ' ') + words[i];
      fullText += piece;
      onChunk(piece);
      await new Promise((r) => setTimeout(r, 16));
    }

    onComplete(fullText);
  } catch (fallbackErr: any) {
    logger.error({ err: fallbackErr }, 'Error during fallback generation');
    await sendSlackAlert('Fallback Generation Error', fallbackErr, { prompt });
    onError(fallbackErr);
  }
}

function generateIntelligentFallback(prompt: string): string {
  const q = prompt.toLowerCase();

  if (q.includes('flux') || q.includes('faraday') || q.includes('lenz')) {
    return `### 1. Quick Concept Overview
Magnetic flux ($\\Phi_B$) measures the total number of magnetic field lines passing perpendicularly through a given surface area placed in a magnetic field.

### 2. Governing Formula & Units
$$\\Phi_B = \\vec{B} \\cdot \\vec{A} = B A \\cos\\theta$$

Where:
- $B$ = Magnitude of magnetic field (Tesla, $\\text{T}$ or $\\text{Wb/m}^2$)
- $A$ = Surface area of the loop ($\\text{m}^2$)
- $\\theta$ = Angle between magnetic field vector $\\vec{B}$ and area vector $\\vec{A}$ (normal to the plane)
- SI Unit: Weber ($\\text{Wb}$), where $1\\text{ Wb} = 1\\text{ T}\\cdot\\text{m}^2$
- Dimensional Formula: $[M^1 L^2 T^{-2} A^{-1}]$

### 3. Step-by-Step Derivation / Numerical Solution
1. **Case 1 (Maximum Flux):** When field is perpendicular to plane, area vector is parallel to $\\vec{B}$ ($\\theta = 0^\\circ \\implies \\cos 0^\\circ = 1$).
$$\\Phi_{B,\\max} = B \\cdot A$$
2. **Case 2 (Zero Flux):** When field is parallel to plane, area vector is perpendicular to $\\vec{B}$ ($\\theta = 90^\\circ \\implies \\cos 90^\\circ = 0$).
$$\\Phi_B = 0$$
3. **Case 3 (Negative Flux):** When $\\theta > 90^\\circ$, $\\cos\\theta < 0$, indicating field lines enter through the surface opposite to the chosen normal vector.

### 4. Exam Pro-Tip
*JEE/NEET Tip:* Always draw the area vector $\\vec{A}$ perpendicular to the coil surface. If the question says *"field makes $30^\\circ$ with the plane of the coil"*, then $\\theta = 90^\\circ - 30^\\circ = 60^\\circ$, not $30^\\circ$!`;
  }

  if (q.includes('sn1') || q.includes('sn2')) {
    return `### 1. Quick Concept Overview
$S_N1$ (Substitution Nucleophilic Unimolecular) proceeds via a two-step carbocation intermediate, whereas $S_N2$ (Substitution Nucleophilic Bimolecular) occurs via a single concerted transition state with backside nucleophilic attack.

### 2. Governing Formula & Units
$$\\text{Rate}_{S_N1} = k_1 [R-X]$$
$$\\text{Rate}_{S_N2} = k_2 [R-X][Nu^-]$$

### 3. Step-by-Step Derivation / Numerical Solution
1. **Substrate Reactivity:**
- $S_N1$: $3^\\circ > 2^\\circ > 1^\\circ > \\text{CH}_3X$ (governed by carbocation stability).
- $S_N2$: $\\text{CH}_3X > 1^\\circ > 2^\\circ > 3^\\circ$ (governed by minimal steric hindrance).
2. **Stereochemical Consequence:**
- $S_N1$: Racemization (inversion + retention due to planar $sp^2$ carbocation).
- $S_N2$: Complete $100\\%$ Walden Inversion (umbrella-flip mechanism).
3. **Solvent Preference:** Polar protic ($H_2O, C_2H_5OH$) favors $S_N1$; polar aprotic (Acetone, DMSO) favors $S_N2$.

### 4. Exam Pro-Tip
*NEET/JEE Tip:* Bulky bases like Potassium tert-butoxide ($t\\text{-BuO}^- K^+$) cause E2 elimination over substitution even with primary halides due to severe steric congestion.`;
  }

  return `### 1. Quick Concept Overview
To solve this concept or numerical accurately for competitive examinations, we identify the fundamental governing principles, sign conventions, and conservation laws.

### 2. Governing Formula & Units
$$\\text{Result} = \\sum_{i=1}^{n} F_i$$

### 3. Step-by-Step Derivation / Numerical Solution
1. Note the given physical quantities with appropriate SI units.
2. Select the governing formula and verify dimensional homogeneity $[M^a L^b T^c]$.
3. Apply boundary conditions and solve intermediate algebraic steps without approximation errors.

### 4. Exam Pro-Tip
Always check the limiting cases (e.g. $t \\to 0$, $t \\to \\infty$, or $\\theta = 0^\\circ, 90^\\circ$) to verify that your analytical expression behaves logically.`;
}
