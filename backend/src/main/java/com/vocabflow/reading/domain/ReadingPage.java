package com.vocabflow.reading.domain;

import java.util.List;

public record ReadingPage(
    List<ReadingPassage> content, int page, int size, long totalElements, int totalPages) {}
