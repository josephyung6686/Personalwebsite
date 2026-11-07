---
title: "SPADE at NutriGene AI"
role: "Applied AI Intern. I co-built SPADE and designed and benchmarked its models and decision rules."
summary: "A system that plans stem-cell manufacturing experiments for Shanghai Pharmaceuticals and decides when it is confident enough to recommend settings."
chips: ["Gaussian processes", "Benchmarks", "Knowing when to hold off"]
demo: spade
link: { label: "View the repo", href: "https://github.com/akwnn/nutrigene-ai-bo-ipsec" }
glance:
  - { label: "Role", value: "Applied AI Intern" }
  - { label: "When", value: "2026 to now, Hong Kong" }
  - { label: "Result", value: "10-round recipe quality in 5 rounds" }
  - { label: "Benchmark", value: "92,400 simulated evaluations" }
---

## What SPADE is

SPADE plans stem-cell manufacturing experiments for Shanghai Pharmaceuticals. Manufacturing depends on six production factors at once, and each experiment uses up lab wells. Point optimization looks for the single best recipe. SPADE looks for a range of settings that holds up, because a best tested condition and a range you can defend answer different scientific questions.

I co-built it. I designed and benchmarked the Gaussian-process models and the decision rules that determine when SPADE is confident enough to recommend a range and when it should hold off. A Gaussian process is a statistical model that estimates a result, and how uncertain that estimate is, at settings it hasn't tried.

## How SPADE decides

SPADE works in rounds, and each round chooses the next experiments. The benchmarks use 48 wells, starting with 16 and followed by four rounds of 8. It fits Gaussian-process level-set models across the six factors, which estimate where results clear the target, and then uses conservative excursion-set estimation to certify a region of settings. When the wells don't support a region, SPADE returns nothing and doesn't recommend a weak range. It's built in Python with BoTorch and GPyTorch.

## How we checked it

I benchmarked SPADE in simulation against BoTorch's noisy Bayesian optimization, across 92,400 simulated evaluations. SPADE reached 10-round recipe quality in 5 rounds. More exactly, there was no detectable difference in regret, a measure of how far a result falls short of the best possible, between SPADE at 5 rounds and the comparison at 10. The project's claim ledger forbids saying SPADE beats Bayesian optimization on regret, and a number only enters the paper with a claim ID, a committed result and the code that produced it.

SPADE hasn't yet been validated in a prospective wet-lab campaign, so these remain simulated results. The ingredients are established methods, and the project's contribution is fitting them to a fixed-well cell assay and testing them.

## About the demo

The demo at the top of this page is my own reimagining of the idea, using sample data. It is separate from the company's product, and nothing in it comes from a client.
