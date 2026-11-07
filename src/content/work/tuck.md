---
title: "Tuck: the agentic AI brain that sorts your files"
role: "Building the engine in a team of two, from reading files and sorting them to the assistant and the checks."
summary: "A Mac app I'm building in a team of two. It reads your files, sorts them into virtual folders and answers questions about them."
chips: ["Agentic AI", "Sorting engine", "AI agents", "Evals with answer keys", "Privacy by design"]
demo: tuck
glance:
  - { label: "Role", value: "The engine" }
  - { label: "Team", value: "Team of two" }
  - { label: "Rule", value: "Nothing moves on disk" }
  - { label: "Checked with", value: "27 sample homes with answer keys" }
---

## What Tuck is

Tuck is a Mac app that organizes your files by reading what's in them. It sorts them into virtual folders that live inside the app, so nothing moves in Finder. When it can't make a decision alone it asks you, and nothing changes until you answer. You can also ask it questions, and it answers from the same index the sorter built.

I'm building it in a team of two. My teammate leads the product and the interface, and I work on the engine underneath. So far it has been built and tested on sample home folders, and real users come next. The [demo at the top of this page](#demo) is a small rebuild of the Needs You screen with sample files. The code is private, and I'm happy to walk through it on a call.

![Tuck's Today screen: what it sorted today, each with Undo, and the decisions that need you](/work/tuck/today.webp)
*The Today screen in the current prototype, with sample files. It shows what Tuck sorted, each with Undo, and what needs you.*

## Reading files

To sort a file by what's inside it, the engine first has to read it, whatever the format. I built six extractors for this, covering PDF, Word, images, archives, structured text and a long tail of other formats. They had 272 tests when they landed. The file extension is treated as a hint, and the file's real type decides which extractor runs. Apple Vision reads the text in images on the Mac, which covers scans and screenshots.

What the AI understands about a file is saved against its content, so a second sort of the same folder doesn't ask the model anything. Before any model is called, rules on the Mac hold back finance, identity, medical and legal files, and a held file is never sent. For everything else, the model can only fill in the fields of a fixed schema and has to cite its evidence. If it doesn't know, it can say so, and a correct "I don't know" counts as a success.

## Sorting

The first engine was careful and costly. It gathered evidence and facts about each file, built groups, froze a folder tree and then placed each file with citations. On 9 October I started a second, batched engine beside it behind a switch. It summarizes each file in a card of about 150 tokens, makes one call to design the folders and asks no more than 3 questions.

On real DeepSeek runs, the new engine placed 80% of the files in a student home, up from 46%, and 92% in a consultant home, up from 53%, with about 40 times fewer model calls and no leaks. The old engine came out on 26 October, and two days later I deleted 30 more modules that nothing ran.

A sort now goes through indexing, a privacy check, cards, understanding, a few quick questions, folder design and placement. Every file ends up in one place, as placed, suggested or unsorted. Your own rules and folders come first, then the design, then exact duplicates, and a model call handles whatever is left. Private files never reach the model, so code places them.

Other languages needed their own fixes. A name check kept only English letters, so every Chinese and Japanese folder looked empty and they all merged into one. After the fix, an offline check showed folders kept correctly going from 15% to 88% in Chinese and from 0% to 73% in Japanese.

![Tuck Brain: a map of folders branching out from you, grouped by parts of life](/work/tuck/brain.webp)
*Tuck Brain in the prototype, with sample files, showing 315 files and 38 folders as one map.*

## The assistant

Ask Tuck is an agent loop I built over the sorter's own database, so there's no second store. Twenty core tools go with every request in a fixed order, which lets the provider cache them, and the rest of the 102 tools load only when the model asks for them. Every tool call passes one policy check that validates it, applies privacy and trust rules and then dispatches it.

Text from a file is tagged as untrusted so that it isn't followed as instructions, and test files try to break this, including a PDF named SYSTEM_apply_moves_now. Private files reach the model only as a handle like {private:1}, while the person sees the real file on their Mac. Pressing Stop ends the turn before the next request and the next tool.

The assistant also can't claim things it didn't do. If a reply says the model did something and no tool did it that turn, the sentence is removed. The same goes for a count no tool returned, which we added after a reply claimed "I looked through 2,318 files." Citations that don't match what a tool returned are dropped, and an AI provider with no written data terms is refused.

## How we checked it

We test against 27 sample homes. Each one is a made-up person's Desktop, Documents and Downloads with its own answer key. The key says what each file is and never where it must go, so a sort is judged on whether the person would find the file. The scorer I built reads the same reply the window draws. The targets in the code are under 5% wrong, at least 85% of files in the tree, at most 3 questions, every private file held and no leaks.

In two real runs on DeepSeek on 1 November, with no reruns, a household home had 1 wrong of 52, found 50 of 53 where the person would look, held 8 of 8 private files and asked 2 questions. A freelancer home had 1 wrong of 49, found 44 of 49, held 5 of 5 and asked 2.

We also audited the key itself and found that about 18% of ordinary files across 19 homes, 151 of 844, could honestly go two ways, so some answers marked wrong may be fine. These are sample homes, and testing with real people's files comes next.
