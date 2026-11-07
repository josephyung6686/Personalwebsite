---
title: "Morphogenesis Lab, Columbia"
role: "Research Assistant. I built the GPU pipeline that turns microscope image stacks into 3D models for finite element analysis."
summary: "A pipeline that turns microscope images of a chicken embryo's neural tube into 3D models, which the lab uses for finite element analysis."
chips: ["Computer vision", "Research", "nnU-Net", "Segmentation", "Finite element analysis"]
glance:
  - { label: "Role", value: "Research Assistant" }
  - { label: "When", value: "Nov 2025 to Jul 2026, New York" }
  - { label: "Result", value: "2 hours to 5 minutes per stack" }
  - { label: "Built with", value: "Python, nnU-Net, SAM 2.1" }
---

## What the lab needs

Columbia's Morphogenesis and Developmental Biomechanics Lab studies the mechanics of how embryos develop. One of its tools is finite element analysis, a way of simulating how a structure responds to forces by dividing its shape into many small pieces and solving the physics on each one. A simulation like that starts from the structure's real shape, so the lab needs accurate 3D geometry of the neural tube, the part of an embryo that later becomes the brain and spinal cord.

That geometry starts as a stack of fluorescence microscope images, one slice at a time, and getting from the images to a 3D model took about two hours of manual work per stack. I built the pipeline that automates it.

## How the pipeline works

The pipeline is three scripts that run in order, on a laptop or in Google Colab.

The first converts the 3D image stack and its inner and outer wall masks into a dataset for nnU-Net, a segmentation framework that configures its own model from the data. Every pixel in a slice gets one of three labels: background, lumen (the hollow center of the tube) or wall.

The second trains a 2D U-Net, a standard image segmentation model, on slices the lab had traced by hand. The data is split five ways for cross-validation. nnU-Net configured a network with 7 stages, 448 by 448 pixel patches and a batch size of 6.

The third runs the model on every slice and writes out lumen and wall masks, along with overlay images so a person can check them by eye. From there, centroid tracking, AI-guided segmentation and artifact filtering produce consistent tissue boundaries for the finite element simulations.

## Moving to a GPU

On a CPU, one training epoch took about 97 minutes, and the run was configured for 1,000 epochs. So training and inference moved to a free GPU on Colab, with a notebook that copies the model and results to Google Drive so they survive when the session disconnects.

Automating the work brought a stack from about 2 hours down to 5 minutes, roughly 24 times faster.

## What this page leaves out

I don't quote an accuracy score here, because the training log I still have stops after one CPU epoch, which isn't a real validation result. The lab's images and unpublished results belong to the lab, so this page only describes the pipeline.
