package org.arandu.api.tutor;

import java.util.List;
import java.util.Locale;

/** Offline stand-in used when META_API_KEY is empty. */
public class MockTutorModel implements TutorModel {

    @Override
    public String complete(List<Message> messages) {
        if (messages.getFirst().content().equals(Assessor.SYSTEM)) {
            String answer = messages.getLast().content().toLowerCase(Locale.ROOT);
            boolean ok = answer.contains("porque") || answer.contains("mitad") || answer.contains("falta");
            return "{\"ok\": " + ok + ", \"reason\": \"(mock) busca una razón en la respuesta\"}";
        }
        if (messages.getFirst().content().equals(org.arandu.api.family.SpotlightService.SYSTEM)) {
            return "(mock) Esta semana tu hijo/a practicó fracciones. Probá repartir una pizza en casa.";
        }
        return "Mirá bien lo que hiciste: ¿qué te dice cada parte?";
    }
}
