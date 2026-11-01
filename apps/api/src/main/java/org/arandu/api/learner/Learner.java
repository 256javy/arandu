package org.arandu.api.learner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A kid's pseudonymous profile (nickname only), owned by an adult account. */
@Entity
@Table(name = "learner")
public class Learner {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "account_id")
    private UUID accountId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Learner() {
    }

    public Learner(UUID accountId, String nickname) {
        this.id = UUID.randomUUID();
        this.accountId = accountId;
        this.nickname = nickname;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public UUID getAccountId() {
        return accountId;
    }
}
