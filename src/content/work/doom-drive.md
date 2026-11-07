---
title: "Doom Drive: AI that runs on your own device"
role: "Side project with a teammate. I work on the library pipeline, the answer engine and the app."
summary: "Pocket hardware that runs AI locally on your laptop or phone with no internet. Every answer shows the exact sentences behind it."
chips: ["Side project", "Local AI", "Hardware", "RAG", "Safety evals"]
glance:
  - { label: "Role", value: "Side project, with a teammate" }
  - { label: "Runs on", value: "Laptops and phones, no internet" }
  - { label: "On the drive", value: "About 42 GB, 40 emergency guides" }
  - { label: "Status", value: "Not launched; guides need clinical review" }
---

## What Doom Drive is

Doom Drive is a pocket drive that holds a large offline library and an AI that runs on your own device. You plug it in, ask a question in plain language and get an answer with no internet. It runs on Windows, Mac and Linux laptops and has Android and iPhone apps, all on one Go core. The library is about 42 GB and includes Wikipedia, MedlinePlus and sources like the CDC and FEMA, and any citation opens the original, scrolled to the quote.

It's a side project I'm building with a teammate. The code is private, and I'm happy to walk through it on a call.

## Why safety sits outside the model

The AI has to fit on a laptop or a phone, and models that small aren't reliable with facts. In published tests, prompted models of 3 to 4 billion parameters score about 30 to 54 on citation quality. So the model is allowed to talk, but its own memory never counts as a fact, and code around it handles safety. A phone with 6 GB of memory or less gets search and no AI at all.

## How an answer gets made

A question goes through four steps. First a deterministic router, which is plain code with no AI, catches emergencies and dose questions. Next comes search, which combines full-text and meaning-based search, with a gate that can say the library doesn't cover the question. Then the model writes an answer, with nine whitelisted tools and up to three tool calls per turn. Last, every sentence is checked. It has to cite real sources, with its numbers and names inside the cited sentence, or it gets dropped.

![Ask answering a question about strokes: each sentence links to a quote, with the sources listed beside it](/work/doom-drive/ask.webp)
*Ask in review mode, with a test library and a stand-in for the model. The screen shows the layout, and the text isn't real model output.*

## Emergencies and doses

Emergency guides are never written by AI. All 40 are built word for word from sources like the CDC, FEMA and MedlinePlus. They load into memory at startup, so they still open with no AI and with the drive unplugged. Medicine questions are never AI-written either, and doses are quoted from the source.

![A serious burn guide in emergency mode, one step at a time, with what to say when you call](/work/doom-drive/guide.webp)
*A guide in emergency mode, one step at a time, with what to say when you call. The wording still needs clinical review.*

## How we checked it

We run safety tests over the full library, and any regression kills the change. There were 0 unsafe answers out of 69 adversarial tests. All 306 dose tests were quoted, along with all 162 child dose tests. Across 605 emergency tests there were 0 silent failures and 0 wrong answers.

Those numbers are from 17 October, before the guides grew from 22 to 40, so they need a re-run. All 40 guides still need review by an EMT or nurse. When the library doesn't cover something, the app says so. It works on a test drive today and hasn't launched.
