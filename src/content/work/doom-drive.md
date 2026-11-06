---
title: "Doom Drive: an offline AI that shows its sources"
role: "Side project: building it with a teammate, from the library pipeline to the answer engine and the app"
summary: "A USB drive with an offline library and an offline AI that answers from it and shows the exact sentences it used"
chips: ["Side project", "Offline AI", "RAG", "Safety evals", "Go"]
glance:
  - { label: "Role", value: "Side project, with a teammate" }
  - { label: "Runs on", value: "Laptops and phones, no internet" }
  - { label: "On the drive", value: "About 42 GB, 40 emergency guides" }
  - { label: "Status", value: "Guides still need EMT or nurse review" }
---

## What Doom Drive is

Plug it in, ask in plain language, and get an answer you can open back to its source, with no internet:

- **Ask:** an assistant that answers only from the library on the drive and shows the sentences it used
- **Emergency guides:** 40 first-aid guides that open at once, with no AI and no drive
- **The library:** about 42 GB, with 7.3M short Wikipedia articles, WikiMed, MedlinePlus and US government sources like CDC, EPA and FEMA
- **Also on the drive:** offline maps with routing, medicine labels, and battery and generator estimates
- **Where it runs:** Windows, Mac and Linux laptops, plus Android and iPhone apps, all on one Go core
- **The team:** it's a side project, and I'm building it with a teammate
- **Code:** private, happy to walk through it on a call

## Why we built it

When the network is gone, online apps stop working, and a chatbot running alone invents facts:

- **The job:** plug in, ask in plain language, and open the original source of any answer
- **The rule:** facts come only from the library, so the model can talk, but its own memory never counts as a fact

## Deciding what to build: what a small model can't be trusted with

The AI has to run on a laptop or a phone, so the design started with the evidence on small models:

- **Citations:** prompted 3 to 4B models score about 30 to 54 on citation quality, and Gemma 3 4B answered only 67% of grounded tasks
- **Sources:** in the MIRAGE study, RAG over Wikipedia alone scored below no RAG at all on medical questions, so the core set had to be real medical sources
- **What we left out:** WikiChat's 7 model calls per turn were too slow for phones, and GraphRAG, LightRAG, HyDE and query rewriting did worse with small models
- **The decision:** safety lives outside the model

## How an answer gets made

Route, search, answer, check, in that order:

- **Rules first:** a deterministic router catches emergencies, doses and child doses before any AI runs
- **Search:** SQLite full-text search plus meaning search on laptops, with a gate that can say the library doesn't cover it
- **A short leash:** the model gets nine whitelisted tools, up to three calls a turn
- **Every sentence checked:** each one must cite sources that exist, with its numbers and names inside the cited sentence; it gets one repair, then it's dropped or the answer abstains
- **Memory isn't evidence:** it can remember your 4-year-old for context, but never cite that as a fact
- **Open at the sentence:** any citation opens the original, scrolled to the quote
- **Work on the answer:** chips under each answer, like "Make it a checklist" and "Say it more simply"

![Ask answering a question about strokes: each sentence links to a quote, with the sources listed beside it](/work/doom-drive/ask.webp)
*Ask, in review mode with a test library and a stand-in for the model: this shows the layout, not model output. Each sentence links to a quote, and its source opens at that sentence*

## Emergencies and doses stay out of the model's hands

Some answers can't wait for a model, and can't be wrong:

- **Guides are never AI-written:** all 40 are built word for word from sources like CDC, NIOSH, FEMA, MedlinePlus topic summaries, Wikibooks and Wikipedia
- **Only what we can ship:** MedlinePlus encyclopedia pages are copyrighted, so the guides leave them out
- **They open with nothing else working:** the guides load into memory at startup, so they work with no AI and the drive unplugged
- **New guides can't steal a route:** the original 22 keep their emergency phrases, and a new guide never takes an older guide's urgent routing
- **Doses are quoted:** doses and medicine questions are never AI-written, and child doses come only from trusted pediatric sources
- **A call I changed:** medical and food answers began as quotes only, but a wall of quotes isn't an answer, so now the AI writes an explanation beside them, labelled, and a switch turns it off
- **Weak phones:** a phone with 6 GB of memory or less gets search, not a worse AI

![The Emergency guides list: the numbers to call first, then a search box and the guides](/work/doom-drive/emergency.webp)
*Emergency guides in the real app: no AI, no waiting, and the number to call first*

![A serious burn guide in emergency mode, one step at a time, with what to say when you call](/work/doom-drive/guide.webp)
*A guide in emergency mode: one step at a time, moving on by itself, with what to say when you call. The wording still needs clinical review*

## How we checked it

Safety gates over the full library, where any regression kills the change:

- **Adversarial:** 0 unsafe of 69
- **Doses:** 306 of 306 quoted, and 162 of 162 child doses
- **Emergencies:** 0 silent and 0 wrong of 605, with 0 of 429 typo misses
- **How old those are:** they're from 17 Oct, before the guides grew from 22 to 40 and medical answers became AI-written, so they need a re-run
- **Agent eval:** 108 of 114 on 24 Oct, with memory leakage 13 of 13; first text took 3.6 s at the median and 10.1 s at p90, and the target of under 2 s isn't met
- **Search:** on 200 gold questions, recall@20 rose from 0.665 with keywords alone to 0.73 with a meaning-search pilot
- **The app, as of 29 Oct:** Go tests green in 27 of 27 packages, 283 of 283 web unit tests, and all 462 browser layout checks, across phone and laptop sizes and both themes
- **A harsh test:** two persona testers, a rural prepper and a suburban parent, said they'd return it and praised only the emergency guides; the fixes went in, with no re-test on record yet
- **Numbers fixed in advance:** my teammate froze the gates for the next round of measurement before any result existed

## A rule I kept: be honest

For a drive that answers health questions, the limits belong on the page:

- **Not clinically reviewed yet:** all 40 guides still need an EMT or nurse to review them, the 18 new ones first, using a checklist that lists each sentence with its source, and the medical claims still need legal review
- **Weak spots we know about:** the drowning CPR wording, and the nosebleed, sprain, fainting, insect sting and poison ivy guides
- **It says when it doesn't know:** if the library doesn't cover something, it says so
- **Not all built:** as of 29 Oct, parts of the approved design are still missing, like Nearest emergency room
- **Not launched:** this is a working app on a test drive, not a product you can buy

![Asked something outside the library, it says the library doesn't answer this](/work/doom-drive/not-covered.webp)
*Asked about last night's World Cup, in review mode with the test library: it says so rather than guessing*

## What I learned

On a small model, safety can't be a prompt: it has to be code that runs before and after the model

- Passing the gates doesn't mean the app is good, so test with real conversations in the running app
- A good answer explains first, then shows its quotes, and never stops at the quotes
