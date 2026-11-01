package org.arandu.api.tutor;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Judges a kid's free-text explanation against an exercise rubric. The result becomes evidence with
 * medium confidence, since it is an LLM judgment and not a deterministic check.
 */
@Component
public class Assessor {

    public record Verdict(boolean ok, String reason) {
    }

    static final String SYSTEM = """
            Sos un evaluador de explicaciones de matemática de chicos de 9 a 12 años. Recibís una rúbrica y la \
            respuesta del chico. Decidí si la respuesta cumple la rúbrica. Sé justo con la ortografía y las \
            palabras informales: importa la idea. Respondé SOLO con JSON, sin texto extra: \
            {"ok": true|false, "reason": "una oración en español que explique la decisión"}""";

    private static final Pattern JSON = Pattern.compile("\\{.*}", Pattern.DOTALL);

    private final TutorModel model;
    private final ObjectMapper json;

    public Assessor(TutorModel model, ObjectMapper json) {
        this.model = model;
        this.json = json;
    }

    public Optional<Verdict> assess(String rubric, String answer) {
        String raw = model.complete(List.of(
                new TutorModel.Message("system", SYSTEM),
                new TutorModel.Message("user", "Rúbrica:\n" + rubric + "\n\nRespuesta del chico:\n" + answer)));
        return parse(raw);
    }

    Optional<Verdict> parse(String raw) {
        Matcher m = JSON.matcher(raw == null ? "" : raw);
        if (!m.find()) {
            return Optional.empty();
        }
        try {
            JsonNode n = json.readTree(m.group());
            if (!n.has("ok") || !n.get("ok").isBoolean()) {
                return Optional.empty();
            }
            return Optional.of(new Verdict(n.get("ok").asBoolean(), n.path("reason").asString("")));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }
}
