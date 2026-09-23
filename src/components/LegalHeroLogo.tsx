import { HeaderLockup } from "@/components/HeaderLockup.tsx";

const HOME_LABEL = "トップへ戻る";

export function LegalHeroLogo() {
  return <HeaderLockup id="legalHome" locale="ja" label={HOME_LABEL} />;
}
