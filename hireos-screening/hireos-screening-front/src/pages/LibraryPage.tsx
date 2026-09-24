import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { listLibraryEntries, runMatchAgain, type LibraryEntry } from "../data/api/library";
import { ApiError } from "../data/api/shared";
import { getPerson } from "../data/db";
import { relTime } from "../lib/format";
import { Icon } from "../components/ui/Icons";
import { Badge, Button, CandidateAvatar, EmptyState, PageHeader, PersonAvatar } from "../components/ui/Primitives";

function MatchStatusBadge({ entry }: { entry: LibraryEntry }) {
  const { t } = useStore();
  if (entry.linkedRoleCount > 0)
    return (
      <Badge tone="success">
        {entry.linkedRoleCount} {t("linked role")}
        {entry.linkedRoleCount > 1 ? "s" : ""}
      </Badge>
    );
  if (entry.pendingRecommendationCount > 0)
    return (
      <Badge tone="info">
        {entry.pendingRecommendationCount} {t("pending recommendation")}
        {entry.pendingRecommendationCount > 1 ? "s" : ""}
      </Badge>
    );
  if (entry.matchStatus === "running") return <Badge tone="info">{t("Checking…")}</Badge>;
  if (entry.matchStatus === "no_match") return <Badge tone="neutral">{t("No matching roles")}</Badge>;
  if (entry.matchStatus === "failed") return <Badge tone="danger">{t("Matching failed")}</Badge>;
  return <Badge tone="outline">{t("Not matched yet")}</Badge>;
}

export function LibraryPage() {
  const { t, state, say } = useStore();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [matching, setMatching] = useState<string | null>(null);

  const load = useCallback((q: string) => {
    listLibraryEntries(q).then((rows) => {
      setEntries(rows);
      if (!q) setTotal(rows.length);
    });
  }, []);

  useEffect(() => {
    load(query);
  }, [query, load]);

  const handleMatchAgain = async (candidateId: string) => {
    setMatching(candidateId);
    try {
      await runMatchAgain(candidateId);
    } catch (error) {
      if (error instanceof ApiError && error.code === "MATCH_IN_PROGRESS") {
        say(t("A matching run is already in progress for this candidate."), { type: "info" });
      } else {
        say(t("Could not start matching."), { type: "error" });
      }
    }
    setMatching(null);
    load(query);
  };

  return (
    <>
      <PageHeader
        title={t("Resume Library")}
        subtitle={t("Every candidate stays here whether or not they’re linked to a job — resumes can arrive before any role exists.")}
        actions={
          <>
            <Link className="btn btn-secondary" to="/imports/new">
              <Icon name="description" />
              {t("Paste profile")}
            </Link>
            <Link className="btn btn-primary" to="/imports/new">
              <Icon name="upload" />
              {t("Upload resumes")}
            </Link>
          </>
        }
      />
      <div className="flex items-center gap-12 flex-wrap" style={{ marginBottom: 16 }}>
        <div className="topbar-search" style={{ maxWidth: 360, padding: "7px 14px" }}>
          <Icon name="search" size={17} />
          <input type="text" placeholder={t("Search name, email, tag...")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="tiny muted">
          {state.lang === "zh" ? `共 ${total} 位候选人中的 ${entries.length} 位` : `${entries.length} of ${total} candidates`}
        </span>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Candidate")}</th>
              <th>{t("Tags")}</th>
              <th>{t("Latest source")}</th>
              <th>{t("Owner")}</th>
              <th>{t("Match status")}</th>
              <th>{t("Last matched")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon="search_off" title={t("No candidates match your search")} body={t("Try a different name, email or tag.")} />
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const { candidate, latestSource } = entry;
                return (
                <tr key={candidate.id} className="clickable">
                  <td>
                    <Link to={`/candidates/${candidate.id}`} className="flex items-center gap-10" style={{ color: "inherit", textDecoration: "none" }}>
                      <CandidateAvatar id={candidate.id} name={candidate.displayName} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{candidate.displayName}</div>
                        <div className="tiny">{candidate.contact.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td>
                    {candidate.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </td>
                  <td className="tiny">{latestSource}</td>
                  <td>
                    <span className="flex items-center gap-8">
                      <PersonAvatar person={getPerson(candidate.owner)} size="sm" /> {getPerson(candidate.owner)?.name}
                    </span>
                  </td>
                  <td>
                    <MatchStatusBadge entry={entry} />
                  </td>
                  <td className="tiny">{relTime(candidate.lastMatchedAt, state.lang)}</td>
                  <td className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMatchAgain(candidate.id);
                      }}
                      disabled={matching === candidate.id || entry.matchStatus === "running"}
                    >
                      {entry.matchStatus === "running" ? t("Matching…") : t("Match again")}
                    </Button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
