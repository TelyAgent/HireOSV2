/**
 * "Fill in by format" for the public salary range (completeness standard F1): min / max (always in K) /
 * currency / period / gross-or-net, written into the document as one standard line so it always
 * passes the F1 check and can be compared with the internal ceiling (X5).
 */
import { useState } from "react";
import { InputNumber, Radio, Select } from "antd";
import { Button } from "../../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { CURRENCY_ZH, salaryText } from "../../lib/format";
import { SALARY_TAX, currencyOf, detectLanguage, filledBlocks, findSection, parseMoney, REQ_ITEMS } from "./completeness";
import { blockPlainText, groupSections, selectDraft } from "./docHelpers";
import { useDocActions } from "./docActions";

export const CURRENCIES = ["CNY", "USD", "SGD", "HKD", "EUR", "GBP", "JPY", "VND"];

/** The standard line, in the document's language. Amounts are in thousands (K). */
export function salaryLine(o: { min: number; max: number; currency: string; period: "month" | "year"; tax: "gross" | "net" }, lang: "zh" | "en") {
  return salaryText({ min: o.min * 1000, max: o.max * 1000, currency: o.currency, period: o.period, basis: o.tax }, lang);
}

export function SalaryModal({ jobId }: { jobId: string }) {
  const { state, t, closeModal } = useStore();
  const actions = useDocActions(jobId);
  const blocks = selectDraft(state, jobId).blocks;
  const lang = detectLanguage(blocks) ?? (state.lang === "zh" ? "zh" : "en");

  // Pre-fill from what the salary line already says.
  const f1 = REQ_ITEMS.find((i) => i.id === "F1")!;
  const existing = filledBlocks(findSection(groupSections(blocks), f1, blocks).sec, f1)[0];
  const text = existing ? blockPlainText(existing) : "";
  const parsed = text ? parseMoney(text) : null;
  const amounts = parsed?.amounts ?? [];
  const [min, setMin] = useState<number | null>(amounts.length ? Math.min(...amounts) / 1000 : null);
  const [max, setMax] = useState<number | null>(amounts.length > 1 ? Math.max(...amounts) / 1000 : null);
  const [currency, setCurrency] = useState(currencyOf(text) ?? (lang === "zh" ? "CNY" : "USD"));
  const [period, setPeriod] = useState<"month" | "year">(parsed?.period ?? "month");
  const [tax, setTax] = useState<"gross" | "net">(SALARY_TAX.test(text) && /税后|net\b|after-?tax/i.test(text) ? "net" : "gross");

  const valid = min != null && max != null && min > 0 && max >= min;
  const line = valid ? salaryLine({ min, max, currency, period, tax }, lang) : "";

  return (
    <>
      <ModalHeader title={t("Public salary range")} />
      <ModalBody>
        <div className="salary-form">
          <div className="field">
            <label>{t("Range")}</label>
            <div className="salary-range">
              <InputNumber min={0} value={min} onChange={(v) => setMin(v)} placeholder={t("Min")} />
              <span>–</span>
              <InputNumber min={0} value={max} onChange={(v) => setMax(v)} placeholder={t("Max")} />
              <span className="salary-unit">K</span>
            </div>
          </div>
          <div className="field">
            <label>{t("Currency")}</label>
            <Select value={currency} style={{ width: 200 }} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${CURRENCY_ZH[c]}` }))} />
          </div>
          <div className="field">
            <label>{t("Pay period")}</label>
            <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} optionType="button">
              <Radio.Button value="month">{t("Monthly")}</Radio.Button>
              <Radio.Button value="year">{t("Yearly")}</Radio.Button>
            </Radio.Group>
          </div>
          <div className="field">
            <label>{t("Gross / net")}</label>
            <Radio.Group value={tax} onChange={(e) => setTax(e.target.value)} optionType="button">
              <Radio.Button value="gross">{t("Gross (pre-tax)")}</Radio.Button>
              <Radio.Button value="net">{t("Net (after tax)")}</Radio.Button>
            </Radio.Group>
          </div>
          <div className="field">
            <label>{t("Preview")}</label>
            <div className="salary-preview">{line || <span className="tiny">{t("Enter a min and max (max ≥ min).")}</span>}</div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            actions.setSalaryLine(line);
            closeModal();
          }}
        >
          {existing ? t("Replace in document") : t("Add to document")}
        </Button>
      </ModalFooter>
    </>
  );
}
