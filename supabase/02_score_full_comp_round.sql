-- BowlPoint Full Competition TEST scoring
-- Set the competition UUID and round number, then run once per round.
-- This writes directly to competition_matches and advances winners.
-- It does not execute the React UI save handler.

BEGIN;

DO $$
DECLARE
  v_competition_id uuid := 'PUT-YOUR-COMPETITION-UUID-HERE';
  v_round_number integer := 1;
  v_round_id uuid;
  v_first_playoff_round integer;
  v_section_count integer;
  v_section record;
  v_match record;
  v_winner uuid;
  v_target uuid;
  v_target_match_no integer;
  v_target_field text;
  a integer;
  b integer;
  pa integer;
  pb integer;
BEGIN
  IF v_competition_id='PUT-YOUR-COMPETITION-UUID-HERE'::uuid THEN
    RAISE EXCEPTION 'Set v_competition_id before running the script.';
  END IF;

  SELECT id INTO v_round_id
  FROM public.competition_rounds
  WHERE competition_id=v_competition_id AND round_number=v_round_number;

  IF v_round_id IS NULL THEN
    RAISE EXCEPTION 'Round % does not exist.',v_round_number;
  END IF;

  -- Score every currently playable, uncompleted match in this round.
  FOR v_match IN
    SELECT *
    FROM public.competition_matches
    WHERE competition_id=v_competition_id
      AND round_id=v_round_id
      AND completed=false
      AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL
    ORDER BY match_number
  LOOP
    a=21-((v_match.match_number+v_round_number)%8);
    b=5+((v_match.match_number*3+v_round_number)%15);
    IF a=b THEN b=b-1; END IF;

    IF a>b THEN pa=2;pb=0;
    ELSIF b>a THEN pa=0;pb=2;
    ELSE pa=1;pb=1;
    END IF;

    UPDATE public.competition_matches
    SET score_a=a,score_b=b,points_a=pa,points_b=pb,
        shots_for_a=a,shots_for_b=b,completed=true,completed_at=now()
    WHERE id=v_match.id;

    -- Normal knockout progression uses the links created by BowlPoint.
    IF v_match.next_match_id IS NOT NULL THEN
      v_winner=CASE WHEN a>b THEN v_match.team_a_id ELSE v_match.team_b_id END;

      UPDATE public.competition_matches
      SET team_a_id=CASE WHEN v_match.next_match_slot='A' THEN v_winner ELSE team_a_id END,
          team_b_id=CASE WHEN v_match.next_match_slot='B' THEN v_winner ELSE team_b_id END
      WHERE id=v_match.next_match_id;
    END IF;
  END LOOP;

  -- Sectional round: calculate section winners and put them into the
  -- first playoff round. Current BowlPoint rules:
  -- 2 sections: S1/S2 -> Final 1
  -- 4 sections: S1/S3 -> SF1, S2/S4 -> SF2
  -- 8 sections: S1/S3 -> QF1, S2/S4 -> QF2,
  --             S5/S7 -> QF3, S6/S8 -> QF4
  IF EXISTS (
    SELECT 1 FROM public.competition_rounds
    WHERE id=v_round_id AND lower(coalesce(round_name,'')) LIKE '%sectional%'
  ) THEN
    SELECT count(*) INTO v_section_count
    FROM public.competition_sections
    WHERE competition_id=v_competition_id;

    SELECT min(round_number) INTO v_first_playoff_round
    FROM public.competition_rounds
    WHERE competition_id=v_competition_id
      AND lower(coalesce(round_name,'')) NOT LIKE '%sectional%';

    IF v_first_playoff_round IS NOT NULL THEN
      FOR v_section IN
        SELECT id,section_number
        FROM public.competition_sections
        WHERE competition_id=v_competition_id
        ORDER BY section_number
      LOOP
        SELECT x.team_id INTO v_winner
        FROM (
          SELECT ct.id AS team_id,
                 coalesce(sum(CASE WHEN cm.team_a_id=ct.id THEN cm.points_a
                                   WHEN cm.team_b_id=ct.id THEN cm.points_b ELSE 0 END),0) AS pts,
                 coalesce(sum(CASE WHEN cm.team_a_id=ct.id THEN cm.shots_for_a-cm.shots_for_b
                                   WHEN cm.team_b_id=ct.id THEN cm.shots_for_b-cm.shots_for_a ELSE 0 END),0) AS agg,
                 coalesce(sum(CASE WHEN cm.team_a_id=ct.id THEN cm.shots_for_a
                                   WHEN cm.team_b_id=ct.id THEN cm.shots_for_b ELSE 0 END),0) AS sf,
                 ct.team_number
          FROM public.competition_section_teams cst
          JOIN public.competition_teams ct ON ct.id=cst.competition_team_id
          LEFT JOIN public.competition_matches cm
            ON cm.section_id=v_section.id
           AND cm.completed=true
           AND (cm.team_a_id=ct.id OR cm.team_b_id=ct.id)
          WHERE cst.section_id=v_section.id
          GROUP BY ct.id,ct.team_number
          HAVING count(cm.id)>0
          ORDER BY pts DESC,agg DESC,sf DESC,ct.team_number
          LIMIT 1
        ) x;

        IF v_winner IS NULL THEN CONTINUE; END IF;

        IF v_section_count=2 THEN
          v_target_match_no=1;
          v_target_field=CASE WHEN v_section.section_number=1 THEN 'A' ELSE 'B' END;
        ELSIF v_section_count=4 THEN
          v_target_match_no=ceil(v_section.section_number::numeric/2)::integer;
          v_target_field=CASE WHEN v_section.section_number IN (1,2) THEN 'A' ELSE 'B' END;
        ELSIF v_section_count=8 THEN
          v_target_match_no=CASE
            WHEN v_section.section_number IN (1,3) THEN 1
            WHEN v_section.section_number IN (2,4) THEN 2
            WHEN v_section.section_number IN (5,7) THEN 3
            WHEN v_section.section_number IN (6,8) THEN 4 END;
          v_target_field=CASE WHEN v_section.section_number IN (1,3,5,7) THEN 'A' ELSE 'B' END;
        ELSE
          CONTINUE;
        END IF;

        SELECT id INTO v_target
        FROM public.competition_matches
        WHERE competition_id=v_competition_id
          AND round_id=(SELECT id FROM public.competition_rounds
                        WHERE competition_id=v_competition_id
                          AND round_number=v_first_playoff_round)
          AND match_number=v_target_match_no
        LIMIT 1;

        IF v_target IS NOT NULL THEN
          IF v_target_field='A' THEN
            UPDATE public.competition_matches SET team_a_id=v_winner WHERE id=v_target;
          ELSE
            UPDATE public.competition_matches SET team_b_id=v_winner WHERE id=v_target;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RAISE NOTICE 'Round % scored.',v_round_number;
END $$;

COMMIT;

-- Quick verification
SELECT r.round_number,r.round_name,
       count(cm.id) AS matches,
       count(*) FILTER(WHERE cm.completed) AS completed,
       count(*) FILTER(WHERE cm.team_a_id IS NOT NULL AND cm.team_b_id IS NOT NULL) AS ready
FROM public.competition_rounds r
LEFT JOIN public.competition_matches cm ON cm.round_id=r.id
WHERE r.competition_id='PUT-YOUR-COMPETITION-UUID-HERE'::uuid
GROUP BY r.round_number,r.round_name
ORDER BY r.round_number;
