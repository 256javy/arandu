package org.arandu.api.tutor;

import java.util.List;
import java.util.Locale;

/** Offline stand-in used when META_API_KEY is empty. */
public class MockTutorModel implements TutorModel {

    @Override
    public String complete(List<Message> messages) {
        if (messages.getFirst().content().equals(Assessor.SYSTEM)) {
            // Judge only the kid's answer: the rubric in the same message mentions "falta" and "mitad" too.
            String answer = kidAnswer(messages.getLast().content()).toLowerCase(Locale.ROOT);
            boolean ok = answer.contains("porque") || answer.contains("mitad") || answer.contains("falta");
            return "{\"ok\": " + ok + ", \"reason\": \"(mock) busca una razón en la respuesta\"}";
        }
        if (messages.getFirst().content().equals(org.arandu.api.family.SpotlightService.SYSTEM)) {
            return "(mock) Esta semana tu hijo/a practicó fracciones. Probá repartir una pizza en casa.";
        }
        return "Mirá bien lo que hiciste: ¿qué te dice cada parte?";
    }

    static String kidAnswer(String content) {
        int start = content.indexOf(Assessor.OPEN);
        int end = content.lastIndexOf(Assessor.CLOSE);
        return start >= 0 && end > start ? content.substring(start + Assessor.OPEN.length(), end) : content;
    }
}
