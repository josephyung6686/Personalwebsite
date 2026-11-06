---
title: "Tuck: a file app people can trust"
role: "Cofounder: building the engine with my cofounder, from reading files and sorting them to the assistant and the checks"
summary: "A macOS app I'm building with my cofounder: an autonomous file organizer and an AI brain for your computer"
chips: ["Cofounder", "Sorting engine", "AI agents", "Evals with answer keys", "Privacy by design"]
demo: tuck
glance:
  - { label: "Role", value: "Cofounder, on the engine" }
  - { label: "Team", value: "Two cofounders" }
  - { label: "Built first", value: "FileMind, my own file sorter" }
  - { label: "Checked with", value: "27 sample homes with answer keys" }
---

## Links

- **Interactive demo:** [at the top of this page](#demo), a small rebuild of Needs You with sample files
- **Code:** private, happy to walk through it on a call

## What Tuck is

An autonomous file organizer and an AI brain for your Mac, built with my cofounder:

- **Organizes for you:** files go into virtual folders, and nothing moves in Finder
- **Asks only when it has to:** the decisions it can't make alone wait in Needs You, and nothing changes until you answer
- **Answers from your files:** Ask Tuck finds and explains files from the same index the sorter built
- **Who does what:** my cofounder leads the product and the interface, and I work on the engine underneath
- **Status:** built and tested on sample home folders, real users next

![Tuck's Today screen: what it sorted today, each with Undo, and the decisions that need you](/work/tuck/today.webp)
*Today, in the current prototype with sample files: what Tuck sorted, each with Undo, and what needs you*

## Where it started: FileMind

Before Tuck I built FileMind, a desktop file sorter of my own, and two failures from it shaped everything after:

- **The goal:** "a memory, not a filing cabinet": understand what's in every file, organize new arrivals by content and never by name alone, and find anything from a plain description in under 2 seconds
- **What I built:** an app that reads each file and designs folders from what's inside, on Electron, React, FastAPI and Python, with crash-resumable ingestion, SQLite full-text search and local MiniLM embeddings in ChromaDB
- **An early rule:** "local to narrow, AI to decide," with GraphRAG, MemGPT and RAPTOR rejected as more than it needed
- **Failure one, too bold:** an early version auto-moved 968 files, a journaled undo put them all back, and read-only became the default
- **Failure two, too careful:** the next classifier, V16, abstained on about 80% of files, so it organized almost nothing, and I rejected it
- **The pivot:** I wrote the spec for V17, where the model sees one table with a row per file and never the raw files, to avoid context rot; subagents survey the table, three propose competing folder trees, a judge picks one, then others assign and audit
- **Who owns the rules:** deterministic Python holds every invariant, so the model proposes and code decides what gets saved
- **How it held up:** 150 real files through the production loop on GLM-5.2 made 23 folders, all 10 sensitive files went to review with none auto-moved, and 31 uncertain files came down to 3 questions
- **Then a bigger test:** a preview on a real corpus of about 13,000 files exposed two engine defects, and after the fixes the full suite of 1,157 tests passed with no regressions
- **What carried into Tuck:** the model works from a card for each file, code owns the rules, and Tuck goes a step further on safety: nothing moves at all

## What "nothing moves on disk" means in the code

A promise only counts if the code can't break it:

- **A sort is rows, not moves:** a placement is a row in one SQLite database, and Finder keeps opening the file at its original path
- **A wall between packages:** a test parses every file in the graph package and fails if any of them imports the code that moves files
- **The old move path is off:** the engine can still move files, behind explicit flags and with an undo for all of it, but moving files from the app is off in this version
- **The one exception:** Trash asks first, and Undo puts the file back
- **Undo on the rest:** every sort shows up in History with its own Undo

![Needs You: one decision, the twelve files it covers, where they would go and why](/work/tuck/needs-you.webp)
*Needs You, in the prototype with sample files: one decision, the files it covers, why, and "Nothing moves on disk"*

![History: every sort and every choice, each with an Undo button](/work/tuck/history.webp)
*History: every sort and every choice, each with Undo*

![The Finder view with a Sorted by Tuck switch](/work/tuck/finder.webp)
*Finder stays as it is: the same files in the same place, with a switch to Tuck's view*

## Reading files: what the engine knows

To sort by what's inside a file, the engine has to read it, in any format, without trusting it, and I built those readers:

- **Six extractors:** PDF, Word, images, archives, structured text and a long tail of other formats, all emitting one shape, with 272 tests when they landed
- **Routed by content:** the file extension is only a signal, and the real file type picks the extractor
- **Scans and screenshots too:** Apple Vision reads the text in images on the Mac
- **Read once:** what the AI understood is saved by content, so a second sort of the same folder asks the model nothing
- **Private stays here:** rules on the Mac hold finance, identity, medical and legal files before any model is called, and a held file is never sent
- **Cite it or say unknown:** the model can only fill fields in a fixed schema, must cite its evidence, and a correct "I don't know" counts as a success

## Sorting: two engines, one rewrite

The first engine was careful and costly, so I started a second one beside it and let the numbers decide:

- **The first engine:** a long spec, part by part, with evidence, facts, groups built from bounded neighbourhoods, then a frozen tree and cited placements
- **The second engine:** on 9 Oct I started a batched one behind a switch, with cards of about 150 tokens, one design call, and no more than 3 questions
- **What decided it:** on real DeepSeek, a student home went from 46% to 80% placed and a consultant home from 53% to 92%, with about 40x fewer model calls and 0 leaks
- **Then cleaning up:** the old engine came out on 26 Oct, and I deleted 30 more modules nothing ran on 28 Oct
- **The stages now:** index, privacy gate, cards, understanding, quick questions, folder design, placement, then whatever is left for you
- **Every file gets one place:** placed, suggested or unsorted, with your own rules and folders first, then the design, then exact duplicates, then a model call for what's left
- **Private files never reach the model:** code alone places them
- **Other languages:** a name check kept only English letters, so every Chinese and Japanese folder looked empty and merged into one; after the fix, folders kept right went from 15% to 88% in Chinese and 0% to 73% in Japanese, on an offline check

![Tuck Brain: a map of folders branching out from you, grouped by parts of life](/work/tuck/brain.webp)
*Tuck Brain, in the prototype with sample files: 315 files and 38 folders as one map*

## The assistant: tools over the same files

Ask Tuck is an agent loop I built over the sorter's own database, with no second store:

- **Tools on demand:** 20 core tools go with every request, in a fixed order so the provider can cache them, and the rest of the 102 load only when the model asks
- **One gate:** every tool call passes a single policy check: validate, then privacy and trust, then dispatch
- **File text is data, not orders:** text from a file is tagged untrusted, and test files try to break that, like a PDF named SYSTEM_apply_moves_now
- **Private files stay handles:** the model sees "{private:1}", never the name, and the person sees the real file on their Mac
- **Stop means stop:** Stop ends the turn before the next request and the next tool

## A rule I kept: be honest

An assistant that says it did something it didn't is worse than one that does nothing:

- **No claim without a tool:** a sentence saying the model did something goes, if no tool did it that turn
- **No invented numbers:** a sentence with a count no tool returned goes too, after a reply claimed "I looked through 2,318 files"
- **Citations must be real:** a citation that doesn't match what a tool returned is dropped
- **Nothing made up about providers:** each AI provider's data terms are written down, and an unknown provider is refused rather than described

## How we checked it

27 sample homes, each a made-up person's Desktop, Documents and Downloads, each with its own answer key:

- **The key says what a file is:** never where it must go, so a sort is judged on whether the person would find the file
- **Scored on what the window shows:** the scorer I built reads the same reply the window draws
- **Targets in code:** under 5% wrong, at least 85% of files in the tree, at most 3 questions, every private file held, no leaks
- **Not V16 again:** that in-the-tree target means a sort can't pass by leaving most files unsorted
- **Two real runs on DeepSeek, 1 Nov, none rerun:** a household home had 1 wrong of 52, found 50 of 53 where the person would look, held 8 of 8 private files and asked 2 questions; a freelancer home had 1 wrong of 49, found 44 of 49, held 5 of 5 and asked 2
- **Checking the key itself:** an audit of 19 homes found about 18% of ordinary files, 151 of 844, could honestly go two ways, so a "wrong" isn't always wrong
- **What this doesn't tell you:** these are sample homes, not real people's files, and testing with real users is next

## What I learned

The model was never the hard part: deciding what it's never allowed to do was

- Too bold moved 968 files, too careful organized almost nothing, and what worked was a plan you can undo
- Give the model less, a table or a card, and let code own the rules
- An eval is only as honest as its answer key, so check the key too
