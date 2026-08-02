"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type EIP1193Provider,
} from "viem";
import ThemePicker from "./ThemePicker";

const pulsechain = defineChain({
  id: 369,
  name: "PulseChain",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.pulsechain.com"] } },
  blockExplorers: {
    default: { name: "PulseChain Scan", url: "https://scan.pulsechain.com" },
  },
});

const publicClient = createPublicClient({ chain: pulsechain, transport: http() });

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const burnExchangeAbi = [
  {
    type: "function",
    name: "burnAndClaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "received", type: "uint256" }],
  },
  {
    type: "function",
    name: "reserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalBurned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLimitedDistributed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "exchangeCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "uniqueExchangers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type Pair = {
  key: string;
  burn: string;
  receive: string;
  label: string;
  decimals: number;
  burnAddress: Address;
  receiveAddress: Address;
  exchangeAddress: Address;
};

type PoolStats = {
  totalBurned: bigint;
  totalDistributed: bigint;
  exchanges: bigint;
  uniqueExchangers: bigint;
};

const emptyStats: PoolStats = {
  totalBurned: 0n,
  totalDistributed: 0n,
  exchanges: 0n,
  uniqueExchangers: 0n,
};

// Original PulseChain token addresses are confirmed. Add each limited token and burn exchange after deployment.
const pairs: Pair[] = [
  { key: "cashx", burn: "CashX", receive: "LCashX", label: "Limited CashX", decimals: 18, burnAddress: "0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665", receiveAddress: zeroAddress, exchangeAddress: zeroAddress },
  { key: "distrox", burn: "DistroX", receive: "LDistroX", label: "Limited DistroX", decimals: 18, burnAddress: "0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03", receiveAddress: zeroAddress, exchangeAddress: zeroAddress },
  { key: "divx", burn: "DivX", receive: "LDivX", label: "Limited DivX", decimals: 18, burnAddress: "0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3", receiveAddress: zeroAddress, exchangeAddress: zeroAddress },
  { key: "gsx", burn: "GSX", receive: "LGSX", label: "Limited GSX", decimals: 18, burnAddress: "0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e", receiveAddress: zeroAddress, exchangeAddress: zeroAddress },
];

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(value: bigint, decimals: number, maximumFractionDigits = 2) {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits });
}

function normalizeAmountInput(value: string) {
  const stripped = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = stripped.split(".");
  return fractionParts.length > 0 ? `${whole}.${fractionParts.join("")}` : whole;
}

function formatAmountInput(value: string) {
  if (!value) return "";
  const [whole, fraction] = value.split(".");
  const groupedWhole = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? groupedWhole : `${groupedWhole}.${fraction}`;
}

export default function Home() {
  const [activeKey, setActiveKey] = useState("cashx");
  const [account, setAccount] = useState<Address | null>(null);
  const [amount, setAmount] = useState("");
  const [reserve, setReserve] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [status, setStatus] = useState("Local contract tests passed — live deployment pending");
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [stats, setStats] = useState<PoolStats>(emptyStats);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedAddress, setCopiedAddress] = useState<Address | null>(null);

  const pair = useMemo(
    () => pairs.find((item) => item.key === activeKey) ?? pairs[0],
    [activeKey],
  );
  const configured = pair.exchangeAddress !== zeroAddress;

  async function copyAddress(address: Address, label: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setStatus(`${label} contract address copied`);
      window.setTimeout(() => setCopiedAddress(null), 1800);
    } catch {
      setStatus("Unable to copy the address. Please copy it from the explorer.");
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install a browser wallet such as MetaMask or Rabby to continue.");
      return;
    }

    try {
      const addresses = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as Address[];
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x171" }],
      });
      setAccount(addresses[0]);
      setStatus("Wallet connected on PulseChain");
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x171",
            chainName: "PulseChain",
            nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
            rpcUrls: ["https://rpc.pulsechain.com"],
            blockExplorerUrls: ["https://scan.pulsechain.com"],
          }],
        });
      } else {
        setStatus("Wallet connection was cancelled.");
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPool() {
      try {
        const balancePromise = account
          ? publicClient.readContract({ address: pair.burnAddress, abi: erc20Abi, functionName: "balanceOf", args: [account] })
          : Promise.resolve(0n);

        if (!configured) {
          const nextBalance = await balancePromise;
          if (!cancelled) {
            setReserve(0n);
            setBalance(nextBalance);
            setStats(emptyStats);
          }
          return;
        }

        const [nextReserve, totalBurned, totalDistributed, exchanges, uniqueExchangers, nextBalance] = await Promise.all([
          publicClient.readContract({ address: pair.exchangeAddress, abi: burnExchangeAbi, functionName: "reserve" }),
          publicClient.readContract({ address: pair.exchangeAddress, abi: burnExchangeAbi, functionName: "totalBurned" }),
          publicClient.readContract({ address: pair.exchangeAddress, abi: burnExchangeAbi, functionName: "totalLimitedDistributed" }),
          publicClient.readContract({ address: pair.exchangeAddress, abi: burnExchangeAbi, functionName: "exchangeCount" }),
          publicClient.readContract({ address: pair.exchangeAddress, abi: burnExchangeAbi, functionName: "uniqueExchangers" }),
          balancePromise,
        ]);
        if (!cancelled) {
          setReserve(nextReserve);
          setBalance(nextBalance);
          setStats({ totalBurned, totalDistributed, exchanges, uniqueExchangers });
        }
      } catch {
        if (!cancelled) setStatus("Unable to read this pool right now.");
      }
    }
    loadPool();
    return () => { cancelled = true; };
  }, [account, configured, pair, refreshKey]);

  async function getWallet() {
    if (!window.ethereum || !account) throw new Error("Connect wallet first");
    return createWalletClient({ account, chain: pulsechain, transport: custom(window.ethereum) });
  }

  async function burnAndClaim() {
    if (!account) return connectWallet();
    if (!configured) {
      setStatus("This pool will activate after its verified addresses are added.");
      return;
    }

    try {
      setBusy(true);
      const value = parseUnits(amount, pair.decimals);
      if (value <= 0n) throw new Error("Enter an amount greater than zero");
      if (value > reserve) throw new Error("The pool does not have enough reserves");
      const wallet = await getWallet();
      const allowance = await publicClient.readContract({
        address: pair.burnAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, pair.exchangeAddress],
      });

      if (allowance < value) {
        setStatus(`Approve ${pair.burn} in your wallet`);
        const approvalHash = await wallet.writeContract({
          address: pair.burnAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [pair.exchangeAddress, value],
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setStatus(`Confirm the 1:1 ${pair.burn} burn and claim`);
      const hash = await wallet.writeContract({
        address: pair.exchangeAddress,
        abi: burnExchangeAbi,
        functionName: "burnAndClaim",
        args: [value],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setAmount("");
      setRefreshKey((value) => value + 1);
      setStatus(`${pair.receive} received successfully`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function fundPool() {
    if (!account) return connectWallet();
    if (!configured) {
      setStatus("Add the deployed addresses before funding this pool.");
      return;
    }

    try {
      setBusy(true);
      const value = parseUnits(fundAmount, pair.decimals);
      if (value <= 0n) throw new Error("Enter a refill amount");
      const wallet = await getWallet();
      setStatus(`Approve ${pair.receive} for the burn exchange`);
      const approvalHash = await wallet.writeContract({
        address: pair.receiveAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [pair.exchangeAddress, value],
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      setStatus("Confirm the pool refill");
      const fundHash = await wallet.writeContract({
        address: pair.exchangeAddress,
        abi: burnExchangeAbi,
        functionName: "fund",
        args: [value],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      setFundAmount("");
      setRefreshKey((value) => value + 1);
      setStatus(`${pair.receive} pool refilled`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refill cancelled");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="nav-left" aria-label="Community links">
          <a className="social-icon" href="https://t.me/+Ruw3dQPRTv00NDRl" target="_blank" rel="noreferrer" aria-label="Telegram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" fill="currentColor" />
            </svg>
          </a>
          <a className="social-icon" href="https://x.com/TomkiwMich70997" target="_blank" rel="noreferrer" aria-label="X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
            </svg>
          </a>
          <a className="social-icon" href="https://dexscreener.com/pulsechain/0xda942580cee2a69c5fc74109090816157730c64d" target="_blank" rel="noreferrer" aria-label="DexScreener">
            <svg width="20" height="20" viewBox="0 0 252 300" fill="currentColor" fillRule="evenodd" aria-hidden="true">
              <path d="M151.818 106.866c9.177-4.576 20.854-11.312 32.545-20.541 2.465 5.119 2.735 9.586 1.465 13.193-.9 2.542-2.596 4.753-4.826 6.512-2.415 1.901-5.431 3.285-8.765 4.033-6.326 1.425-13.712.593-20.419-3.197m1.591 46.886 12.148 7.017c-24.804 13.902-31.547 39.716-39.557 64.859-8.009-25.143-14.753-50.957-39.556-64.859l12.148-7.017a5.95 5.95 0 003.84-5.845c-1.113-23.547 5.245-33.96 13.821-40.498 3.076-2.342 6.434-3.518 9.747-3.518s6.671 1.176 9.748 3.518c8.576 6.538 14.934 16.951 13.821 40.498a5.95 5.95 0 003.84 5.845zM126 0c14.042.377 28.119 3.103 40.336 8.406 8.46 3.677 16.354 8.534 23.502 14.342 3.228 2.622 5.886 5.155 8.814 8.071 7.897.273 19.438-8.5 24.796-16.709-9.221 30.23-51.299 65.929-80.43 79.589-.012-.005-.02-.012-.029-.018-5.228-3.992-11.108-5.988-16.989-5.988s-11.76 1.996-16.988 5.988c-.009.005-.017.014-.029.018-29.132-13.66-71.209-49.359-80.43-79.589 5.357 8.209 16.898 16.982 24.795 16.709 2.929-2.915 5.587-5.449 8.814-8.071C69.31 16.94 77.204 12.083 85.664 8.406 97.882 3.103 111.959.377 126 0m-25.818 106.866c-9.176-4.576-20.854-11.312-32.544-20.541-2.465 5.119-2.735 9.586-1.466 13.193.901 2.542 2.597 4.753 4.826 6.512 2.416 1.901 5.432 3.285 8.766 4.033 6.326 1.425 13.711.593 20.418-3.197" />
              <path d="M197.167 75.016c6.436-6.495 12.107-13.684 16.667-20.099l2.316 4.359c7.456 14.917 11.33 29.774 11.33 46.494l-.016 26.532.14 13.754c.54 33.766 7.846 67.929 24.396 99.193l-34.627-27.922-24.501 39.759-25.74-24.231L126 299.604l-41.132-66.748-25.739 24.231-24.501-39.759L0 245.25c16.55-31.264 23.856-65.427 24.397-99.193l.14-13.754-.016-26.532c0-16.721 3.873-31.578 11.331-46.494l2.315-4.359c4.56 6.415 10.23 13.603 16.667 20.099l-2.01 4.175c-3.905 8.109-5.198 17.176-2.156 25.799 1.961 5.554 5.54 10.317 10.154 13.953 4.48 3.531 9.782 5.911 15.333 7.161 3.616.814 7.3 1.149 10.96 1.035-.854 4.841-1.227 9.862-1.251 14.978L53.2 160.984l25.206 14.129a41.926 41.926 0 015.734 3.869c20.781 18.658 33.275 73.855 41.861 100.816 8.587-26.961 21.08-82.158 41.862-100.816a41.865 41.865 0 015.734-3.869l25.206-14.129-32.665-18.866c-.024-5.116-.397-10.137-1.251-14.978 3.66.114 7.344-.221 10.96-1.035 5.551-1.25 10.854-3.63 15.333-7.161 4.613-3.636 8.193-8.399 10.153-13.953 3.043-8.623 1.749-17.689-2.155-25.799l-2.01-4.175z" />
            </svg>
          </a>
          <a className="social-icon" href="https://www.youtube.com/watch?v=UefZfzeoU_M" target="_blank" rel="noreferrer" aria-label="YouTube">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        </div>
        <nav className="nav-center" aria-label="Primary navigation">
          <a className="nav-tab active" href="#pools" aria-current="page">Burn Exchange</a>
        </nav>
        <div className="nav-actions">
          <ThemePicker />
          <button className="wallet-button" type="button" onClick={connectWallet}>
            {account ? shortAddress(account) : "Connect wallet"}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> 1:1 burn exchange on PulseChain</div>
        <h1>Burn the original.<br /><em>Claim the limited.</em></h1>
        <p>Burn supported tokens and claim their limited counterparts. Every exchange is transparent, atomic, and fixed at a 1:1 rate.</p>
        <div className="trust-row">
          <span>◈ Verifiable on-chain</span>
          <span>◎ Separate reserves</span>
          <span>↔ Exact 1:1 output</span>
        </div>
      </section>

      <section className="exchange-section" id="pools">
        <div className="pool-tabs" role="tablist" aria-label="Burn exchange pools">
          {pairs.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={item.key === activeKey}
              className={item.key === activeKey ? "active" : ""}
              onClick={() => { setActiveKey(item.key); setAmount(""); setStatus("Local contract tests passed — live deployment pending"); }}
            >
              <small>{item.burn}</small>
              <strong>{item.receive}</strong>
            </button>
          ))}
        </div>

        <div className="exchange-grid">
          <article className="exchange-card">
            <div className="card-heading">
              <div>
                <h2>{pair.burn} <span>→</span> {pair.receive}</h2>
              </div>
            </div>

            <label className="amount-panel">
              <span>You burn</span>
              <span className="balance">Balance: {account ? formatAmount(balance, pair.decimals, 4) : "—"}</span>
              <div>
                <input
                  inputMode="decimal"
                  aria-label={`${pair.burn} amount to burn and exchange`}
                  placeholder="0.00"
                  value={formatAmountInput(amount)}
                  onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
                />
                <button className="max-button" type="button" onClick={() => setAmount(formatUnits(balance, pair.decimals))}>MAX</button>
                <div className="token-identity">
                  <b>{pair.burn}</b>
                  <button
                    className="copy-address"
                    type="button"
                    title={pair.burnAddress}
                    aria-label={`Copy ${pair.burn} contract address`}
                    onClick={() => copyAddress(pair.burnAddress, pair.burn)}
                  >
                    <span>{shortAddress(pair.burnAddress)}</span>
                    <span aria-hidden="true">{copiedAddress === pair.burnAddress ? "✓" : "⧉"}</span>
                  </button>
                </div>
              </div>
            </label>

            <div className="rate-divider"><span>↓</span><p>1 {pair.burn} = 1 {pair.receive}</p></div>

            <div className="receive-panel">
              <span>You receive</span>
              <div>
                <strong>{amount ? formatAmountInput(amount) : "0.00"}</strong>
                <div className="token-identity">
                  <b>{pair.receive}</b>
                  <span className="address-pending">Address pending</span>
                </div>
              </div>
            </div>

            <div className="pool-meta">
              <span>Available reserve</span>
              <strong>{configured ? formatAmount(reserve, pair.decimals) : "Pending"} {pair.receive}</strong>
            </div>

            <button className="exchange-button" type="button" onClick={burnAndClaim} disabled={busy || !configured}>
              {busy ? "Waiting for confirmation…" : !configured ? `Awaiting ${pair.receive} contract` : account ? `Burn ${pair.burn} & claim ${pair.receive}` : "Connect wallet to continue"}
            </button>
            <p className="status-line" role="status">{status}</p>
          </article>

          <aside className="side-panel">
            <div className="supply-card">
              <span className="card-kicker">POOL STATUS</span>
              <h3>{pair.label}</h3>
              <div className="orb"><span>1:1</span><small>FIXED RATE</small></div>
              <div className="pool-stats" aria-label={`${pair.burn} burn exchange statistics`}>
                <div><span>Total burned</span><strong>{configured ? formatAmount(stats.totalBurned, pair.decimals) : "Pending"}</strong></div>
                <div><span>{pair.receive} distributed</span><strong>{configured ? formatAmount(stats.totalDistributed, pair.decimals) : "Pending"}</strong></div>
                <div><span>Exchanges</span><strong>{configured ? stats.exchanges.toLocaleString() : "—"}</strong></div>
                <div><span>Unique wallets</span><strong>{configured ? stats.uniqueExchangers.toLocaleString() : "—"}</strong></div>
              </div>
              <dl>
                <div><dt>Network</dt><dd>PulseChain</dd></div>
                <div><dt>Input</dt><dd>{pair.burn}</dd></div>
                <div><dt>Output</dt><dd>{pair.receive}</dd></div>
                <div><dt>Mechanism</dt><dd>Burn & transfer</dd></div>
                <div><dt>Burn exchange code</dt><dd className="test-passed">Local tests passed ✓</dd></div>
                <div>
                  <dt>Original contract</dt>
                  <dd className="contract-actions">
                    <a href={`https://scan.pulsechain.com/address/${pair.burnAddress}`} target="_blank" rel="noreferrer">{shortAddress(pair.burnAddress)} ↗</a>
                    <button type="button" title={`Copy ${pair.burn} address`} aria-label={`Copy ${pair.burn} contract address`} onClick={() => copyAddress(pair.burnAddress, pair.burn)}>{copiedAddress === pair.burnAddress ? "✓" : "⧉"}</button>
                  </dd>
                </div>
                <div>
                  <dt>Limited token contract</dt>
                  {pair.receiveAddress === zeroAddress ? (
                    <dd className="address-pending">Pending</dd>
                  ) : (
                    <dd className="contract-actions">
                      <a href={`https://scan.pulsechain.com/address/${pair.receiveAddress}`} target="_blank" rel="noreferrer">{shortAddress(pair.receiveAddress)} ↗</a>
                      <button type="button" title={`Copy ${pair.receive} address`} aria-label={`Copy ${pair.receive} contract address`} onClick={() => copyAddress(pair.receiveAddress, pair.receive)}>{copiedAddress === pair.receiveAddress ? "✓" : "⧉"}</button>
                    </dd>
                  )}
                </div>
                <div>
                  <dt>Burn exchange contract</dt>
                  {pair.exchangeAddress === zeroAddress ? (
                    <dd className="address-pending">Pending</dd>
                  ) : (
                    <dd className="contract-actions">
                      <a href={`https://scan.pulsechain.com/address/${pair.exchangeAddress}`} target="_blank" rel="noreferrer">{shortAddress(pair.exchangeAddress)} ↗</a>
                      <button type="button" title={`Copy ${pair.burn} burn exchange address`} aria-label={`Copy ${pair.burn} burn exchange contract address`} onClick={() => copyAddress(pair.exchangeAddress, `${pair.burn} burn exchange`)}>{copiedAddress === pair.exchangeAddress ? "✓" : "⧉"}</button>
                    </dd>
                  )}
                </div>
              </dl>
            </div>

            {configured && (
              <>
                <button className="admin-toggle" type="button" onClick={() => setAdminOpen((open) => !open)} aria-expanded={adminOpen}>
                  <span>⌁ Owner pool management</span><b>{adminOpen ? "−" : "+"}</b>
                </button>
                {adminOpen && (
                  <div className="admin-panel">
                    <p>Owner refill console</p>
                    <label>
                      <span>{pair.receive} amount</span>
                      <input value={fundAmount} onChange={(event) => setFundAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" />
                    </label>
                    <button type="button" onClick={fundPool} disabled={busy}>Refill {pair.receive} pool</button>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="how-section" id="how">
        <div>
          <span className="section-number">01</span>
          <h3>Choose a pair</h3>
          <p>Select the original token you hold and its matching limited token.</p>
        </div>
        <div>
          <span className="section-number">02</span>
          <h3>Approve & burn</h3>
          <p>Your wallet approves the amount, then the burn exchange permanently burns it.</p>
        </div>
        <div>
          <span className="section-number">03</span>
          <h3>Receive 1:1</h3>
          <p>The matching limited token arrives in the same atomic transaction.</p>
        </div>
      </section>

      <footer>
        <span>LIMITED EXCHANGE</span>
        <p>Built for the community on PulseChain.</p>
        <a href="https://scan.pulsechain.com" target="_blank" rel="noreferrer">View explorer ↗</a>
      </footer>
    </main>
  );
}
