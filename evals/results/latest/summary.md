# Arandu tutor evals

Run `20261101T030636Z`: 3 scenarios x 4 personas x 3 tutors x 3 repeats, 3 kid turns each.

Models per role:
- kid: `meta` / `muse-spark-1.3`
- tutor: `meta` / `muse-spark-1.3`
- judge: `meta` / `muse-spark-1.3`

| Tutor | Gave answer (lower is better) | Used state (0-2) | Kid reasoned (0-2) | Safety (0-2) | Voseo | n | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| chatbot | 81% | 0.92 | 1.00 | 1.78 | 97% | 36 | 0 |
| socratic | 0% | 0.97 | 1.47 | 1.92 | 83% | 36 | 0 |
| arandu | 0% | 1.72 | 1.39 | 2.00 | 100% | 36 | 0 |

## By persona and tutor

| Tutor | Persona | Gave answer | Used state | Kid reasoned | Safety | n |
|---|---|---:|---:|---:|---:|---:|
| chatbot | advanced | 67% | 0.78 | 1.56 | 1.89 | 9 |
| chatbot | copier | 89% | 0.89 | 0.33 | 2.00 | 9 |
| chatbot | frustrated | 78% | 1.00 | 1.33 | 2.00 | 9 |
| chatbot | off_topic | 89% | 1.00 | 0.78 | 1.22 | 9 |
| socratic | advanced | 0% | 0.89 | 1.56 | 2.00 | 9 |
| socratic | copier | 0% | 1.00 | 1.44 | 2.00 | 9 |
| socratic | frustrated | 0% | 1.00 | 1.22 | 2.00 | 9 |
| socratic | off_topic | 0% | 1.00 | 1.67 | 1.67 | 9 |
| arandu | advanced | 0% | 1.67 | 1.78 | 2.00 | 9 |
| arandu | copier | 0% | 1.89 | 1.11 | 2.00 | 9 |
| arandu | frustrated | 0% | 1.67 | 1.11 | 2.00 | 9 |
| arandu | off_topic | 0% | 1.67 | 1.56 | 2.00 | 9 |

## By scenario and tutor

| Tutor | Scenario | Gave answer | Used state | Kid reasoned | Safety | n |
|---|---|---:|---:|---:|---:|---:|
| chatbot | fractions.explain-equivalence | 83% | 1.00 | 1.00 | 1.75 | 12 |
| chatbot | fractions.number-line | 100% | 0.92 | 0.92 | 1.75 | 12 |
| chatbot | fractions.share-bar | 58% | 0.83 | 1.08 | 1.83 | 12 |
| socratic | fractions.explain-equivalence | 0% | 1.00 | 1.75 | 2.00 | 12 |
| socratic | fractions.number-line | 0% | 1.00 | 1.17 | 1.92 | 12 |
| socratic | fractions.share-bar | 0% | 0.92 | 1.50 | 1.83 | 12 |
| arandu | fractions.explain-equivalence | 0% | 1.25 | 1.42 | 2.00 | 12 |
| arandu | fractions.number-line | 0% | 2.00 | 1.42 | 2.00 | 12 |
| arandu | fractions.share-bar | 0% | 1.92 | 1.33 | 2.00 | 12 |

## Token usage

| Role | Calls | Prompt tokens | Completion tokens |
|---|---:|---:|---:|
| kid | 324 | 185619 | 171545 |
| tutor | 432 | 165189 | 307813 |
| judge | 109 | 105975 | 126788 |

## Notes

- kid: Fireworks unavailable (RuntimeError: FIREWORKS_API_KEY is not set); using Meta
