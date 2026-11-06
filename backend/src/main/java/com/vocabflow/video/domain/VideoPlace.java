package com.vocabflow.video.domain;

import java.time.Instant;

/** Where a learner stopped in a video, and when it was saved. */
public record VideoPlace(int seconds, Instant updatedAt) {}
