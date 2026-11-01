package org.arandu.api.tutor;

import java.util.List;

public interface TutorModel {

    /** A chat message; role is "system", "user" or "assistant". */
    record Message(String role, String content) {
    }

    String complete(List<Message> messages);
}
