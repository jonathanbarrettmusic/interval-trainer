# Interval Trainer

A browser-based musical interval training app for ABRSM and Trinity Guildhall theory exam preparation, Grades 1–8.

## Features

- **Identify mode** — a notated interval is shown; select the correct name
- **Build mode** — a root note and target interval are given; select the completing note
- Intervals rendered on a real stave using [VexFlow](https://www.vexflow.com/)
- Covers all ABRSM/Trinity syllabus intervals from Grade 1 (unqualified 2nds–5ths) through Grade 8 (compound and chromatic intervals, alto clef)
- Session score and streak tracking
- No build tools, no backend — fully client-side

## File structure

```
interval-trainer/
├── index.html   — markup and filter controls
├── style.css    — layout and visual design
├── script.js    — interval logic, question generation, VexFlow rendering, UI wiring
└── README.md
```

## Running locally

```bash
npx serve .
```

Then open `http://localhost:3000`.

## Deployment

The repo is configured for direct deployment via [Vercel](https://vercel.com). Connect the GitHub repository in the Vercel dashboard and deploy — no build command or output directory configuration needed.

## Syllabus coverage

| Grade | Intervals | Quality | Clef | Direction |
|-------|-----------|---------|------|-----------|
| 1–2   | 2nd–5th   | Number only | Treble, Bass | Above |
| 3–4   | 2nd–8th   | Number only | Treble, Bass | Above |
| 5     | 2nd–8th   | Major, minor, Perfect, Aug, Dim | Treble, Bass | Above & below |
| 6–8   | All + 9th/10th | All qualities | Treble, Bass, Alto | Above & below |
