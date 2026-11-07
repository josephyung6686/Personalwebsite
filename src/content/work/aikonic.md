---
title: "Aikonic: AI features for a voice notes product"
role: "Software Engineering Intern. I worked on search and agent tools, memory, the podcast pipeline, the desktop app, and the web and mobile apps."
summary: "Aikonic sells translation earbuds and an AI note app. I spent a month working on the AI and product features behind them."
chips: ["RAG", "Agent tools", "Multilingual search", "AI pipelines", "Desktop and mobile"]
demo: aikonic
glance:
  - { label: "Role", value: "Software Engineering Intern" }
  - { label: "When", value: "July 2026, Singapore" }
  - { label: "Search used by", value: "10,000+ people" }
  - { label: "Implemented", value: "Hybrid search and 21 agent tools" }
---

## What Aikonic is

Aikonic makes earbuds that translate in real time and record calls, along with an app that turns those recordings into transcripts, summaries and podcasts. People use it to search what was said in their meetings and documents.

I interned there in July 2026 and worked on five parts of the product: search and agent tools, memory, the podcast pipeline, the desktop app, and the web and mobile apps.

## Search and agent tools

The assistant answers questions about your recordings using retrieval-augmented generation. The system cuts each transcript into short segments and turns each one into an embedding, a list of numbers that captures its meaning. When you ask something, it pulls the most relevant segments for the language model to read. More than 10,000 people use this search.

Vector search of that kind is good at finding related ideas and less reliable on exact names, numbers and technical terms. I implemented hybrid retrieval, which runs keyword search and vector search in parallel and merges the results into one ranking using a method called Reciprocal Rank Fusion. If the embedding service goes down, keyword search keeps working. I also improved citations, so an answer stays traceable to a specific recording and timestamp, and a citation that hasn't resolved doesn't appear as a clickable source.

The chunking had a problem that only showed up outside English. The original code estimated a transcript's length by splitting on spaces, which works reasonably well in English and fails in Chinese and Japanese, where words aren't consistently separated by spaces. A whole Japanese meeting could read as one short segment, which produced one oversized chunk and a timestamp nobody could use. I worked on the chunking so that segments and timestamps function more reliably across languages.

I also developed the tool layer that lets the assistant take actions in the app as well as answer questions. I defined 21 tool calls, each limited to one narrow job. They cover these areas:

- generating a podcast episode from a recording or a folder
- producing or regenerating a meeting summary
- editing transcript and summary files
- moving and reorganizing recordings between folders
- triggering correction and memory operations
- managing recordings through chat commands

Every tool is scoped to a folder, so the assistant can only read or change recordings in the folder or workspace the current conversation can access. That prevents a query in one person's workspace from reaching another person's data. Search and the tools share one orchestration layer and have regression tests.

## Memory

I also explored Aikonic's memory architecture. Search finds what was said before. A memory system has to represent what the product currently understands to be true and how that has changed, because job titles change, deadlines move and decisions get reversed.

I worked with a temporal versioning model for this and applied temporal fact versioning. When a fact changes, the old version is kept and marked as superseded. The system records when each fact became valid, when it was retired and which fact replaced it, so the product can reconstruct what it understood at a particular point in time.

I also ran into a timing problem between pipeline stages. I wanted a meeting summary to reference facts extracted from the same meeting, but summarization and fact extraction run as separate stages, and extraction can't be guaranteed to finish first. Making one stage wait on the other would have been fragile, so I redesigned the context flow so the summary uses information that is guaranteed to exist, such as facts from a participant's earlier meetings. That reduced race conditions, the bugs where a result depends on which stage happens to finish first.

## The podcast pipeline

Aikonic can turn a meeting into a podcast. The feature originally used one model for the whole job, and a single prompt asking one model to plan, structure, write and pace an episode often gives generic or inconsistent results. I converted it into a pipeline with separate stages:

- context analysis, which finds the main themes and decides the episode's focus
- script generation, which turns that analysis into a structured script
- director notes, which add instructions for pacing, emphasis, transitions, delivery and tone
- text-to-speech, which turns the script into audio
- a duration policy, which shortens or expands the content to fit the requested length

Each stage can now be evaluated, replaced and debugged on its own, so when an episode goes wrong the system can identify the stage responsible.

Text-to-speech was the largest processing cost, and the whole script used to go through it as one sequential request. I divided the script into independent segments, processed them concurrently and put the audio back together in order, which cut generation time by about three times. Because the audio now comes in segments, you can start listening to the first one while the later ones are still generating.

## The desktop app

On the desktop app I worked on device connection, authentication, real-time translation, recording reliability and user feedback, and I added most of the app's features.

The device talks to a computer over two separate channels. Its microphone connects through classic Bluetooth as a standard audio device, so apps like Microsoft Teams and Zoom can use it directly. The Aikonic app talks to the same device through Bluetooth Low Energy for recording controls, transcription, translation and device management. Several early bugs came from treating these as one connection. Separating the two connection states improved device detection, recording controls and recovery.

For recording and translation sessions, I focused on how long people feel they are waiting. Network round trips can't be eliminated, but much of the setup can happen before anyone is waiting on it. The app pre-warms connections before they're needed, overlaps session setup with other startup work, reconnects automatically when a connection drops, and does less blocking work during the visible startup.

## The web and mobile apps

A large part of this work came from feedback from another team at the company. In several cases a feature already existed but failed silently or wasn't fully exposed in the interface. The mobile note screen, for example, already had structured data for summaries and to-do items, but to-dos couldn't stay marked as done, and summaries appeared as flat text even though the data had block types.

I implemented persistent completion states for to-dos, improved how structured summaries render, and added clearer feedback when an action fails. I also exposed existing features more consistently in the interface and improved translations, localization and interface consistency.

## About the demo

The demo at the top of this page is my own reimagining of these features, built with invented sample data. It is separate from Aikonic's product.
