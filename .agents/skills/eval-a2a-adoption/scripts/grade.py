#!/usr/bin/env python3
"""Compute adoption ratings from evidence-backed assessments; no network calls."""

import argparse
import json
import sys
from datetime import datetime, time, timedelta, timezone
from pathlib import PurePosixPath
from zoneinfo import ZoneInfo


SIZES = {"1", "2", "3", "5", "8"}
THRESHOLDS = {
    "good": {"feature": 25, "bug": 50, "estimate": 200},
    "excellent": {"feature": 50, "bug": 100, "estimate": 500},
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def timestamp(value):
    require(isinstance(value, str), "Timestamp must be an ISO string")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None and result.utcoffset() is not None,
            "Timestamp must have a UTC offset")
    return result


def full_weeks(evaluated_at, tz_name="Asia/Shanghai"):
    local = timestamp(evaluated_at).astimezone(ZoneInfo(tz_name))
    monday = local.date() - timedelta(days=local.weekday())
    end = datetime.combine(monday, time.min, tzinfo=local.tzinfo)
    return [(end - timedelta(weeks=n), end - timedelta(weeks=n - 1))
            for n in range(4, 0, -1)]


def latest_samples(records, kind, evaluated_at, limit=10):
    """Select from a fully acquired candidate list, not proof of pagination."""
    require(kind in {"issues", "prs"}, "Unknown sample kind")
    cutoff = timestamp(evaluated_at)
    selected = [record for record in records
                if (kind != "issues" or "pull_request" not in record)
                and timestamp(record["created_at"]) <= cutoff]
    return sorted(selected, key=lambda r: (timestamp(r["created_at"]), r["number"]),
                  reverse=True)[:limit]


def evidence(record, label):
    values = record.get("evidence")
    require(isinstance(values, list) and all(isinstance(v, str) and v.strip() for v in values),
            f"{label}: evidence must be a list of nonempty strings")
    return values


def number(record, label):
    value = record.get("number")
    require(type(value) is int and value > 0, f"{label}: positive Issue/PR number required")
    return value


def file_integrity(record):
    """Validate an Agent's recursive inventory; do not infer filesystem absence."""
    require(isinstance(record, dict), "file_integrity assessment required")
    require(type(record.get("complete")) is bool, "file_integrity.complete must be boolean")
    files = record.get("files")
    require(isinstance(files, list) and files, "File inventory must include the process root")
    root = "a2a_dev_process.md"
    seen, states = set(), []
    for entry in files:
        require(isinstance(entry, dict), "File inventory entry must be an object")
        path = entry.get("path")
        require(isinstance(path, str) and path and not path.startswith("/")
                and ".." not in PurePosixPath(path).parts
                and str(PurePosixPath(path)) == path,
                "File path must be normalized and repository-relative")
        require(path not in seen, "Duplicate inventory path; retain references in evidence")
        seen.add(path)
        chain = entry.get("chain")
        require(isinstance(chain, list) and chain and chain[0] == root and chain[-1] == path
                and all(isinstance(p, str) and p.strip() for p in chain),
                "File reference chain must start at process root and end at target")
        state = entry.get("status")
        require(state in {"pass", "missing", "unknown", "na"}, "Invalid file status")
        require(path != root or state != "na", "Process root cannot be excluded")
        sources = evidence(entry, "file")
        if state in {"pass", "missing", "na"}:
            require(sources, "Known file status requires reference/verification evidence")
        if state in {"unknown", "na"}:
            require(isinstance(entry.get("reason"), str) and entry["reason"].strip(),
                    "Unknown/excluded file requires reason")
        states.append(state)
    require(root in seen, "File inventory must include a2a_dev_process.md")
    expected = ("fail" if "missing" in states else
                "unknown" if "unknown" in states or not record["complete"] else "pass")
    require(record.get("result") == expected, "File integrity result contradicts inventory")
    return record


def grade(data):
    require(isinstance(data, dict), "Assessment must be an object")
    require(type(data.get("schema_version")) is int and data["schema_version"] == 2,
            "Unsupported schema_version")
    repo = data.get("repository")
    require(isinstance(repo, str) and repo.count("/") == 1 and all(repo.split("/")),
            "repository must be OWNER/REPO")
    as_of = timestamp(data["evaluated_at"])
    tz_name = data.get("timezone", "Asia/Shanghai")
    bounds = full_weeks(data["evaluated_at"], tz_name)
    integrity = file_integrity(data.get("file_integrity"))
    # A confirmed missing required file is sufficient: no GitHub sampling prerequisite.
    if integrity["result"] == "fail":
        return {"schema_version": 2, "repository": repo,
                "evaluated_at": data["evaluated_at"], "timezone": tz_name,
                "status": "incomplete", "rating": "不合格", "rating_basis": "file_integrity",
                "file_integrity": integrity, "baseline": "unknown",
                "sample_counts": {"issues": 0, "prs": 0}, "weeks": [],
                "metrics_complete": False, "excluded": [], "outside_window": [],
                "unknown_eligibility": [], "stages_not_evaluated": ["samples", "metrics"],
                "limitations": ["Confirmed missing process reference; subsequent stages not evaluated."]}
    collection = data.get("collection", {})
    for key in ("selection_complete", "samples_complete", "metrics_complete"):
        require(type(collection.get(key)) is bool, f"collection.{key} must be boolean")
    baseline = data.get("baseline", {})
    result = baseline.get("result")
    require(result in {"pass", "fail", "unknown"}, "Invalid baseline result")
    base_evidence = evidence(baseline, "baseline")
    require(isinstance(baseline.get("reason"), str) and baseline["reason"].strip(),
            "baseline.reason required")
    if result in {"pass", "fail"}:
        require(base_evidence, "Known baseline requires evidence")
    samples = data.get("samples", {})
    counts, sample_results, all_ids = {}, [], set()
    for kind in ("issues", "prs"):
        records = samples.get(kind)
        require(isinstance(records, list) and len(records) <= 10,
                f"samples.{kind} must contain at most 10 records")
        counts[kind] = len(records)
        keys = []
        for record in records:
            identifier = number(record, kind)
            require(identifier not in all_ids, "Duplicate sample number")
            all_ids.add(identifier)
            created = timestamp(record["created_at"])
            require(created <= as_of, "Sample created after frozen evaluation time")
            keys.append((created, identifier))
            state = record.get("result")
            require(state in {"pass", "fail", "unknown"}, "Invalid sample result")
            sources = evidence(record, kind)
            if state in {"pass", "fail"}:
                require(sources, "Known sample result requires evidence")
            sample_results.append(state)
        require(keys == sorted(keys, reverse=True), "Samples must be newest-created first")
    require(not (result == "pass" and any(r != "pass" for r in sample_results)),
            "Baseline pass contradicts sample results")
    require(not (result == "unknown" and "fail" in sample_results),
            "Known sample failure must make baseline fail")
    require(result != "fail" or "fail" in sample_results,
            "Baseline fail requires a confirmed sample failure")

    limitations = data.get("limitations", [])
    require(isinstance(limitations, list) and all(isinstance(v, str) for v in limitations),
            "limitations must be strings")
    limitations = list(limitations)
    if integrity["result"] == "unknown":
        limitations.append("Process file inventory incomplete/unknown; cannot grant a passing rating.")
    baseline_complete = (collection["selection_complete"] and collection["samples_complete"] and result != "unknown"
                         and "unknown" not in sample_results)
    if any(count == 0 for count in counts.values()):
        baseline_complete = False
        limitations.append("No Issue or PR sample; basic adoption cannot be demonstrated.")
    elif any(count < 10 for count in counts.values()):
        limitations.append("Fewer than 10 Issues or PRs; rating covers all available samples only.")
    if not collection["samples_complete"]:
        limitations.append("Sample collection/evidence incomplete.")
    if not collection["selection_complete"]:
        limitations.append("Latest sample membership not established; sample-based rating unavailable.")

    weeks = [{"start": start.isoformat(), "end": end.isoformat(),
              "start_utc": start.astimezone(timezone.utc).isoformat(),
              "end_utc": end.astimezone(timezone.utc).isoformat(),
              "feature": 0, "bug": 0, "estimate": 0,
              "unknown_estimates": [], "included": []}
             for start, end in bounds]
    metrics_complete = collection["metrics_complete"]
    deliveries = data.get("deliveries")
    require(isinstance(deliveries, list), "deliveries must be a list")
    seen = {}
    excluded, outside, unknown_eligibility = [], [], []
    for record in deliveries:
        identifier = number(record, "delivery")
        if identifier in seen:
            require(seen[identifier] == record, "Conflicting duplicate delivery record")
            continue
        seen[identifier] = record
        eligibility = record.get("eligible")
        require(eligibility is None or type(eligibility) is bool, "eligible must be bool or null")
        sources = evidence(record, "delivery")
        if eligibility is not True:
            require(isinstance(record.get("reason"), str) and record["reason"].strip(),
                    "Excluded/unknown delivery requires reason")
            if eligibility is None:
                metrics_complete = False
                unknown_eligibility.append(identifier)
            else:
                require(sources, "Exclusion requires evidence")
                excluded.append(identifier)
            continue
        require(record.get("type") in {"Feature", "Bug"}, "Only Feature/Bug can be eligible")
        require(sources, "Eligible delivery requires acceptance/closure evidence")
        closed = timestamp(record["accepted_closed_at"])
        require(closed <= as_of, "Delivery closure is after evaluation time")
        require(type(record.get("estimate_confirmed")) is bool, "estimate_confirmed must be bool")
        index = next((i for i, (start, end) in enumerate(bounds) if start <= closed < end), None)
        if index is None:
            outside.append(identifier)
            continue
        week = weeks[index]
        week["feature" if record["type"] == "Feature" else "bug"] += 1
        week["included"].append(identifier)
        estimate = record.get("estimate")
        if isinstance(estimate, str) and estimate in SIZES and record["estimate_confirmed"]:
            week["estimate"] += int(estimate)
        else:
            week["unknown_estimates"].append(identifier)
            metrics_complete = False
    if not metrics_complete:
        limitations.append("Weekly metrics incomplete; unknown values are not zero estimates.")
    for week in weeks:
        for level, thresholds in THRESHOLDS.items():
            gap = {key: max(0, minimum - week[key]) for key, minimum in thresholds.items()}
            week[level] = {"gap": gap,
                           "met": all(value == 0 for value in gap.values()) if metrics_complete else None}

    complete = integrity["result"] == "pass" and baseline_complete and metrics_complete
    if not collection["selection_complete"]:
        rating = None
    elif result == "fail":
        rating = "不合格"
    elif not complete:
        rating = None
    elif all(week["excellent"]["met"] for week in weeks):
        rating = "优秀"
    elif all(week["good"]["met"] for week in weeks):
        rating = "良好"
    else:
        rating = "合格"
    return {"schema_version": 2, "repository": repo,
            "evaluated_at": data["evaluated_at"], "timezone": tz_name,
            "status": "complete" if complete else "incomplete", "rating": rating,
            "file_integrity": integrity,
            "baseline": result, "sample_counts": counts, "weeks": weeks,
            "metrics_complete": metrics_complete, "excluded": excluded,
            "outside_window": outside, "unknown_eligibility": unknown_eligibility,
            "limitations": limitations}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assessment", help="Evidence-backed assessment JSON path")
    args = parser.parse_args()
    try:
        with open(args.assessment, encoding="utf-8") as source:
            result = grade(json.load(source))
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Invalid assessment: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
