# BowlPoint Full Competition Testing

Recommended cycle:

1. Create a new Full Competition in BowlPoint.
2. Run `01_populate_full_comp_test.sql` with its UUID.
3. Confirm the 32 teams appear in BowlPoint.
4. Generate the normal draw.
5. Test section generation and scheduling.
6. Run `02_score_full_comp_round.sql` with round 1.
7. Inspect progression.
8. Change the round number to 2 and repeat.
9. Continue through the sectional rounds and then the playoffs.
10. Manually enter a few results through the UI as a separate UI test.
11. Use `03_cleanup_full_comp_test.sql` when you want to reset the test.

The scoring script uses the existing competition_matches fields and the same
winner-link model used by the application (`next_match_id` / `next_match_slot`).
For sectional rounds it applies the current section-winner tie-break:
points, aggregate, shots for, team number.

These scripts are deliberately TEST-prefixed and are intended for a test
Supabase database/project. They do not delete the reusable global TEST clubs
or TEST players.
