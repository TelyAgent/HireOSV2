import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { pasteProfile } from "../../data/api/library";
import { Button } from "../../components/ui/Primitives";

export function PasteTab() {
  const { t, say } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      say(t("Name is required"), { type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const candidate = await pasteProfile({ name, email, location, notes });
      say(`${name} ${t("added to Resume Library")}`, { type: "success" });
      navigate(`/candidates/${candidate.id}`);
    } catch {
      say(t("Could not add this candidate."), { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="section-title">{t("Paste profile")}</div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Add a candidate from structured information instead of a file. No job needs to be selected — this still saves to the Resume Library.")}
      </p>
      <div className="field">
        <label>{t("Full name")}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nina Torres" />
      </div>
      <div className="flex gap-16">
        <div className="field" style={{ flex: 1 }}>
          <label>{t("Email")}</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{t("Location")}</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State, Country" />
        </div>
      </div>
      <div className="field">
        <label>{t("Background / notes")}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Paste a summary, LinkedIn profile text, or notes from a conversation")} />
      </div>
      <Button variant="primary" icon="add" onClick={submit} disabled={submitting}>
        {t("Add to library")}
      </Button>
    </div>
  );
}
