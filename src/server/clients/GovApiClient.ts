import { parseEposHtml, extractTotalsFromHtml } from "@/lib/parser";
import type { Transaction } from "@/types";

const EPOS_URL = "https://epos.mahafood.gov.in/FPS_Trans_Details.jsp";

export interface GovApiResult {
  transactions: Transaction[];
  totals: ReturnType<typeof extractTotalsFromHtml>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps the government ePOS transaction endpoint. Reuses the existing
 * cheerio-based HTML parser rather than duplicating parsing logic.
 *
 * This gov server's TLS handshake is observed to be intermittently flaky
 * (connection reset before the handshake completes, unrelated to request
 * content) — retried a few times with backoff before giving up.
 */
export class GovApiClient {
  async fetchTransactions(
    distCode: string,
    fpsId: string,
    month: string,
    year: string,
    maxAttempts = 4
  ): Promise<GovApiResult> {
    const formBody = `dist_code=${encodeURIComponent(distCode)}&fps_id=${encodeURIComponent(
      fpsId
    )}&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`;

    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(EPOS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            Accept: "text/html",
          },
          body: formBody,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`ePOS API returned status ${response.status}`);
        }

        const html = await response.text();
        const transactions = parseEposHtml(html);
        const totals = extractTotalsFromHtml(html);

        return { transactions, totals };
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts - 1) {
          await sleep(300 * 2 ** attempt + Math.random() * 200);
        }
      }
    }

    throw new Error(
      `Failed to reach ePOS API after ${maxAttempts} attempts: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`
    );
  }
}
