Autopilot mode: generates ONE article at a time at scheduled frequency, not pre-generated batches.

## Pipeline (generate-autopilot-article edge function)
1. Pre-verification: fetch all existing articles for the site to avoid repetition
2. AI generates unique topic based on site context + existing content
3. AI writes full article (800-1200 words HTML)
4. Post-verification: quality score 1-10, checks uniqueness, structure, length
5. Auto-correction: if score < 7, AI rewrites with fixes
6. Save + generate image
7. publish-scheduled publishes it and creates next placeholder

## Frontend flow
- Autopilot is 3 steps: mode → settings (frequency only) → confirmation
- No topic generation, no batch — just activates the loop
- Creates one placeholder article with mode="autopilot", frequency label stored

## Frequency format
- Stored as French label: "Tous les 3 jours", "Toutes les semaines", etc.
- Parsed by publish-scheduled to compute next date
