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

    /** {@code missing} is a short hint of what the kid still has to add, or empty when nothing is missing. */
    public record Verdict(boolean ok, String reason, String missing) {

        /** Evidence detail: the reason plus, when present, what is missing so Musi can guide. */
        public String detail() {
            return missing == null || missing.isBlank() ? reason : reason + " Falta: " + missing;
        }
    }

    static final String SYSTEM = """
            Sos un evaluador de explicaciones de matemática de chicos de 9 a 12 años. Recibís una rúbrica y la \
            respuesta del chico. Decidí si la respuesta cumple la rúbrica, leyéndola en el contexto de la \
            pregunta (el chico puede nombrar las cosas como aparecen en la pregunta en vez de usar números).
            Criterio:
            - Importa la idea, no la forma. Ignorá faltas de ortografía, abreviaturas ("xq", "q"), falta de \
            tildes y palabras informales.
            - Una idea matemática correcta dicha con palabras propias cuenta como demostrada (ok true) aunque \
            sea informal o le falte detalle. Por ejemplo "es la misma parte del total", "es la misma \
            proporción", "ocupa lo mismo", "los pedazos son más chicos pero son más" son razones válidas.
            - La respuesta correcta sin ninguna razón NO alcanza (ok false), aunque la respuesta sea correcta.
            - Una razón falsa o que no tiene que ver (por ejemplo "porque 4 es más grande que 3", "porque tiene \
            números más chicos") NO alcanza aunque llegue a la respuesta correcta.
            - Pedir la respuesta, decir "no sé" o hablar de otra cosa NO alcanza.
            Respondé SOLO con JSON, sin texto extra:
            {"ok": true|false, "reason": "una oración en español que explique la decisión", \
            "missing": "si ok es false, en pocas palabras qué le falta a la explicación; si ok es true, vacío"}""";

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
            JsonNode missing = n.path("missing");
            return Optional.of(new Verdict(n.get("ok").asBoolean(), n.path("reason").asString(""),
                    missing.isString() ? missing.asString().strip() : ""));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }
}
