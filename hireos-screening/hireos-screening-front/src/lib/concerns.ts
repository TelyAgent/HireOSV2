/** Server concern titles are English templates; translate the known one ("<requirement> is not confirmed"). */
export function concernTitle(title: string, t: (s: string) => string) {
  const m = /^(.*) is not confirmed$/s.exec(title);
  return m ? t("{label} is not confirmed").replace("{label}", m[1]) : title;
}
