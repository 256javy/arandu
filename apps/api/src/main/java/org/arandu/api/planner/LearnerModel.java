package org.arandu.api.planner;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Per-skill learner state built from evidence. Mastery is an exponential moving average where each
 * piece of evidence pulls the estimate toward 1 (ok) or 0 (not ok), weighted by its confidence:
 * a deterministic check moves it more than an LLM judgment.
 */
public final class LearnerModel {

    public enum Status { NEW, PRACTICING, STUCK, LIKELY, MASTERED }

    /** Minimal view of a stored evidence row. */
    public record Observation(String skill, boolean ok, String confidence, String exercise, String detail,
                              Instant at) {
    }

    public record SkillState(String skill, int attempts, int successes, double mastery, Status status,
                             String lastExercise, String lastDetail, String lastConfidence) {
    }

    static final double RATE = 0.5;
    static final double MASTERED_AT = 0.5;

    private final Map<String, SkillState> skills;
    private final String lastExercise;

    private LearnerModel(Map<String, SkillState> skills, String lastExercise) {
        this.skills = skills;
        this.lastExercise = lastExercise;
    }

    static double weight(String confidence) {
        return switch (confidence) {
            case "high" -> 1.0;
            case "medium" -> 0.6;
            default -> 0.3;
        };
    }

    /** Builds the model from observations in chronological order. */
    public static LearnerModel of(List<Observation> observations) {
        Map<String, List<Observation>> bySkill = new LinkedHashMap<>();
        for (String s : ExerciseCatalog.SKILLS) {
            bySkill.put(s, new ArrayList<>());
        }
        String last = null;
        for (Observation o : observations) {
            bySkill.computeIfAbsent(o.skill(), k -> new ArrayList<>()).add(o);
            last = o.exercise();
        }
        Map<String, SkillState> states = new LinkedHashMap<>();
        bySkill.forEach((skill, obs) -> states.put(skill, state(skill, obs)));
        return new LearnerModel(states, last);
    }

    private static SkillState state(String skill, List<Observation> obs) {
        if (obs.isEmpty()) {
            return new SkillState(skill, 0, 0, 0, Status.NEW, null, null, null);
        }
        double m = 0;
        int ok = 0;
        for (Observation o : obs) {
            m += RATE * weight(o.confidence()) * ((o.ok() ? 1 : 0) - m);
            if (o.ok()) {
                ok++;
            }
        }
        Observation last = obs.getLast();
        Status status;
        if (last.ok() && m >= MASTERED_AT) {
            status = Status.MASTERED;
        } else if (last.ok()) {
            status = Status.LIKELY;
        } else if (obs.size() >= 2 && !obs.get(obs.size() - 2).ok()) {
            status = Status.STUCK;
        } else {
            status = Status.PRACTICING;
        }
        return new SkillState(skill, obs.size(), ok, m, status, last.exercise(), last.detail(), last.confidence());
    }

    public List<SkillState> skills() {
        return List.copyOf(skills.values());
    }

    public SkillState skill(String skill) {
        return skills.get(skill);
    }

    public String lastExercise() {
        return lastExercise;
    }
}
