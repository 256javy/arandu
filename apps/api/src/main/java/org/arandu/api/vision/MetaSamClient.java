package org.arandu.api.vision;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Calls {@code sam-3.1} on the Meta Responses API. The image goes inline as a base64 data URL (never
 * a public URL, never the Files API), with {@code store=false}, and masks come back {@code one_bit}
 * (1.5-3 KB per image instead of ~70 KB lossless). Nothing about the request is logged.
 */
public class MetaSamClient implements SamClient {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Content(String type, String text, String image_url) {
    }

    record Message(String type, String role, List<Content> content) {
    }

    record Request(String model, List<Message> input, Map<String, String> metadata, boolean store) {
    }

    record Response(List<Output> output) {
        record Output(String type, List<Content> content) {
        }
    }

    private final RestClient client;

    public MetaSamClient(String baseUrl, String apiKey, Duration timeout) {
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(timeout);
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    @Override
    public String segment(byte[] image, String mediaType, String prompt) {
        String dataUrl = "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(image);
        Request req = new Request("sam-3.1",
                List.of(new Message("message", "user", List.of(
                        new Content("input_text", prompt, null),
                        new Content("input_image", null, dataUrl)))),
                Map.of("mask_encoding", "one_bit", "include_confidence", "true"),
                false);
        Response res;
        try {
            res = client.post().uri("/responses").body(req).retrieve().body(Response.class);
        } catch (RestClientException e) {
            // The exception message may echo the request; report only its type.
            throw new SamUnavailableException("SAM call failed: " + e.getClass().getSimpleName());
        }
        if (res == null || res.output() == null) {
            throw new SamUnavailableException("empty SAM response");
        }
        StringBuilder text = new StringBuilder();
        for (Response.Output o : res.output()) {
            if ("message".equals(o.type()) && o.content() != null) {
                for (Content c : o.content()) {
                    if ("output_text".equals(c.type()) && c.text() != null) {
                        text.append(c.text());
                    }
                }
            }
        }
        return text.toString();
    }
}
