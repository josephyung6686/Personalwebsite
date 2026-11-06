---
title: "SPADE at NutriGene AI"
role: "Applied AI Intern: co-built SPADE, designed and benchmarked the models and decision rules"
summary: "A system that plans stem-cell manufacturing experiments for Shanghai Pharmaceuticals, and knows when it is confident enough to recommend"
chips: ["Gaussian processes", "Benchmarks", "Knowing when to hold off"]
demo: spade
link: { label: "View the repo", href: "https://github.com/akwnn/nutrigene-ai-bo-ipsec" }
glance:
  - { label: "Role", value: "Applied AI Intern" }
  - { label: "When", value: "2026 to now, Hong Kong" }
  - { label: "Result", value: "10-round recipe quality in 5 rounds" }
  - { label: "Benchmark", value: "92,400 simulated evaluations" }
---

## Context

SPADE plans stem-cell manufacturing experiments for Shanghai Pharmaceuticals, and I co-built it:

- **The question:** not only which single recipe is best, but which range of production settings holds up
- **Why that's different:** a best tested condition and a range you can defend answer different scientific questions
- **My part:** I designed and benchmarked the Gaussian-process models and the decision rules that determine when SPADE is confident enough to recommend a range, and when it should hold off

## How SPADE decides

Each round chooses the next experiments, then the system decides whether it can say anything yet:

- **The model:** Gaussian-process level-set models over a six-factor space
- **Spending wells in rounds:** the benchmarks use 48 wells, opened with 16 and followed by four rounds of 8
- **The certificate:** conservative excursion-set estimation certifies a region of settings
- **Holding off is an answer:** when the wells don't support a region, SPADE returns nothing rather than a weak range
- **Built with:** Python, BoTorch and GPyTorch

## How we checked it

Against BoTorch's noisy Bayesian optimization, in simulation:

- **Fewer rounds:** it reached 10-round recipe quality in 5 rounds, across 92,400 simulated evaluations
- **What that means exactly:** no detectable difference in regret between SPADE at 5 rounds and the comparison at 10

## A rule I kept: be honest

A planning tool for a lab is only useful if it's clear about what it has and hasn't shown:

- **"No detectable difference" is not "beats":** the project's claim ledger forbids saying SPADE beats Bayesian optimization on regret
- **Every number needs a source:** a number only enters the paper with a claim ID, a committed result and the code that produced it
- **Simulated so far:** these are benchmarks, and SPADE hasn't yet been validated in a prospective wet-lab campaign
- **Not new theory:** the ingredients are established, and the work is in fitting them to a fixed-well cell assay and testing them

## About the demo

The demo at the top of this page is my reimagining of the idea, not the company's product:

- **Sample data:** nothing in it comes from a client
- **Try this:** step through the rounds and watch when it holds off and when it recommends a range
