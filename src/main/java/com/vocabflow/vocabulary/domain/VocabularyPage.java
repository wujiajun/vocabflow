package com.vocabflow.vocabulary.domain;

import java.util.List;

public record VocabularyPage(
    List<UserVocabulary> content, int page, int size, long totalElements, int totalPages) {}
