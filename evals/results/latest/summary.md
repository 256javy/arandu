# Arandu tutor evals

Run `20261101T070843Z`: 6 scenarios x 4 personas x 3 tutors x 3 repeats, 4 kid turns each.

Models per role:
- kid: `meta` / `muse-spark-1.3`
- tutor: `meta` / `muse-spark-1.3`
- judge: `meta` / `muse-spark-1.3`

| Tutor | Gave answer (lower is better) | Used state (0-2) | Kid reasoned (0-2) | Own insight | Turn of insight | Solved | Turns to solve | Safety (0-2) | Voseo | n | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| chatbot | 89% | 1.67 | 0.57 | 7% | 2.00 | 85% | 2.00 | 1.76 | 100% | 72 | 0 |
| socratic | 4% | 1.62 | 1.79 | 54% | 2.28 | 67% | 2.25 | 1.96 | 93% | 72 | 0 |
| arandu | 0% | 1.39 | 1.56 | 42% | 2.67 | 52% | 2.36 | 1.94 | 100% | 72 | 0 |

## By persona and tutor

| Tutor | Persona | Gave answer | Used state | Kid reasoned | Own insight | Solved | Safety | n |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| chatbot | advanced | 83% | 1.67 | 0.94 | 17% | 92% | 2.00 | 18 |
| chatbot | copier | 100% | 1.67 | 0.06 | 0% | 100% | 2.00 | 18 |
| chatbot | frustrated | 89% | 1.67 | 0.50 | 6% | 83% | 2.00 | 18 |
| chatbot | off_topic | 83% | 1.67 | 0.78 | 6% | 67% | 1.06 | 18 |
| socratic | advanced | 11% | 1.61 | 2.00 | 83% | 75% | 2.00 | 18 |
| socratic | copier | 0% | 1.67 | 1.78 | 50% | 75% | 2.00 | 18 |
| socratic | frustrated | 6% | 1.56 | 1.50 | 33% | 58% | 2.00 | 18 |
| socratic | off_topic | 0% | 1.67 | 1.89 | 50% | 58% | 1.83 | 18 |
| arandu | advanced | 0% | 1.44 | 1.94 | 72% | 75% | 2.00 | 18 |
| arandu | copier | 0% | 1.33 | 1.39 | 28% | 42% | 2.00 | 18 |
| arandu | frustrated | 0% | 1.44 | 1.39 | 33% | 50% | 2.00 | 18 |
| arandu | off_topic | 0% | 1.33 | 1.50 | 33% | 42% | 1.78 | 18 |

## By scenario and tutor

| Tutor | Scenario | Gave answer | Used state | Kid reasoned | Own insight | Solved | Safety | n |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| chatbot | fractions.explain-compare | 67% | 1.00 | 1.08 | 25% | - | 1.83 | 12 |
| chatbot | fractions.explain-equivalence | 67% | 1.00 | 1.33 | 17% | - | 1.58 | 12 |
| chatbot | fractions.number-line | 100% | 2.00 | 0.08 | 0% | 100% | 1.75 | 12 |
| chatbot | fractions.number-line-again | 100% | 2.00 | 0.25 | 0% | 92% | 1.75 | 12 |
| chatbot | fractions.share-bar | 100% | 2.00 | 0.58 | 0% | 50% | 1.83 | 12 |
| chatbot | proportions.recipe | 100% | 2.00 | 0.08 | 0% | 100% | 1.83 | 12 |
| socratic | fractions.explain-compare | 0% | 1.00 | 1.92 | 33% | - | 2.00 | 12 |
| socratic | fractions.explain-equivalence | 8% | 1.00 | 1.92 | 83% | - | 1.83 | 12 |
| socratic | fractions.number-line | 0% | 1.92 | 1.83 | 42% | 75% | 2.00 | 12 |
| socratic | fractions.number-line-again | 0% | 1.83 | 1.92 | 67% | 83% | 1.92 | 12 |
| socratic | fractions.share-bar | 17% | 2.00 | 1.67 | 58% | 8% | 2.00 | 12 |
| socratic | proportions.recipe | 0% | 2.00 | 1.50 | 42% | 100% | 2.00 | 12 |
| arandu | fractions.explain-compare | 0% | 1.00 | 1.92 | 67% | - | 1.83 | 12 |
| arandu | fractions.explain-equivalence | 0% | 1.00 | 1.92 | 92% | - | 2.00 | 12 |
| arandu | fractions.number-line | 0% | 1.17 | 1.67 | 33% | 67% | 1.83 | 12 |
| arandu | fractions.number-line-again | 0% | 1.17 | 1.25 | 8% | 25% | 2.00 | 12 |
| arandu | fractions.share-bar | 0% | 2.00 | 1.25 | 17% | 17% | 2.00 | 12 |
| arandu | proportions.recipe | 0% | 2.00 | 1.33 | 33% | 100% | 2.00 | 12 |

## Token usage

| Role | Calls | Prompt tokens | Completion tokens | Empty responses retried |
|---|---:|---:|---:|---:|
| kid | 685 | 610285 | 470285 | 5 |
| tutor | 901 | 755945 | 278029 | 0 |
| judge | 216 | 339843 | 294672 | 0 |

Conversations lost to empty responses after retries: 0

## Notes

- tutor reasoning_effort=minimal (kid and judge: low)
