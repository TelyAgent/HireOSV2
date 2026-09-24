import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, PageHeader } from "../components/ui/Primitives";
import { TEMPLATES } from "../data/fixtures/templates";
import { fmtDate } from "../lib/format";
import { useStore } from "../store/StoreContext";
import { useStartCreate } from "./NewJobPage";

export function TemplatesPage() {
  const { t, say } = useStore();
  const startCreate = useStartCreate();
  return (
    <MainInner>
      <PageHeader
        title={t("Templates")}
        subtitle={t("Reusable role templates. Cloning a template still requires confirming HC, location and dates.")}
        actions={
          <Button variant="primary" onClick={() => say(t("Template creation flow not built in this prototype"))}>
            <Icon name="add" />
            {t("New template")}
          </Button>
        }
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Template")}</th>
              <th>{t("Last updated")}</th>
              <th>{t("Used by")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TEMPLATES.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  <strong>{tpl.name}</strong>
                </td>
                <td className="tiny">{fmtDate(tpl.updatedAt)}</td>
                <td className="tiny">
                  {tpl.usedBy} {t("jobs")}
                </td>
                <td className="text-right">
                  <Button size="sm" onClick={() => startCreate("template")}>
                    {t("Use template")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MainInner>
  );
}
