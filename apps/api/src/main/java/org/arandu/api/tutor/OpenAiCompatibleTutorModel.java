package org.arandu.api.tutor;

import java.util.List;
import org.springframework.web.client.RestClient;

/** Calls an OpenAI-compatible {@code /chat/completions} endpoint. */
public class OpenAiCompatibleTutorModel implements TutorModel {

    record Request(String model, List<Message> messages, double temperature, int max_tokens) {
    }

    record Response(List<Choice> choices) {
        record Choice(Message message) {
        }
    }

    private final RestClient client;
    private final String model;

    public OpenAiCompatibleTutorModel(String baseUrl, String apiKey, String model) {
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
        this.model = model;
    }

    @Override
    public String complete(List<Message> messages) {
        Response res = client.post()
                .uri("/chat/completions")
                .body(new Request(model, messages, 0.4, 200))
                .retrieve()
                .body(Response.class);
        if (res == null || res.choices() == null || res.choices().isEmpty()) {
            throw new IllegalStateException("empty LLM response");
        }
        return res.choices().get(0).message().content().trim();
    }
}
