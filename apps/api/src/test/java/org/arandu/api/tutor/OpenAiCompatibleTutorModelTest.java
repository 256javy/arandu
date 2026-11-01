package org.arandu.api.tutor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenAiCompatibleTutorModelTest {

    private static final String EMPTY = """
            {"choices":[{"message":{"role":"assistant","content":null},"finish_reason":"length"}]}""";
    private static final String BLANK = """
            {"choices":[{"message":{"role":"assistant","content":"  "},"finish_reason":"stop"}]}""";
    private static final String OK = """
            {"choices":[{"message":{"role":"assistant","content":" ¿Qué ves? "},"finish_reason":"stop"}]}""";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final OpenAiCompatibleTutorModel model =
            new OpenAiCompatibleTutorModel(builder, "http://llm", "k", "m", "minimal", 100);
    private final List<TutorModel.Message> messages = List.of(new TutorModel.Message("user", "hola"));

    @Test
    void retriesOnceWhenTheContentIsEmpty() {
        server.expect(requestTo("http://llm/chat/completions")).andRespond(withSuccess(EMPTY, MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://llm/chat/completions")).andRespond(withSuccess(OK, MediaType.APPLICATION_JSON));
        assertThat(model.complete(messages)).isEqualTo("¿Qué ves?");
        server.verify();
    }

    @Test
    void failsAfterTwoEmptyResponses() {
        server.expect(requestTo("http://llm/chat/completions")).andRespond(withSuccess(EMPTY, MediaType.APPLICATION_JSON));
        server.expect(requestTo("http://llm/chat/completions")).andRespond(withSuccess(BLANK, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> model.complete(messages)).isInstanceOf(IllegalStateException.class)
                .hasMessage("empty LLM response");
        server.verify();
    }

    @Test
    void doesNotRetryAGoodAnswer() {
        server.expect(ExpectedCount.once(), requestTo("http://llm/chat/completions"))
                .andRespond(withSuccess(OK, MediaType.APPLICATION_JSON));
        assertThat(model.complete(messages)).isEqualTo("¿Qué ves?");
        server.verify();
    }
}
