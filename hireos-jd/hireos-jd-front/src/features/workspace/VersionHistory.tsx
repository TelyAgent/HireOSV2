/**
 * JD versions: the publish dialog (creates the next version) and the version history drawer
 * (view a snapshot, compare two versions, restore one as the draft).
 */
import { useState } from "react";
import { Input, Select } from "antd";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import {
  CancelButton,
  ConfirmDialog,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtDate, fmtRelative } from "../../lib/format";
import { coreJobToLocalJob } from "../jobs/jobsMapping";
import { BLOCK_LEVELS, BLOCK_LEVEL_KEYS, blockLevel, blockPlainText, editDocCopy, groupSections, selectDraft } from "./docHelpers";
import { diffBlocks, publishVersion, type BlockDiff, type JdVersion } from "./versions";
import { useDocumentSaver } from "./useDocumentSaver";
import type { BlockLevel } from "../../data/types";

function LevelTag({ level }: { level: BlockLevel }) {
  const { t } = useStore();
  return (
    <span className={`lvl-tag lvl-${level} static`}>
      <Icon name={BLOCK_LEVELS[level].icon} />
      {t(BLOCK_LEVELS[level].label)}
    </span>
  );
}

function personName(id: string) {
  return getPerson(id)?.name ?? id;
}

/** Counts per kind of change, e.g. "+2 added · 1 edited". */
function DiffSummary({ diff }: { diff: BlockDiff }) {
  const { t } = useStore();
  const parts: [number, string, string][] = [
    [diff.added.length, "added", "add"],
    [diff.removed.length, "removed", "del"],
    [diff.edited.length, "edited", "edit"],
    [diff.level.length, "visibility changed", "lvl"],
  ];
  return (
    <div className="ver-summary">
      {parts
        .filter(([n]) => n)
        .map(([n, label, cls]) => (
          <span key={label} className={`ver-chip ${cls}`}>
            {n} {t(label)}
          </span>
        ))}
      {diff.reordered && <span className="ver-chip lvl">{t("reordered")}</span>}
      {!diff.count && <span className="tiny">{t("No differences.")}</span>}
    </div>
  );
}

function DiffList({ diff }: { diff: BlockDiff }) {
  const { t } = useStore();
  const where = (section: string) => (section ? <span className="tiny"> · {section}</span> : null);
  return (
    <div className="ver-diff-list">
      {diff.added.map((x) => (
        <div key={`a-${x.block.id}`} className="ver-diff add">
          <Icon name="add" />
          <div>
            {blockPlainText(x.block)}
            {where(x.section)} <LevelTag level={blockLevel(x.block)} />
          </div>
        </div>
      ))}
      {diff.removed.map((x) => (
        <div key={`r-${x.block.id}`} className="ver-diff del">
          <Icon name="remove" />
          <div>
            {blockPlainText(x.block)}
            {where(x.section)}
          </div>
        </div>
      ))}
      {diff.edited.map((x) => (
        <div key={`e-${x.id}`} className="ver-diff edit">
          <Icon name="edit" />
          <div>
            <span className="ver-old">{x.before}</span>
            <br />
            {x.after}
            {where(x.section)}
          </div>
        </div>
      ))}
      {diff.level.map((x) => (
        <div key={`l-${x.id}`} className="ver-diff lvl">
          <Icon name="visibility" />
          <div>
            {x.text}
            {where(x.section)}
            <div className="tiny">
              {t(BLOCK_LEVELS[x.from].label)} → {t(BLOCK_LEVELS[x.to].label)}
            </div>
          </div>
        </div>
      ))}
      {diff.reordered && (
        <div className="ver-diff lvl">
          <Icon name="swap_vert" />
          <div>{t("Blocks were reordered.")}</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Publish ---------------- */

export function PublishModal({ jobId }: { jobId: string }) {
  const { state, t, mutate, say, closeModal } = useStore();
  const save = useDocumentSaver(jobId);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const info = state.wsVersions[jobId];
  const draft = selectDraft(state, jobId);
  const prev = info?.versions[info.versions.length - 1] ?? null;
  const diff = diffBlocks(prev ? prev.blocks : [], draft.blocks);
  const nextNo = (prev?.versionNo ?? 0) + 1;
  const nothing = !!prev && diff.count === 0;
  const counts = BLOCK_LEVEL_KEYS.map((k) => draft.blocks.filter((b) => blockLevel(b) === k).length);

  const confirm = async () => {
    setBusy(true);
    try {
      // Publish exactly what is saved: save pending edits (or a never-saved document) first.
      let revision = draft.serverRevision ?? null;
      if (draft.saveState !== "saved" || revision == null) revision = await save({ quiet: true });
      if (revision == null) return;
      const res = await publishVersion(jobId, { revision, note: note.trim(), publishedBy: state.currentUserId });
      mutate((d) => {
        const current = d.wsVersions[jobId];
        d.wsVersions = {
          ...d.wsVersions,
          [jobId]: { jdCode: current?.jdCode ?? res.version.code.split("@")[0], versions: [...(current?.versions ?? []), res.version] },
        };
        const j = d.jobs[jobId];
        if (j) d.jobs = { ...d.jobs, [jobId]: coreJobToLocalJob(res.job, j) };
      });
      closeModal();
      say(`${t("Published")} ${res.version.code}`, { type: "success" });
    } catch (error) {
      say(error instanceof Error ? error.message : t("Couldn't publish this job. Please try again."), { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ModalHeader title={t("Publish JD")} />
      <ModalBody>
        <div className="ver-publish-head">
          <span className="jd-id static">
            <Icon name="tag" />
            {info?.jdCode ?? "—"}
          </span>
          <Icon name="arrow_forward" />
          <span className="badge badge-info">
            {t("New version")} v{nextNo}
          </span>
          <span className="tiny">
            {prev ? `${t("Current")}: v${prev.versionNo} · ${fmtRelative(prev.publishedAt)}` : t("First publication")}
          </span>
        </div>
        {nothing ? (
          <div className="info-inline" style={{ margin: "12px 0" }}>
            <Icon name="info" />
            {t("No changes since v{n}.").replace("{n}", String(prev!.versionNo))} {t("Every Publish creates a new version — edit the JD first.")}
          </div>
        ) : (
          <>
            {prev && (
              <div className="field" style={{ marginTop: 14 }}>
                <label className="ver-label">{t("Changes since v{n}").replace("{n}", String(prev.versionNo))}</label>
                <DiffSummary diff={diff} />
                <DiffList diff={diff} />
              </div>
            )}
            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("Version note (optional)")}</label>
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 5 }}
                placeholder={t("What changed and why?")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="info-inline">
          <Icon name="visibility" />
          {t("Only Public blocks are shown externally")} ({counts[0]}). {t("Internal")} ({counts[1]}) / {t("Confidential")} ({counts[2]}){" "}
          {t("blocks stay in HireOS and are kept in the version snapshot.")}
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" disabled={nothing || busy || !info} onClick={() => void confirm()}>
          {busy ? t("Publishing…") : `${t("Publish")} v${nextNo}`}
        </Button>
      </ModalFooter>
    </>
  );
}

/* ---------------- History ---------------- */

type View = { kind: "list" } | { kind: "view"; no: number } | { kind: "compare"; no: number; base: number };

export function VersionHistoryDrawer({ jobId }: { jobId: string }) {
  const { state, t, mutate, say, openModal, closeModal } = useStore();
  const [view, setView] = useState<View>({ kind: "list" });
  const info = state.wsVersions[jobId];
  const versions = info?.versions ?? [];
  const latest = versions[versions.length - 1];
  const draft = selectDraft(state, jobId);
  const byNo = (no: number) => versions.find((v) => v.versionNo === no);

  const restore = (v: JdVersion) =>
    openModal(
      <ConfirmDialog
        title={`${t("Restore")} v${v.versionNo} ${t("as the draft?")}`}
        body={t("The current draft is replaced by this snapshot. Nothing is published until you press Publish, which then creates the next version — this version itself never changes.")}
        confirmLabel={t("Restore")}
        onConfirm={() => {
          mutate((d) => {
            editDocCopy(d, jobId, (doc) => {
              doc.blocks = v.blocks.map((b) => ({ ...b, text: Array.isArray(b.text) ? [...b.text] : b.text }));
              if (v.meta) doc.meta = v.meta;
              doc.revision++;
              doc.saveState = "dirty";
            });
          });
          closeModal();
          say(`${t("Restored")} v${v.versionNo} ${t("into the draft")}`, { type: "success" });
        }}
      />,
    );

  if (view.kind === "view") {
    const v = byNo(view.no);
    if (!v) return null;
    const prev = byNo(v.versionNo - 1);
    return (
      <>
        <DrawerHeader title={`${v.code} · ${v.title}`} />
        <DrawerBody>
          <div className="card card-pad ver-meta">
            <div>
              <span>{t("Published")}</span>
              <strong>
                {fmtDate(v.publishedAt)} · {personName(v.publishedBy)}
              </strong>
            </div>
            {v.note && (
              <div>
                <span>{t("Note")}</span>
                <strong>{v.note}</strong>
              </div>
            )}
          </div>
          <div className="eyebrow" style={{ margin: "14px 0 8px" }}>
            {t("Snapshot (read-only)")}
          </div>
          {groupSections(v.blocks).map((sec, i) => (
            <div key={sec.head?.id ?? i} className="ver-sec">
              {sec.head && (
                <div className="ver-row head">
                  <span className="ver-txt">{blockPlainText(sec.head)}</span>
                  <LevelTag level={blockLevel(sec.head)} />
                </div>
              )}
              {sec.blocks.map((b) => (
                <div key={b.id} className={`ver-row${b.kind === "ul" ? " li" : ""}`}>
                  <span className="ver-txt">{blockPlainText(b)}</span>
                  <LevelTag level={blockLevel(b)} />
                </div>
              ))}
            </div>
          ))}
        </DrawerBody>
        <DrawerFooter>
          <Button onClick={() => setView({ kind: "list" })}>{t("Back")}</Button>
          {prev && (
            <Button onClick={() => setView({ kind: "compare", no: v.versionNo, base: prev.versionNo })}>
              {t("Compare with")} v{prev.versionNo}
            </Button>
          )}
          {v !== latest && <Button onClick={() => restore(v)}>{t("Restore as draft")}</Button>}
        </DrawerFooter>
      </>
    );
  }

  if (view.kind === "compare") {
    const nv = byNo(view.no);
    const ov = byNo(view.base);
    if (!nv || !ov) return null;
    const diff = diffBlocks(ov.blocks, nv.blocks);
    return (
      <>
        <DrawerHeader title={`${t("Compare")} v${ov.versionNo} → v${nv.versionNo}`} />
        <DrawerBody>
          <div className="field">
            <label className="ver-label">{t("Compare v{n} against").replace("{n}", String(nv.versionNo))}</label>
            <Select
              value={ov.versionNo}
              style={{ width: 240 }}
              options={versions
                .filter((x) => x.versionNo < nv.versionNo)
                .map((x) => ({ value: x.versionNo, label: `v${x.versionNo} — ${fmtDate(x.publishedAt)}` }))}
              onChange={(base) => setView({ kind: "compare", no: nv.versionNo, base })}
            />
          </div>
          <DiffSummary diff={diff} />
          <DiffList diff={diff} />
        </DrawerBody>
        <DrawerFooter>
          <Button onClick={() => setView({ kind: "view", no: nv.versionNo })}>{t("Back")}</Button>
        </DrawerFooter>
      </>
    );
  }

  const pending = latest ? diffBlocks(latest.blocks, draft.blocks) : null;
  return (
    <>
      <DrawerHeader title={t("Version history")} />
      <DrawerBody>
        <div className="ver-publish-head" style={{ marginBottom: 12 }}>
          <span className="jd-id static">
            <Icon name="tag" />
            {info?.jdCode ?? "—"}
          </span>
          <span className="tiny">{t("Every Publish creates a new version. History is kept so every change can be traced.")}</span>
        </div>
        {pending && pending.count > 0 && (
          <div className="ver-item draft">
            <div className="ver-item-top">
              <strong>{t("Draft")}</strong>
              <span className="badge badge-warning">{t("Unpublished changes")}</span>
            </div>
            <DiffSummary diff={pending} />
          </div>
        )}
        {!versions.length && <div className="tiny">{t("Not published yet — the first Publish creates v1.")}</div>}
        {[...versions].reverse().map((v) => {
          const prev = byNo(v.versionNo - 1);
          return (
            <div key={v.versionNo} className="ver-item">
              <div className="ver-item-top">
                <strong>v{v.versionNo}</strong>
                {v === latest && <span className="badge badge-success">{t("Latest")}</span>}
                <span className="tiny">
                  {fmtDate(v.publishedAt)} · {personName(v.publishedBy)}
                </span>
                <div style={{ flex: 1 }} />
                <Button variant="text" size="sm" onClick={() => setView({ kind: "view", no: v.versionNo })}>
                  {t("View")}
                </Button>
                {prev && (
                  <Button variant="text" size="sm" onClick={() => setView({ kind: "compare", no: v.versionNo, base: prev.versionNo })}>
                    {t("Compare")}
                  </Button>
                )}
                {v !== latest && (
                  <Button variant="text" size="sm" onClick={() => restore(v)}>
                    {t("Restore")}
                  </Button>
                )}
              </div>
              {v.note && <div className="ver-note">{v.note}</div>}
              {prev ? <DiffSummary diff={diffBlocks(prev.blocks, v.blocks)} /> : <div className="tiny">{t("First publication")}</div>}
            </div>
          );
        })}
      </DrawerBody>
    </>
  );
}
