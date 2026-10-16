import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sourceLabel } from "../features/imports/sources";
import { MATCH_STATUS_BADGE } from "../features/library/matchStatus";
import { PAGE_SIZE, appendPage, nextPage, requestGate } from "../features/library/paging";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { deleteCandidate, listLibraryEntries, MATCH_STATUSES, runMatchAgain, type LibraryEntry, type LibraryFilters, type LibraryList } from "../data/api/library";
import { ApiError } from "../data/api/shared";
import { getPerson } from "../data/db";
import { relTime } from "../lib/format";
import { Icon } from "../components/ui/Icons";
import { Badge, Button, CandidateAvatar, EmptyState, PageHeader, PersonAvatar } from "../components/ui/Primitives";
import { ConfirmDialog } from "../components/ui/Overlays";
import { ResumeImportModal, type ImportTab } from "../features/imports/ResumeImportPanel";

function MatchStatusBadge({ entry }: { entry: LibraryEntry }) {
  const { t } = useStore();
  const badge = MATCH_STATUS_BADGE[entry.matchStatus] ?? MATCH_STATUS_BADGE.not_started;
  return (
    <span title={entry.matchReason ? t(entry.matchReason) : undefined}>
      <Badge tone={badge.tone}>
        {t(badge.label)}
        {entry.matchStatus === "recommendations" && entry.pendingRecommendationCount > 0 ? ` · ${entry.pendingRecommendationCount}` : ""}
      </Badge>
    </span>
  );
}

const FILTER_KEYS = ["q", "tag", "source", "owner", "matchStatus", "addedFrom", "addedTo"] as const;
const SCROLL_KEY = "screening.library.scroll";
const SEARCH_KEY = "screening.library.search";

function savedSearch(): string {
  try {
    return sessionStorage.getItem(SEARCH_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The page's scroll container (the app shell's main area). */
function scroller() {
  return document.querySelector<HTMLElement>("main.main");
}

export function LibraryPage() {
  const { t, state, say } = useStore();
  const navigate = useNavigate();
  // Search and filters live in the URL, so coming back from a candidate restores them (#173).
  const [params, setParams] = useSearchParams();
  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as Required<LibraryFilters>,
    [params],
  );
  const [query, setQuery] = useState(filters.q);
  // Opened without a search (the detail page's Back, the sidebar): pick up the last one first, so the list
  // and the scroll position come back as they were (#173). Clear filters empties it.
  const [restoring, setRestoring] = useState(() => !params.toString() && !!savedSearch());
  useEffect(() => {
    if (restoring) {
      if (params.toString()) setRestoring(false);
      else setParams(new URLSearchParams(savedSearch()), { replace: true });
      return;
    }
    try {
      sessionStorage.setItem(SEARCH_KEY, params.toString());
    } catch {
      /* storage unavailable: the URL still carries the search */
    }
  }, [params, restoring, setParams]);
  // The box follows the URL when it changes from outside (restored, cleared).
  useEffect(() => {
    setQuery((current) => (current.trim() === filters.q ? current : filters.q));
  }, [filters.q]);
  // Loading, failed or loaded: an empty library is only shown once the request has come back empty (#168).
  const [list, setList] = useState<LibraryList | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [matching, setMatching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [importTab, setImportTab] = useState<ImportTab | null>(null);
  const restoredScroll = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Each request's number: a response for an earlier search or page is dropped when it arrives late (#172 review).
  const gate = useRef(requestGate()).current;

  const setFilter = useCallback(
    (key: (typeof FILTER_KEYS)[number], value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Typing updates the URL after a short pause, not on every key.
  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => setFilter("q", query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query, filters.q, setFilter]);

  const load = useCallback(() => {
    setLoadState((current) => (current === "ready" ? "ready" : "loading"));
    const id = gate.start();
    listLibraryEntries(filters, 0, PAGE_SIZE)
      .then((result) => {
        if (!gate.isLatest(id)) return;
        setList(result);
        setLoadState("ready");
      })
      .catch(() => {
        if (gate.isLatest(id)) setLoadState("error");
      });
  }, [filters, gate]);

  /** The next page, appended to what is shown; a failure leaves the list as it was (#172 review). */
  const loadMore = async () => {
    if (!list || loadingMore) return;
    const id = gate.start();
    setLoadingMore(true);
    try {
      const { offset, limit } = nextPage(list.items.length);
      const next = await listLibraryEntries(filters, offset, limit);
      if (!gate.isLatest(id)) return;
      setList((current) => (current ? appendPage<LibraryEntry, LibraryList>(current, next, (entry) => entry.candidate.id) : next));
    } catch {
      if (gate.isLatest(id)) say(t("Couldn't load more candidates. Try again."), { type: "error" });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!restoring) load();
  }, [load, restoring]);

  // Back from a candidate: put the list where it was once its rows are there again (#173).
  useLayoutEffect(() => {
    if (loadState !== "ready" || restoredScroll.current) return;
    restoredScroll.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null") as { search: string; top: number } | null;
      if (saved && saved.search === params.toString()) scroller()?.scrollTo({ top: saved.top });
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* storage unavailable: start at the top */
    }
  }, [loadState, params]);

  const openCandidate = (id: string) => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ search: params.toString(), top: scroller()?.scrollTop ?? 0 }));
    } catch {
      /* storage unavailable: nothing to restore later */
    }
    navigate(`/candidates/${id}`);
  };

  const entries = list?.items ?? [];
  const total = list?.total ?? 0;
  const matched = list?.matched ?? 0;
  const filtered = FILTER_KEYS.some((key) => filters[key]);
  const ownerName = (ownerId: string) => {
    const row = list?.items.find((entry) => entry.candidate.ownerId === ownerId);
    return (row && getPerson(row.candidate.owner)?.name) || ownerId;
  };

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
    load();
  };

  const handleDelete = async (candidateId: string) => {
    setDeleting(candidateId);
    try {
      await deleteCandidate(candidateId);
      say(t("Candidate removed from the library"), { type: "success" });
      load();
    } catch {
      say(t("Could not remove this candidate."), { type: "error" });
    }
    setDeleting(null);
    setConfirmingDeleteId(null);
  };

  return (
    <>
      <PageHeader
        title={t("Resume Library")}
        subtitle={t("Every candidate stays here whether or not they’re linked to a job — resumes can arrive before any role exists.")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportTab("paste")}>
              <Icon name="description" />
              {t("Paste profile")}
            </Button>
            <Button variant="primary" onClick={() => setImportTab("upload")}>
              <Icon name="upload" />
              {t("Upload resumes")}
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-12 flex-wrap" style={{ marginBottom: 10 }}>
        <div className="topbar-search" style={{ maxWidth: 360, padding: "7px 14px" }}>
          <Icon name="search" size={17} />
          <input type="text" placeholder={t("Search name, email, tag...")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("Search name, email, tag...")} />
        </div>
        {loadState === "ready" && (
          <span className="tiny muted" data-testid="library-count">
            {state.lang === "zh" ? `共 ${total} 位候选人中的 ${matched} 位` : `${matched} of ${total} candidates`}
          </span>
        )}
      </div>
      <div className="library-filters flex items-center gap-8 flex-wrap" style={{ marginBottom: 16 }} data-testid="library-filters">
        <select aria-label={t("Tag")} value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)}>
          <option value="">{t("All tags")}</option>
          {list?.facets.tags.map((f) => (
            <option key={f.value} value={f.value}>{`${f.value} (${f.count})`}</option>
          ))}
        </select>
        <select aria-label={t("Source")} value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
          <option value="">{t("All sources")}</option>
          {list?.facets.sources.map((f) => (
            <option key={f.value} value={f.value}>{`${t(sourceLabel(f.value))} (${f.count})`}</option>
          ))}
        </select>
        <select aria-label={t("Owner")} value={filters.owner} onChange={(e) => setFilter("owner", e.target.value)}>
          <option value="">{t("All owners")}</option>
          {list?.facets.owners.map((f) => (
            <option key={f.value} value={f.value}>{`${ownerName(f.value)} (${f.count})`}</option>
          ))}
        </select>
        <select aria-label={t("Match status")} value={filters.matchStatus} onChange={(e) => setFilter("matchStatus", e.target.value)}>
          <option value="">{t("All match statuses")}</option>
          {MATCH_STATUSES.map((status) => (
            <option key={status} value={status}>{t(MATCH_STATUS_BADGE[status].label)}</option>
          ))}
        </select>
        <label className="tiny muted flex items-center gap-4">
          {t("Added from")}
          <input type="date" value={filters.addedFrom} max={filters.addedTo || undefined} onChange={(e) => setFilter("addedFrom", e.target.value)} />
        </label>
        <label className="tiny muted flex items-center gap-4">
          {t("to")}
          <input type="date" value={filters.addedTo} min={filters.addedFrom || undefined} onChange={(e) => setFilter("addedTo", e.target.value)} />
        </label>
        {filtered && (
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setQuery("");
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            {t("Clear filters")}
          </Button>
        )}
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
              <th style={{ textAlign: "right" }}>{t("Linked roles")}</th>
              <th>{t("Last matched")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loadState === "loading" ? (
              <tr>
                <td colSpan={8} className="tiny muted" style={{ padding: 24, textAlign: "center" }} data-testid="library-loading" aria-busy="true">
                  {t("Loading candidates…")}
                </td>
              </tr>
            ) : loadState === "error" ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="error"
                    title={t("Couldn't load the library")}
                    body={t("Your candidates are still there — the list just didn't load.")}
                    actions={
                      <Button variant="primary" onClick={load}>
                        {t("Try again")}
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  {total === 0 ? (
                    <EmptyState
                      icon="folder_open"
                      title={t("The library is empty")}
                      body={t("Upload or paste résumés to add candidates — no job is needed.")}
                      actions={
                        <Button variant="primary" onClick={() => setImportTab("upload")}>
                          {t("Upload resumes")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState icon="search_off" title={t("No candidates match your search")} body={t("Try a different name, email or tag.")} />
                  )}
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const { candidate, latestSource } = entry;
                return (
                <tr key={candidate.id} className="clickable" data-candidate-id={candidate.id} onClick={() => openCandidate(candidate.id)}>
                  <td>
                    <Link
                      to={`/candidates/${candidate.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openCandidate(candidate.id);
                      }}
                      className="flex items-center gap-10"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
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
                  <td className="tiny">{t(sourceLabel(latestSource))}</td>
                  <td>
                    <span className="flex items-center gap-8">
                      <PersonAvatar person={getPerson(candidate.owner)} size="sm" /> {getPerson(candidate.owner)?.name}
                    </span>
                  </td>
                  <td>
                    <MatchStatusBadge entry={entry} />
                  </td>
                  <td style={{ textAlign: "right" }} data-testid="linked-roles">
                    {entry.linkedRoleCount}
                  </td>
                  <td className="tiny">{relTime(candidate.lastMatchedAt, state.lang)}</td>
                  <td className="text-right">
                    <span className="flex items-center gap-8" style={{ justifyContent: "flex-end" }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMatchAgain(candidate.id);
                        }}
                        loading={matching === candidate.id || entry.matchStatus === "running"}
                      >
                        {t("Match again")}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(candidate.id);
                        }}
                        disabled={deleting === candidate.id}
                      >
                        {t("Delete")}
                      </Button>
                    </span>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {loadState === "ready" && entries.length < matched && (
        <div className="flex items-center gap-12" style={{ justifyContent: "center", marginTop: 12 }}>
          <span className="tiny muted">{state.lang === "zh" ? `已显示 ${entries.length} / ${matched} 位` : `Showing ${entries.length} of ${matched}`}</span>
          <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore} data-testid="show-more">
            {t("Show more")}
          </Button>
        </div>
      )}
      {confirmingDeleteId && (
        <ConfirmDialog
          open
          onClose={() => setConfirmingDeleteId(null)}
          title={t("Remove candidate")}
          body={t("This permanently removes the candidate and their resume history from the library. This can't be undone.")}
          confirmLabel={t("Delete")}
          danger
          onConfirm={() => handleDelete(confirmingDeleteId)}
        />
      )}
      {importTab && (
        <ResumeImportModal
          initialTab={importTab}
          onClose={() => {
            setImportTab(null);
            load();
          }}
        />
      )}
    </>
  );
}
