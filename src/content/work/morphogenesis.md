---
title: "Morphogenesis Lab, Columbia"
role: "Research Assistant: built the GPU pipeline that turns microscope image stacks into 3D models"
summary: "A GPU pipeline that turns microscope image stacks into 3D models of the embryo neural tube"
chips: ["Computer vision", "Research", "nnU-Net"]
glance:
  - { label: "Role", value: "Research Assistant" }
  - { label: "When", value: "2025 to 2026, New York" }
  - { label: "Result", value: "2 hours to 5 minutes per stack" }
  - { label: "Built with", value: "Python, nnU-Net, SAM 2.1" }
---

## Context

The lab's finite-element simulations need the 3D shape of the embryo's neural tube, and that shape starts as a stack of microscope images:

- **My part:** I built the GPU pipeline that turns those stacks into 3D models

## How it works

Outline each slice, then stack the outlines:

- **Trained on the lab's own work:** a 2D nnU-Net learned from the lab's hand-traced slices
- **Two walls in every slice:** it outlines the inner and outer walls of the tube
- **Into 3D:** the slices stack into the geometry the lab's simulations use
- **On GPU:** training and inference both run there, using nnU-Net's self-configuring 2D setup

## The result

Hours of waiting became minutes:

- **Faster:** from 2 hours to 5 minutes for a 125-slice stack, about 24x faster
