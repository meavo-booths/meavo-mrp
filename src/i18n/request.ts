import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * Server-side message loader for next-intl.
 * Loads the right messages bundle based on the URL locale.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? (requested as Locale)
      : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Use Sofia time for date/number formatting on the server.
    timeZone: "Europe/Sofia",
  };
});
