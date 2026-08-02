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
        <a className="brand" href="#top" aria-label="Limited Exchange home">
          <span className="brand-title">LIMITED EXCHANGE</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#pools">Pools</a>
          <ThemePicker />
          <button className="wallet-button" type="button" onClick={connectWallet}>
            {account ? shortAddress(account) : "Connect wallet"}
          </button>
        </nav>
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
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
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
                <strong>{amount || "0.00"}</strong>
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
