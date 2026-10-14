import copy
import unittest

from grade import full_weeks, grade, latest_samples


AS_OF = "2026-10-13T08:00:00Z"


def assessment():
    return {"schema_version": 2, "repository": "owner/repo", "evaluated_at": AS_OF,
            "timezone": "Asia/Shanghai",
            "file_integrity": {"result": "pass", "complete": True, "files": [
                {"path": "a2a_dev_process.md", "status": "pass",
                 "chain": ["a2a_dev_process.md"], "evidence": ["tree-and-recursive-audit"]}]},
            "collection": {"selection_complete": True, "samples_complete": True, "metrics_complete": True},
            "baseline": {"result": "pass", "reason": "All applicable checks pass", "evidence": ["checks.json"]},
            "samples": {"issues": [{"number": 1, "created_at": "2026-10-12T00:00:00Z",
                                     "result": "pass", "evidence": ["issue-checks"]}],
                        "prs": [{"number": 2, "created_at": "2026-10-12T00:00:00Z",
                                 "result": "pass", "evidence": ["pr-checks"]}]},
            "deliveries": [], "limitations": []}


def add_week(data, week, features, bugs, estimate="3"):
    start, _ = full_weeks(AS_OF)[week]
    base = len(data["deliveries"]) + 100
    for i in range(features + bugs):
        data["deliveries"].append({"number": base + i, "type": "Feature" if i < features else "Bug",
                                   "eligible": True, "accepted_closed_at": start.isoformat(),
                                   "estimate": estimate, "estimate_confirmed": True,
                                   "evidence": ["acceptance", "closure", "owner-confirmation"]})


class GradeTests(unittest.TestCase):
    def test_direct_and_indirect_missing_files_override_all_other_stages(self):
        for chain in (["a2a_dev_process.md"],
                      ["a2a_dev_process.md", ".github/workflows/ci.yml"],
                      ["a2a_dev_process.md", ".github/workflows/ci.yml", ".github/prompts/qa.md",
                       ".agents/skills/qa/SKILL.md", ".github/schemas/qa.json"]):
            data = assessment()
            entry = {"path": chain[-1], "status": "missing", "chain": chain,
                     "evidence": ["source-line", "complete-tree-confirmed-absence"]}
            data["file_integrity"].update(result="fail", files=(
                [entry] if len(chain) == 1 else data["file_integrity"]["files"] + [entry]))
            for key in ("baseline", "samples", "collection", "deliveries"):
                data.pop(key)
            result = grade(data)
            self.assertEqual(result["rating"], "不合格")
            self.assertEqual(result["rating_basis"], "file_integrity")
            self.assertEqual(result["weeks"], [])  # Uncollected metrics are not zero.
            self.assertEqual(result["stages_not_evaluated"], ["samples", "metrics"])

    def test_missing_reference_overrides_excellent_volume(self):
        data = assessment()
        for week in range(4):
            add_week(data, week, 50, 100, "5")
        data["file_integrity"]["files"].append({"path": "AGENTS.md", "status": "missing",
            "chain": ["a2a_dev_process.md", "AGENTS.md"], "evidence": ["confirmed-missing"]})
        data["file_integrity"]["result"] = "fail"
        self.assertEqual(grade(data)["rating"], "不合格")

    def test_confirmed_missing_is_not_cancelled_by_other_unknown_references(self):
        data = assessment()
        data["file_integrity"].update(result="fail", complete=False)
        data["file_integrity"]["files"] += [
            {"path": ".github/workflows/ci.yml", "status": "missing",
             "chain": ["a2a_dev_process.md", ".github/workflows/ci.yml"],
             "evidence": ["confirmed-tree-absence"]},
            {"path": "AGENTS.md", "status": "unknown",
             "chain": ["a2a_dev_process.md", "AGENTS.md"],
             "reason": "permission denied", "evidence": []}]
        data["collection"]["selection_complete"] = False
        self.assertEqual(grade(data)["rating"], "不合格")

    def test_unknown_or_incomplete_recursive_inventory_blocks_passing_grade(self):
        data = assessment()
        data["file_integrity"].update(result="unknown", complete=False)
        self.assertIsNone(grade(data)["rating"])
        data["file_integrity"]["complete"] = True
        data["file_integrity"]["files"].append({"path": "AGENTS.md", "status": "unknown",
            "chain": ["a2a_dev_process.md", "AGENTS.md"], "reason": "permission denied",
            "evidence": []})
        self.assertIsNone(grade(data)["rating"])
        data["baseline"]["result"] = "fail"
        data["samples"]["issues"][0]["result"] = "fail"
        self.assertEqual(grade(data)["rating"], "不合格")

    def test_file_integrity_field_and_consistent_evidence_are_required(self):
        data = assessment()
        data.pop("file_integrity")
        with self.assertRaisesRegex(ValueError, "file_integrity assessment required"):
            grade(data)
        data = assessment()
        data["schema_version"] = 1
        with self.assertRaisesRegex(ValueError, "schema_version"):
            grade(data)
        data = assessment()
        data["file_integrity"]["result"] = "fail"
        with self.assertRaisesRegex(ValueError, "contradicts inventory"):
            grade(data)
        data = assessment()
        data["file_integrity"]["files"][0]["status"] = "missing"
        with self.assertRaisesRegex(ValueError, "contradicts inventory"):
            grade(data)
        data["file_integrity"]["result"] = "fail"
        data["file_integrity"]["files"][0]["evidence"] = []
        with self.assertRaisesRegex(ValueError, "requires reference/verification evidence"):
            grade(data)

    def test_documented_exclusions_and_reference_chains(self):
        data = assessment()
        data["file_integrity"]["files"].append({"path": "docs/quality/reports/PR-456.md",
            "status": "na", "chain": ["a2a_dev_process.md", "docs/quality/reports/PR-456.md"],
            "reason": "explicit sample output, no matching PR", "evidence": ["source-line"]})
        self.assertEqual(grade(data)["rating"], "合格")
        data["file_integrity"]["files"][1]["chain"] = ["other.md", "docs/quality/reports/PR-456.md"]
        with self.assertRaisesRegex(ValueError, "reference chain"):
            grade(data)

    def test_full_weeks_use_local_monday_and_exclude_current_week(self):
        bounds = full_weeks(AS_OF)
        self.assertEqual(bounds[0][0].isoformat(), "2026-09-14T00:00:00+08:00")
        self.assertEqual(bounds[-1][1].isoformat(), "2026-10-12T00:00:00+08:00")
        self.assertEqual(full_weeks("2026-10-11T16:00:00Z"), bounds)
        self.assertNotEqual(full_weeks("2026-10-11T15:59:59Z"), bounds)

    def test_latest_samples_all_states_not_updated_and_exclude_pr(self):
        records = [{"number": i, "created_at": f"2026-10-{i + 1:02}T00:00:00Z",
                    "updated_at": "2026-10-13T00:00:00Z", "state": "closed" if i % 2 else "open"}
                   for i in range(12)]
        records.append({"number": 99, "created_at": "2026-10-13T01:00:00Z", "pull_request": {}})
        records.append({"number": 100, "created_at": "2026-10-14T00:00:00Z"})
        self.assertEqual([r["number"] for r in latest_samples(records, "issues", AS_OF)],
                         list(range(11, 1, -1)))
        self.assertEqual(latest_samples(records, "prs", AS_OF)[0]["number"], 99)

    def test_empty_complete_weeks_qualify_only_baseline_and_small_sample_disclosed(self):
        result = grade(assessment())
        self.assertEqual(result["rating"], "合格")
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["sample_counts"], {"issues": 1, "prs": 1})
        self.assertTrue(result["limitations"])

    def test_good_thresholds_inclusive_and_all_three_required(self):
        data = assessment()
        for week in range(4):
            add_week(data, week, 25, 50)
        self.assertEqual(grade(data)["rating"], "良好")
        for kind in ("Feature", "Bug"):
            changed = copy.deepcopy(data)
            changed["deliveries"].remove(next(r for r in changed["deliveries"] if r["type"] == kind))
            self.assertEqual(grade(changed)["rating"], "合格")
        for record in data["deliveries"]:
            record["estimate"] = "2"
        self.assertEqual(grade(data)["rating"], "合格")

    def test_exact_point_boundary(self):
        data = assessment()
        for week in range(4):
            add_week(data, week, 25, 50, "2")
            rows = data["deliveries"][-75:]
            for row in rows[:50]:
                row["estimate"] = "3"
        self.assertEqual(grade(data)["rating"], "良好")
        data["deliveries"][0]["estimate"] = "2"
        self.assertEqual(grade(data)["rating"], "合格")

    def test_excellent_threshold_and_a_weak_week_not_hidden_by_average(self):
        data = assessment()
        for week in range(4):
            add_week(data, week, 50, 100, "3")
            for row in data["deliveries"][-150:-125]:
                row["estimate"] = "5"
        self.assertEqual(grade(data)["rating"], "优秀")
        data["deliveries"][0]["estimate"] = "3"
        self.assertEqual(grade(data)["rating"], "良好")
        data["deliveries"].remove(next(r for r in data["deliveries"] if r["type"] == "Feature"))
        self.assertEqual(grade(data)["rating"], "良好")
        data = assessment()
        add_week(data, 0, 0, 0)
        for week in (1, 2, 3):
            add_week(data, week, 100, 200, "8")
        self.assertEqual(grade(data)["rating"], "合格")

    def test_baseline_failure_overrides_volume_even_with_missing_metrics(self):
        data = assessment()
        data["baseline"]["result"] = "fail"
        data["samples"]["issues"][0]["result"] = "fail"
        data["collection"]["metrics_complete"] = False
        result = grade(data)
        self.assertEqual(result["rating"], "不合格")
        self.assertEqual(result["status"], "incomplete")

    def test_known_failure_with_unknown_sample_keeps_incomplete_status(self):
        data = assessment()
        data["baseline"]["result"] = "fail"
        data["samples"]["issues"][0]["result"] = "fail"
        data["samples"]["prs"][0]["result"] = "unknown"
        result = grade(data)
        self.assertEqual(result["rating"], "不合格")
        self.assertEqual(result["status"], "incomplete")

    def test_unestablished_sample_membership_blocks_formal_failure_rating(self):
        data = assessment()
        data["baseline"]["result"] = "fail"
        data["samples"]["issues"][0]["result"] = "fail"
        data["collection"]["selection_complete"] = False
        result = grade(data)
        self.assertIsNone(result["rating"])
        self.assertEqual(result["status"], "incomplete")

    def test_unknown_or_missing_evidence_does_not_produce_false_grade(self):
        for key in ("samples_complete", "metrics_complete"):
            data = assessment()
            data["collection"][key] = False
            self.assertIsNone(grade(data)["rating"])
        data = assessment()
        data["samples"]["prs"] = []
        self.assertIsNone(grade(data)["rating"])
        data = assessment()
        data["baseline"]["result"] = "unknown"
        data["samples"]["issues"][0]["result"] = "unknown"
        self.assertIsNone(grade(data)["rating"])

    def test_unknown_estimate_preserves_count_and_is_not_zero(self):
        for estimate, confirmed in (("TBD", True), (None, False), ("13", True), ("3", False), (3, True)):
            data = assessment()
            add_week(data, 0, 1, 0)
            data["deliveries"][0].update(estimate=estimate, estimate_confirmed=confirmed)
            result = grade(data)
            self.assertIsNone(result["rating"])
            self.assertEqual(result["weeks"][0]["feature"], 1)
            self.assertEqual(result["weeks"][0]["unknown_estimates"], [100])

    def test_week_edges_and_identical_duplicate_count_once(self):
        data = assessment()
        add_week(data, 0, 1, 0)
        record = data["deliveries"][0]
        record["accepted_closed_at"] = "2026-09-13T16:00:00Z"
        data["deliveries"].append(copy.deepcopy(record))
        self.assertEqual(grade(data)["weeks"][0]["feature"], 1)
        record["accepted_closed_at"] = "2026-09-20T16:00:00Z"
        data["deliveries"] = [record]
        self.assertEqual(grade(data)["weeks"][1]["feature"], 1)
        record["accepted_closed_at"] = "2026-10-11T16:00:00Z"
        self.assertEqual(grade(data)["outside_window"], [100])

    def test_exclusions_unknown_eligibility_and_conflicts(self):
        data = assessment()
        data["deliveries"] = [{"number": 100, "type": "Bug", "eligible": False,
                                "reason": "duplicate/not planned", "evidence": ["closure-reason"]}]
        self.assertEqual(grade(data)["excluded"], [100])
        self.assertEqual(grade(data)["weeks"][0]["bug"], 0)
        data["deliveries"][0]["eligible"] = None
        self.assertIsNone(grade(data)["rating"])
        data = assessment()
        add_week(data, 0, 1, 0)
        conflict = copy.deepcopy(data["deliveries"][0])
        conflict["estimate"] = "5"
        data["deliveries"].append(conflict)
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            grade(data)

    def test_invalid_input_and_contradictions_rejected(self):
        data = assessment()
        data["samples"]["issues"][0]["result"] = "fail"
        with self.assertRaisesRegex(ValueError, "contradicts"):
            grade(data)
        data = assessment()
        data["baseline"]["result"] = "fail"
        with self.assertRaisesRegex(ValueError, "confirmed sample failure"):
            grade(data)
        for bad_time in ("2026-10-13T08:00:00", "2026-10-12"):
            data = assessment()
            data["evaluated_at"] = bad_time
            with self.assertRaises(ValueError):
                grade(data)
        data = assessment()
        add_week(data, 0, 1, 0)
        data["deliveries"][0]["type"] = "Design"
        with self.assertRaisesRegex(ValueError, "Feature/Bug"):
            grade(data)


if __name__ == "__main__":
    unittest.main()
