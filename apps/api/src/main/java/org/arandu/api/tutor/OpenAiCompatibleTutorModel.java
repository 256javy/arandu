package org.arandu.api.tutor;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import org.springframework.web.client.RestClient;

/**
 * Calls an OpenAI-compatible {@code /chat/completions} endpoint (Meta Model API, Fireworks, ...).
 * Muse Spark is a reasoning model: reasoning tokens count against {@code max_tokens}, so the budget
 * is generous and the reasoning effort is configurable.
 */
public class OpenAiCompatibleTutorModel implements TutorModel {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Request(String model, List<Message> messages, double temperature, int max_tokens,
                   String reasoning_effort) {
    }

    record Response(List<Choice> choices) {
        record Choice(Message message, String finish_reason) {
        }
    }

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(OpenAiCompatibleTutorModel.class);

    private final RestClient client;
    private final String model;
    private final String reasoningEffort;
    private final int maxTokens;

    public OpenAiCompatibleTutorModel(String baseUrl, String apiKey, String model, String reasoningEffort,
                                      int maxTokens) {
        this(RestClient.builder(), baseUrl, apiKey, model, reasoningEffort, maxTokens);
    }

    OpenAiCompatibleTutorModel(RestClient.Builder builder, String baseUrl, String apiKey, String model,
                               String reasoningEffort, int maxTokens) {
        this.client = builder
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
        this.model = model;
        this.reasoningEffort = reasoningEffort == null || reasoningEffort.isBlank() ? null : reasoningEffort;
        this.maxTokens = maxTokens;
    }

    String reasoningEffort() {
        return reasoningEffort;
    }

    int maxTokens() {
        return maxTokens;
    }

    /** Muse Spark occasionally answers with empty content; one retry, then the caller's error path (502). */
    @Override
    public String complete(List<Message> messages) {
        for (int attempt = 0; attempt < 2; attempt++) {
            String content = call(messages);
            if (content != null && !content.isBlank()) {
                return content.trim();
            }
            log.warn("empty LLM response from {} (attempt {})", model, attempt + 1);
        }
        throw new IllegalStateException("empty LLM response");
    }

    private String call(List<Message> messages) {
        Response res = client.post()
                .uri("/chat/completions")
                .body(new Request(model, messages, 0.4, maxTokens, reasoningEffort))
                .retrieve()
                .body(Response.class);
        if (res == null || res.choices() == null || res.choices().isEmpty()
                || res.choices().get(0).message() == null) {
            return null;
        }
        return res.choices().get(0).message().content();
    }
}
