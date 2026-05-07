/* ═══════════════════════════════════════════════════════════════
   script.js — Interval Trainer
   Architecture:
     INTERVALS — note math, semitone arithmetic, quality naming
     SYLLABUS  — grade-based interval pools, root-note pools
     QUESTIONS — question + distractor generation
     RENDERER  — VexFlow stave rendering (step 3)
     UI        — event handlers, score state, DOM updates
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════════════════
//  INTERVALS
// ═══════════════════════════════════════════════════════════════

const LETTER_ORDER     = ['C','D','E','F','G','A','B'];
const LETTER_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const ACC_SEMITONES    = { '##':2, '#':1, '':0, 'b':-1, 'bb':-2 };
const ACC_FROM_OFFSET  = { '-2':'bb', '-1':'b', '0':'', '1':'#', '2':'##' };

// Expected semitones at major/perfect quality for each interval number
const BASE_SEMITONES = { 1:0, 2:2, 3:4, 4:5, 5:7, 6:9, 7:11, 8:12, 9:14, 10:16 };

// Perfect-family intervals (P/A/d) vs major-minor family (M/m/A/d)
const PERFECT_FAMILY = new Set([1, 4, 5, 8]);

const QUALITY_LABELS = {
  P:'Perfect', M:'Major', m:'Minor',
  A:'Augmented', d:'Diminished',
};

const NUMBER_LABELS = {
  1:'Unison', 2:'2nd', 3:'3rd', 4:'4th', 5:'5th',
  6:'6th',   7:'7th', 8:'Octave', 9:'9th', 10:'10th',
};

function noteToMidi({ letter, accidental, octave }) {
  return (octave + 1) * 12 + LETTER_SEMITONES[letter] + ACC_SEMITONES[accidental];
}

function noteToDiatonic({ letter, octave }) {
  return octave * 7 + LETTER_ORDER.indexOf(letter);
}

function noteLabel({ letter, accidental, octave }) {
  return `${letter}${accidental}${octave}`;
}

// VexFlow key string, e.g. "f#/4"
function vexKey({ letter, accidental, octave }) {
  return `${letter.toLowerCase()}${accidental}/${octave}`;
}

function qualityToSemitoneAdj(quality, number) {
  if (PERFECT_FAMILY.has(number)) {
    return { dd:-2, d:-1, P:0, A:1, AA:2 }[quality] ?? 0;
  }
  return { d:-2, m:-1, M:0, A:1, AA:2 }[quality] ?? 0;
}

function semitoneDevToQuality(dev, number) {
  if (PERFECT_FAMILY.has(number)) {
    return { '-2':'dd', '-1':'d', '0':'P', '1':'A', '2':'AA' }[String(dev)] ?? null;
  }
  return { '-2':'d', '-1':'m', '0':'M', '1':'A', '2':'AA' }[String(dev)] ?? null;
}

// Calculate the interval between lower and upper (lower must have lower MIDI).
function calcInterval(lower, upper) {
  const diatDist  = noteToDiatonic(upper) - noteToDiatonic(lower);
  const semiDist  = noteToMidi(upper) - noteToMidi(lower);
  const number    = Math.abs(diatDist) + 1;
  const dev       = Math.abs(semiDist) - (BASE_SEMITONES[number] ?? 0);
  const quality   = semitoneDevToQuality(dev, number);
  return { number, quality, semitones: Math.abs(semiDist) };
}

function buildNoteAbove(root, number, quality) {
  const rootIdx   = LETTER_ORDER.indexOf(root.letter);
  const steps     = number - 1;
  const targetIdx = (rootIdx + steps) % 7;
  const octaveInc = Math.floor((rootIdx + steps) / 7);
  const letter    = LETTER_ORDER[targetIdx];
  const octave    = root.octave + octaveInc;
  const semitones = BASE_SEMITONES[number] + qualityToSemitoneAdj(quality, number);
  const natMidi   = (octave + 1) * 12 + LETTER_SEMITONES[letter];
  const accOffset = noteToMidi(root) + semitones - natMidi;
  return { letter, accidental: ACC_FROM_OFFSET[String(accOffset)] ?? '', octave };
}

function buildNoteBelow(root, number, quality) {
  const rootIdx   = LETTER_ORDER.indexOf(root.letter);
  const steps     = number - 1;
  const targetIdx = ((rootIdx - steps) % 7 + 7) % 7;
  const octaveDec = Math.ceil((steps - rootIdx) / 7);
  const letter    = LETTER_ORDER[targetIdx];
  const octave    = root.octave - octaveDec;
  const semitones = BASE_SEMITONES[number] + qualityToSemitoneAdj(quality, number);
  const natMidi   = (octave + 1) * 12 + LETTER_SEMITONES[letter];
  const accOffset = noteToMidi(root) - semitones - natMidi;
  return { letter, accidental: ACC_FROM_OFFSET[String(accOffset)] ?? '', octave };
}

function intervalLabel(number, quality, showQuality) {
  if (!showQuality) return NUMBER_LABELS[number] ?? `${number}th`;
  return `${QUALITY_LABELS[quality] ?? quality} ${NUMBER_LABELS[number] ?? `${number}th`}`;
}

function intervalExplanation(number, quality, lower, upper, showQuality) {
  const semitones = BASE_SEMITONES[number] + qualityToSemitoneAdj(quality, number);
  const label     = intervalLabel(number, quality, showQuality);
  const semiStr   = `${semitones} semitone${semitones !== 1 ? 's' : ''}`;
  return `A ${label} spans ${semiStr}. ${noteLabel(lower)} → ${noteLabel(upper)} = ${semiStr}.`;
}

// ═══════════════════════════════════════════════════════════════
//  SYLLABUS
// ═══════════════════════════════════════════════════════════════

// All intervals in scope, tagged with the grade at which they are introduced.
const INTERVAL_POOL = [
  { number:4, quality:'P', gradeIntro:1 },
  { number:5, quality:'P', gradeIntro:1 },
  { number:2, quality:'M', gradeIntro:1 },
  { number:3, quality:'M', gradeIntro:1 },
  { number:6, quality:'M', gradeIntro:3 },
  { number:7, quality:'M', gradeIntro:3 },
  { number:8, quality:'P', gradeIntro:3 },
  { number:2, quality:'m', gradeIntro:5 },
  { number:3, quality:'m', gradeIntro:5 },
  { number:6, quality:'m', gradeIntro:5 },
  { number:7, quality:'m', gradeIntro:5 },
  { number:4, quality:'A', gradeIntro:6 },  // tritone (augmented 4th)
  { number:5, quality:'d', gradeIntro:6 },  // tritone (diminished 5th)
  { number:2, quality:'A', gradeIntro:6 },  // augmented 2nd
  { number:7, quality:'d', gradeIntro:6 },  // diminished 7th
  { number:9, quality:'M', gradeIntro:6 },
  { number:9, quality:'m', gradeIntro:6 },
  { number:10,quality:'M', gradeIntro:6 },
  { number:10,quality:'m', gradeIntro:6 },
];

// Per-grade configuration
const GRADE_CONFIG = {
  1: { showQuality:false, dirs:['above'] },
  2: { showQuality:false, dirs:['above'] },
  3: { showQuality:false, dirs:['above'] },
  4: { showQuality:false, dirs:['above'] },
  5: { showQuality:true,  dirs:['above','below'] },
  6: { showQuality:true,  dirs:['above','below'] },
  7: { showQuality:true,  dirs:['above','below'] },
  8: { showQuality:true,  dirs:['above','below'] },
};

function getIntervalPool(grade, qualityFilter) {
  const cfg = GRADE_CONFIG[grade];
  return INTERVAL_POOL.filter(iv => {
    if (iv.gradeIntro > grade) return false;
    if (!cfg.showQuality || qualityFilter === 'all') return true;
    if (qualityFilter === 'perfect'     && iv.quality !== 'P') return false;
    if (qualityFilter === 'major-minor' && !['M','m'].includes(iv.quality)) return false;
    if (qualityFilter === 'aug-dim'     && !['A','d'].includes(iv.quality)) return false;
    if (qualityFilter === 'diatonic'    &&  ['A','d'].includes(iv.quality)) return false;
    return true;
  });
}

// Root note pools — notes from which intervals will be built.
// 'simple' = Grade 1–4 (naturals only, single octave range).
// 'full'   = Grade 5+ (adds accidentals, wider pitch range).
const ROOT_POOLS = {
  treble: {
    simple: [
      {letter:'C',accidental:'',octave:4},{letter:'D',accidental:'',octave:4},
      {letter:'E',accidental:'',octave:4},{letter:'F',accidental:'',octave:4},
      {letter:'G',accidental:'',octave:4},{letter:'A',accidental:'',octave:4},
      {letter:'B',accidental:'',octave:4},{letter:'C',accidental:'',octave:5},
    ],
    full: [
      {letter:'C',accidental:'',octave:4},{letter:'D',accidental:'',octave:4},
      {letter:'E',accidental:'',octave:4},{letter:'F',accidental:'',octave:4},
      {letter:'G',accidental:'',octave:4},{letter:'A',accidental:'',octave:4},
      {letter:'B',accidental:'',octave:4},{letter:'C',accidental:'',octave:5},
      {letter:'D',accidental:'',octave:5},
      {letter:'C',accidental:'#',octave:4},{letter:'D',accidental:'#',octave:4},
      {letter:'F',accidental:'#',octave:4},{letter:'G',accidental:'#',octave:4},
      {letter:'D',accidental:'b',octave:4},{letter:'E',accidental:'b',octave:4},
      {letter:'G',accidental:'b',octave:4},{letter:'A',accidental:'b',octave:4},
      {letter:'B',accidental:'b',octave:4},
    ],
  },
  bass: {
    simple: [
      {letter:'C',accidental:'',octave:3},{letter:'D',accidental:'',octave:3},
      {letter:'E',accidental:'',octave:3},{letter:'F',accidental:'',octave:3},
      {letter:'G',accidental:'',octave:3},{letter:'A',accidental:'',octave:3},
      {letter:'B',accidental:'',octave:3},{letter:'C',accidental:'',octave:4},
    ],
    full: [
      {letter:'E',accidental:'',octave:2},{letter:'F',accidental:'',octave:2},
      {letter:'G',accidental:'',octave:2},{letter:'A',accidental:'',octave:2},
      {letter:'B',accidental:'',octave:2},{letter:'C',accidental:'',octave:3},
      {letter:'D',accidental:'',octave:3},{letter:'E',accidental:'',octave:3},
      {letter:'F',accidental:'',octave:3},{letter:'G',accidental:'',octave:3},
      {letter:'A',accidental:'',octave:3},{letter:'B',accidental:'',octave:3},
      {letter:'C',accidental:'',octave:4},
      {letter:'F',accidental:'#',octave:2},{letter:'C',accidental:'#',octave:3},
      {letter:'B',accidental:'b',octave:2},{letter:'E',accidental:'b',octave:3},
      {letter:'A',accidental:'b',octave:3},{letter:'B',accidental:'b',octave:3},
    ],
  },
  alto: {
    simple: [
      {letter:'C',accidental:'',octave:4},{letter:'D',accidental:'',octave:4},
      {letter:'E',accidental:'',octave:4},{letter:'F',accidental:'',octave:4},
      {letter:'G',accidental:'',octave:4},{letter:'A',accidental:'',octave:4},
    ],
    full: [
      {letter:'C',accidental:'',octave:4},{letter:'D',accidental:'',octave:4},
      {letter:'E',accidental:'',octave:4},{letter:'F',accidental:'',octave:4},
      {letter:'G',accidental:'',octave:4},{letter:'A',accidental:'',octave:4},
      {letter:'B',accidental:'b',octave:3},{letter:'B',accidental:'',octave:3},
      {letter:'C',accidental:'#',octave:4},{letter:'F',accidental:'#',octave:4},
      {letter:'B',accidental:'b',octave:4},{letter:'E',accidental:'b',octave:4},
    ],
  },
};

function getRootPool(clef, grade) {
  const c = ROOT_POOLS[clef] ?? ROOT_POOLS.treble;
  return grade >= 5 ? c.full : c.simple;
}

// ═══════════════════════════════════════════════════════════════
//  QUESTIONS
// ═══════════════════════════════════════════════════════════════

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build 3 distractor interval labels distinct from the correct one.
// Preference order: same number / different quality → adjacent number → other.
function buildIntervalDistractors(correctNumber, correctQuality, pool, showQuality) {
  const correctLabel = intervalLabel(correctNumber, correctQuality, showQuality);

  const byPriority = pool
    .map(iv => ({ iv, label: intervalLabel(iv.number, iv.quality, showQuality) }))
    .filter(({ label }) => label !== correctLabel);

  const unique = [];
  const seen   = new Set([correctLabel]);
  for (const { iv, label } of byPriority) {
    if (seen.has(label)) continue;
    seen.add(label);
    const priority = iv.number === correctNumber ? 0
                   : Math.abs(iv.number - correctNumber) === 1 ? 1 : 2;
    unique.push({ label, priority });
  }

  unique.sort((a, b) => a.priority - b.priority || Math.random() - 0.5);
  return unique.slice(0, 3).map(x => x.label);
}

// Build 3 distractor note labels for Build mode.
function buildNoteDistractors(correctNote, root, dir, iv, pool) {
  const correctMidi = noteToMidi(correctNote);
  const seen        = new Set([noteLabel(correctNote)]);
  const distractors = [];

  // Use adjacent-number intervals as primary distractors
  const adjacent = shuffle(
    pool.filter(p => !(p.number === iv.number && p.quality === iv.quality))
        .sort((a, b) => Math.abs(a.number - iv.number) - Math.abs(b.number - iv.number))
  );

  for (const adj of adjacent) {
    if (distractors.length >= 3) break;
    const note = dir === 'above'
      ? buildNoteAbove(root, adj.number, adj.quality)
      : buildNoteBelow(root, adj.number, adj.quality);
    if (!note || noteToMidi(note) === correctMidi) continue;
    if (!ACC_FROM_OFFSET.hasOwnProperty(String(noteToMidi(note) - ((note.octave + 1) * 12 + LETTER_SEMITONES[note.letter])))) continue;
    const lbl = noteLabel(note);
    if (!seen.has(lbl)) { seen.add(lbl); distractors.push(lbl); }
  }

  return distractors;
}

/**
 * Generate a question object.
 * Returns null if no valid question can be constructed with the current settings.
 */
function generateQuestion({ grade, clef, direction, mode, qualityFilter }) {
  const cfg      = GRADE_CONFIG[grade];
  const pool     = getIntervalPool(grade, qualityFilter);
  if (!pool.length) return null;

  const rootPool = getRootPool(clef, grade);
  const validDirs = direction === 'both'
    ? cfg.dirs
    : [direction].filter(d => cfg.dirs.includes(d));
  if (!validDirs.length) return null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const iv   = pick(pool);
    const dir  = pick(validDirs);
    const root = pick(rootPool);

    const top = dir === 'above'
      ? buildNoteAbove(root, iv.number, iv.quality)
      : buildNoteBelow(root, iv.number, iv.quality);

    // Reject if resulting accidental is out of double-sharp/flat range
    const natMidi   = (top.octave + 1) * 12 + LETTER_SEMITONES[top.letter];
    const accOffset = noteToMidi(top) - natMidi;
    if (!ACC_FROM_OFFSET.hasOwnProperty(String(accOffset))) continue;

    const lower = dir === 'above' ? root : top;
    const upper = dir === 'above' ? top  : root;

    if (mode === 'identify') {
      const correctLabel = intervalLabel(iv.number, iv.quality, cfg.showQuality);
      const distractors  = buildIntervalDistractors(iv.number, iv.quality, pool, cfg.showQuality);
      const options      = shuffle([correctLabel, ...distractors]).slice(0, 4);
      if (options.length < 2) continue;

      return {
        mode: 'identify', clef, direction: dir,
        lower, upper, root,
        interval: iv, showQuality: cfg.showQuality,
        correctLabel, options,
        explanation: intervalExplanation(iv.number, iv.quality, lower, upper, cfg.showQuality),
        prompt: 'Name the interval shown.',
      };
    } else {
      // Build mode
      const correctLabel = noteLabel(top);
      const distractors  = buildNoteDistractors(top, root, dir, iv, pool);
      const options      = shuffle([correctLabel, ...distractors]).slice(0, 4);
      if (options.length < 2) continue;
      const dirWord = dir === 'above' ? 'above' : 'below';

      return {
        mode: 'build', clef, direction: dir,
        lower, upper, root,
        interval: iv, showQuality: cfg.showQuality,
        correctLabel, options,
        explanation: intervalExplanation(iv.number, iv.quality, lower, upper, cfg.showQuality),
        prompt: `Write a note a <strong>${intervalLabel(iv.number, iv.quality, cfg.showQuality)}</strong> ${dirWord} <strong>${noteLabel(root)}</strong>.`,
      };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  RENDERER  — VexFlow stave rendering
//
//  note1 : always shown (lower note in identify, root in build)
//  note2 : second note shown as a chord; null = single notehead
//           (build mode withholds it until the student answers)
// ═══════════════════════════════════════════════════════════════

function renderStave(note1, note2, clef, container) {
  container.innerHTML = '';

  if (typeof Vex === 'undefined') {
    container.innerHTML = '<p style="color:#c00;font-size:0.82rem;text-align:center">VexFlow failed to load.</p>';
    return;
  }

  try {
    const VF = Vex.Flow;
    const W  = 300, H = 185;

    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    // staveY = 68 leaves ~68 px above for ledger lines on high notes
    const stave = new VF.Stave(10, 68, W - 20);
    stave.addClef(clef);
    stave.setContext(ctx).draw();

    // Build a StaveNote. When note2 is given, display as a chord (both
    // noteheads at the same rhythmic position — standard for interval notation).
    const keys = note2 ? [vexKey(note1), vexKey(note2)] : [vexKey(note1)];
    const sn   = new VF.StaveNote({ clef, keys, duration: 'w' });

    [note1, note2].forEach((n, i) => {
      if (!n || !n.accidental) return;
      const acc = new VF.Accidental(n.accidental);
      // VexFlow 4.x uses addModifier(modifier, index); 3.x uses addAccidental(index, modifier)
      typeof sn.addModifier === 'function'
        ? sn.addModifier(acc, i)
        : sn.addAccidental(i, acc);
    });

    // A single whole note fills exactly one 4/4 bar — no strict-mode issue.
    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables([sn]);
    new VF.Formatter().joinVoices([voice]).format([voice], W - 80);
    voice.draw(ctx, stave);

    // Make the SVG scale down on narrow screens while capping at its natural width
    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', '100%');
      svg.style.maxWidth  = `${W}px`;
      svg.style.height    = 'auto';
    }

  } catch (err) {
    container.innerHTML = `<p style="color:#c00;font-size:0.82rem;text-align:center">Notation error: ${err.message}</p>`;
    console.error('VexFlow:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
//  UI
// ═══════════════════════════════════════════════════════════════

const state = {
  score:    0,
  attempts: 0,
  streak:   0,
  answered: false,
  question: null,
};

const $ = id => document.getElementById(id);

function readSettings() {
  return {
    mode:          $('sel-mode').value,
    grade:         Number($('sel-grade').value),
    clef:          $('sel-clef').value,
    direction:     $('sel-direction').value,
    qualityFilter: $('sel-quality').value,
  };
}

function updateScore() {
  $('score-display').textContent  = `${state.score} / ${state.attempts}`;
  $('streak-display').textContent = state.streak;
}

function renderQuestion(q) {
  state.question = q;
  state.answered = false;

  $('question-prompt').innerHTML = q.prompt;
  $('feedback').textContent      = '';
  $('feedback').className        = 'feedback';
  $('btn-next').hidden           = true;

  // Identify: show both notes as a chord. Build: show only the root — the
  // student selects the second note; it is revealed after they answer.
  const sn1 = q.mode === 'identify' ? q.lower : q.root;
  const sn2 = q.mode === 'identify' ? q.upper : null;
  renderStave(sn1, sn2, q.clef, $('stave-container'));

  const answersEl = $('answers');
  answersEl.innerHTML = '';
  q.options.forEach(label => {
    const btn     = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => handleAnswer(label));
    answersEl.appendChild(btn);
  });
}

function handleAnswer(chosen) {
  if (state.answered) return;
  state.answered = true;
  state.attempts++;

  const q       = state.question;
  const correct = chosen === q.correctLabel;
  const fbEl    = $('feedback');

  if (correct) { state.score++; state.streak++; }
  else         { state.streak = 0; }

  // Reveal the complete interval on the stave (matters for build mode)
  renderStave(q.lower, q.upper, q.clef, $('stave-container'));

  fbEl.className   = `feedback ${correct ? 'correct' : 'incorrect'}`;
  fbEl.textContent = `${correct ? '✓ Correct.' : '✗ Incorrect.'} ${q.explanation}`;

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === q.correctLabel) btn.classList.add(correct ? 'correct' : 'reveal');
    else if (btn.textContent === chosen)    btn.classList.add('incorrect');
  });

  updateScore();
  $('btn-next').hidden = false;
}

function newQuestion() {
  const q = generateQuestion(readSettings());
  if (!q) {
    $('question-prompt').textContent = 'No intervals match these settings — try adjusting the filters.';
    $('answers').innerHTML           = '';
    $('stave-container').innerHTML   = '';
    $('btn-next').hidden             = true;
    return;
  }
  renderQuestion(q);
}

// ── Grade change: enforce syllabus constraints on other controls ──

function applyGradeConstraints() {
  const grade   = Number($('sel-grade').value);
  const clefEl  = $('sel-clef');
  const dirEl   = $('sel-direction');
  const qualEl  = $('sel-quality');

  // Alto clef: Grade 5+
  clefEl.querySelector('option[value="alto"]').disabled = grade < 5;
  if (grade < 5 && clefEl.value === 'alto') clefEl.value = 'treble';

  // Direction: only "above" for Grades 1–4
  dirEl.querySelectorAll('option').forEach(o => {
    o.disabled = grade < 5 && o.value !== 'above';
  });
  if (grade < 5) dirEl.value = 'above';

  // Quality filter: not meaningful until Grade 5 (intervals unnamed by quality)
  qualEl.disabled = grade < 5;
  if (grade < 5) qualEl.value = 'all';
}

// ── Boot ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  $('sel-grade').addEventListener('change', applyGradeConstraints);
  $('btn-new').addEventListener('click',   newQuestion);
  $('btn-next').addEventListener('click',  newQuestion);
  $('btn-reset').addEventListener('click', () => {
    state.score = state.attempts = state.streak = 0;
    updateScore();
    newQuestion();
  });

  applyGradeConstraints();
  updateScore();
  // Start with a question so the page is immediately interactive
  newQuestion();
});
