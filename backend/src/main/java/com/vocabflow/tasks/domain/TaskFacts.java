package com.vocabflow.tasks.domain;

/** What is possible for the user on a day; decides which variable tasks can be offered. */
public record TaskFacts(
    int dailyGoal,
    int ratedToday,
    int studyableWords,
    int dueReviews,
    int gameWords,
    boolean articleAvailable,
    boolean videoAvailable) {}
