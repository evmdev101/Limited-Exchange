"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./limited-token-insights.css";

type InsightView = "holders" | "activity";

type LimitedToken = {
  key: string;
  name: string;
  symbol: string;
  address: string;
  aliases: string[];
};

type HolderRow = {
  address: string;
  rawBalance: string;
};

type ActivityRow = {
  hash: string;
  from: string;
  to: string;
  rawValue: string;
  decimals: number;
  timestamp: string;
};

const TOKENS: LimitedToken[] = [
  {
    key: "lcashx",
    name: "Limited CashX",
    symbol: "LCASHX",
    address: "0x57cBC908078b291117242385Fe7C0cf3582fA460",
    aliases: ["LCASHX", "LIMITED CASHX"],
  },
  {
    key: "ldistrox",
    name: "Limited DistributionX",
    symbol: "LDISTROX",
    address: "0xfC961146971679Cc4E731F60D72B60eb3dd8b036",
    aliases: ["LDISTROX", "LIMITED DISTRIBUTIONX"],
  },
  {
    key: "ldivx",
    name: "Limited DividendX",
    symbol: "LDIVX",
    address: "0x8DbD0923c0c2dd4973806B655036251610aE11BC",
    aliases: ["LDIVX", "LIMITED DIVIDENDX"],
  },
  {
    key: "lgsx",
    name: "Limited Grand SlamX",
    symbol: "LGSX",
    address: "0xCc6A42F028905096c76E5631aed78e20f5CDDDBa",
    aliases: ["LGSX", "LIMITED GRAND SLAMX"],
  },
];

const API_BASES = [
  "https://api.scan.pulsechain.com/api/v2",
  "https://scan.pulsechain.com/api/v2",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function addressFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "hash" in value) {
    const hash = (value as { hash?: unknown }).hash;
    return typeof hash === "string" ? hash : "";
  }
  return "";
}

function compactAddress(address: string): string {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formattedUnits(rawValue: string, decimals: number, maximumFractionDigits = 4): string {
  try {
    const value = BigInt(rawValue || "0");
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = (value % divisor).toString().padStart(decimals, "0");
    const trimmedFraction = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
    const wholeText = whole.toLocaleString("en-US");
    return trimmedFraction ? `${wholeText}.${trimmedFraction}` : wholeText;
  } catch {
    return "0";
  }
}

function percentageOf(rawValue: string, rawSupply: string): string {
  try {
    const value = BigInt(rawValue || "0");
    const supply = BigInt(rawSupply || "0");
    if (supply === 0n) return "0%";
    const hundredths = (value * 10_000n) / supply;
    return `${(Number(hundredths) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}%`;
  } catch {
    return "0%";
  }
}

function relativeTime(timestamp: string): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function fetchPulseData(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (const base of API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`PulseChain explorer returned ${response.status}`);
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to load PulseChain data");
}

function tokenFromText(text: string): LimitedToken | undefined {
  const normalized = text.toUpperCase().replace(/\s+/g, " ");
  return TOKENS.find((token) => token.aliases.some((alias) => normalized.includes(alias)));
}

export default function LimitedTokenInsights() {
  const [token, setToken] = useState<LimitedToken>(TOKENS[0]);
  const [view, setView] = useState<InsightView>("holders");
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [totalSupply, setTotalSupply] = useState("0");
  const [decimals, setDecimals] = useState(18);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const updateFromElement = (element: Element | null) => {
      if (!element) return;
      const match = tokenFromText(element.textContent || "");
      if (match) setToken((current) => (current.key === match.key ? current : match));
    };

    const activeSelectors = [
      '[role="tab"][aria-selected="true"]',
      ".active",
      "[data-active='true']",
    ];
    activeSelectors.some((selector) => {
      const element = document.querySelector(selector);
      const match = element ? tokenFromText(element.textContent || "") : undefined;
      if (match) {
        setToken(match);
        return true;
      }
      return false;
    });

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest("button, [role='tab'], a")
        : null;
      updateFromElement(target);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([
      fetchPulseData(`/tokens/${token.address}`, controller.signal),
      fetchPulseData(`/tokens/${token.address}/holders`, controller.signal),
      fetchPulseData(`/tokens/${token.address}/transfers`, controller.signal),
    ])
      .then(([metadata, holderResponse, transferResponse]) => {
        const tokenDecimals = Number(metadata.decimals ?? 18);
        setDecimals(Number.isFinite(tokenDecimals) ? tokenDecimals : 18);
        setTotalSupply(String(metadata.total_supply ?? metadata.totalSupply ?? "0"));

        const holderItems = Array.isArray(holderResponse.items) ? holderResponse.items : [];
        setHolders(
          holderItems.slice(0, 25).map((item) => {
            const row = item as Record<string, unknown>;
            return {
              address: addressFrom(row.address),
              rawBalance: String(row.value ?? row.balance ?? "0"),
            };
          }),
        );

        const transferItems = Array.isArray(transferResponse.items) ? transferResponse.items : [];
        setActivity(
          transferItems.slice(0, 25).map((item) => {
            const row = item as Record<string, unknown>;
            const total = row.total && typeof row.total === "object"
              ? (row.total as Record<string, unknown>)
              : {};
            const transferToken = row.token && typeof row.token === "object"
              ? (row.token as Record<string, unknown>)
              : {};
            const rowDecimals = Number(total.decimals ?? transferToken.decimals ?? tokenDecimals ?? 18);
            return {
              hash: String(row.transaction_hash ?? row.tx_hash ?? ""),
              from: addressFrom(row.from),
              to: addressFrom(row.to),
              rawValue: String(total.value ?? row.value ?? row.amount ?? "0"),
              decimals: Number.isFinite(rowDecimals) ? rowDecimals : 18,
              timestamp: String(row.timestamp ?? ""),
            };
          }),
        );
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Unable to load token data");
          setHolders([]);
          setActivity([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, reloadKey]);

  const circulatingHolders = useMemo(
    () => holders.filter((holder) => holder.address.toLowerCase() !== ZERO_ADDRESS),
    [holders],
  );

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  return (
    <section className="limited-insights" aria-label={`${token.name} on-chain data`}>
      <div className="limited-insights__tabs" role="tablist" aria-label="Limited token details">
        <button
          type="button"
          role="tab"
          aria-selected={view === "holders"}
          className={view === "holders" ? "is-active" : ""}
          onClick={() => setView("holders")}
        >
          Holders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "activity"}
          className={view === "activity" ? "is-active" : ""}
          onClick={() => setView("activity")}
        >
          Activity
        </button>
        <span className="limited-insights__token">{token.symbol}</span>
      </div>

      <div className="limited-insights__heading">
        <div>
          <span className="limited-insights__eyebrow">Live on PulseChain</span>
          <h3>{view === "holders" ? `Top ${token.symbol} holders` : `Recent ${token.symbol} activity`}</h3>
        </div>
        <div className="limited-insights__heading-actions">
          <span>{view === "holders" ? `${Math.min(circulatingHolders.length, 25)} holders` : `${Math.min(activity.length, 25)} events`}</span>
          <button type="button" onClick={refresh} aria-label="Refresh on-chain data">↻</button>
        </div>
      </div>

      {loading ? (
        <div className="limited-insights__state">Loading live {token.symbol} data…</div>
      ) : error ? (
        <div className="limited-insights__state limited-insights__state--error">
          <strong>Unable to load live data right now.</strong>
          <span>{error}</span>
          <button type="button" onClick={refresh}>Try again</button>
        </div>
      ) : view === "holders" ? (
        <div className="limited-insights__list" role="tabpanel">
          <div className="limited-insights__columns limited-insights__columns--holders">
            <span>Wallet</span><span>Owned</span><span>% owned</span>
          </div>
          {circulatingHolders.length === 0 ? (
            <div className="limited-insights__state">No holders found yet.</div>
          ) : circulatingHolders.slice(0, 25).map((holder, index) => (
            <a
              className="limited-insights__row limited-insights__row--holder"
              href={`https://scan.pulsechain.com/address/${holder.address}`}
              target="_blank"
              rel="noreferrer"
              key={`${holder.address}-${index}`}
            >
              <div className="limited-insights__wallet">
                <span className="limited-insights__rank">{index + 1}</span>
                <span className="limited-insights__avatar" style={{ "--avatar-index": index } as React.CSSProperties} />
                <span>{compactAddress(holder.address)}</span>
              </div>
              <strong>{formattedUnits(holder.rawBalance, decimals)}</strong>
              <span>{percentageOf(holder.rawBalance, totalSupply)}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="limited-insights__list" role="tabpanel">
          {activity.length === 0 ? (
            <div className="limited-insights__state">No token activity found yet.</div>
          ) : activity.slice(0, 25).map((event, index) => {
            const isMint = event.from.toLowerCase() === ZERO_ADDRESS;
            const isBurn = event.to.toLowerCase() === ZERO_ADDRESS;
            return (
              <div className="limited-insights__row limited-insights__row--activity" key={`${event.hash}-${index}`}>
                <div className="limited-insights__activity-main">
                  <span className={`limited-insights__event-dot ${isMint ? "is-mint" : isBurn ? "is-burn" : ""}`} />
                  <div>
                    <span>
                      {isMint ? "Minted to" : isBurn ? "Burned by" : `${compactAddress(event.from)} →`}{" "}
                      <strong>{compactAddress(isBurn ? event.from : event.to)}</strong>
                    </span>
                    <strong>{formattedUnits(event.rawValue, event.decimals)} {token.symbol}</strong>
                  </div>
                </div>
                <div className="limited-insights__activity-action">
                  <span>{relativeTime(event.timestamp)}</span>
                  {event.hash ? (
                    <a href={`https://scan.pulsechain.com/tx/${event.hash}`} target="_blank" rel="noreferrer">
                      View tx ↗
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
