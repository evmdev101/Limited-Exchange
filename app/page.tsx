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

const vaultAbi = [
  {
    type: "function",
    name: "redeem",
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
] as const;

type Pair = {
  key: string;
  burn: string;
  receive: string;
  label: string;
  decimals: number;
  burnAddress: Address;
  receiveAddress: Address;
  vaultAddress: Address;
};

// Replace these addresses after the four vaults and eight token contracts are confirmed.
const pairs: Pair[] = [
  { key: "cashx", burn: "CashX", receive: "LCashX", label: "Limited CashX", decimals: 18, burnAddress: zeroAddress, receiveAddress: zeroAddress, vaultAddress: zeroAddress },
  { key: "distrox", burn: "DistroX", receive: "LDistroX", label: "Limited DistroX", decimals: 18, burnAddress: zeroAddress, receiveAddress: zeroAddress, vaultAddress: zeroAddress },
  { key: "divx", burn: "DivX", receive: "LDivX", label: "Limited DivX", decimals: 18, burnAddress: zeroAddress, receiveAddress: zeroAddress, vaultAddress: zeroAddress },
  { key: "gsx", burn: "GSX", receive: "LGSX", label: "Limited GSX", decimals: 18, burnAddress: zeroAddress, receiveAddress: zeroAddress, vaultAddress: zeroAddress },
];

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const [activeKey, setActiveKey] = useState("cashx");
  const [account, setAccount] = useState<Address | null>(null);
  const [amount, setAmount] = useState("");
  const [reserve, setReserve] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [status, setStatus] = useState("Ready to redeem");
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("");

  const pair = useMemo(
    () => pairs.find((item) => item.key === activeKey) ?? pairs[0],
    [activeKey],
  );
  const configured = pair.vaultAddress !== zeroAddress;

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
    if (!configured) {
      setReserve(0n);
      setBalance(0n);
      return;
    }

    let cancelled = false;
    async function loadPool() {
      try {
        const reads: Promise<bigint>[] = [
          publicClient.readContract({ address: pair.vaultAddress, abi: vaultAbi, functionName: "reserve" }),
        ];
        if (account) {
          reads.push(publicClient.readContract({ address: pair.burnAddress, abi: erc20Abi, functionName: "balanceOf", args: [account] }));
        }
        const values = await Promise.all(reads);
        if (!cancelled) {
          setReserve(values[0]);
          setBalance(values[1] ?? 0n);
        }
      } catch {
        if (!cancelled) setStatus("Unable to read this pool right now.");
      }
    }
    loadPool();
    return () => { cancelled = true; };
  }, [account, configured, pair]);

  async function getWallet() {
    if (!window.ethereum || !account) throw new Error("Connect wallet first");
    return createWalletClient({ account, chain: pulsechain, transport: custom(window.ethereum) });
  }

  async function redeem() {
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
        args: [account, pair.vaultAddress],
      });

      if (allowance < value) {
        setStatus(`Approve ${pair.burn} in your wallet`);
        const approvalHash = await wallet.writeContract({
          address: pair.burnAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [pair.vaultAddress, value],
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      setStatus(`Confirm the 1:1 ${pair.burn} redemption`);
      const hash = await wallet.writeContract({
        address: pair.vaultAddress,
        abi: vaultAbi,
        functionName: "redeem",
        args: [value],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setAmount("");
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
      setStatus(`Approve ${pair.receive} for the vault`);
      const approvalHash = await wallet.writeContract({
        address: pair.receiveAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [pair.vaultAddress, value],
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      setStatus("Confirm the pool refill");
      const fundHash = await wallet.writeContract({
        address: pair.vaultAddress,
        abi: vaultAbi,
        functionName: "fund",
        args: [value],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      setFundAmount("");
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
        <a className="brand" href="#top" aria-label="Nexion Limited home">
          <span className="brand-mark">N</span>
          <span><b>NEXION</b><small>LIMITED EXCHANGE</small></span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#pools">Pools</a>
          <button className="wallet-button" type="button" onClick={connectWallet}>
            {account ? shortAddress(account) : "Connect wallet"}
          </button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> 1:1 token redemption on PulseChain</div>
        <h1>Burn the original.<br /><em>Claim the limited.</em></h1>
        <p>Exchange supported Nexion ecosystem tokens for their limited counterparts. Every redemption is transparent, atomic, and fixed at a 1:1 rate.</p>
        <div className="trust-row">
          <span>◈ Verifiable on-chain</span>
          <span>◎ Separate reserves</span>
          <span>↔ Exact 1:1 output</span>
        </div>
      </section>

      <section className="exchange-section" id="pools">
        <div className="pool-tabs" role="tablist" aria-label="Redemption pools">
          {pairs.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={item.key === activeKey}
              className={item.key === activeKey ? "active" : ""}
              onClick={() => { setActiveKey(item.key); setAmount(""); setStatus("Ready to redeem"); }}
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
                <span className="card-kicker">ACTIVE PAIR</span>
                <h2>{pair.burn} <span>→</span> {pair.receive}</h2>
              </div>
              <span className={`network-pill ${configured ? "live" : "pending"}`}>
                {configured ? "● LIVE" : "● AWAITING DEPLOYMENT"}
              </span>
            </div>

            <label className="amount-panel">
              <span>You burn</span>
              <span className="balance">Balance: {account ? Number(formatUnits(balance, pair.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</span>
              <div>
                <input
                  inputMode="decimal"
                  aria-label={`${pair.burn} amount to redeem`}
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                />
                <button type="button" onClick={() => setAmount(formatUnits(balance, pair.decimals))}>MAX</button>
                <b>{pair.burn}</b>
              </div>
            </label>

            <div className="rate-divider"><span>↓</span><p>1 {pair.burn} = 1 {pair.receive}</p></div>

            <div className="receive-panel">
              <span>You receive</span>
              <div><strong>{amount || "0.00"}</strong><b>{pair.receive}</b></div>
            </div>

            <div className="pool-meta">
              <span>Available reserve</span>
              <strong>{configured ? Number(formatUnits(reserve, pair.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "Pending"} {pair.receive}</strong>
            </div>

            <button className="redeem-button" type="button" onClick={redeem} disabled={busy}>
              {busy ? "Waiting for confirmation…" : account ? `Burn ${pair.burn} & claim ${pair.receive}` : "Connect wallet to continue"}
            </button>
            <p className="status-line" role="status">{status}</p>
          </article>

          <aside className="side-panel">
            <div className="supply-card">
              <span className="card-kicker">POOL STATUS</span>
              <h3>{pair.label}</h3>
              <div className="orb"><span>1:1</span><small>FIXED RATE</small></div>
              <dl>
                <div><dt>Network</dt><dd>PulseChain</dd></div>
                <div><dt>Input</dt><dd>{pair.burn}</dd></div>
                <div><dt>Output</dt><dd>{pair.receive}</dd></div>
                <div><dt>Mechanism</dt><dd>Burn & transfer</dd></div>
              </dl>
            </div>

            <button className="admin-toggle" type="button" onClick={() => setAdminOpen((open) => !open)} aria-expanded={adminOpen}>
              <span>⌁ Pool management</span><b>{adminOpen ? "−" : "+"}</b>
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
          <p>Your wallet approves the amount, then the vault permanently burns it.</p>
        </div>
        <div>
          <span className="section-number">03</span>
          <h3>Receive 1:1</h3>
          <p>The matching limited token arrives in the same atomic transaction.</p>
        </div>
      </section>

      <footer>
        <span>NEXION // LIMITED EXCHANGE</span>
        <p>Built for the Nexion community on PulseChain.</p>
        <a href="https://scan.pulsechain.com" target="_blank" rel="noreferrer">View explorer ↗</a>
      </footer>
    </main>
  );
}
