package com.vocabflow.reading.domain;

import java.util.List;

/** What a provider wrote: {@code words} are the target terms that the text uses, all of them. */
public record ReadingContent(String title, String body, List<String> words) {}
